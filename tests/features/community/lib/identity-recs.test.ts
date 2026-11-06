import { describe, expect, it } from 'vitest'
import { legacySuggestIdentities } from '@/scripts/recommender/legacy'
import { rbo } from '@/scripts/recommender/metrics'
import { buildIdentityModel, companionsOfIdentity, detectArchetype, rankIdentities, suggestIdentities, IDENTITY_CONFIG, type IdentityConfig } from '@/features/community/lib/identity-recs'
import { catalogOf, identity, NOW, post, times } from './rec-fixtures'

const ids = (items: { id: string }[]) => items.map(item => item.id)

describe('identity recommender: synergy without a hard minimum', () => {
  // Candidates X1..X3 are each fielded 6 times; B1 is fielded 4 times, with X1 once, X2 three times and X3 never.
  const catalog = catalogOf({
    identities: [identity('B1', 'b'), identity('X1', 'x'), identity('X2', 'x'), identity('X3', 'x'), identity('Z1', 'z')],
  })
  const formations = [
    post(['B1', 'X1']), ...times(3, () => post(['B1', 'X2'])),
    ...times(5, () => post(['Z1', 'X1'])), ...times(3, () => post(['Z1', 'X2'])), ...times(6, () => post(['Z1', 'X3'])),
  ]
  const model = buildIdentityModel(formations, catalog)

  it('REQ-DECKS-040 lets a pair seen once count for a little, a pair seen three times for more, and a pair never seen for nothing', () => {
    const { ranked } = rankIdentities(model, { context: ['B1'], sinner: 'x', now: NOW })
    expect(ids(ranked)).toEqual(['X2', 'X1', 'X3'])
    // The old rule dropped every pair under three shared posts, so X1 and X3 could not be told apart.
    expect(ids(legacySuggestIdentities(formations.map(f => ({ ...f, votes: 0, views: 0 })), ['B1'], new Set(['X1', 'X2', 'X3']))).length).toBe(1)
  })

  it('REQ-DECKS-040 answers for every candidate of the sinner, released by now and not already on the board', () => {
    const withNew = buildIdentityModel(formations, catalogOf({ identities: [identity('B1', 'b'), identity('X1', 'x'), identity('X2', 'x', { release: '2027-01-01' }), identity('X4', 'b')] }))
    expect(ids(rankIdentities(withNew, { context: ['B1'], sinner: 'x', now: NOW }).ranked)).toEqual(['X1'])
    expect(rankIdentities(model, { context: ['B1'], sinner: 'nobody', now: NOW }).ranked).toEqual([])
  })
})

describe('identity recommender: the whole board decides', () => {
  // 화상 teams (B1, C1, D1) field A1; the 거미집-like pair E1+A2 is fielded together more often than anything else.
  const catalog = catalogOf({
    identities: [
      identity('A1', 'a', { status: ['화상'], factions: ['F1'] }), identity('A2', 'a', { status: ['침잠'], factions: ['G'] }),
      identity('A3', 'a', { status: ['진동'], factions: ['H'] }), identity('A4', 'a', { status: ['출혈'], factions: ['I'] }),
      identity('B1', 'b', { status: ['화상'], factions: ['F1'] }), identity('C1', 'c', { status: ['화상'], factions: ['F1'] }),
      identity('D1', 'd', { status: ['화상'], factions: ['F2'] }), identity('E1', 'e', { status: ['침잠'], factions: ['G'] }),
    ],
  })
  const formations = [
    ...times(5, () => post(['B1', 'C1', 'A1'])), ...times(2, () => post(['B1', 'D1', 'A1'])), ...times(2, () => post(['C1', 'D1', 'A1'])),
    ...times(30, () => post(['E1', 'A2'])), ...times(4, () => post(['A2'])), ...times(2, () => post(['A3'])), post(['A4']),
  ]
  const model = buildIdentityModel(formations, catalog)
  const ask = (context: string[]) => rankIdentities(model, { context, sinner: 'a', now: NOW }).ranked

  it('REQ-DECKS-041 does not let the one tightest partner carry a candidate the rest of the board never fielded', () => {
    // E1 and A2 are fielded together 30 times, yet B1 and C1 (and the keyword they share) back A1.
    expect(ids(ask(['B1', 'C1', 'E1']))[0]).toBe('A1')
    expect(ids(ask(['E1']))[0]).toBe('A2')
  })

  it('REQ-DECKS-041 asks the posts of the whole board, not only the strongest pair, when kits and affiliations cannot tell the candidates apart', () => {
    const plain = catalogOf({ identities: ['A1', 'A2'].map(id => identity(id, 'a', { status: ['화상'] })).concat(['B1', 'C1', 'E1'].map((id, i) => identity(id, 'bce'[i], { status: ['화상'] }))) })
    const plainModel = buildIdentityModel([
      ...times(5, () => post(['B1', 'C1', 'A1'])), ...times(2, () => post(['B1', 'A1'])), ...times(2, () => post(['C1', 'A1'])), ...times(30, () => post(['E1', 'A2'])),
    ], plain)
    // A2 is the more popular and E1 pairs with it 30 times; B1 and C1 both pair with A1.
    expect(ids(rankIdentities(plainModel, { context: ['B1', 'C1', 'E1'], sinner: 'a', now: NOW }).ranked)[0]).toBe('A1')
    expect(ids(rankIdentities(plainModel, { context: ['E1'], sinner: 'a', now: NOW }).ranked)[0]).toBe('A2')
  })

  it('REQ-DECKS-041 follows the board\'s main keyword: with burn identities on the board, the burn identity leads without any shared post', () => {
    const lonely = buildIdentityModel([], catalog)
    expect(ids(rankIdentities(lonely, { context: ['B1', 'C1', 'D1'], sinner: 'a', now: NOW }).ranked)[0]).toBe('A1')
    expect(ids(rankIdentities(lonely, { context: ['E1'], sinner: 'a', now: NOW }).ranked)[0]).toBe('A2')
  })

  it('REQ-DECKS-041 shifts the list when one more identity joins the board instead of flipping it', () => {
    const before = ids(ask(['B1', 'C1']))
    const after = ids(ask(['B1', 'C1', 'E1']))
    expect(after[0]).toBe(before[0])
    expect(rbo(before, after)).toBeGreaterThan(0.6)
  })
})

