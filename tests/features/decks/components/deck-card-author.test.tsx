import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => [namespace, key].filter(Boolean).join('.'),
  useLocale: () => 'ko',
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))
vi.mock('@/components/providers/KeywordProvider', () => ({ useKeywordData: () => ({ getIconUrl: () => null }), useKeywords: () => ({}) }))
vi.mock('@/features/decks/components/NoteChips', () => ({ NoteRenderer: () => null, useNoteGiftLookup: () => ({}) }))
vi.mock('@/features/tools/components/OwnedBadge', () => ({ default: () => null, useMissingSinners: () => [] }))
vi.mock('@/features/decks/components/FormationThumbnail', () => ({ default: () => null }))

import DeckCard, { type DeckSummary } from '@/features/decks/components/DeckCard'

const deck = (extra: Partial<DeckSummary>): DeckSummary => ({
  id: 'd1', user_id: 'u1', title: '덱', description: null, tags: [], vote_count: 0, view_count: 0, created_at: '2026-10-15T00:00:00Z', ...extra,
})

describe('deck card author', () => {
  it('puts the author avatar before the name', () => {
    const html = renderToStaticMarkup(<DeckCard deck={deck({ username: '작성자', avatar_url: 'https://x/a.webp', profile_public: true })} />)
    expect(html).toMatch(/<img src="https:\/\/x\/a\.webp"[^>]*>[\s\S]*?작성자/)
  })

  it('links the name to the profile only when the profile is public', () => {
    expect(renderToStaticMarkup(<DeckCard deck={deck({ username: '작성자', profile_public: true })} />)).toContain('href="/users/u1"')
    const hidden = renderToStaticMarkup(<DeckCard deck={deck({ username: '작성자', profile_public: false })} />)
    expect(hidden).not.toContain('/users/u1')
    expect(hidden).toContain('작성자')
  })
})
