import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import NoteBlockViewer from '@/components/notes/NoteBlockViewer'
import { normalizeDocument } from '@/lib/notes/blocks'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: null, isLoading: true, mutate: () => {} }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const accordion = (title: string) => ({ type: 'noteAccordion', content: [{ type: 'noteTitle', content: [{ type: 'text', text: title }] }, { type: 'noteBody', content: [p('내용')] }] })
const render = (...content: object[]) => renderToStaticMarkup(<NoteBlockViewer doc={normalizeDocument({ type: 'doc', content })!} renderText={t => t} />)

it('REQ-COMMUNITY-059 two accordions get one text button above the first, saying to close all while all are open', () => {
  const html = render(p('앞 글'), accordion('하나'), p('사이'), accordion('둘'))
  expect(html.match(/note-accordion-all/g)).toHaveLength(1)
  expect(html).toContain('모두 접기')
  expect(html.indexOf('note-accordion-all')).toBeGreaterThan(html.indexOf('앞 글'))
  expect(html.indexOf('note-accordion-all')).toBeLessThan(html.indexOf('data-open="true"'))
})
it('REQ-COMMUNITY-059 a single accordion has no button and keeps its markup', () => {
  const html = render(accordion('하나'))
  expect(html).not.toContain('note-accordion-all')
  expect(html).toContain('<section class="note-accordion" data-open="true">')
})
it('REQ-COMMUNITY-059 every accordion starts open', () => {
  expect(render(accordion('a'), accordion('b'), accordion('c')).match(/data-open="true"/g)).toHaveLength(3)
})
