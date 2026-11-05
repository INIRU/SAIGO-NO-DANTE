import { describe, expect, it } from 'vitest'
import { coinPowerLabels, isUnbreakableCoinText, parseSkillDescription, skillDescriptionBlocks, splitEgoSkillDescription, unbreakableCoinIndices, unbreakableCoinSet } from '@/lib/identity/skill-description'

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

const RAW = '[WhenUse] 본문 [Burst]\n\n<style="highlight">두번째 문단</style>\n'
  + '<coin=1>[SuperCoin]\n[OnSucceedAttack] 피해</coin>\n'
  + '<coin=2>[OnSucceedAttack] 침잠 1\n- 추가</coin>\n'
  + '<coin=3>[OnSucceedAttack] 이 코인이 [SuperCoin]이면 +1</coin>'

describe('REQ-SHARED-020 raw skill descriptions (<coin=N> blocks)', () => {
  it('REQ-SHARED-020 splits the main text into lines and each coin block into its own section', () => {
    const parsed = parseSkillDescription(RAW)
    expect(parsed.globalEffects).toEqual(['[WhenUse] 본문 [Burst]', '<style="highlight">두번째 문단</style>'])
    expect([...parsed.paragraphBreaks]).toEqual([1])
    expect(parsed.coinSections).toEqual([
      { coinNum: 1, isUnbreakable: true, lines: ['[OnSucceedAttack] 피해'] },
      { coinNum: 2, isUnbreakable: false, lines: ['[OnSucceedAttack] 침잠 1', '- 추가'] },
      { coinNum: 3, isUnbreakable: false, lines: ['[OnSucceedAttack] 이 코인이 [SuperCoin]이면 +1'] },
    ])
  })

  it('REQ-SHARED-020 marks a coin unbreakable by a line that starts with [SuperCoin], not by a mention inside a sentence', () => {
    expect([...unbreakableCoinIndices(RAW)]).toEqual([0])
    expect([...unbreakableCoinIndices('<coin=2>[SuperCoin]<style="highlight"></style>\n[OnSucceedAttack] 피해</coin>')]).toEqual([1])
    // The main text may say "all coins become [SuperCoin]"; that is not a coin.
    expect([...unbreakableCoinIndices('[StartBattle]\n- 모든 코인이 [SuperCoin]으로 변경됨\n<coin=1>피해</coin>')]).toEqual([])
  })

  it('REQ-SHARED-020 still reads the old unbreakable wording inside a coin block and an old [코인 N] line with [SuperCoin]', () => {
    expect([...unbreakableCoinIndices('<coin=1>일반</coin>\n<coin=2>파괴 불가 코인\n피해</coin>')]).toEqual([1])
    expect([...unbreakableCoinIndices('[코인 1] [SuperCoin]\n피해')]).toEqual([0])
  })

  it('REQ-SHARED-020 keeps every line balanced: a tag open across lines reopens, and an unclosed main tag never reaches the coins', () => {
    expect(parseSkillDescription('<style="highlight">가\n나</style>').globalEffects).toEqual(['<style="highlight">가', '<style="highlight">나</style>'])
    expect(parseSkillDescription('<coin=1><b>- 가\n- 나</b></coin>').coinSections[0].lines).toEqual(['<b>- 가', '<b>- 나</b>'])
    const parsed = parseSkillDescription('<style="highlight">본문\n<coin=1>효과</coin>')
    expect(parsed.globalEffects).toEqual(['<style="highlight">본문'])
    expect(parsed.coinSections[0].lines).toEqual(['효과'])
  })

  it('REQ-SHARED-020 reads a raw description without coins as main lines only', () => {
    const parsed = parseSkillDescription('[WhenUse] 가\n[OnHit] 나')
    expect(parsed.globalEffects).toEqual(['[WhenUse] 가', '[OnHit] 나'])
    expect(parsed.coinSections).toEqual([])
  })

  it('REQ-SHARED-020 tells an unbreakable coin text from other text', () => {
    expect(isUnbreakableCoinText('파괴 불가 코인 위력 증가')).toBe(true)
    expect(isUnbreakableCoinText('Unbreakable Coin')).toBe(true)
    expect(isUnbreakableCoinText('破壊不可コイン')).toBe(true)
    expect(isUnbreakableCoinText('[SuperCoin]\n피해')).toBe(true)
    expect(isUnbreakableCoinText('[OnSucceedAttack] 이 코인이 [SuperCoin]이면')).toBe(false)
    expect(isUnbreakableCoinText('')).toBe(false)
    expect(isUnbreakableCoinText(null)).toBe(false)
  })

  it('REQ-SHARED-020 lists display blocks: main lines, then each coin block whole; old text one block per line', () => {
    expect(skillDescriptionBlocks(RAW)).toEqual([
      { text: '[WhenUse] 본문 [Burst]', coinStart: false },
      { text: '', coinStart: false },
      { text: '<style="highlight">두번째 문단</style>', coinStart: false },
      { text: '<coin=1>[SuperCoin]\n[OnSucceedAttack] 피해</coin>', coinStart: true },
      { text: '<coin=2>[OnSucceedAttack] 침잠 1\n- 추가</coin>', coinStart: true },
      { text: '<coin=3>[OnSucceedAttack] 이 코인이 [SuperCoin]이면 +1</coin>', coinStart: true },
    ])
    expect(skillDescriptionBlocks('가\n[코인 1] 나\n다')).toEqual([
      { text: '가', coinStart: false }, { text: '[코인 1] 나', coinStart: true }, { text: '다', coinStart: false },
    ])
  })
})

