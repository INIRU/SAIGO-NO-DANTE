import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { KeywordProvider, useFormatSkillDesc } from '@/components/providers/KeywordProvider'
import { NoteRenderer } from '@/components/decks/NoteChips'
import { NOTE_PREFIX } from '@/lib/notes/blocks'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const keywords = {
  '못': { desc: '못 설명' },
  '화상': { desc: '화상 설명' },
}

function renderNote(text: string) {
  return renderToStaticMarkup(
    <KeywordProvider keywords={keywords}><NoteRenderer text={text}/></KeywordProvider>,
  )
}

function GameFormatter({ text }: { text: string }) {
  const formatSkillDesc = useFormatSkillDesc()
  return <>{formatSkillDesc(text, '#fff')}</>
}

function renderGameText(text: string) {
  return renderToStaticMarkup(
    <KeywordProvider keywords={keywords}><GameFormatter text={text}/></KeywordProvider>,
  )
}

function keywordCount(html: string) {
  return html.match(/keyword-token/g)?.length ?? 0
}

it('lets notes escape automatic keywords without changing explicit keyword nodes', () => {
  expect(keywordCount(renderNote('흑수 못 넣을시'))).toBe(1)
  const escaped = renderNote('흑수 \\못 넣을시')
  expect(keywordCount(escaped)).toBe(0)
  expect(escaped).not.toContain('\\못')
  expect(keywordCount(renderNote('a\\못'))).toBe(0)
  expect(keywordCount(renderNote('a \\못'))).toBe(0)
  expect(keywordCount(renderNote('화상\\못'))).toBe(1)

  const structured = NOTE_PREFIX + JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: '\\못 ' }, { type: 'noteKeyword', attrs: { id: '못' } },
  ] }] })
  expect(keywordCount(renderNote(structured))).toBe(1)
})

it('uses one backslash as the escape marker and keeps code literal', () => {
  expect(keywordCount(renderNote('못'))).toBe(1)
  expect(keywordCount(renderNote('\\못'))).toBe(0)
  const repeated = renderNote('\\\\못')
  expect(keywordCount(repeated)).toBe(1)
  expect(repeated).toContain('\\\\')
  expect(keywordCount(renderNote('\\\\\\못'))).toBe(0)
  expect(renderNote('`\\못`')).toContain('\\못')
  const codeBlock = NOTE_PREFIX + JSON.stringify({ type: 'doc', content: [{ type: 'codeBlock', content: [{ type: 'text', text: '\\못' }] }] })
  expect(renderNote(codeBlock)).toContain('<code>\\못</code>')
})

// REQ-SHARED-021: game text is drawn by the game text renderer, never searched for keywords; the backslash is no
// escape marker there (it was only a note feature), so it shows as written.
it('REQ-SHARED-021 draws game text without guessing keywords and keeps a backslash literal', () => {
  const html = renderGameText('\\못 화상')
  expect(keywordCount(html)).toBe(0)
  expect(html).toContain('\\못 화상')
})
