import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getClientIp, getRequestMetadata } from '@/lib/request-meta'

// A client can send any X-Forwarded-For; Cloudflare appends the real address after it.
const spoofed = () => new Headers({ 'x-forwarded-for': '6.6.6.6, 1.2.3.4', 'cf-connecting-ip': '1.2.3.4', 'x-real-ip': '9.9.9.9' })

afterEach(() => vi.unstubAllEnvs())

describe('REQ-SHARED-048 trusted visitor IP', () => {
  it('REQ-SHARED-048 the self-hosted server trusts only CF-Connecting-IP', () => {
    vi.stubEnv('SELF_HOSTED', '1')
    expect(getClientIp(spoofed())).toBe('1.2.3.4')
    expect(getClientIp(new Headers({ 'x-forwarded-for': '6.6.6.6' }))).toBeNull()
  })

  it('REQ-SHARED-048 elsewhere X-Forwarded-For wins and a sent CF-Connecting-IP is ignored', () => {
    vi.stubEnv('SELF_HOSTED', '')
    expect(getClientIp(spoofed())).toBe('6.6.6.6')
    expect(getClientIp(new Headers({ 'x-real-ip': '9.9.9.9', 'cf-connecting-ip': '1.2.3.4' }))).toBe('9.9.9.9')
  })

  it('REQ-SHARED-048 request metadata hashes the same address', () => {
    vi.stubEnv('IP_HASH_SECRET', 'test')
    vi.stubEnv('SELF_HOSTED', '1')
    const selfHosted = getRequestMetadata(new Request('https://example.test', { headers: spoofed() })).ipHash
    vi.stubEnv('SELF_HOSTED', '')
    const elsewhere = getRequestMetadata(new Request('https://example.test', { headers: spoofed() })).ipHash
    expect(selfHosted).toBe(getRequestMetadata(new Request('https://example.test', { headers: { 'x-forwarded-for': '1.2.3.4' } })).ipHash)
    expect(elsewhere).not.toBe(selfHosted)
  })

  it('REQ-SHARED-071 behind CloudFront trusts the viewer address only with the origin secret', () => {
    vi.stubEnv('SELF_HOSTED', '1')
    vi.stubEnv('ORIGIN_VERIFY_SECRET', 'origin-secret')
    // Cloudflare sees CloudFront, so CF-Connecting-IP is the edge; the CloudFront function writes the visitor to x-viewer-ip.
    const viaCloudFront = (secret?: string) => new Headers({ 'cf-connecting-ip': '13.0.0.1', 'x-viewer-ip': '5.5.5.5', ...(secret === undefined ? {} : { 'x-origin-verify': secret }) })
    expect(getClientIp(viaCloudFront('origin-secret'))).toBe('5.5.5.5')
    expect(getClientIp(viaCloudFront('guess'))).toBe('13.0.0.1')
    expect(getClientIp(viaCloudFront())).toBe('13.0.0.1')
    vi.stubEnv('ORIGIN_VERIFY_SECRET', '')
    expect(getClientIp(viaCloudFront(''))).toBe('13.0.0.1')
  })

  it('REQ-SHARED-048 rate limits and votes read the IP only through getClientIp', () => {
    for (const file of ['proxy.ts', 'lib/rate-limit.ts', 'app/api/decks/[id]/vote/route.ts']) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/x-forwarded-for|x-real-ip|cf-connecting-ip/)
      expect(source, file).toContain('getClientIp(')
    }
  })
})
