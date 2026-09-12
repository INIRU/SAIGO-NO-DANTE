import { expect, it } from 'vitest'
import { getKeywordCategory } from '@/lib/keywords/category'

it('restores all five categories from source tags without classifying translated prose', () => {
  const cases = [
    ['화상', 'Combustion', 'negative', '상태이상'],
    ['진동 - 사슬', 'VibrationChain', 'negative', '상태이상'],
    ['신속', 'Agility', null, '버프'],
    ['피해량 증가', 'AttackDmgUp', null, '버프'],
    ['색욕 보호', 'ScarletTakeDamageDown', null, '버프'],
    ['속박', 'Binding', null, '디버프'],
    ['체력 회복 감소', 'TakeHpHealReduce', null, '디버프'],
    ['분노 취약', 'CrimsonTakeDamageUp', null, '디버프'],
    ['봉인된 검', 'MiddleFatherSwordOneOutis', null, '고유'],
    ['시간 유예', 'TimeSuspend', 'negative', '디버프'],
    ['파괴 불가 코인', 'SuperCoin', null, '기타'],
    ['참격', null, null, '기타'],
    ['알 수 없는 키워드', null, null, '기타'],
  ] as const
  for (const [name, tag, effect_type, expected] of cases) expect(getKeywordCategory({name, tag, effect_type})).toBe(expected)
})
