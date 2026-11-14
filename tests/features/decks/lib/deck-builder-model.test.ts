import { describe, expect, it } from 'vitest'
import type { EGO, Identity, Passive, Sinner, Skill } from '@/lib/types'
import {
  buildDeckDraftState, buildDeckInsightData, buildDeckKeywordSlots, buildDeckSaveRows, buildIdentityUpties, countCustomSkillsets, defaultEgoSlots,
  groupPassivesByIdentity, groupSkillsByIdentity, pickEgoSlots, pickIdentitySlots, sanitizeDeckMainKeywords, toggleFormationSlot, toggleMainKeywordIn,
} from '@/features/decks/lib/deck-builder-model'

const sinner = (id: string, name_kr: string): Sinner => ({ id, name_kr, order_num: 1 }) as unknown as Sinner
const sinners = [sinner('yi-sang', '이상'), sinner('faust', '파우스트'), sinner('ryoshu', '료슈')]
const identity = (id: string, sinner_id: string, over: Record<string, unknown> = {}) => ({ id, sinner_id, name_kr: id, folder_name: 'f', game_id: '10101', keywords: ['화상'], skill_keyword_list: ['화상'], ...over }) as unknown as Identity
const ego = (id: string, sinner_id: string, grade: string, name_kr = id) => ({ id, sinner_id, grade, name_kr, cost: [1], ego_skills: [] }) as unknown as EGO
const skill = (id: string, identity_id: string, order: number, over: Record<string, unknown> = {}) => ({ id, identity_id, skill_order: order, skill_type: 'attack', sin_affinity: 'wrath', uptie_level: 3, ...over }) as unknown as Skill

describe('sanitizeDeckMainKeywords', () => {
  it('keeps known keywords once each, in order, at most five', () => {
    expect(sanitizeDeckMainKeywords(undefined)).toEqual([])
    expect(sanitizeDeckMainKeywords(['화상', '없음', '화상', '파열'])).toEqual(['화상', '파열'])
    expect(sanitizeDeckMainKeywords(['참격', '관통', '타격', '화상', '파열', '침잠', '호흡'])).toEqual(['참격', '관통', '타격', '화상', '파열'])
  })
})

describe('slot pickers', () => {
  const identities = [identity('a', 'yi-sang'), identity('b', 'faust')]
  const egos = [ego('e1', 'yi-sang', 'ZAYIN'), ego('e2', 'faust', 'HE')]

  it('points sinner ids at identities and leaves unknown ids empty', () => {
    const out = pickIdentitySlots({ 'yi-sang': 'a', faust: 'missing' }, identities)
    expect(out['yi-sang']).toBe(identities[0])
    expect(Object.keys(out)).toEqual(['yi-sang', 'faust'])
    expect(out.faust).toBeUndefined()
  })

  it('points sinner and grade at E.G.O, keeping an empty entry unless told not to', () => {
    const ids = { 'yi-sang': { ZAYIN: 'e1', HE: 'nope' }, faust: { HE: 'nope' } }
    expect(pickEgoSlots(ids, egos)).toEqual({ 'yi-sang': { ZAYIN: egos[0] }, faust: {} })
    expect(pickEgoSlots(ids, egos, { keepEmptySinners: false })).toEqual({ 'yi-sang': { ZAYIN: egos[0] } })
  })

  it('starts with the default E.G.O, else the ZAYIN one, else nothing', () => {
    const pool = [ego('z1', 'yi-sang', 'ZAYIN'), ego('d1', 'yi-sang', 'HE', '오감도'), ego('z2', 'faust', 'ZAYIN'), ego('h3', 'ryoshu', 'HE')]
    const out = defaultEgoSlots(sinners, pool)
    expect(out['yi-sang']).toEqual({ HE: pool[1] })
    expect(out.faust).toEqual({ ZAYIN: pool[2] })
    expect(out.ryoshu).toBeUndefined()
  })
})

describe('skills and passives at each slot\'s uptie', () => {
  it('maps placed identities to their uptie', () => {
    const slots = { 'yi-sang': identity('a', 'yi-sang'), faust: undefined, ryoshu: identity('c', 'ryoshu') }
    expect([...buildIdentityUpties(sinners, slots, { 'yi-sang': 3, faust: 4 })]).toEqual([['a', 3], ['c', undefined]])
  })

  it('keeps the rows nearest the uptie, the top uptie per order, sorted by skill and variant order', () => {
    const rows = [
      skill('s2', 'a', 2), skill('s1', 'a', 1, { variant_order: 2 }), skill('s1b', 'a', 1, { variant_order: 1 }),
      skill('old', 'a', 3, { uptie_level: 1 }), skill('x', 'b', 1, { uptie_level: 4 }),
    ]
    const out = groupSkillsByIdentity(rows, new Map([['a', 3], ['b', 4]]))
    expect(out.a.map(s => s.id)).toEqual(['s1b', 's1', 's2'])
    expect(out.b.map(s => s.id)).toEqual(['x'])
    expect(groupSkillsByIdentity([], new Map())).toEqual({})
  })

  it('sorts passives by their order', () => {
    const p = (id: string, order: number) => ({ id, identity_id: 'a', passive_order: order, passive_type: 'battle', uptie_level: 3 }) as unknown as Passive
    const out = groupPassivesByIdentity([p('p2', 2), p('p1', 1)], new Map([['a', 3]]))
    expect(out.a.map(x => (x as unknown as { id: string }).id)).toEqual(['p1', 'p2'])
  })
})

