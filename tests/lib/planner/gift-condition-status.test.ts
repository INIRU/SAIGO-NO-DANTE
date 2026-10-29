import { describe, expect, it } from 'vitest'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots, giftConditionKey, giftConditionScope } from '@/lib/planner/gift-condition-status'
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

describe('activation_condition extensions', () => {
  const empty = { formationKeywordCounts: {}, allKeywordCounts: {} }
  const slot = (slot_order: number, affiliation: string, association_list: string[] = [], skill_condition_list?: string[]) =>
    ({ identity_id: 'i' + slot_order, sinner_id: 's', name_kr: 'x', rarity: 1, keywords: [], game_id: null, folder_name: null,
      slot_order, affiliation, association_list, skill_condition_list }) as Parameters<typeof getGiftConditionCountsForSlots>[0][number]

  it('judges a tiered condition against the next unreached tier', () => {
    const tiers = [{ count: 6 }, { count: 8 }, { count: 10 }, { count: 12 }]
    const cond = gift({ type: 'keyword', keyword: '화상', count: 6, tiers })
    const at = (formation: number, all: number) => getGiftActivationConditionStatus({
      gift: cond, formationKeywordCounts: { 화상: formation }, allKeywordCounts: { 화상: all } })
    expect(at(3, 3)).toMatchObject({ level: 'unmet', need: 6, tier: { reached: 0, total: 4 } })
    expect(at(3, 6)).toMatchObject({ level: 'warn', need: 6 })
    expect(at(7, 7)).toMatchObject({ level: 'unmet', need: 8, tier: { reached: 1, total: 4 } })
    expect(at(7, 12)).toMatchObject({ level: 'warn', need: 8 })
    expect(at(12, 12)).toBeNull()
    expect(giftConditionKey(at(7, 7))).toBe('unmet:7/7/8:t1/4')
  })

  it('counts an identity once under "A or B" affiliations', () => {
    const slots = [slot(0, '검은 구름 회', ['검은 구름 회', '손 협회']), slot(1, '손 협회'), slot(2, '무관')]
    const counts = getGiftConditionCountsForSlots(slots)
    const cond = gift({ type: 'affiliation', affiliations: ['검은 구름 회', '손 협회'], count: 3 })
    expect(getGiftActivationConditionStatus({ gift: cond, ...counts })).toMatchObject({ formation: 2, all: 2, need: 3 })
    // without the members the old summed count double counts the identity (3)
    expect(getGiftActivationConditionStatus({ gift: cond, ...empty, formationAffiliationCounts: counts.formationAffiliationCounts, allAffiliationCounts: counts.allAffiliationCounts }))
      .toBeNull()
  })

  it('flags a partial condition and keeps the status', () => {
    const status = getGiftActivationConditionStatus({ gift: gift({ type: 'affiliation', affiliation: '중지', count: 3, partial: true }),
      ...empty, formationAffiliationCounts: { 중지: 1 }, allAffiliationCounts: { 중지: 1 } })
    expect(status).toMatchObject({ level: 'unmet', partial: true })
    expect(giftConditionKey(status)).toBe('unmet:1/1/3:p')
  })

  it('computes a skill (blood feast) condition only when skill data exists', () => {
    const cond = gift({ type: 'skill', skill_condition: '혈찬 소모', count: 3 })
    expect(getGiftActivationConditionStatus({ gift: cond, ...getGiftConditionCountsForSlots([slot(0, 'a')]) })).toBeNull()
    const slots = [slot(0, 'a', [], ['혈찬 소모']), slot(1, 'a', [], []), slot(2, 'a', [], ['혈찬 소모']), slot(8, 'a', [], ['혈찬 소모'])]
    expect(getGiftActivationConditionStatus({ gift: cond, ...getGiftConditionCountsForSlots(slots) }))
      .toEqual({ level: 'warn', kind: 'skill', subjects: ['혈찬 소모'], need: 3, formation: 2, all: 3 })
  })

  it('treats the 8th slot as the bench (7 deployed)', () => {
    const cond = gift({ type: 'affiliation', affiliation: 'a', count: 2 })
    const slots = [slot(0, 'a'), slot(7, 'a')]
    expect(getGiftActivationConditionStatus({ gift: cond, ...getGiftConditionCountsForSlots(slots) })).toMatchObject({ level: 'warn', formation: 1, all: 2 })
  })
})

describe('REQ-PLANNER-090 the head count a condition reads (game text)', () => {
  const counts = { formationKeywordCounts: { 화상: 2 }, allKeywordCounts: { 화상: 5 } }
  const withText = (effect_base: string, scope?: string) =>
    ({ activation_condition: { type: 'keyword', keyword: '화상', count: 4, ...(scope ? { scope } : {}) }, effect_base }) as Parameters<typeof getGiftActivationConditionStatus>[0]['gift']
  it('REQ-PLANNER-090 reads "대기 인원 제외" and "출격 인원을 기준으로 함" as the deployed seven only: the bench does not help', () => {
    expect(giftConditionScope(withText('화상 인격 4인 이상이면 (E.G.O 스킬 제외. 대기 인원 제외)'))).toBe('deployed')
    expect(giftConditionScope(withText('… (출격 인원을 기준으로 함)'))).toBe('deployed')
    expect(getGiftActivationConditionStatus({ gift: withText('(대기 인원 제외)'), ...counts })).toMatchObject({ level: 'unmet', scope: 'deployed', formation: 2 })
  })
  it('REQ-PLANNER-090 reads "편성 인원 포함" and "대기 인원 포함" as the whole formation: met with the bench, no warning', () => {
    expect(giftConditionScope(withText('(E.G.O 스킬 제외, 편성 인원 포함)'))).toBe('formation')
    expect(giftConditionScope(withText('(대기 인원 포함)'))).toBe('formation')
    expect(giftConditionScope(withText('(except E.G.O Skills; except Backup Units)'))).toBe('deployed')
    expect(giftConditionScope(withText('(出撃人員を基準とする)'))).toBe('deployed')
    expect(giftConditionScope(withText("(including 'Unique Sinking' and Backup Units; excluding E.G.O Skills)"))).toBe('formation')
    expect(giftConditionScope(withText('(E.G.Oスキルを除く、編成人員を含む)'))).toBe('formation')
    expect(getGiftActivationConditionStatus({ gift: withText('(편성 인원 포함)'), ...counts })).toBeNull()
    expect(getGiftActivationConditionStatus({ gift: { ...withText('(편성 인원 포함)'), activation_condition: { type: 'keyword', keyword: '화상', count: 6 } } as never, ...counts }))
      .toMatchObject({ level: 'unmet', scope: 'formation', all: 5 })
  })
  it('REQ-PLANNER-090 prefers the stored scope and keeps the old rule when neither says', () => {
    expect(giftConditionScope(withText('(대기 인원 제외)', 'formation'))).toBe('formation')
    expect(giftConditionScope(withText('화상 인격 4인 이상이면'))).toBeNull()
    expect(getGiftActivationConditionStatus({ gift: withText('화상 인격 4인 이상이면'), ...counts })).toMatchObject({ level: 'warn' })
  })
})
