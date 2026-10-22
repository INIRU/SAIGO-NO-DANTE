import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => [namespace, key].filter(Boolean).join('.'),
  useLocale: () => 'ko',
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children, prefetch, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => <a href={href} data-prefetch={String(prefetch)} {...rest}>{children}</a> }))
vi.mock('@/components/providers/KeywordProvider', () => ({ useKeywordData: () => ({ getIconUrl: () => null }), useKeywords: () => ({}) }))
vi.mock('@/components/decks/NoteChips', () => ({ NoteRenderer: () => null, useNoteGiftLookup: () => ({}) }))
vi.mock('@/components/collection/OwnedBadge', () => ({ default: () => null, useMissingSinners: () => [] }))
vi.mock('@/components/ui/FormationThumbnail', () => ({ default: () => null }))

import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'

const deck: DeckSummary = { id: 'd1', user_id: 'u1', title: '덱', description: null, tags: [], vote_count: 0, view_count: 0, created_at: '2026-10-15T00:00:00Z' }

describe('card links prefetch heavy detail pages only on intent (IntentLink)', () => {
  it('deck card detail link does not prefetch before intent', () => {
    const html = renderToStaticMarkup(<DeckCard deck={deck} />)
    expect(html).toMatch(/<a href="\/decks\/d1" data-prefetch="false"/)
  })
})
