import { describe, expect, it } from 'vitest'
import { getIdentitySkillDistribution } from '@/lib/planner/types'
import type { EgoData, EgoSlot, IdentityData, IdentitySlot, SinnerData, SkillDistribution, SkillSummary } from '@/lib/planner/types'
import { computeDeckResources, computeSinProduction, fieldedEntries } from '@/lib/decks/deck-analysis'
import { isDeployedSlot } from '@/lib/constants/game'
import { DEFAULT_EGO_NAMES } from '@/lib/decks/default-ego'
import { MANUAL_ATTACK_MAIN_KEYWORDS, MAX_DECK_MAIN_KEYWORDS } from '@/lib/decks/keyword-rules'
import {
  deckAnalysisFor,
  deckKeywordSlotsFor,
  defaultEgoForSinner,
  egosByGradeFor,
  groupEgosBySinner,
  groupIdentitiesBySinner,
  groupSkillsByIdentity,
  pickedIdentitySlot,
  pruneManualMainKeywords,
  rosterFromKey,
  rosterKeyOf,
  sameKeywordList,
  skillDistributionAfter,
  toggledMainKeywords,
} from '@/features/planner/lib/deck-tab-model'

// The originals from DeckTab.tsx, kept verbatim to compare the extracted functions against.
const oldHighestDonor = (dist: SkillDistribution, targetIdx: number) => {
  let donorIdx: number | null = null
  for (let idx = 0; idx < dist.length; idx++) {
    if (idx === targetIdx || dist[idx] <= 0) continue
    if (donorIdx === null || dist[idx] > dist[donorIdx]) donorIdx = idx
  }
  return donorIdx
}
const oldLowestReceiver = (dist: SkillDistribution, targetIdx: number) => {
  let receiverIdx: number | null = null
  for (let idx = 0; idx < dist.length; idx++) {
    if (idx === targetIdx) continue
    if (receiverIdx === null || dist[idx] < dist[receiverIdx]) receiverIdx = idx
  }
  return receiverIdx
}
function oldSkillChange(dist: SkillDistribution, idx: number, delta: number): SkillDistribution | null {
  const next: SkillDistribution = [dist[0], dist[1], dist[2]]
  if (delta > 0) {
    const donorIdx = oldHighestDonor(dist, idx)
    if (dist[idx] >= 6 || donorIdx === null) return null
    next[idx] += 1
    next[donorIdx] -= 1
  } else if (delta < 0) {
    const receiverIdx = oldLowestReceiver(dist, idx)
    if (dist[idx] <= 0 || receiverIdx === null) return null
    next[idx] -= 1
    next[receiverIdx] += 1
  } else {
    return null
  }
  return next
}

function identity(id: string, sinner: string, rarity: number, extra: Partial<IdentityData> = {}): IdentityData {
  return { id, sinner_id: sinner, name_kr: `n${id}`, rarity, keywords: ['a'], skill_keyword_list: ['b'], game_id: `g${id}`, folder_name: `f${id}`, ...extra } as IdentityData
}
function slot(id: string, sinner: string, order: number, extra: Partial<IdentitySlot> = {}): IdentitySlot {
  return { identity_id: id, sinner_id: sinner, name_kr: `n${id}`, rarity: 2, keywords: [], game_id: `g${id}`, folder_name: `f${id}`, slot_order: order, ...extra }
}
function ego(id: string, sinner: string, grade: string, name = id, cost: number | null = 1): EgoData {
  return { id, sinner_id: sinner, name_kr: name, grade, sin_affinity: 'WRATH', image_url: null, cost } as unknown as EgoData
}

const sinners = [{ id: 's1', name_kr: '이상' }, { id: 's2', name_kr: '파우스트' }, { id: 's3', name_kr: '돈키호테' }] as SinnerData[]

describe('skill distribution', () => {
  it('skillDistributionAfter matches the original handler for every distribution, skill and delta', () => {
    for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6; b++) for (let c = 0; c <= 6; c++) {
      const dist: SkillDistribution = [a, b, c]
      for (const idx of [0, 1, 2]) for (const delta of [-1, 0, 1, 5, -5]) {
        expect(skillDistributionAfter(dist, idx, delta)).toEqual(oldSkillChange(dist, idx, delta))
      }
    }
  })
})

