import { describe, expect, it } from 'vitest'
import type { IdentityDetail, IdentitySlot } from '@/lib/decks/identity-types'
import { getGiftActivationConditionStatus } from '@/lib/planner/gift-condition-status'
import { computeFormationGiftKeywordCounts, computeAllGiftKeywordCounts } from '@/lib/decks/keyword-rules'
import {
  buildEgoGiftConditionLookup, buildFormationEgos, buildInsightIdentities, buildInsightSlots, buildSkillExchangeRow, computeDeckAnalysis,
  findCustomSkillSlots, groupEgosBySinner, mergeViewerFields, normalizeDeckDetail, pickDeployedIdentityIds, resolveDeckKeywords,
  slotUptie, sortDeckSlots, type DeckDetail, type EgoSlot,
} from '@/features/decks/lib/deck-detail-model'

const skill = (order: number, over: Record<string, unknown> = {}) => ({
  id: `s${order}`, name: `skill${order}`, skill_type: 'attack', atk_type: 'slash', sin_affinity: 'wrath', coins: 1, base_power: 1, coin_power: 1,
  skill_order: order, atk_weight: 1, offense_level: 1, uptie_level: 3, ...over,
})
const identity = (id: string, sinner_id: string, over: Partial<IdentityDetail> = {}): IdentityDetail => ({
  id, sinner_id, folder_name: 'f', game_id: '10101', keywords: [], name_kr: id, tier: 1, rarity: 1, hp: 1, speed_min: 1, speed_max: 2, def_level: 1,
  slash_res: null, pierce_res: null, blunt_res: null, skills: [skill(1), skill(2), skill(3)], passives: [], ...over,
})
const slot = (id: string | null, slot_order: number, sinner_id = 'yi-sang', over: Partial<IdentitySlot> = {}): IdentitySlot => ({
  slot_order, gacksung: true, identities: id ? identity(id, sinner_id) : null, ...over,
})
const ego = (id: string, sinner_id: string, over: Record<string, unknown> = {}) => ({
  id, name_kr: id, grade: 'HE', sin_affinity: 'wrath', sinner_id, folder_name: null, image_url: `img-${id}`, cost: [1], ...over,
})

describe('slotUptie', () => {
  it('uses the saved uptie, else 2 for a non-awakened row and 4 otherwise', () => {
    expect(slotUptie(slot('a', 0, 'yi-sang', { uptie: 3 }))).toBe(3)
    expect(slotUptie(slot('a', 0, 'yi-sang', { gacksung: false }))).toBe(2)
    expect(slotUptie(slot('a', 0))).toBe(4)
    expect(slotUptie(null)).toBe(4)
    expect(slotUptie(slot('a', 0, 'yi-sang', { uptie: 0 }))).toBe(0)
  })
})

