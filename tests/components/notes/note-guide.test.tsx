import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import NoteEditorGuide, { guideCopy } from '@/components/notes/NoteEditorGuide'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))

const NEW_TIPS = 5
it('REQ-COMMUNITY-064 the guide has the same number of tips in every language, five of them new', () => {
  const counts = (['ko', 'en', 'ja'] as const).map(lang => guideCopy[lang].tips.length)
  expect(new Set(counts).size).toBe(1)
  expect(counts[0]).toBe(4 + NEW_TIPS)
})
it('REQ-COMMUNITY-064 each new tip is a title and one short line, in every language', () => {
  for (const lang of ['ko', 'en', 'ja'] as const) {
    for (const [title, body] of guideCopy[lang].tips.slice(-NEW_TIPS)) {
      expect(title.trim().length).toBeGreaterThan(0)
      expect(title.length).toBeLessThanOrEqual(24)
      expect(body.trim().length).toBeGreaterThan(0)
      expect(body.length).toBeLessThanOrEqual(70)
      expect(body).not.toContain('\n')
    }
  }
})
it('REQ-COMMUNITY-064 the new tips cover marks, mention, duplicate, markdown paste and reading view', () => {
  const ko = guideCopy.ko.tips.slice(-NEW_TIPS).map(([title]) => title).join('|')
  for (const word of ['글자 꾸미기', '@', '복제', '마크다운', '목차']) expect(ko).toContain(word)
})
it('REQ-COMMUNITY-064 the guide button draws no dot on the server (storage is read in the browser)', () => {
  const html = renderToStaticMarkup(<NoteEditorGuide compact />)
  expect(html).toContain('작성 도구 사용법')
  expect(html).not.toContain('note-new-dot')
})
