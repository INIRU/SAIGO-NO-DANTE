import { describe, expect, it } from 'vitest'
import { collectEgoKeywordTags, collectKeywordTags } from './ego-keywords'

describe('EGO keyword coverage', () => {
  it('finds Dhyana in a gift effect without mistaking a passive title for a buff', () => {
    expect([...collectKeywordTags({name:'참선',desc:'적중 시 [Zazen] 1을 얻음. [Zazen] 위력 증가'})]).toEqual(['Zazen'])
    expect([...collectKeywordTags({name:'참선',desc:'흐트러짐에서 회복할 때 체력 회복'})]).toEqual([])
  })
  it('includes passive effects, corrosion and later-stage coin text', () => {
    const result = collectEgoKeywordTags(
      { awakeningSkillId: 1, corrosionSkillId: 2, passiveList: [3], skillKeywordList: ['Sinking'] },
      new Map([[1, { skillData: [{ buffKeyword: 'Binding' }] }], [2, {}]]),
      new Map([[3, {}]]),
      new Map<string, unknown>([['1_1', { desc: '[Sinking]' }], ['1_5', { coinlist: [{ coindescs: [{ desc: '[WaveSinking]' }] }] }], ['2_4', { desc: '[Vulnerable]' }], ['99_4', { desc: '[EnemyOnly]' }]]),
      new Map([[3, { desc: '적중 시 [Zazen]을 얻음' }]]),
    )
    expect([...result].sort()).toEqual(['Binding', 'Sinking', 'Vulnerable', 'WaveSinking', 'Zazen'])
  })
  it('fails instead of silently omitting a missing passive', () => {
    expect(() => collectEgoKeywordTags({ passiveList: [3] }, new Map(), new Map(), new Map(), new Map())).toThrow('Missing EGO passive source: 3')
  })
})
