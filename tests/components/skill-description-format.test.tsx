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

it('formats a description the same whatever unrelated keywords the catalog holds', () => {
  const used: Record<string, KeywordInfo> = { 화상: { desc: '' }, 화상위력: { desc: '' }, 출혈: { desc: '' }, 못: { desc: '' } }
  const unrelated = Object.fromEntries(Array.from({ length: 400 }, (_, index) => [`무관한 키워드 ${index}`, { desc: '' }]))
  const text = '[합 승리시] 화상 3 부여, 출혈 횟수 2 부여. 못을 박는다. 벼락치기 사용 시 화상위력 증가. 【출혈】 대상에게 못 2'
  const html = render(used, text)
  expect(html).toBe(render({ ...unrelated, ...used }, text))
  expect(html.match(/keyword-token/g)?.length).toBeGreaterThanOrEqual(4)
})