describe('identity recommender: empty board, new identities and starters', () => {
  const catalog = catalogOf({
    identities: [
      identity('P1', 'p', { status: ['화상'] }), identity('P2', 'p', { status: ['출혈'] }), identity('P3', 'p', { status: ['진동'], release: '2026-10-15' }),
      identity('P0', 'p', { rarity: 1 }), identity('Q1', 'q', { status: ['화상'] }), identity('Q0', 'q', { rarity: 1 }),
    ],
  })
  const model = buildIdentityModel([...times(9, () => post(['P1', 'Q1'])), ...times(3, () => post(['P2'])), post(['P1', 'P0'])], catalog)

  it('REQ-DECKS-042 ranks an empty board by recent use, labels each with its main keyword, and lifts a new identity nobody has fielded yet', () => {
    const { items, archetype } = suggestIdentities(model, { context: [], sinner: 'p', now: NOW })
    expect(archetype).toEqual({ keywords: [], factions: [] })
    expect(ids(items)).toEqual(['P3', 'P1', 'P2'])
    expect(items.find(item => item.id === 'P3')!.reasons).toContain('new')
    expect(items.find(item => item.id === 'P1')!.reasons).toContain('keyword:화상')
    expect(items.every(item => item.reasons.length > 0 && Number.isFinite(item.score))).toBe(true)
  })

  it('REQ-DECKS-042 never suggests the LCB 수감자 starter and does not count it as part of the board', () => {
    const { items } = suggestIdentities(model, { context: ['Q0'], sinner: 'p', now: NOW })
    expect(ids(items)).not.toContain('P0')
    expect(items).toEqual(suggestIdentities(model, { context: [], sinner: 'p', now: NOW }).items)
  })

  it('REQ-DECKS-042 weighs recent posts more when the half-life is set, so the list follows what is used now', () => {
    const catalogRecent = catalogOf({ identities: [identity('R1', 'r'), identity('R2', 'r')] })
    const old = times(6, () => post(['R1'], { createdAt: NOW - 90 * 86_400_000 }))
    const fresh = times(4, () => post(['R2'], { createdAt: NOW - 86_400_000 }))
    const recent = buildIdentityModel([...old, ...fresh], catalogRecent)
    const cfg: IdentityConfig = { ...IDENTITY_CONFIG, halfLife: 14 }
    expect(ids(rankIdentities(recent, { context: [], sinner: 'r', now: NOW }, { ...IDENTITY_CONFIG, halfLife: 0 }).ranked)[0]).toBe('R1')
    expect(ids(rankIdentities(recent, { context: [], sinner: 'r', now: NOW }, cfg).ranked)[0]).toBe('R2')
  })
})

