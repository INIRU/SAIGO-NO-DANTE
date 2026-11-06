import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import NoteBlockViewer from '@/features/notes/components/NoteBlockViewer'
import { normalizeDocument } from '@/lib/notes/blocks'

const assets = vi.hoisted(() => ({ data: undefined as unknown }))
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('swr', () => ({ default: () => ({ data: assets.data, error: null, isLoading: false, mutate: () => {} }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const render = (...content: object[]) => renderToStaticMarkup(<NoteBlockViewer doc={normalizeDocument({ type: 'doc', content: [{ type: 'paragraph', content }] })!} renderText={t => t} />)
const identity = { kind: 'identity', id: 'i1', name: '로쟈', image_url: '/portrait.webp', identity: { sinner_id: 'rodion', rarity: 3, game_id: '1', folder_name: 'x' } }
const gift = { kind: 'gift', id: 'g1', name: '시험 추출', image_url: '/g.webp', grade: '1', keyword: '화상', description: '효과' }

it('REQ-COMMUNITY-061 a mention and a gift name are wrapped for a preview but draw no card until a pointer arrives', () => {
  assets.data = [identity, gift]
  const html = render({ type: 'noteMention', attrs: { kind: 'identity', id: 'i1', name: '로쟈' } }, { type: 'noteGift', attrs: { id: 'g1', name: '시험 추출' } })
  expect(html.match(/class="note-preview-host"/g)).toHaveLength(2)
  expect(html).not.toContain('note-preview-card')
  expect(html).not.toContain('role="dialog"')
})
it('REQ-COMMUNITY-061 without the asset there is nothing to preview', () => {
  assets.data = []
  expect(render({ type: 'noteMention', attrs: { kind: 'identity', id: 'gone', name: '지워진 인격' } })).not.toContain('note-preview-host')
})
it('REQ-COMMUNITY-062 touch opens the modal and never the hover card', () => {
  const source = readFileSync('features/notes/components/NotePreviewCard.tsx', 'utf8')
  expect(source).toContain('BaseModal')
  expect(source).toContain('usesHover(event.pointerType)')
  expect(source).toContain("lastPointer.current !== 'touch'")
})
