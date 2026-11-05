import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADSENSE_ACCOUNT } from '@/lib/seo/metadata'

const root = resolve(__dirname, '../..')

describe('AdSense site verification', () => {
  it('names the publisher of ads.txt', () => {
    const publisher = readFileSync(resolve(root, 'public/ads.txt'), 'utf8').match(/^google\.com, (pub-\d+), DIRECT, f08c47fec0942fa0$/m)?.[1]
    expect(publisher).toBeTruthy()
    expect(ADSENSE_ACCOUNT).toBe(`ca-${publisher}`)
  })

  it('puts the account meta tag on every page', () => {
    const layout = readFileSync(resolve(root, 'app/[lang]/layout.tsx'), 'utf8')
    expect(layout).toMatch(/other: \{[^}]*'google-adsense-account': ADSENSE_ACCOUNT/)
  })

  it('REQ-SHARED-067 loads the AdSense code with the account in the head of every page', () => {
    const layout = readFileSync(resolve(root, 'app/[lang]/layout.tsx'), 'utf8')
    expect(layout).toContain('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ACCOUNT}')
    expect(layout).toMatch(/<script async src=\{`https:\/\/pagead2\.googlesyndication\.com[^`]*`\} crossOrigin="anonymous"/)
  })
})

