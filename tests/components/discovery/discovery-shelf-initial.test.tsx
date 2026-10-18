import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/components/discovery/ForYou', () => ({ default: () => null, OwnedLink: () => null }))
vi.mock('@/components/decks/DeckCard', () => ({ default: ({ deck }: { deck: { id: string } }) => <a href={`/ko/decks/${deck.id}`}>card</a> }))
vi.mock('@/components/planner/PlanCard', () => ({ default: () => null }))
vi.mock('@/components/sinners/IdentityCard', () => ({ default: () => null }))

import DiscoveryShelf from '@/components/discovery/DiscoveryShelf'

describe('REQ-COMMUNITY-046 board first paint', () => {
  it('REQ-COMMUNITY-046 renders the cards from the initial data with no skeleton', () => {
    const initialData = { recent: [{ id: 'a1' }], updated: [], popular: [{ id: 'b2' }], identities: [] } as never
    const html = renderToStaticMarkup(<DiscoveryShelf kind="deck" onBrowse={() => {}} initialData={initialData} />)
    expect(html).toContain('/ko/decks/a1')
    expect(html).toContain('/ko/decks/b2')
    expect(html).not.toContain('data-board-skeleton')
  })
})
