import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KeywordProvider } from '@/components/providers/KeywordProvider'
import { NoteRenderer } from '@/components/decks/NoteChips'
import { NOTE_PREFIX, notePreviewText } from '@/lib/notes/blocks'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const keywords = {
  못: { desc: '못 설명' },
  화상: { desc: '화상 설명' },
}
const renderNote = (text: string, props: Partial<Parameters<typeof NoteRenderer>[0]> = {}) =>
  renderToStaticMarkup(<KeywordProvider keywords={keywords}><NoteRenderer text={text} {...props} /></KeywordProvider>)
const doc = (...content: object[]) => NOTE_PREFIX + JSON.stringify({ type: 'doc', content })
const tokens = (html: string) => html.match(/keyword-token/g)?.length ?? 0

describe('REQ-DECKS-011 memos show keywords only as explicit chips', () => {
  it('REQ-DECKS-011 does not turn the words of a plain memo into keywords', () => {
    const html = renderNote('흑수 못 넣을시 화상 3 부여')
    expect(tokens(html)).toBe(0)
    expect(html).toContain('흑수 못 넣을시 화상 3 부여')
  })

  it('REQ-DECKS-011 does not guess inside bold, italic or link text either', () => {
    const html = renderNote('**화상** *못* [화상](https://example.test/)')
    expect(tokens(html)).toBe(0)
    expect(html).toContain('<strong')
    expect(html).toContain('>화상</strong>')
  })

  it('REQ-DECKS-011 does not guess in the text nodes of a block document, and draws its explicit chips', () => {
    const html = renderNote(doc({ type: 'paragraph', content: [{ type: 'text', text: '화상 못 ' }, { type: 'noteKeyword', attrs: { id: '화상' } }, { type: 'text', text: ' 3' }] }))
    expect(tokens(html)).toBe(1)
    expect(html).toContain('화상 못 ')
  })

  it('REQ-DECKS-011 draws a [k:] token as an inline keyword label (no chip box), and only that', () => {
    const html = renderNote('화상 [k:못] 박기')
    expect(tokens(html)).toBe(1)
    expect(html).toContain('화상 ')
    expect(html).not.toMatch(/clip-path/)
  })

  it('REQ-DECKS-011 shows a stray backslash as text (it is no escape any more)', () => {
    const html = renderNote('흑수 \\못 넣을시, \\\\화상')
    expect(tokens(html)).toBe(0)
    expect(html).toContain('흑수 \\못 넣을시, \\\\화상')
  })

  it('REQ-DECKS-011 draws placeholder tokens of a memo as labels but never searches it for keywords', () => {
    const html = renderNote('화상 {{potency}} 부여')
    expect(html).toContain('data-placeholder="potency"')
    expect(tokens(html)).toBe(0)
  })

  it('REQ-DECKS-011 keeps a keyword chip of a block document in the one-line card preview as a token', () => {
    const saved = doc({ type: 'paragraph', content: [{ type: 'text', text: '먼저 ' }, { type: 'noteKeyword', attrs: { id: '화상' } }, { type: 'text', text: ' 챙기기' }] })
    expect(notePreviewText(saved)).toContain('[k:화상]')
    const preview = renderNote(notePreviewText(saved), { inline: true })
    expect(tokens(preview)).toBe(1)
    expect(preview).not.toMatch(/clip-path/)
  })
})

describe('REQ-DECKS-011 a block memo keeps the space between two chips', () => {
  it('REQ-DECKS-011 keeps the space between two chips of a block document, and still hides an empty paragraph', () => {
    const html = renderNote(doc(
      { type: 'paragraph', content: [{ type: 'noteKeyword', attrs: { id: '화상' } }, { type: 'text', text: ' ' }, { type: 'noteKeyword', attrs: { id: '못' } }] },
      { type: 'paragraph', content: [{ type: 'text', text: '   ' }] },
    ))
    expect(html).toMatch(/<span> <\/span>/)
    expect(html.match(/<p>/g)).toHaveLength(1)
  })
})

describe('REQ-DECKS-011 the guessing code is gone from the screens', () => {
  const sourceOf = (path: string) => readFileSync(path, 'utf8')
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (name === 'node_modules' || name.startsWith('.')) return []
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })

  it('REQ-DECKS-011 the keyword provider has no guessing renderer or escape option', () => {
    const source = sourceOf('components/providers/KeywordProvider.tsx')
    expect(source).not.toMatch(/formatSkillDescInner|escapeKeywords|PARTICLES/)
  })

  it('REQ-DECKS-011 no component, page or library module imports the matcher', () => {
    const importers = [...walk('components'), ...walk('app'), ...walk('lib'), ...walk('features')]
      .filter(path => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
      .filter(path => /keywords\/keyword-guess'/.test(sourceOf(path)))
    expect(importers).toEqual([])
  })
})
