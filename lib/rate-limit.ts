import { createHash, createHmac } from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

interface RateLimitEntry {
  timestamps: number[]
}

type RateLimitBucket = 'write' | 'readonly' | 'comment' | 'create' | 'rating' | 'report' | 'sample'

type RateLimitConfig = {
  maxRequests: number
  windowMs: number
}

type RequestRateLimitOptions = {
  bucket?: RateLimitBucket
  scope: string
  userId?: string | null
  authenticatedKey?: string | null
}

const store = new Map<string, RateLimitEntry>()

const CLEANUP_INTERVAL = 300_000 // 5분마다 만료 엔트리 정리

/** 버킷별 제한. 서버리스 환경에서는 인스턴스별로만 적용되는 기본 방어선이다. */
const BUCKET_LIMITS: Record<RateLimitBucket, RateLimitConfig> = {
  write: { maxRequests: 30, windowMs: 60_000 },
  readonly: { maxRequests: 120, windowMs: 60_000 },
  comment: { maxRequests: 10, windowMs: 60_000 },
  create: { maxRequests: 6, windowMs: 60_000 },
  rating: { maxRequests: 15, windowMs: 60_000 },
  report: { maxRequests: 5, windowMs: 60_000 },
  sample: { maxRequests: 30, windowMs: 86_400_000 },
}

let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of store) {
    // Keys start with their bucket, so a day-long window does not keep minute buckets around for a day.
    const cutoff = now - (BUCKET_LIMITS[key.slice(0, key.indexOf(':')) as RateLimitBucket]?.windowMs ?? 60_000)
    entry.timestamps = entry.timestamps.filter(t => t > cutoff)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}

function getHashSecret(): string | null {
  return process.env.IP_HASH_SECRET || process.env.NEXTAUTH_SECRET || null
}

function stableHash(value: string): string {
  const secret = getHashSecret()
  const hash = secret
    ? createHmac('sha256', secret)
    : createHash('sha256')
  return hash.update(value).digest('hex')
}

function getFirstHeaderValue(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim()
  if (!first || first.toLowerCase() === 'unknown') return null
  return first
}

function getFallbackRequestIdentity(request: NextRequest | Request): string {
  const ip = getFirstHeaderValue(request.headers.get('x-forwarded-for'))
    ?? getFirstHeaderValue(request.headers.get('x-real-ip'))
  if (ip) return `ip:${stableHash(ip)}`

  const userAgent = request.headers.get('user-agent')?.trim()
  if (userAgent) return `ua:${stableHash(userAgent)}`

  return 'unknown'
}

function buildRequestRateLimitKey(
  request: NextRequest | Request,
  options: RequestRateLimitOptions,
): string {
  const userId = options.userId?.trim()
  const authenticatedKey = options.authenticatedKey?.trim()
  const identity = userId
    ? `user:${stableHash(userId)}`
    : authenticatedKey
      ? `auth:${stableHash(authenticatedKey)}`
      : getFallbackRequestIdentity(request)

  return `${options.scope}:${identity}`
}

export function checkRateLimit(
  identifier: string,
  bucket: RateLimitBucket = 'write',
): { allowed: boolean; retryAfter?: number } {
  cleanup()

  const config = BUCKET_LIMITS[bucket]
  const now = Date.now()
  const cutoff = now - config.windowMs
  const storeKey = `${bucket}:${stableHash(identifier || 'unknown')}`
  const entry = store.get(storeKey)

  if (!entry) {
    store.set(storeKey, { timestamps: [now] })
    return { allowed: true }
  }

  // 윈도우 밖 타임스탬프 제거
  entry.timestamps = entry.timestamps.filter(t => t > cutoff)

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfter = Math.ceil((oldestInWindow + config.windowMs - now) / 1000)
    return { allowed: false, retryAfter: Math.max(1, retryAfter) }
  }

  entry.timestamps.push(now)
  return { allowed: true }
}

export function checkRequestRateLimit(
  request: NextRequest | Request,
  options: RequestRateLimitOptions,
): { allowed: boolean; retryAfter?: number } {
  return checkRateLimit(
    buildRequestRateLimitKey(request, options),
    options.bucket ?? 'write',
  )
}

export function rateLimitResponse(result: { retryAfter?: number }) {
  return NextResponse.json(
    { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    {
      status: 429,
      headers: { 'Retry-After': String(result.retryAfter ?? 60) },
    },
  )
}
