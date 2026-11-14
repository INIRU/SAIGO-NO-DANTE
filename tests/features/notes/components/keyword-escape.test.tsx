import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { KeywordProvider, useFormatSkillDesc } from '@/components/providers/KeywordProvider'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

const keywords = {
  '못': { desc: '못 설명' },
  '화상': { desc: '화상 설명' },
}

function GameFormatter({ text }: { text: string }) {
  const formatSkillDesc = useFormatSkillDesc()
  return <>{formatSkillDesc(text, '#fff')}</>
}

// Game text is drawn by the game text renderer, never searched for keywords; the backslash is no
// escape marker there, so it shows as written. (User memos: tests/features/notes/components/memo-explicit-keywords.test.tsx.)
it('draws game text without guessing keywords and keeps a backslash literal', () => {
  const html = renderToStaticMarkup(<KeywordProvider keywords={keywords}><GameFormatter text={'\\못 화상'} /></KeywordProvider>)
  expect(html.match(/keyword-token/g)?.length ?? 0).toBe(0)
  expect(html).toContain('\\못 화상')
})
