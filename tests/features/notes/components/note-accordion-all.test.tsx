import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import NoteBlockViewer from '@/features/notes/components/NoteBlockViewer'
import { normalizeDocument } from '@/lib/notes/blocks'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: null, isLoading: true, mutate: () => {} }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const accordion = (title: string) => ({ type: 'noteAccordion', content: [{ type: 'noteTitle', content: [{ type: 'text', text: title }] }, { type: 'noteBody', content: [p('내용')] }] })
const render = (...content: object[]) => renderToStaticMarkup(<NoteBlockViewer doc={normalizeDocument({ type: 'doc', content })!} renderText={t => t} />)

it('REQ-COMMUNITY-060 two accordions get one text button above the first, saying to close all while all are open', () => {
  const html = render(p('앞 글'), accordion('하나'), p('사이'), accordion('둘'))
  expect(html.match(/note-accordion-all/g)).toHaveLength(1)
  expect(html).toContain('모두 접기')
  expect(html.indexOf('note-accordion-all')).toBeGreaterThan(html.indexOf('앞 글'))
  expect(html.indexOf('note-accordion-all')).toBeLessThan(html.indexOf('data-open="true"'))
})
it('REQ-COMMUNITY-060 a single accordion has no button and keeps its markup', () => {
  const html = render(accordion('하나'))
  expect(html).not.toContain('note-accordion-all')
  expect(html).toContain('<section class="note-accordion" data-open="true">')
})
it('REQ-COMMUNITY-060 every accordion starts open', () => {
  expect(render(accordion('a'), accordion('b'), accordion('c')).match(/data-open="true"/g)).toHaveLength(3)
})

const closedAccordion = (title: string) => ({ ...accordion(title), attrs: { collapsed: true } })
it('REQ-COMMUNITY-060 an accordion the writer saved as closed starts closed for the reader, the others open', () => {
  const html = render(closedAccordion('접힘'), accordion('펼침'))
  expect(html.indexOf('data-open="false"')).toBeLessThan(html.indexOf('접힘') + 200)
  expect(html.match(/data-open="false"/g)).toHaveLength(1)
  expect(html.match(/data-open="true"/g)).toHaveLength(1)
  // one closed: the button offers to open all
  expect(html).toContain('모두 펼치기')
})
it('REQ-COMMUNITY-060 saving keeps only a closed default on the accordion', () => {
  const doc = normalizeDocument({ type: 'doc', content: [closedAccordion('a'), { ...accordion('b'), attrs: { collapsed: 'yes' } }, accordion('c')] })!
  expect(doc.content?.map(n => n.attrs ?? null)).toEqual([{ collapsed: true }, null, null])
})
it('REQ-COMMUNITY-060 the editor reads and writes the default as data-collapsed on the saved html', async () => {
  const { NoteAccordion } = await import('@/features/notes/components/NoteBlocks')
  const attrs = (NoteAccordion.config.addAttributes as () => Record<string, { default: unknown; parseHTML: (el: HTMLElement) => unknown; renderHTML: (a: Record<string, unknown>) => unknown }>)()
  expect(attrs.collapsed.default).toBe(false)
  expect(attrs.collapsed.renderHTML({ collapsed: true })).toEqual({ 'data-collapsed': 'true' })
  expect(attrs.collapsed.renderHTML({ collapsed: false })).toEqual({})
  expect(attrs.collapsed.parseHTML({ getAttribute: () => 'true' } as unknown as HTMLElement)).toBe(true)
})
