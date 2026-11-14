import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { EGO, Identity, Sinner } from '@/lib/data/sinners'

// The E.G.O tab opens from the address hash after mount; a server render has no hash, so the tab state starts there instead.
const view = vi.hoisted(() => ({ tab: 'identities' }))
vi.mock('react', async original => {
  const react = await original<typeof import('react')>()
  return { ...react, useState: (initial: unknown) => (initial === 'identities' ? [view.tab, () => {}] : react.useState(initial)) }
})
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => Object.assign((key: string) => key, { raw: () => [] }) }))
vi.mock('@/lib/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/sinners/faust',
}))
vi.mock('@/components/providers/KeywordProvider', () => ({ useKeywordData: () => ({ sinMap: {}, iconMap: {}, getIconUrl: () => null }) }))
vi.mock('@/features/catalog/hooks/useOwnedIdentities', () => ({ useOwnedIdentities: () => null }))
vi.mock('@/lib/hooks/useRoutePrefetch', () => ({ useRoutePrefetch: () => {} }))

const sinner = { id: 'faust', name: 'Faust', name_kr: '파우스트', name_jp: 'ファウスト', order_num: 2 } as unknown as Sinner
const identities = [
  { id: 'i-1', sinner_id: 'faust', name: 'LCB Sinner', name_kr: 'LCB 수감자', rarity: 1, game_id: '10201', keywords: [] },
  { id: 'i-2', sinner_id: 'faust', name: 'W Corp.', name_kr: 'W사 2등급 정리 요원', rarity: 2, game_id: '10202', keywords: [] },
] as unknown as Identity[]
const egos = [
  { id: 'e-1', sinner_id: 'faust', name: 'Representation Emitter', name_kr: '표상 방출기', grade: 'ZAYIN', sin_affinity: 'pride' },
] as unknown as EGO[]

const render = async (tab: 'identities' | 'ego') => {
  view.tab = tab
  const { default: SinnerDetailClient } = await import('@/app/[lang]/sinners/[slug]/_components/SinnerDetailClient')
  return renderToStaticMarkup(<SinnerDetailClient sinner={sinner} identities={identities} egos={egos} />)
}
const anchors = (html: string, kind: string) => [...html.matchAll(/<a [^>]*>/g)].map(match => match[0]).filter(tag => tag.includes(`/${kind}/`))

describe('cards on a sinner page are links', () => {
  it('every identity card is an anchor to its detail page, named after the identity', async () => {
    const html = await render('identities')
    const links = anchors(html, 'identities')

    expect(links).toHaveLength(identities.length)
    for (const identity of identities) {
      expect(links.find(tag => tag.includes(`href="/sinners/faust/identities/${identity.id}"`))).toContain(`aria-label="${identity.name_kr}"`)
    }
    // The card inside is no longer a script-only button: a crawler follows the anchor, and so does a new-tab click.
    expect(html).not.toContain('role="button"')
  })

  it('every E.G.O card is an anchor to its detail page, named after the E.G.O', async () => {
    const html = await render('ego')
    const links = anchors(html, 'ego')

    expect(links).toHaveLength(egos.length)
    expect(links[0]).toContain('href="/sinners/faust/ego/e-1"')
    expect(links[0]).toContain('aria-label="표상 방출기"')
    expect(html).not.toMatch(/<button[^>]*aria-label="표상 방출기"/)
  })
})
