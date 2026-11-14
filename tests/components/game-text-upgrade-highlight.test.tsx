import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { KeywordProvider, useFormatSkillDesc, type KeywordInfo } from '@/components/providers/KeywordProvider'
import { EffectText } from '@/features/mirror-dungeon/components/GiftDetailModal'

vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: 'a' }))
vi.mock('swr', () => ({ default: () => ({ data: undefined }), preload: () => Promise.resolve() }))

const KEYWORDS: Record<string, KeywordInfo> = {}
const GOLD = '#f8c200'

// 블러디 가젯 (limbus.ego_gifts): the game marks what each level changed with <style="upgradeHighlight">.
const BLOODY_GADGET = {
  base: '턴 시작 시, 무작위 아군 하나가 [AttackDmgUp] 2 얻음.\n\n색욕 속성 공격 스킬을 보유한 아군에게 우선으로 적용되며, 이 경우에는 [AttackDmgUp] 1 추가로 얻음.',
  plus: '턴 시작 시, 무작위 아군 하나가 [AttackDmgUp] 2 얻음.\n\n색욕 속성 공격 스킬을 보유한 아군에게 우선으로 적용되며, 이 경우에는 <style="upgradeHighlight">[AttackDmgUp] 2</style> 추가로 얻음.',
  plusplus: '턴 시작 시, <style="upgradeHighlight">무작위 아군 둘</style>이 [AttackDmgUp] 2 얻음.\n\n색욕 속성 공격 스킬을 보유한 아군에게 우선으로 적용되며, 이 경우에는 [AttackDmgUp] 2 추가로 얻음.',
}

function Formatter({ text, upgradeHighlight }: { text: string; upgradeHighlight?: string }) {
  const format = useFormatSkillDesc()
  return <>{format(text, '#abcdef', undefined, undefined, upgradeHighlight ? { upgradeHighlight } : undefined)}</>
}
const render = (text: string, upgradeHighlight?: string) =>
  renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}><Formatter text={text} upgradeHighlight={upgradeHighlight} /></KeywordProvider>)
const renderEffect = (text: string) =>
  renderToStaticMarkup(<KeywordProvider keywords={KEYWORDS}><EffectText text={text} color="#c8b898" /></KeywordProvider>)

describe('enhanced gift text tints what the enhancement changed', () => {
  it('colours the upgradeHighlight run when asked, and only that run', () => {
    const html = render(BLOODY_GADGET.plusplus, GOLD)
    expect(html).toContain(`<span style="color:${GOLD}">무작위 아군 둘</span>이 `)
    expect(html.match(new RegExp(GOLD, 'g'))).toHaveLength(1)
    expect(html).not.toContain('upgradeHighlight')
  })

  it('keeps the plain colourless rendering when no colour is asked', () => {
    const html = render(BLOODY_GADGET.plusplus)
    expect(html).toContain('무작위 아군 둘')
    expect(html).not.toContain('color:')
  })

  it('leaves the base text untouched', () => {
    expect(renderEffect(BLOODY_GADGET.base)).not.toContain(GOLD)
  })

  it('compares each level to the one before it, as the game writes it: + tints the added bonus, ++ only the head-count', () => {
    const plus = renderEffect(BLOODY_GADGET.plus)
    expect(plus).toContain(`color:${GOLD}`)
    expect(plus).toContain('추가로 얻음')
    expect(plus.match(new RegExp(GOLD, 'g'))).toHaveLength(1)
    const plusplus = renderEffect(BLOODY_GADGET.plusplus)
    expect(plusplus).toContain(`<span style="color:${GOLD}">무작위 아군 둘</span>`)
    expect(plusplus.match(new RegExp(GOLD, 'g'))).toHaveLength(1)
  })

  it('tints a highlight that spans a line break on every line', () => {
    const html = renderEffect('<style="upgradeHighlight">첫 줄\n둘째 줄</style> 끝')
    expect(html.match(new RegExp(`color:${GOLD}`, 'g'))).toHaveLength(2)
    expect(html).toContain('첫 줄')
    expect(html).toContain('둘째 줄')
  })

  it('keeps bold and the surrounding text inside the tinted run', () => {
    const html = render('앞 <style="upgradeHighlight">값 <b>10</b>%</style> 뒤', GOLD)
    expect(html).toContain(`<span style="color:${GOLD}">값 <span style="font-weight:700">10</span>%</span>`)
  })
})
