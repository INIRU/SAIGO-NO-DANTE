import { describe, expect, it } from 'vitest'
import {
  computeAllGiftAffiliationCounts,
  computeFormationGiftAffiliationCounts,
  countGiftConditionAffiliations,
  getDeckIdentityAffiliations,
  normalizeGiftAffiliationLabel,
  type DeckKeywordSlot,
} from '@/lib/decks/keyword-rules'

describe('deck gift affiliation rules', () => {
  const slots: DeckKeywordSlot[] = [
    { slot_order: 0, identities: { affiliation: '중지', association_list: ['중지'] } },
    { slot_order: 1, identities: { affiliation: '중지', association_list: ['림버스 컴퍼니', '중지'] } },
    { slot_order: 2, identities: { affiliation: '중지' } },
    { slot_order: 7, identities: { affiliation: '중지' } },
    { slot_order: 99, identities: { affiliation: '중지' } },
  ]

  it('인격의 대표 소속과 association_list를 중복 없이 세야 한다', () => {
    expect(getDeckIdentityAffiliations({ affiliation: '중지', association_list: ['중지', '림버스 컴퍼니'] }))
      .toEqual(['중지', '림버스 컴퍼니'])
  })

  it('1~7번 편성 소속 수와 대기 포함 소속 수를 분리한다', () => {
    expect(computeFormationGiftAffiliationCounts(slots).중지).toBe(3)
    expect(computeAllGiftAffiliationCounts(slots).중지).toBe(4)
  })

  it('게임 추출 조건에 붙은 설명성 접두어를 제거하고 실제 소속을 매칭한다', () => {
    const formationCounts = computeFormationGiftAffiliationCounts(slots)

    expect(normalizeGiftAffiliationLabel('- 턴 시작 시 중지')).toBe('턴 시작 시 중지')
    expect(countGiftConditionAffiliations(formationCounts, ['- 턴 시작 시 중지'])).toBe(3)
  })
})
