import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { KeywordProvider, useFormatSkillDesc, type KeywordInfo } from '@/components/providers/KeywordProvider'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))

function Formatter({ text }: { text: string }) {
  const format = useFormatSkillDesc()
  return <>{format(text, '#fff', { '벼락치기': '#f00' })}</>
}

const render = (keywords: Record<string, KeywordInfo>, text: string) =>
  renderToStaticMarkup(<KeywordProvider keywords={keywords}><Formatter text={text} /></KeywordProvider>)

it('draws placeholder tokens as labels instead of showing the braces', () => {
  const html = render({ 화상: { desc: '' } }, '화상 {{potency}} 부여 (현재 {{live}}%)')
  expect(html).toContain('data-placeholder="potency"')
  expect(html).toContain('data-placeholder="live"')
  expect(html).not.toContain('{{')
})
