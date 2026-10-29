import { describe, expect, it } from 'vitest'
import { canonicalRedirectUrl } from '@/lib/seo/canonical-host'

describe('canonicalRedirectUrl', () => {
  it('sends http visitors to https on the apex host', () => {
    expect(canonicalRedirectUrl('saigo-no-dante.com', '{"scheme":"http"}', '/ko/decks?page=2')).toBe('https://saigo-no-dante.com/ko/decks?page=2')
  })

  it('sends www to the apex host whatever the scheme', () => {
    expect(canonicalRedirectUrl('www.saigo-no-dante.com', '{"scheme":"https"}', '/ko')).toBe('https://saigo-no-dante.com/ko')
    expect(canonicalRedirectUrl('www.saigo-no-dante.com', '{"scheme":"http"}', '/')).toBe('https://saigo-no-dante.com/')
  })

  it('leaves https on the apex host alone', () => {
    expect(canonicalRedirectUrl('saigo-no-dante.com', '{"scheme":"https"}', '/ko')).toBeNull()
  })

  it('never redirects without the Cloudflare visitor header or off the production host', () => {
    // The tunnel reaches the server over plain http, so only the edge's record of the visitor's scheme counts.
    expect(canonicalRedirectUrl('saigo-no-dante.com', null, '/ko')).toBeNull()
    expect(canonicalRedirectUrl('localhost:3000', '{"scheme":"http"}', '/ko')).toBeNull()
    expect(canonicalRedirectUrl(null, '{"scheme":"http"}', '/ko')).toBeNull()
  })
})
