import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import NoteBlockViewer from '@/components/notes/NoteBlockViewer'
import { normalizeDocument } from '@/lib/notes/blocks'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: null, isLoading: true, mutate: () => {} }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const render = (...content: object[]) => renderToStaticMarkup(<NoteBlockViewer doc={normalizeDocument({ type: 'doc', content })!} renderText={t => t} />)

it('renders callout, table, checklist and divider; old notes render unchanged', () => {
  const html = render(
    p('옛 글'),
    { type: 'noteCallout', attrs: { variant: 'warning' }, content: [p('조심')] },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [p('H')] }, { type: 'tableCell', content: [p('')] }] }] },
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p('끝')] }] },
    { type: 'horizontalRule' },
  )
  expect(html).toContain('<p><span>옛 글</span></p>')
  expect(html).toMatch(/note-callout[^>]*data-variant="warning"|data-variant="warning"[^>]*note-callout/)
  expect(html).toMatch(/<table[\s\S]*<th[^>]*>[\s\S]*H[\s\S]*<td/)
  expect(html).toMatch(/<input[^>]*type="checkbox"/)
  expect(html).toContain('<hr/>')
})
it('renders a card slot only when a deck or plan is chosen', () => {
  expect(render(p('a'), { type: 'noteCard', attrs: { kind: 'deck', id: '' } })).not.toContain('note-card')
  expect(render({ type: 'noteCard', attrs: { kind: 'deck', id: 'd1' } })).toContain('note-card')
})
