import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { KeywordProvider } from '@/components/providers/KeywordProvider'
import { NoteRenderer } from '@/components/decks/NoteChips'
import { NoteGiftClickContext } from '@/features/notes/components/NoteBlockViewer'
import { NOTE_PREFIX } from '@/lib/notes/blocks'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('swr', () => ({ default: () => ({ data: [{ kind: 'gift', id: 'g1', name: '혈향도래', grade: '3', keyword: '출혈', image_url: null }], error: null, isLoading: false, mutate: () => {} }) }))

const memo = NOTE_PREFIX + JSON.stringify({ type: 'doc', content: [{ type: 'noteAsset', attrs: { kind: 'gift', id: 'g1' } }] })
const render = (onGiftClick: ((key: string) => void) | null) => renderToStaticMarkup(
  <KeywordProvider keywords={{}}><NoteGiftClickContext value={onGiftClick}><NoteRenderer text={memo} /></NoteGiftClickContext></KeywordProvider>,
)

it('makes memo gift blocks clickable where a page provides the gift modal', () => {
  expect(render(() => {})).toMatch(/<button[^>]*note-asset-view--gift/)
  expect(render(null)).not.toMatch(/<button[^>]*note-asset-view--gift/)
})
