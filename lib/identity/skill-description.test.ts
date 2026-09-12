import { expect, it } from 'vitest'
import { parseSkillDescription, unbreakableCoinIndices } from './skill-description'

it('uses the same zero-based unbreakable coin indices for every locale and renderer', () => {
  for (const [coin, unbreakable] of [['코인', '파괴 불가 코인'], ['Coin', 'Unbreakable Coin'], ['コイン', '破壊不可コイン']]) {
    const text = `[${coin} 1] normal\n[${coin} 2] ${unbreakable}\non hit\n[${coin} 3]\n${unbreakable}\nlast effect`
    expect([...unbreakableCoinIndices(text)]).toEqual([1, 2])
    expect(parseSkillDescription(text).coinSections[2].lines).toEqual(['last effect'])
  }
})
it('does not classify a global mention or another coin as unbreakable', () => {
  expect([...unbreakableCoinIndices('파괴 불가 코인 위력 증가\n[코인 1] 적중시 피해')]).toEqual([])
  expect([...unbreakableCoinIndices(null)]).toEqual([])
})
