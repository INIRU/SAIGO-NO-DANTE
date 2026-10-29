import { describe, expect, it } from 'vitest'
import { conditionLines } from '@/lib/mirror-dungeon/gift-condition-lines'

describe('REQ-MD-060 which effect lines a gift condition gates', () => {
  it('REQ-MD-060 gates the condition line and its sub-lines when only some effects need it', () => {
    const lines = [
      '적의 참격 내성이 1.5 이하인 경우, 참격 내성 +0.3',
      '참격 스킬 공격 레벨 +2',
      '턴 시작시, 검계 소속 인격이 3인 이상일 때 발동 (출격 인원을 기준으로 함)',
      ' - 전투 시작 시 분노, 오만 스킬을 장착한 검계 소속 아군 인격에게 본국검 - 격법 전수 1 부여',
    ]
    expect(conditionLines(lines, true)).toEqual({ condition: 2, gated: [2, 3] })
  })
  it('REQ-MD-060 gates every other line when the whole gift needs it', () => {
    const lines = ['턴 시작 시, 흑운회 소속 인격이 3인 이상일 때 발동 (출격 인원을 기준으로 함).', '아군이 참격 위력 증가 2 얻음.', '- 빼기 코인일 경우 …']
    expect(conditionLines(lines, false)).toEqual({ condition: 0, gated: [0, 1, 2] })
  })
  it('REQ-MD-060 reads the count in English and Japanese, and finds nothing without one', () => {
    expect(conditionLines(['Gain 1 Haste.', 'If 3 or more Kurokumo Identities are deployed, deal +10% damage'], true)?.gated).toEqual([1])
    expect(conditionLines(['黒雲会所属人格が3人以上の場合、発動'], false)?.condition).toBe(0)
    expect(conditionLines(['참격 피해량 +10%'], true)).toBeNull()
  })
})