describe('buildDeckKeywordSlots', () => {
  it('lists placed identities with their formation slot, 99 when not in the order, and their attack types', () => {
    const slots = { 'yi-sang': identity('a', 'yi-sang', { affiliation: 'W', association_list: ['X'] }), ryoshu: identity('c', 'ryoshu', { skill_keyword_list: undefined }) }
    const skills = { a: [skill('s', 'a', 1, { atk_type: 'pierce' }), skill('t', 'a', 2)] }
    const out = buildDeckKeywordSlots(sinners, slots, ['ryoshu'], skills)
    expect(out.map(s => s.slot_order)).toEqual([99, 0])
    expect(out[0].identities).toEqual({ skill_keyword_list: ['화상'], affiliation: 'W', association_list: ['X'], skills: [{ skill_type: 'attack', atk_type: 'pierce' }, { skill_type: 'attack', atk_type: 'attack' }] })
    expect(out[1].identities).toEqual({ skill_keyword_list: [], affiliation: null, association_list: [], skills: [] })
  })
})

describe('toggles', () => {
  it('picks, drops and refuses past the limit with the same list', () => {
    expect(toggleMainKeywordIn(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleMainKeywordIn(['a', 'b'], 'a')).toEqual(['b'])
    const full = ['1', '2', '3', '4', '5']
    expect(toggleMainKeywordIn(full, '6')).toBe(full)
  })

  it('moves a sinner in and out of the formation order, twelve at most', () => {
    expect(toggleFormationSlot(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleFormationSlot(['a', 'b'], 'a')).toEqual(['b'])
    const full = Array.from({ length: 12 }, (_, i) => `s${i}`)
    expect(toggleFormationSlot(full, 'extra')).toBe(full)
    expect(toggleFormationSlot(full, 's3')).toHaveLength(11)
  })

  it('counts the custom skill distributions of placed identities only', () => {
    const slots = { 'yi-sang': identity('a', 'yi-sang'), faust: undefined }
    expect(countCustomSkillsets({ 'yi-sang': [3, 2, 1], faust: [1, 1, 4], ryoshu: [2, 2, 2] }, slots)).toBe(0)
    expect(countCustomSkillsets({ 'yi-sang': [2, 2, 2], faust: [1, 1, 4] }, slots)).toBe(1)
  })
})

describe('buildDeckInsightData', () => {
  it('lists placed identities with names, deployed ids and the resource totals', () => {
    const a = identity('a', 'yi-sang')
    const c = identity('c', 'ryoshu', { folder_name: null })
    const out = buildDeckInsightData({
      sinners, deckSlots: { 'yi-sang': a, ryoshu: c }, egoSlots: {}, formationOrder: ['yi-sang'], skillDistribution: { 'yi-sang': [1, 1, 1] },
      skillsByIdentityId: { a: [skill('s1', 'a', 1), skill('s2', 'a', 2), skill('s3', 'a', 3)] }, passivesByIdentityId: {}, locale: 'ko', localizeSinnerName: id => `n:${id}`,
    })
    expect(out.identities.map(i => [i.id, i.sinnerName, i.imageUrl === ''])).toEqual([['a', 'n:yi-sang', false], ['c', 'n:ryoshu', true]])
    expect([...out.deployedIds]).toEqual(['a'])
    expect(out.resources.identities).toBe(1)
    expect(out.sinCounts).toBe(out.resources.production)
    expect(out.identities[0].deck?.wrath).toBe(3)
    expect(out.baseSinCounts.wrath).toBe(6)
  })

  it('is empty with nothing placed', () => {
    const out = buildDeckInsightData({ sinners, deckSlots: {}, egoSlots: {}, formationOrder: [], skillDistribution: {}, skillsByIdentityId: {}, passivesByIdentityId: {}, locale: 'ko', localizeSinnerName: id => id })
    expect(out.identities).toEqual([])
    expect(out.deployedIds.size).toBe(0)
  })
})

describe('save rows and draft', () => {
  const deckSlots = { 'yi-sang': identity('a', 'yi-sang'), ryoshu: identity('c', 'ryoshu') }
  const egoSlots = { 'yi-sang': { ZAYIN: ego('e1', 'yi-sang', 'ZAYIN') }, faust: {} }

  it('writes one row per placed sinner with the defaults for what was not touched', () => {
    const out = buildDeckSaveRows({ sinners, deckSlots, gacksungSlots: { ryoshu: true }, upties: { 'yi-sang': 2 }, formationOrder: ['ryoshu'], skillDistribution: { ryoshu: [1, 2, 3] }, egoSlots })
    expect(out.identitySlots).toEqual([
      { identity_id: 'a', gacksung: false, uptie: 2, slot_order: 99, s1_count: 3, s2_count: 2, s3_count: 1 },
      { identity_id: 'c', gacksung: true, uptie: 4, slot_order: 0, s1_count: 1, s2_count: 2, s3_count: 3 },
    ])
    expect(out.egoRows).toEqual([{ ego_id: 'e1', grade: 'ZAYIN' }])
  })

  it('stores ids, not objects, and a zero save time', () => {
    const draft = buildDeckDraftState({
      title: 'T', contentType: 'guide', description: 'D', deckSlots: { ...deckSlots, faust: undefined }, egoSlots, formationOrder: ['ryoshu'],
      mainKeywords: ['화상'], mainKeywordsManual: true, gacksungSlots: {}, skillDistribution: {}, upties: {},
    })
    expect(draft).toEqual({
      title: 'T', contentType: 'guide', description: 'D', deckSlotIds: { 'yi-sang': 'a', ryoshu: 'c' }, egoSlotIds: { 'yi-sang': { ZAYIN: 'e1' }, faust: {} },
      formationOrder: ['ryoshu'], mainKeywords: ['화상'], mainKeywordsManual: true, savedAt: 0, gacksungSlots: {}, skillDistribution: {}, upties: {},
    })
  })
})