describe('sortDeckSlots', () => {
  it('orders by slot, the waiting slots (99) last, without touching the input', () => {
    const input = [slot('c', 99), slot('b', 3), slot('a', 0), slot('d', 99)]
    expect(sortDeckSlots(input).map(s => s.identities!.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(input.map(s => s.identities!.id)).toEqual(['c', 'b', 'a', 'd'])
    expect(sortDeckSlots([])).toEqual([])
  })
})

describe('deck E.G.O', () => {
  const rows: EgoSlot[] = [
    { grade: 'WAW', ego: ego('e1', 'faust') as EgoSlot['ego'] },
    { grade: 'ZAYIN', ego: ego('e2', 'faust') as EgoSlot['ego'] },
    { grade: 'HE', ego: null },
    { grade: 'ALEPH', ego: ego('e3', 'yi-sang') as EgoSlot['ego'] },
  ]

  it('maps sinner and grade to the E.G.O the strip draws, skipping empty rows', () => {
    const out = buildFormationEgos(rows, 'ko')
    expect(Object.keys(out).sort()).toEqual(['faust', 'yi-sang'])
    expect(out.faust.WAW).toEqual({ id: 'e1', name: 'e1', sin_affinity: 'wrath', image_url: 'img-e1' })
    expect(Object.keys(out.faust)).toEqual(['WAW', 'ZAYIN'])
    expect(buildFormationEgos([], 'ko')).toEqual({})
  })

  it('groups by sinner in grade order', () => {
    const out = groupEgosBySinner(rows)
    expect(out.faust.map(e => e.grade)).toEqual(['ZAYIN', 'WAW'])
    expect(out['yi-sang'].map(e => e.grade)).toEqual(['ALEPH'])
    expect(groupEgosBySinner([])).toEqual({})
  })
})

describe('deck keywords and custom skill slots', () => {
  it('keeps the saved keywords that are known, else falls back to the formation', () => {
    const sorted = [slot('a', 0, 'yi-sang', { identities: identity('a', 'yi-sang', { keywords: ['화상'] }) })]
    expect(resolveDeckKeywords(['화상', '없는키워드'], sorted)).toEqual(['화상'])
    expect(resolveDeckKeywords(['없는키워드'], sorted)).toEqual(['화상'])
    expect(resolveDeckKeywords(null, sorted)).toEqual(['화상'])
    expect(resolveDeckKeywords([], [])).toEqual([])
  })

  it('finds slots whose distribution is not 3-2-1', () => {
    const slots = [slot('a', 0), slot('b', 1, 'faust', { s1_count: 2, s2_count: 2, s3_count: 2 }), slot('c', 2, 'ryoshu', { s1_count: 3, s2_count: 2, s3_count: 1 })]
    expect(findCustomSkillSlots(slots).map(s => s.identities!.id)).toEqual(['b'])
  })
})

describe('buildEgoGiftConditionLookup', () => {
  const slots = [
    slot('a', 0, 'yi-sang', { identities: identity('a', 'yi-sang', { keywords: ['화상'], skill_keyword_list: ['화상'] }) }),
    slot('b', 9, 'faust', { identities: identity('b', 'faust', { keywords: ['화상'] }) }),
    slot('w', 99, 'ryoshu', { identities: identity('w', 'ryoshu', { keywords: ['출혈'] }) }),
  ]
  const burn = { name: '불꽃', activation_condition: { type: 'keyword' as const, keyword: '화상', count: 3 } }
  const plain = { name: '평범', activation_condition: null }
  const unset = { name: '미정' }

  it('rates each gift by its name with the same call the formation check makes', () => {
    const out = buildEgoGiftConditionLookup(slots, [burn, plain, unset])
    const assigned = slots.slice(0, 2)
    const keywordSlots = assigned.map(s => ({
      slot_order: s.slot_order,
      identities: { skill_keyword_list: s.identities!.skill_keyword_list ?? s.identities!.keywords ?? [], affiliation: null, association_list: [], skills: s.identities!.skills.map(k => ({ skill_type: k.skill_type, atk_type: k.atk_type ?? k.skill_type })) },
    }))
    const expected = getGiftActivationConditionStatus({
      gift: { activation_condition: burn.activation_condition },
      formationKeywordCounts: computeFormationGiftKeywordCounts(keywordSlots),
      allKeywordCounts: computeAllGiftKeywordCounts(keywordSlots),
      formationAffiliationCounts: {}, allAffiliationCounts: {}, formationAffiliationMembers: {}, allAffiliationMembers: {},
    })
    expect(Object.keys(out)).toEqual(['불꽃', '평범', '미정'])
    expect(out['불꽃']).not.toBeNull()
    expect(out['불꽃']).toEqual(expected)
    expect(out['평범']).toBeNull()
    expect(out['미정']).toBeNull()
  })

  it('is empty without gifts', () => {
    expect(buildEgoGiftConditionLookup(slots, [])).toEqual({})
  })
})

describe('insight data', () => {
  const filled = [
    slot('f', 1, 'faust', { uptie: 2 }),
    slot('y', 0, 'yi-sang', { s1_count: 2, s2_count: 2, s3_count: 2 }),
    slot('r', 99, 'ryoshu'),
  ]

  it('orders the identities by sinner and keeps each one\'s rows at its own uptie', () => {
    const out = buildInsightSlots(filled)
    expect(out.map(r => r.identity.id)).toEqual(['y', 'f', 'r'])
    expect(out[0].skills.map(k => k.identity_id)).toEqual(['y', 'y', 'y'])
    expect(buildInsightSlots([])).toEqual([])
  })

  it('picks the deployed identities (slots 0-6)', () => {
    expect([...pickDeployedIdentityIds(buildInsightSlots(filled))].sort()).toEqual(['f', 'y'])
  })

  it('writes the insight identities with the sinner names and the saved distribution', () => {
    const out = buildInsightIdentities(buildInsightSlots(filled), 'ko', id => `name:${id}`)
    expect(out.map(r => [r.id, r.sinnerName])).toEqual([['y', 'name:yi-sang'], ['f', 'name:faust'], ['r', 'name:ryoshu']])
    expect(out[0].imageUrl).toContain('10101_normal_info')
    expect(out[0]!.deck?.wrath).toBe(6)
    expect(out[1]!.deck?.wrath).toBe(6)
  })

  it('sums resources over the deployed identities and counts E.G.O of the same sinner', () => {
    const rows: EgoSlot[] = [{ grade: 'HE', ego: ego('e', 'yi-sang', { ego_skills: [] }) as EgoSlot['ego'] }, { grade: 'WAW', ego: null }]
    const out = computeDeckAnalysis(rows, buildInsightSlots(filled))
    expect(out.sinCounts).toBe(out.resources.production)
    expect(out.resources.identities).toBe(2)
    expect(out.resources.deployedOnly).toBe(true)
    // the base production ignores the saved distribution: 3 + 2 + 1 per identity
    expect(out.baseSinCounts.wrath).toBe(12)
    expect(out.sinCounts.wrath).toBe(12)
    const none = computeDeckAnalysis([], [])
    expect(none.resources.identities).toBe(0)
  })
})

describe('deck detail response', () => {
  it('turns one-element relations into plain objects and defaults missing lists', () => {
    const raw = {
      id: 'd', deck_identities: [{ slot_order: 0, identities: [identity('a', 'yi-sang')] }, { slot_order: 1, identities: [] }, { slot_order: 2, identities: identity('b', 'faust') }],
      deck_egos: [{ grade: 'HE', ego: [ego('e', 'faust')] }, { grade: 'WAW', ego: null }],
    } as unknown as DeckDetail
    const out = normalizeDeckDetail(raw)
    expect(out.deck_identities.map(s => s.identities?.id ?? null)).toEqual(['a', null, 'b'])
    expect(out.deck_egos?.map(e => e.ego?.id ?? null)).toEqual(['e', null])
    const empty = normalizeDeckDetail({ id: 'x' } as unknown as DeckDetail)
    expect(empty.deck_identities).toEqual([])
    expect(empty.deck_egos).toEqual([])
  })

  it('patches only the viewer fields into the deck already shown', () => {
    const prev = { id: 'd', title: 'T', vote_count: 1, view_count: 1, deck_identities: [slot('a', 0)] } as unknown as DeckDetail
    const fixed = { ...prev, title: 'other', deck_code: 'C', is_owner: true, is_admin: false, vote_count: 5, view_count: 9, all_sinner_egos: undefined, deck_identities: [] } as unknown as DeckDetail
    const out = mergeViewerFields(prev, fixed)
    expect(out).toMatchObject({ title: 'T', deck_code: 'C', is_owner: true, is_admin: false, vote_count: 5, view_count: 9, all_sinner_egos: [] })
    expect(out.deck_identities).toBe(prev.deck_identities)
  })
})

describe('buildSkillExchangeRow', () => {
  it('reads the three attack skills and the saved distribution', () => {
    const row = buildSkillExchangeRow(slot('a', 0, 'yi-sang', { s1_count: 1, s2_count: 2, s3_count: 3 }), 'ko', '이상')
    expect(row.distribution).toEqual([1, 2, 3])
    expect(row.identity).toMatchObject({ name: 'a', sinnerName: '이상' })
    expect(row.identity.imageUrl).toContain('10101_normal_info')
    expect(row.skills.map(k => k?.name)).toEqual(['skill1', 'skill2', 'skill3'])
  })

  it('leaves a missing skill empty, skips defense skills and falls back to the default distribution', () => {
    const noSecond = identity('a', 'yi-sang', { skills: [skill(1), skill(2, { skill_type: 'defense' }), skill(3)], folder_name: null })
    const row = buildSkillExchangeRow({ slot_order: 0, gacksung: true, identities: noSecond }, 'ko', 'x')
    expect(row.skills.map(k => k?.name ?? null)).toEqual(['skill1', null, 'skill3'])
    expect(row.distribution).toEqual([3, 2, 1])
    expect(row.identity.imageUrl).toBeNull()
  })
})
