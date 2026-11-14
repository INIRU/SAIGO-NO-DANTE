import { describe, expect, it } from 'vitest'
import type { Passive, Skill } from '@/lib/types'
import { computePassiveDiffs, computeSkillDiffs, diffDescriptionLines } from '@/features/catalog/lib/uptie-diff'

describe('diffDescriptionLines', () => {
  it('returns only changed lines, removed before their replacement, tagged with the coin', () => {
    const from = '[사용시] 위력 +1\n[코인 1] [적중시] 파열 2 부여\n[적중시] 침잠 1 부여\n[코인 2] [적중시] 파열 2 부여'
    const to = '[사용시] 위력 +1\n[코인 1] [적중시] 파열 3 부여\n[적중시] 침잠 1 부여\n[코인 2] [적중시] 파열 2 부여\n[적중시] 충전 1 증가'
    expect(diffDescriptionLines(from, to)).toEqual([
      { kind: 'removed', coin: 1, text: '[적중시] 파열 2 부여' },
      { kind: 'added', coin: 1, text: '[적중시] 파열 3 부여' },
      { kind: 'added', coin: 2, text: '[적중시] 충전 1 증가' },
    ])
  })

  it('treats the same text in another coin as a change and ignores blank lines', () => {
    expect(diffDescriptionLines('[코인 1] 효과\n\n', '[코인 2] 효과')).toEqual([
      { kind: 'removed', coin: 1, text: '효과' },
      { kind: 'added', coin: 2, text: '효과' },
    ])
    expect(diffDescriptionLines('같음\n', '같음')).toEqual([])
  })
})

describe('diffDescriptionLines of raw descriptions', () => {
  it('tags the lines of each <coin=N> block with that coin', () => {
    const from = '[WhenUse] 위력 +1\n<coin=1>[OnSucceedAttack] 파열 2\n- 추가</coin>\n<coin=2>[OnSucceedAttack] 침잠 1</coin>'
    const to = '[WhenUse] 위력 +1\n<coin=1>[OnSucceedAttack] 파열 3\n- 추가</coin>\n<coin=2>[OnSucceedAttack] 침잠 1\n[OnSucceedAttack] 충전 1</coin>'
    expect(diffDescriptionLines(from, to)).toEqual([
      { kind: 'removed', coin: 1, text: '[OnSucceedAttack] 파열 2' },
      { kind: 'added', coin: 1, text: '[OnSucceedAttack] 파열 3' },
      { kind: 'added', coin: 2, text: '[OnSucceedAttack] 충전 1' },
    ])
  })

  it('sees the same coin text as unchanged whether it is written as a [코인 N] line or a block', () => {
    expect(diffDescriptionLines('[코인 1] 효과', '<coin=1>효과</coin>')).toEqual([])
  })

  it('returns lines that are balanced on their own, so each can be drawn separately', () => {
    expect(diffDescriptionLines('', '<style="highlight">- 가\n\n- 나</style>\n끝')).toEqual([
      { kind: 'added', coin: 0, text: '<style="highlight">- 가' },
      { kind: 'added', coin: 0, text: '<style="highlight">- 나</style>' },
      { kind: 'added', coin: 0, text: '끝' },
    ])
  })

  it('ignores a line left holding only tags', () => {
    expect(diffDescriptionLines('<style="highlight">가', '<style="highlight">가\n</style>')).toEqual([])
  })
})

const skill = (over: Partial<Skill>) => ({ id: 's', skill_order: 1, base_power: 3, coin_power: 2, coins: 2, description: 'a', ...over } as Skill)

describe('computeSkillDiffs / computePassiveDiffs', () => {
  it('maps a skill to its next-level row with numeric deltas, and lists new skills', () => {
    const { diffs, newSkills } = computeSkillDiffs(
      [skill({ id: 'x', offense_level: 68 }), skill({ id: 'same', skill_order: 2 })],
      [skill({ id: 'x4', offense_level: 71, coin_power: 3 }), skill({ id: 'same4', skill_order: 2 }), skill({ id: 'new', skill_order: 3 })],
    )
    expect(diffs.get('x')).toMatchObject({ next: { id: 'x4' }, offense_level: { from: 68, to: 71 }, coin_power: { from: 2, to: 3 } })
    expect(diffs.get('x')?.base_power).toBeUndefined()
    expect(diffs.has('same')).toBe(false)
    expect(newSkills.map(s => s.id)).toEqual(['new'])
  })

  it('flags translation-only description changes and sin count changes on passives', () => {
    const p = (over: Partial<Passive>) => ({ id: 'p', passive_type: 'battle', passive_order: 1, sin_count: 3, description: 'a', ...over } as Passive)
    const { diffs } = computePassiveDiffs([p({ description_en: 'old' })], [p({ id: 'p4', description_en: 'new', sin_count: 4 })])
    expect(diffs.get('p')).toMatchObject({ next: { id: 'p4' }, sin_count: { from: 3, to: 4 } })
  })
})
