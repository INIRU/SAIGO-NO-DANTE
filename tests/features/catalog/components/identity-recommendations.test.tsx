import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => [namespace, key].filter(Boolean).join('.'),
  useLocale: () => 'ko',
}))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))
vi.mock('@/features/catalog/components/IdentityFrameCard', () => ({ default: ({ name }: { name: string }) => <span data-card>{name}</span> }))
vi.mock('@/features/decks/components/DeckCard', () => ({ default: ({ deck }: { deck: { id: string } }) => <span data-deck>{deck.id}</span> }))
vi.mock('@/features/planner/components/PlanCard', () => ({ default: ({ plan }: { plan: { id: string } }) => <span data-plan>{plan.id}</span> }))

import IdentityRecommendations from '@/features/catalog/components/IdentityRecommendations'
import type { IdentityCompanion, IdentityPost } from '@/features/community/server/identity-recommendations'

const companion = (id: string, count: number): IdentityCompanion =>
  ({ id, sinner_id: 'yisang', rarity: 3, game_id: '10101', folder_name: 'x', name_kr: `인격${id}`, name_en: null, name_jp: null, count })
const post = (kind: 'deck' | 'planner', id: string): IdentityPost => ({ kind, post: { id, title: id } })

describe('IdentityRecommendations', () => {
  it('REQ-COMMUNITY-066 links each companion to its detail page and shows the shared count with a unit', () => {
    const html = renderToStaticMarkup(<IdentityRecommendations companions={[companion('B', 7), companion('C', 3)]} posts={[]} />)
    expect(html).toContain('href="/sinners/yisang/identities/B"')
    expect(html).toContain('href="/sinners/yisang/identities/C"')
    expect(html).toMatch(/>7<[\s\S]*?identity\.recommendations\.unit/)
    expect(html).toContain('identity.recommendations.companions')
    expect(html).not.toContain('identity.recommendations.popular')
  })

  it('REQ-COMMUNITY-067 shows popular decks and plans as their own cards', () => {
    const html = renderToStaticMarkup(<IdentityRecommendations companions={[]} posts={[post('deck', 'd1'), post('planner', 'p1')]} />)
    expect(html).toContain('<span data-deck="true">d1</span>')
    expect(html).toContain('<span data-plan="true">p1</span>')
    expect(html).toContain('identity.recommendations.popular')
    expect(html).not.toContain('identity.recommendations.companions')
  })

  it('REQ-COMMUNITY-068 draws nothing, not even a heading, when both lists are empty', () => {
    expect(renderToStaticMarkup(<IdentityRecommendations companions={[]} posts={[]} />)).toBe('')
  })
})
