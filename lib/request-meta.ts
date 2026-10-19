import type { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

export type RequestMetadata = {
  ip: string | null
  ipHash: string | null
  ipMasked: string | null
  userAgentHash: string | null
  country: string | null
}

function getHashSecret(): string | null {
  return process.env.IP_HASH_SECRET || process.env.NEXTAUTH_SECRET || null
}

function getFirstHeaderValue(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim()
  if (!first || first.toLowerCase() === 'unknown') return null
  return first
}

function getCountryHeaderValue(value: string | null): string | null {
  const country = getFirstHeaderValue(value)
  if (!country) return null
  const normalized = country.toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

function stripPort(value: string): string {
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end > 0 ? value.slice(1, end) : value
  }
  const colonCount = (value.match(/:/g) ?? []).length
  if (colonCount === 1) return value.split(':')[0] ?? value
  return value
}

function maskIp(value: string | null): string | null {
  if (!value) return null
  const ip = stripPort(value)
  const ipv4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) return `${ipv4Match[1]}.${ipv4Match[2]}.${ipv4Match[3]}.0`

  if (ip.includes(':')) {
    const parts = ip.split(':')
    return `${parts.slice(0, 4).join(':')}::`
  }

  return null
}

function keyedHash(value: string | null): string | null {
  const secret = getHashSecret()
  if (!value || !secret) return null
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function hashDeviceToken(token: string | null): string | null {
  return keyedHash(token)
}

/**
 * The visitor address from the header the host overwrites: Cloudflare's on the self-hosted server (a client can prefix
 * X-Forwarded-For there), X-Forwarded-For on Vercel (where anyone can send CF-Connecting-IP).
 */
export function getClientIp(headers: Headers): string | null {
  if (process.env.SELF_HOSTED === '1') return getFirstHeaderValue(headers.get('cf-connecting-ip'))
  return getFirstHeaderValue(headers.get('x-forwarded-for')) ?? getFirstHeaderValue(headers.get('x-real-ip'))
}

export function getRequestMetadata(request: NextRequest | Request): RequestMetadata {
  const headers = request.headers
  const ip = getClientIp(headers)
  const normalizedIp = ip ? stripPort(ip) : null
  const userAgent = headers.get('user-agent')?.trim() || null

  return {
    ip: maskIp(normalizedIp),
    ipHash: keyedHash(normalizedIp),
    ipMasked: maskIp(normalizedIp),
    userAgentHash: keyedHash(userAgent),
    country:
      getCountryHeaderValue(headers.get('x-vercel-ip-country')) ??
      getCountryHeaderValue(headers.get('cf-ipcountry')) ??
      getCountryHeaderValue(headers.get('x-country-code')),
  }
}
