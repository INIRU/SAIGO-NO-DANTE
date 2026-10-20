import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/components/discovery/ForYou', () => ({ default: () => null, OwnedLink: () => null }))
vi.mock('@/components/board/BoardCard', () => ({
  default: ({ kind, post }: { kind: string; post: { id: string } }) => <a href={`/ko/${kind === 'deck' ? 'decks' : 'planner/community'}/${post.id}`}>card</a>,
  RankPlate: () => null,
}))
vi.mock('@/components/ui/IdentityFrameCard', () => ({ default: () => null }))

import DiscoveryShelf from '@/components/discovery/DiscoveryShelf'

describe('REQ-COMMUNITY-046 board first paint', () => {
  it('REQ-COMMUNITY-046 renders the cards from the initial data with no skeleton', () => {
    const initialData = { recent: [{ id: 'a1' }], updated: [], popular: [{ id: 'b2' }], identities: [] } as never
    const html = renderToStaticMarkup(<DiscoveryShelf kind="deck" onBrowse={() => {}} initialData={initialData} />)
    expect(html).toContain('/ko/decks/a1')
    expect(html).toContain('/ko/decks/b2')
    expect(html).not.toContain('data-board-skeleton')
  })

  it('REQ-COMMUNITY-046 links the plan cards of the plan board to their detail pages', () => {
    const initialData = { recent: [{ id: 'p9' }], updated: [], popular: [], identities: [] } as never
    const html = renderToStaticMarkup(<DiscoveryShelf kind="planner" onBrowse={() => {}} initialData={initialData} />)
    expect(html).toContain('/ko/planner/community/p9')
  })
})
