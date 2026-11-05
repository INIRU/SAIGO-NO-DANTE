import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CLOUDFLARE_WEB_ANALYTICS_TOKEN } from '@/lib/seo/metadata'

describe('REQ-SHARED-072 Web Analytics without the Cloudflare proxy', () => {
  it('REQ-SHARED-072 the self-hosted layout carries the beacon itself, since CloudFront injects nothing', () => {
    const layout = readFileSync('app/[lang]/layout.tsx', 'utf8')
    expect(layout).toMatch(/process\.env\.SELF_HOSTED === '1'[\s\S]{0,200}static\.cloudflareinsights\.com\/beacon\.min\.js/)
    expect(layout).toContain('CLOUDFLARE_WEB_ANALYTICS_TOKEN')
    expect(CLOUDFLARE_WEB_ANALYTICS_TOKEN).toMatch(/^[0-9a-f]{32}$/)
  })
})