describe('roster', () => {
  it('rosterKeyOf sorts by sinner order and drops the slot order; rosterFromKey reads it back', () => {
    const slots = [slot('3', 's3', 2), slot('1', 's1', 99), slot('9', 'zz', 0), slot('2', 's2', 1)]
    const rank = new Map(sinners.map((sinner, index) => [sinner.id, index]))
    const old = [...slots].sort((a, b) => (rank.get(a.sinner_id) ?? 99) - (rank.get(b.sinner_id) ?? 99)).map(({ slot_order: _o, ...s }) => JSON.stringify(s)).join('\n')
    const key = rosterKeyOf(slots, sinners)
    expect(key).toBe(old)
    expect(rosterFromKey(key).map(s => s.sinner_id)).toEqual(['s1', 's2', 's3', 'zz'])
    expect(rosterFromKey(key)[0]).not.toHaveProperty('slot_order')
    expect(rosterKeyOf([], sinners)).toBe('')
    expect(rosterFromKey('')).toEqual([])
  })
})

describe('grouping', () => {
  const identities = [identity('1', 's1', 2), identity('2', 's1', 3), identity('3', 's2', 1), identity('4', 's1', 1), identity('5', 's2', 3)]
  const order = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
  const egos = [ego('e1', 's1', 'WAW'), ego('e2', 's1', 'ZAYIN'), ego('e3', 's2', 'ALEPH'), ego('e4', 's1', 'TETH'), ego('e5', 's2', 'UNKNOWN')]

  it('groups identities by sinner, highest rarity first', () => {
    const old = new Map<string, IdentityData[]>()
    for (const ident of identities) { if (!old.has(ident.sinner_id)) old.set(ident.sinner_id, []); old.get(ident.sinner_id)!.push(ident) }
    for (const [, list] of old) list.sort((a, b) => b.rarity - a.rarity)
    expect(groupIdentitiesBySinner(identities)).toEqual(old)
    expect([...groupIdentitiesBySinner(identities).get('s1')!.map(i => i.id)]).toEqual(['2', '1', '4'])
  })

  it('groups E.G.O by sinner in grade order', () => {
    const old = new Map<string, EgoData[]>()
    for (const e of egos) { if (!old.has(e.sinner_id)) old.set(e.sinner_id, []); old.get(e.sinner_id)!.push(e) }
    for (const [, list] of old) list.sort((a, b) => order.indexOf(a.grade) - order.indexOf(b.grade))
    expect(groupEgosBySinner(egos, order)).toEqual(old)
  })

  it('groups skills by identity in input order', () => {
    const skills = [{ identity_id: 'a', skill_type: 'x' }, { identity_id: 'b', skill_type: 'y' }, { identity_id: 'a', skill_type: 'z' }] as SkillSummary[]
    const grouped = groupSkillsByIdentity(skills)
    expect(grouped.get('a')!.map(s => s.skill_type)).toEqual(['x', 'z'])
    expect(grouped.get('b')!.map(s => s.skill_type)).toEqual(['y'])
  })
})

