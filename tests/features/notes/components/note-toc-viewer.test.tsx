import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import NoteBlockViewer from '@/features/notes/components/NoteBlockViewer'
import { normalizeDocument } from '@/lib/notes/blocks'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: null, isLoading: true, mutate: () => {} }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const h = (level: number, text: string) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] })
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const render = (anchors: boolean | undefined, ...content: object[]) => renderToStaticMarkup(<NoteBlockViewer anchors={anchors} doc={normalizeDocument({ type: 'doc', content })!} renderText={t => t} />)
const three = [h(1, '운용 순서'), p('가'), h(2, '핵심 기프트'), p('나'), h(2, '대체 편성'), p('다')]

it('REQ-COMMUNITY-057 three headings with anchors on give ids, a contents list and a collapsible bar', () => {
  const html = render(true, ...three)
  expect(html).toContain('id="note-운용-순서"')
  expect(html).toContain('id="note-핵심-기프트"')
  expect(html).toMatch(/<nav[^>]*aria-label="목차"/)
  expect(html).toContain('href="#note-대체-편성"')
  expect(html).toMatch(/<button[^>]*class="note-toc-toggle"[^>]*aria-expanded="false"/)
})
it('REQ-COMMUNITY-057 two headings, or anchors off, leave the markup as it was', () => {
  expect(render(true, h(1, '하나'), p('가'), h(2, '둘'))).toBe('<div class="note-block-document"><h2><span>하나</span></h2><p><span>가</span></p><h3><span>둘</span></h3></div>')
  expect(render(undefined, ...three)).not.toContain('note-toc')
  expect(render(undefined, ...three)).toContain('<h2><span>운용 순서</span></h2>')
})
it('REQ-COMMUNITY-058 each heading carries a button that copies its link', () => {
  const html = render(true, ...three)
  expect(html.match(/class="note-heading-link"/g)).toHaveLength(3)
  expect(html).toContain('aria-label="링크 복사: 핵심 기프트"')
})
