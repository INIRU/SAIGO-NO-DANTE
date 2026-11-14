import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Identity, Sinner } from '@/lib/data/sinners'

const page = vi.hoisted(() => ({ locale: 'ko' }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => page.locale,
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('next/dynamic', () => ({ default: () => () => null }))

import IdentityPortraitSection from '@/features/catalog/components/IdentityPortraitSection'

const QUOTE = '난 이미 기다릴 만큼 기다렸어.'
const sinner = { id: 'rodion', name: 'Rodion', name_kr: '로쟈', name_jp: 'ロージャ' } as Sinner
const identity = { id: 'identity-1', sinner_id: 'rodion', name: '거미집 엄지 아비', name_kr: '거미집 엄지 아비', name_en: 'Thumb Capo', name_jp: '親指カポ', rarity: 3, quote: QUOTE } as unknown as Identity

function portrait(locale: string, quote: string | undefined = QUOTE) {
  page.locale = locale
  return renderToStaticMarkup(
    <IdentityPortraitSection sinner={sinner} identity={{ ...identity, quote }} gacksung={false} setGacksung={() => {}}
      showFullArt={false} setShowFullArt={() => {}} sinColor="#c8900a" rarityNum={3} />,
  )
}

describe('identity portrait quote', () => {
  it.each(['ko', 'en', 'ja'])('shows the Korean quote on the %s page, marked as Korean', locale => {
    const html = portrait(locale)
    expect(html).toContain(QUOTE)
    expect(html).toMatch(/<blockquote[^>]* lang="ko"/)
  })

  it('draws no quote for an identity without one', () => {
    expect(portrait('en', '')).not.toContain('<blockquote')
  })
})
