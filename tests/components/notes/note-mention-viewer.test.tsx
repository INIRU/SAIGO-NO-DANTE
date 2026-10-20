import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import NoteBlockViewer from '@/components/notes/NoteBlockViewer'
import { normalizeDocument } from '@/lib/notes/blocks'

const assets = vi.hoisted(() => ({ data: undefined as unknown }))
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('swr', () => ({ default: () => ({ data: assets.data, error: null, isLoading: false, mutate: () => {} }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const render = (...content: object[]) => renderToStaticMarkup(<NoteBlockViewer doc={normalizeDocument({ type: 'doc', content: [{ type: 'paragraph', content }] })!} renderText={t => t} />)
const mention = (kind: string, id: string, name: string) => ({ type: 'noteMention', attrs: { kind, id, name } })

it('REQ-COMMUNITY-053 an identity mention is a link with a small portrait and the name in the reader\'s language', () => {
  assets.data = [{ kind: 'identity', id: 'i1', name: '로쟈', name_en: 'Rodion', image_url: '/portrait.webp', identity: { sinner_id: 'rodion' } }]
  const html = render({ type: 'text', text: '추천 ' }, mention('identity', 'i1', '저장된 이름'))
  expect(html).toMatch(/<a[^>]*href="\/sinners\/rodion\/identities\/i1"[^>]*class="note-mention"|<a[^>]*class="note-mention"[^>]*href="\/sinners\/rodion\/identities\/i1"/)
  expect(html).toContain('<img')
  expect(html).toContain('로쟈')
  expect(html).not.toContain('저장된 이름')
})
it('REQ-COMMUNITY-053 an E.G.O mention goes to the E.G.O page of its sinner', () => {
  assets.data = [{ kind: 'ego', id: 'e1', name: '붉은 눈', sinnerId: 'rodion', image_url: '/ego.webp', ego: { grade: 'WAW' } }]
  expect(render(mention('ego', 'e1', '붉은 눈'))).toContain('href="/sinners/rodion/ego/e1"')
})
it('REQ-COMMUNITY-053 without the asset the saved name shows, with no link', () => {
  assets.data = []
  const html = render(mention('identity', 'gone', '지워진 인격'))
  expect(html).toContain('지워진 인격')
  expect(html).not.toContain('<a')
  expect(html).toContain('note-mention')
})