describe('REQ-SHARED-020 E.G.O skill effect split', () => {
  it('REQ-SHARED-020 splits the old [코인 N] format as before (follow-up lines belong to their coin)', () => {
    expect(splitEgoSkillDescription('[사용시] 본문\n\n[코인 1] 효과1\n후속\n[코인 2] 파괴 불가 코인')).toEqual({
      normalEffect: '[사용시] 본문', coinEffects: ['효과1\n후속', '파괴 불가 코인'],
    })
    expect(splitEgoSkillDescription('[Coin 2] Effect')).toEqual({ normalEffect: '', coinEffects: ['', 'Effect'] })
    expect(splitEgoSkillDescription('')).toEqual({ normalEffect: '', coinEffects: [] })
  })

  it('REQ-SHARED-020 splits raw <coin=N> blocks, leaving coins without a block empty and the raw text untouched', () => {
    expect(splitEgoSkillDescription('<style="highlight">본문 A</style>\n\n본문 B\n<coin=1>[SuperCoin]\n효과</coin>\n<coin=3>끝</coin>')).toEqual({
      normalEffect: '<style="highlight">본문 A</style>\n\n본문 B', coinEffects: ['[SuperCoin]\n효과', '', '끝'],
    })
  })
})

describe('coin_list from the game coin data', () => {
  const coin = (scale: number, operator: 'ADD' | 'SUB' | 'MUL', unbreakable = false) => ({ scale, operator, color: null, unbreakable })
  it('takes the unbreakable coins from coin_list and the text only when there is none', () => {
    const text = '[코인 1] 파괴 불가 코인'
    expect([...unbreakableCoinSet({ description: text, coin_list: [coin(7, 'ADD'), coin(7, 'ADD', true)] })]).toEqual([1])
    expect([...unbreakableCoinSet({ description: text, coin_list: null })]).toEqual([0])
    expect([...unbreakableCoinSet({ description: text, coin_list: [] })]).toEqual([0])
  })
  it('labels each coin with its value and operator', () => {
    expect(coinPowerLabels({ coin_list: [coin(7, 'ADD'), coin(12, 'SUB'), coin(2, 'MUL')] })).toEqual(['+7', '-12', '×2'])
    expect(coinPowerLabels({})).toEqual([])
  })
})
