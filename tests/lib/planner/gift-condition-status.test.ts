import { expect, it } from 'vitest'
import { getGiftActivationConditionStatus, giftConditionKey } from '@/lib/planner/gift-condition-status'
import { getLocalizedAffiliation } from '@/lib/i18n/localize'

const gift = (activation_condition: unknown) => ({ activation_condition }) as Parameters<typeof getGiftActivationConditionStatus>[0]['gift']

it('reports keyword conditions as counts, not text', () => {
  const base = { formationKeywordCounts: { 화상: 2 }, allKeywordCounts: { 화상: 5 } }
  expect(getGiftActivationConditionStatus({ gift: gift({ type: 'keyword', keyword: '화상', count: 5 }), ...base }))
    .toEqual({ level: 'warn', kind: 'keyword', subjects: ['화상'], need: 5, formation: 2, all: 5 })
  expect(getGiftActivationConditionStatus({ gift: gift({ type: 'keyword', keyword: '화상', count: 6 }), ...base }))
    .toMatchObject({ level: 'unmet', formation: 2, all: 5 })
  expect(getGiftActivationConditionStatus({ gift: gift({ type: 'keyword', keyword: '화상', count: 2 }), ...base })).toBeNull()
})

it('checks affiliation conditions and keys statuses by their counts', () => {
  const status = getGiftActivationConditionStatus({ gift: gift({ type: 'affiliation', affiliation: '중지', count: 3 }),
    formationKeywordCounts: {}, allKeywordCounts: {}, formationAffiliationCounts: { 중지: 1 }, allAffiliationCounts: { 중지: 2 } })
  expect(status).toEqual({ level: 'unmet', kind: 'affiliation', subjects: ['중지'], need: 3, formation: 1, all: 2 })
  expect(giftConditionKey(status)).toBe('unmet:1/2/3')
  expect(giftConditionKey(null)).toBe('')
})

it('names the affiliations the game data added', () => {
  expect(getLocalizedAffiliation('시지프', 'en')).toBe('Sisyphe')
  expect(getLocalizedAffiliation('르루주', 'ja')).toBe('ル・ルージュ')
  expect(getLocalizedAffiliation('구 G사', 'en')).toBe('Old G Corp.')
})
