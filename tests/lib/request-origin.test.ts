import { describe, expect, it } from 'vitest'
import { isAllowedRequestOrigin } from '@/lib/request-origin'
describe('origin checks behind the local preview proxy', () => {
  it('accepts the exact browser-visible host despite an internal localhost URL', () => {
    expect(isAllowedRequestOrigin('http://127.0.0.1:3000/ko', 'http://localhost:3000', '127.0.0.1:3000', [])).toBe(true)
    expect(isAllowedRequestOrigin('https://preview.trycloudflare.com/ko', 'http://localhost:3001', 'preview.trycloudflare.com', [])).toBe(true)
  })
  it('rejects foreign origins, partial host matches and unexpected ports', () => {
    for (const origin of ['https://evil.test', 'https://preview.trycloudflare.com.evil.test', 'https://preview.trycloudflare.com:444', 'data:text/plain,hello', 'broken']) {
      expect(isAllowedRequestOrigin(origin, 'http://localhost:3001', 'preview.trycloudflare.com', [])).toBe(false)
    }
  })
})
