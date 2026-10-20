import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import NoteBlockViewer from '@/components/notes/NoteBlockViewer'
import { normalizeDocument } from '@/lib/notes/blocks'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: null, isLoading: true, mutate: () => {} }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const render = (...marks: object[]) => renderToStaticMarkup(<NoteBlockViewer doc={normalizeDocument({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '글', marks }] }] })!} renderText={t => t} />)

it('REQ-COMMUNITY-049 an old note without the new marks renders exactly as before', () => {
  expect(render({ type: 'bold' }, { type: 'italic' })).toBe('<div class="note-block-document"><p><span><em><strong>글</strong></em></span></p></div>')
  expect(render({ type: 'link', attrs: { href: 'https://example.com' } })).toContain('<a href="https://example.com/" target="_blank" rel="noopener noreferrer">글</a>')
})
it('REQ-COMMUNITY-049 draws strike, a gold highlight and a sin colour', () => {
  expect(render({ type: 'strike' })).toContain('<s>글</s>')
  expect(render({ type: 'highlight' })).toContain('<mark class="note-highlight">글</mark>')
  const html = render({ type: 'noteColor', attrs: { sin: 'envy' } })
  expect(html).toContain('class="note-sin-color"')
  expect(html).toContain('--note-sin:var(--envy)')
  expect(html).toContain('data-note-color="envy"')
})
it('REQ-COMMUNITY-050 a highlight wraps the colour whatever the order the marks were saved in', () => {
  const html = render({ type: 'highlight' }, { type: 'noteColor', attrs: { sin: 'wrath' } }, { type: 'bold' })
  expect(html).toMatch(/<mark class="note-highlight"><span class="note-sin-color"[^>]*><strong>글<\/strong><\/span><\/mark>/)
})
it('REQ-COMMUNITY-050 a colour the whitelist rejects is not drawn', () => {
  expect(render({ type: 'noteColor', attrs: { sin: 'url(javascript:1)' } })).not.toContain('note-sin-color')
})
