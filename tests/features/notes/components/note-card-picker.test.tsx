import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('swr', () => ({ default: () => ({ data: [{ id: 'd1', title: '출혈 덱', deck_identities: [], deck_egos: [] }], error: null, isLoading: false, mutate: () => {} }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('@/components/ui/BaseModal', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/components/decks/DeckCard', () => ({ default: ({ deck }: { deck: { title: string } }) => <article data-deck-card>{deck.title}</article> }))
vi.mock('@/components/planner/PlanCard', () => ({ default: () => <article data-plan-card /> }))

it('REQ-COMMUNITY-045 the card picker uses the gift picker frame and shows results as board cards', async () => {
  const { NoteCardPicker } = await import('@/features/notes/components/NoteCardBlock')
  const html = renderToStaticMarkup(<NoteCardPicker kind="deck" onKind={() => {}} onSelect={() => {}} onClose={() => {}} />)
  expect(html).toContain('note-direct-picker')
  expect(html).toContain('note-direct-sidebar')
  expect(html).toMatch(/data-deck-card[^>]*>출혈 덱/)
  expect(html).toMatch(/<button[^>]*aria-label="출혈 덱/)
})