describe('keywords', () => {
  const identities = [identity('1', 's1', 2, { affiliation: 'AFF', association_list: ['as'] } as Partial<IdentityData>), identity('2', 's2', 2)]
  const identityById = new Map(identities.map(i => [i.id, i]))
  const skills = [{ identity_id: '1', skill_type: 'SLASH' }, { identity_id: '1', skill_type: 'PIERCE' }] as SkillSummary[]
  const skillsByIdentity = groupSkillsByIdentity(skills)

  it('deckKeywordSlotsFor matches the original mapping', () => {
    const slots = [slot('1', 's1', 0, { keywords: ['own'], skill_keyword_list: null }), slot('2', 's2', 99, { affiliation: 'X' }), slot('77', 's3', 1)]
    const old = slots.map(s => {
      const sourceIdentity = identityById.get(s.identity_id)
      return {
        slot_order: s.slot_order,
        identities: {
          skill_keyword_list: s.skill_keyword_list ?? sourceIdentity?.skill_keyword_list ?? [],
          keywords: s.keywords ?? sourceIdentity?.keywords ?? [],
          affiliation: s.affiliation ?? sourceIdentity?.affiliation ?? null,
          association_list: s.association_list ?? sourceIdentity?.association_list ?? [],
          skills: (skillsByIdentity.get(s.identity_id) ?? []).map(skill => ({ skill_type: skill.skill_type, atk_type: skill.skill_type })),
        },
      }
    })
    expect(deckKeywordSlotsFor(slots, identityById, skillsByIdentity)).toEqual(old)
  })

  it('sameKeywordList and pruneManualMainKeywords match the original expressions', () => {
    const lists = [[], ['a'], ['a', 'b'], ['b', 'a']]
    for (const x of lists) for (const y of lists) {
      expect(sameKeywordList(x, y)).toBe(x.length === y.length && x.every((k, i) => k === y[i]))
    }
    const attack = [...MANUAL_ATTACK_MAIN_KEYWORDS][0]
    const counts = { a: 2, b: 0 }
    const selected = ['a', 'b', 'c', attack]
    expect(pruneManualMainKeywords(selected, counts)).toEqual(selected.filter(k => MANUAL_ATTACK_MAIN_KEYWORDS.has(k) || (counts[k as 'a'] ?? 0) > 0))
  })

  it('toggledMainKeywords matches the original handler', () => {
    const attack = [...MANUAL_ATTACK_MAIN_KEYWORDS][0]
    const counts: Record<string, number> = { a: 2, b: 1, c: 0 }
    const old = (keyword: string, base: string[]) => {
      const isManualAttackKeyword = MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword)
      if (!isManualAttackKeyword && (counts[keyword] ?? 0) <= 0) return null
      return base.includes(keyword) ? base.filter(item => item !== keyword) : base.length >= MAX_DECK_MAIN_KEYWORDS ? base : [...base, keyword]
    }
    const full = Array.from({ length: MAX_DECK_MAIN_KEYWORDS }, (_, i) => `k${i}`)
    for (const keyword of ['a', 'b', 'c', 'zz', attack, 'k0']) for (const base of [[], ['a'], ['b', 'a'], full, [...full.slice(1), 'a']]) {
      expect(toggledMainKeywords(keyword, counts, base)).toEqual(old(keyword, base))
    }
  })
})

describe('E.G.O and identity picks', () => {
  const egos = [ego('z1', 's1', 'ZAYIN', 'default-one'), ego('z2', 's1', 'ZAYIN', 'other'), ego('t1', 's1', 'TETH'), ego('z3', 's2', 'ZAYIN', 'x'), ego('h', 's3', 'HE')]
  const egoById = new Map(egos.map(e => [e.id, e]))

  it('egosByGradeFor uses the data when known and rebuilds from the slot when not', () => {
    const egoSlots: EgoSlot[] = [
      { ego_id: 'z1', sinner_id: 's1', name_kr: 'stale', grade: 'ZAYIN', sin_affinity: 'x' },
      { ego_id: 'gone', sinner_id: 's1', name_kr: 'gone', grade: 'HE', sin_affinity: 'GLOOM' },
      { ego_id: 'z3', sinner_id: 's2', name_kr: 'x', grade: 'ZAYIN' },
    ]
    const old = (sinnerId: string) => {
      const byGrade: Record<string, unknown> = {}
      for (const s of egoSlots.filter(e => e.sinner_id === sinnerId)) {
        byGrade[s.grade] = egoById.get(s.ego_id) ?? { id: s.ego_id, sinner_id: s.sinner_id, name_kr: s.name_kr, grade: s.grade, sin_affinity: s.sin_affinity, image_url: null, cost: null }
      }
      return byGrade
    }
    for (const sinnerId of ['s1', 's2', 's3']) expect(egosByGradeFor(egoSlots, sinnerId, egoById)).toEqual(old(sinnerId))
    expect(egosByGradeFor(egoSlots, 's1', egoById).HE).toMatchObject({ id: 'gone', cost: null, image_url: null })
  })

  it('defaultEgoForSinner matches the original lookup', () => {
    const namedSinners = [{ id: 's1', name_kr: Object.keys(DEFAULT_EGO_NAMES)[0] }, { id: 's2', name_kr: 'unlisted' }, { id: 's3', name_kr: '' }] as SinnerData[]
    const defaultName = DEFAULT_EGO_NAMES[Object.keys(DEFAULT_EGO_NAMES)[0]]
    const pool = [ego('a', 's1', 'ZAYIN', 'nope'), ego('b', 's1', 'ZAYIN', defaultName), ego('c', 's2', 'ZAYIN', 'first'), ego('d', 's2', 'ZAYIN', 'second'), ego('e', 's3', 'HE')]
    const old = (sinnerId: string) => {
      const sinnerName = namedSinners.find(s => s.id === sinnerId)?.name_kr
      const dn = sinnerName ? DEFAULT_EGO_NAMES[sinnerName] : undefined
      return dn
        ? pool.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN' && e.name_kr === dn) ?? pool.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN')
        : pool.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN')
    }
    for (const sinnerId of ['s1', 's2', 's3', 'none']) expect(defaultEgoForSinner(pool, namedSinners, sinnerId)).toBe(old(sinnerId))
    expect(defaultEgoForSinner(pool, namedSinners, 's1')?.id).toBe('b')
    // the named one is missing: fall back to the first ZAYIN
    expect(defaultEgoForSinner(pool.filter(e => e.id !== 'b'), namedSinners, 's1')?.id).toBe('a')
  })

  it('pickedIdentitySlot keeps order and skill counts only for the same identity, and omits uptie 4', () => {
    const ident = identity('1', 's1', 3, { keywords: undefined, skill_keyword_list: undefined } as unknown as Partial<IdentityData>)
    const previousSame = slot('1', 's1', 4, { s1_count: 3, s2_count: 2, s3_count: 1 })
    const previousOther = slot('2', 's1', 5, { s1_count: 3, s2_count: 2, s3_count: 1 })
    const old = (previous: IdentitySlot | undefined, uptie: number) => {
      const sameIdentity = previous?.identity_id === ident.id
      return {
        identity_id: ident.id, sinner_id: ident.sinner_id, name_kr: ident.name_kr, rarity: ident.rarity,
        keywords: ident.keywords ?? [], skill_keyword_list: ident.skill_keyword_list ?? [], game_id: ident.game_id, folder_name: ident.folder_name,
        slot_order: previous?.slot_order ?? 99,
        ...(sameIdentity ? { s1_count: previous.s1_count, s2_count: previous.s2_count, s3_count: previous.s3_count } : {}),
        ...(uptie === 4 ? {} : { uptie }),
      }
    }
    for (const previous of [undefined, previousSame, previousOther]) for (const uptie of [1, 3, 4]) {
      expect(pickedIdentitySlot(ident, uptie, previous)).toEqual(old(previous, uptie))
    }
    expect(pickedIdentitySlot(ident, 4, previousSame)).not.toHaveProperty('uptie')
    expect(pickedIdentitySlot(ident, 4, previousOther)).not.toHaveProperty('s1_count')
  })
})

