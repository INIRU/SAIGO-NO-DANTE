/**
 * IP 기반 in-memory sliding window rate limiter
 * 서버리스 환경에서는 인스턴스별 별도 카운트되지만 기본 방어 제공
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

const WINDOW_MS = 60_000       // 1분 윈도우
const CLEANUP_INTERVAL = 300_000 // 5분마다 만료 엔트리 정리

/** 버킷별 최대 요청 수 (1분 윈도우 기준) */
const BUCKET_LIMITS: Record<string, number> = {
  write:    30,   // 쓰기 API (POST/PUT/PATCH/DELETE)
  readonly: 120,  // 공개 GET API (scraper 방어)
}

let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - WINDOW_MS
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff)
    if (entry.timestamps.length === 0) store.delete(key)
  }
}

export function checkRateLimit(
  ip: string,
  bucket: 'write' | 'readonly' = 'write',
): { allowed: boolean; retryAfter?: number } {
  cleanup()

  const maxRequests = BUCKET_LIMITS[bucket]
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const storeKey = `${bucket}:${ip}`
  const entry = store.get(storeKey)

  if (!entry) {
    store.set(storeKey, { timestamps: [now] })
    return { allowed: true }
  }

  // 윈도우 밖 타임스탬프 제거
  entry.timestamps = entry.timestamps.filter(t => t > cutoff)

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000)
    return { allowed: false, retryAfter: Math.max(1, retryAfter) }
  }

  entry.timestamps.push(now)
  return { allowed: true }
}
