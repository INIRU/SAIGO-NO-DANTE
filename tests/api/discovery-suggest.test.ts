import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Formation } from '@/features/community/lib/co-occurrence'
import { catalogOf, ego, identity, NOW, post, times } from '@/tests/features/community/lib/rec-fixtures'

const state = vi.hoisted(() => ({ fail: false }))
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const [X, R, P, Q, E1, E2, S0, Y] = [1, 2, 3, 4, 5, 6, 7, 8].map(uuid)

const catalog = catalogOf({
  identities: [
    identity(X, 'yisang', { status: ['화상'], factions: ['거미집'] }), identity(R, 'faust', { status: ['화상'], factions: ['거미집'] }), identity(P, 'faust', { status: ['침잠'] }),
    identity(Q, 'ishmael', { status: ['화상'] }), identity(S0, 'faust', { rarity: 1 }), identity(Y, 'yisang', { status: ['침잠'] }),
  ],
  egos: [ego(E1, 'yisang', 'TETH', { status: ['화상'] }), ego(E2, 'yisang', 'HE')],
  gifts: [{ game_id: 9001, keyword: '화상', grade: '1' }, { game_id: 9002, keyword: '공통', grade: '1' }],
  themes: [
    { id: 11, difficulty: 'hard', ego_gift_ids: [9001, 9002], specific_ego_gift_ids: [], floor_info: { 하드: [1, 2] } },
    { id: 12, difficulty: 'hard', ego_gift_ids: [9002], specific_ego_gift_ids: [], floor_info: { 하드: [1] } },
    { id: 13, difficulty: 'hard', ego_gift_ids: [9002], specific_ego_gift_ids: [], floor_info: { 하드: [3] } },
  ],
})

vi.mock('@/features/community/server/rec-data', () => {
  const plan = (identities: string[], floors: NonNullable<Formation['floors']>): Formation => ({ ...post(identities, { kind: 'planner', createdAt: NOW - 86_400_000 }), floors })
  return {
    getFormations: async () => {
      if (state.fail) throw new Error('down')
      return [
        ...times(5, () => post([X, R, Q], { egos: [E1] })), ...times(2, () => post([Y, P], { egos: [E2] })), ...times(15, () => post([P])),
        ...times(3, () => plan([X, R], [{ floor: 1, theme: '11', gifts: ['9001'], difficulty: 'hard' }])),
        ...times(2, () => plan([Y, P], [{ floor: 1, theme: '12', gifts: ['9002'], difficulty: 'hard' }])),
      ]
    },
    getRecCatalog: async () => catalog,
  }
})

import { GET } from '@/app/api/discovery/suggest/route'

const ask = (query: string) => GET(new Request(`http://localhost/api/discovery/suggest?${query}`))

beforeEach(() => { state.fail = false })

describe('GET /api/discovery/suggest', () => {
  it('REQ-DECKS-022 suggests the asked sinner\'s identities beside every identity on the board, with reasons, partners and the board\'s archetype', async () => {
    const body = await (await ask(`type=identity&sinner=faust&with=${X},${Q}`)).json()
    expect(body.items.map((row: { id: string }) => row.id)).toEqual([R, P])
    expect(body.items[0]).toMatchObject({ id: R })
    expect(body.items[0].reasons.every((code: string) => /^(keyword|faction|sin):.+|synergy|meta|new$/.test(code))).toBe(true)
    expect(body.items[0].partners.map((partner: { id: string }) => partner.id)).toEqual(expect.arrayContaining([X, Q]))
    expect(body.items[0].partners.filter((partner: { chosen: boolean }) => partner.chosen).length).toBeGreaterThan(0)
    expect(body.archetype).toEqual({ keywords: ['화상'], factions: [] })
  })

  it('REQ-DECKS-040 answers for an empty board and ignores the order of the board and the LCB starter', async () => {
    const empty = await (await ask('type=identity&sinner=faust')).json()
    expect(empty.items.length).toBe(2)
    expect(empty.archetype).toEqual({ keywords: [], factions: [] })
    expect(empty.items.map((row: { id: string }) => row.id)).not.toContain(S0)
    const a = await (await ask(`type=identity&sinner=faust&with=${X},${Q}`)).json()
    const b = await (await ask(`type=identity&sinner=faust&with=${Q},${X},${S0}`)).json()
    expect(b).toEqual(a)
  })

  it('REQ-DECKS-023 REQ-DECKS-044 suggests the identity\'s sinner\'s E.G.O with the posts that equip it, reasons and partners, leaving a filled grade out', async () => {
    const body = await (await ask(`type=ego&identity=${X}&with=${R}`)).json()
    expect(body.items[0]).toMatchObject({ id: E1, count: 5 })
    expect(body.items[0].partners[0]).toMatchObject({ id: R, chosen: true })
    expect(body.archetype.keywords).toEqual(['화상'])
    const taken = await (await ask(`type=ego&identity=${X}&equipped=${E1}`)).json()
    expect(taken.items.map((row: { id: string }) => row.id)).toEqual([E2])
  })

  it('REQ-PLANNER-029 REQ-PLANNER-040 lists the packs the floor can show in its difficulty and that the plan has not used elsewhere, with plan counts and reasons', async () => {
    const body = await (await ask(`type=floor&floor=1&identities=${X},${R}&difficulty=hard&others=2:12`)).json()
    expect(body.themes.map((row: { id: string }) => row.id)).toEqual(['11'])
    expect(body.themes[0]).toMatchObject({ id: '11', count: 3 })
    expect(body.themes[0].reasons.length).toBeGreaterThan(0)
    // Plans like this one decide; a pack only dissimilar plans took is left out, but with nothing known of the plan every plan counts.
    const alike = await (await ask(`type=floor&floor=1&identities=${X},${R}`)).json()
    expect(alike.themes.map((row: { id: string }) => row.id)).toEqual(['11'])
    const open = await (await ask('type=floor&floor=1&identities=')).json()
    expect(open.themes.map((row: { id: string }) => row.id)).toEqual(['11', '12'])
    // Pack 13 only shows on floor 3.
    expect(open.themes.map((row: { id: string }) => row.id)).not.toContain('13')
  })

  it('REQ-PLANNER-030 REQ-PLANNER-041 lists the gifts of the floor\'s pack that similar plans took, and every gift seen on the floor when the pack is not given', async () => {
    const body = await (await ask(`type=floor&floor=1&identities=${X},${R}&theme=11&taken=9002`)).json()
    expect(body.gifts.map((row: { id: string }) => row.id)).toEqual(['9001'])
    expect(body.gifts[0]).toMatchObject({ id: '9001', count: 3 })
    const anyPack = await (await ask(`type=floor&floor=1&identities=${X},${R}`)).json()
    expect(anyPack.gifts[0].id).toBe('9001')
  })

  it('REQ-DECKS-024 refuses bad parameters and answers an unreadable count with an error, not guesses', async () => {
    expect((await ask('type=identity&sinner=faust&with=not-an-id')).status).toBe(400)
    expect((await ask('type=identity')).status).toBe(400)
    expect((await ask('type=ego&identity=nope')).status).toBe(400)
    expect((await ask('type=floor&floor=99')).status).toBe(400)
    expect((await ask(`type=floor&floor=1&difficulty=impossible`)).status).toBe(400)
    expect((await ask(`type=floor&floor=1&theme=abc`)).status).toBe(400)
    expect((await ask('type=nothing')).status).toBe(400)
    state.fail = true
    expect((await ask(`type=identity&sinner=faust&with=${X}`)).status).toBe(503)
    expect((await ask(`type=floor&floor=1`)).status).toBe(503)
  })
})