describe('identity recommender: reasons, partners, archetype', () => {
  const catalog = catalogOf({
    identities: [
      identity('A1', 'a', { status: ['화상'], factions: ['거미집'] }), identity('A2', 'a', { status: ['침잠'] }),
      identity('B1', 'b', { status: ['화상'], factions: ['새벽 사무소'] }), identity('C1', 'c', { status: ['화상'], factions: ['새벽 사무소'] }),
      identity('D1', 'd', { status: ['화상'], factions: ['거미집'] }), identity('G1', 'g', { status: ['화상'], factions: ['거미집'] }),
    ],
  })
  const model = buildIdentityModel([...times(5, () => post(['A1', 'B1', 'C1', 'D1'])), ...times(4, () => post(['A1', 'G1'])), ...times(2, () => post(['A2']))], catalog)

  it('REQ-DECKS-043 names the archetype the board adds up to: the keyword most of it shares and the affiliation two or more share', () => {
    const board = ['B1', 'C1', 'D1'].map(id => catalog.identities[id])
    expect(detectArchetype(catalog, board)).toEqual({ keywords: ['화상'], factions: ['새벽 사무소'] })
    expect(detectArchetype(catalog, [catalog.identities.B1])).toEqual({ keywords: ['화상'], factions: [] })
    expect(detectArchetype(catalog, [])).toEqual({ keywords: [], factions: [] })
    expect(detectArchetype(catalog, [catalog.identities.B1, catalog.identities.A2])).toEqual({ keywords: ['화상', '침잠'], factions: [] })
  })

  it('REQ-DECKS-043 gives readable reasons first (keyword:<name>, faction:<name>) and the board members it goes with before other partners', () => {
    const { items, archetype } = suggestIdentities(model, { context: ['B1', 'C1', 'D1'], sinner: 'a', now: NOW })
    expect(archetype.keywords).toEqual(['화상'])
    const first = items[0]
    expect(first.id).toBe('A1')
    expect(first.reasons[0]).toMatch(/^(keyword|faction|sin):/)
    expect(first.reasons.every(code => /^(keyword|faction|sin):.+|synergy|meta|new$/.test(code))).toBe(true)
    expect(first.partners.length).toBeLessThanOrEqual(3)
    expect(first.partners.slice(0, 3).filter(partner => partner.chosen).map(partner => partner.id).sort()).toEqual(['B1', 'C1', 'D1'])
    expect(first.partners.every(partner => partner.score > 0 && partner.score <= 1)).toBe(true)
  })

  it('REQ-DECKS-043 fills the remaining partner places with the strongest identities of sinners not on the board', () => {
    const { items } = suggestIdentities(model, { context: ['B1'], sinner: 'a', now: NOW })
    const partners = items.find(item => item.id === 'A1')!.partners
    expect(partners[0]).toMatchObject({ id: 'B1', chosen: true })
    const others = partners.filter(partner => !partner.chosen)
    expect(others.length).toBeGreaterThan(0)
    expect(others.every(partner => !['A1', 'A2', 'B1'].includes(partner.id))).toBe(true)
  })
})

describe('companions on an identity page', () => {
  const catalog = catalogOf({
    identities: [identity('A', 'a', { status: ['화상'] }), identity('R', 'r', { status: ['화상'] }), identity('P', 'p', { status: ['출혈'] }), identity('S', 'a', { status: ['화상'] })],
  })
  // P (popular, in every post) against R (rare, only beside A).
  const model = buildIdentityModel([...times(5, () => post(['A', 'R', 'P'])), ...times(15, () => post(['P']))], catalog)

  it('REQ-COMMUNITY-066 lists identities of other sinners that posts field with this one, tighter pairs over popular ones, with the shared count', () => {
    const rows = companionsOfIdentity(model, 'A')
    expect(rows.map(row => row.identity_id)).toEqual(['R', 'P'])
    expect(rows[0]).toMatchObject({ identity_id: 'R', count: 5 })
    expect(rows[0].score).toBeGreaterThan(rows[1].score)
  })

  it('REQ-COMMUNITY-066 has none for an identity no post fields, never lists the same sinner, and keeps at most the limit', () => {
    expect(companionsOfIdentity(model, 'S')).toEqual([])
    expect(companionsOfIdentity(model, 'nobody')).toEqual([])
    expect(companionsOfIdentity(model, 'A', { limit: 1 })).toHaveLength(1)
  })
})