describe('deckAnalysisFor', () => {
  it('matches the original memo body', () => {
    const slots = [slot('1', 's1', 0, { s1_count: 3, s2_count: 2, s3_count: 1 }), slot('2', 's2', 99), slot('3', 's3', 1, { s1_count: 1, s2_count: 1, s3_count: 4 })]
    const roster = rosterFromKey(rosterKeyOf(slots, sinners))
    const skills = [
      { identity_id: '1', skill_type: 'SLASH', sin_affinity: 'WRATH', skill_order: 1, coin_count: 2 },
      { identity_id: '2', skill_type: 'PIERCE', sin_affinity: 'LUST', skill_order: 2, coin_count: 3 },
      { identity_id: '3', skill_type: 'BLUNT', sin_affinity: 'GLUTTONY', skill_order: 3, coin_count: 1 },
    ] as unknown as SkillSummary[]
    const skillsByIdentity = groupSkillsByIdentity(skills)
    const egoSlots: EgoSlot[] = [{ ego_id: 'e1', sinner_id: 's1', name_kr: 'x', grade: 'ZAYIN' }, { ego_id: 'e2', sinner_id: 's3', name_kr: 'y', grade: 'HE' }]
    const egoById = new Map([['e1', ego('e1', 's1', 'ZAYIN', 'x', 5)]])
    const deployedSinners = new Set(slots.filter(s => isDeployedSlot(s.slot_order)).map(s => s.sinner_id))
    const entries = roster.map(s => ({
      skills: skillsByIdentity.get(s.identity_id) ?? [],
      distribution: getIdentitySkillDistribution(s),
      deployed: deployedSinners.has(s.sinner_id),
      egos: egoSlots.filter(e => e.sinner_id === s.sinner_id).map(e => ({ cost: egoById.get(e.ego_id)?.cost })),
    }))
    const expected = { resources: computeDeckResources(entries), baseSinCounts: computeSinProduction(fieldedEntries(entries).map(({ skills: sk }) => ({ skills: sk }))) }
    expect(deckAnalysisFor(roster, slots, egoSlots, skillsByIdentity, egoById)).toEqual(expected)
    expect(deckAnalysisFor([], [], [], new Map(), new Map())).toEqual({ resources: computeDeckResources([]), baseSinCounts: computeSinProduction([]) })
  })
})
