import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/ko/decks/1' }))
import { renderToStaticMarkup } from 'react-dom/server'
import AdSlot, { AdSlotSpace } from '@/components/ads/AdSlot'
import { ADS_ON } from '@/lib/seo/ads'

const root = resolve(__dirname, '../../..')
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('ads switched off', () => {
  it('draws no ad, no reserved place and no ad script while the switch is off', () => {
    expect(ADS_ON).toBe(false)
    for (const place of ['top', 'inline', 'hero', 'left', 'right', 'panel'] as const)
      expect(renderToStaticMarkup(<AdSlot slot="1234567890" place={place} />), place).toBe('')
    expect(renderToStaticMarkup(<AdSlotSpace />)).toBe('')
    // the AdSense code loads only with the switch on; the account meta tag and ads.txt stay so ads can come back
    expect(source('app/[lang]/layout.tsx')).toMatch(/\{ADS_ON && <script async src=\{`https:\/\/pagead2\.googlesyndication\.com/)
    expect(source('app/[lang]/layout.tsx')).toContain("'google-adsense-account': ADSENSE_ACCOUNT")
    // a detail page's lower banner box (a padded section) would stand empty: it is left out with the switch off
    for (const page of ['app/[lang]/planner/community/[id]/PlanDetailClient.tsx', 'app/[lang]/decks/[id]/DeckDetailClient.tsx'])
      expect(source(page), page).toMatch(/const lowerAd = ADS_ON && <div/)
  })
})
