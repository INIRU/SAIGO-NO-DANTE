import { describe, expect, it } from 'vitest'
import { buildFloorModel, rankGifts, rankThemes } from '@/features/community/lib/floor-recs'
import { catalogOf, identity, NOW, post, times } from './rec-fixtures'

const catalog = catalogOf({
  identities: [
    identity('B1', 'b', { status: ['화상'] }), identity('C1', 'c', { status: ['화상'] }), identity('E1', 'e', { status: ['침잠'] }), identity('F1', 'f', { status: ['침잠'] }), identity('Z1', 'z'),
  ],
  gifts: [{ game_id: 9001, keyword: '화상', grade: '1' }, { game_id: 9002, keyword: '화상', grade: '1' }, { game_id: 9003, keyword: '침잠', grade: '1' }, { game_id: 9004, keyword: '공통', grade: '1' }],
  themes: [
    { id: 1, difficulty: 'hard', ego_gift_ids: [9001, 9002], specific_ego_gift_ids: [], floor_info: null },
    { id: 2, difficulty: 'hard', ego_gift_ids: [9003, 9004], specific_ego_gift_ids: [], floor_info: null },
    { id: 3, difficulty: 'hard', ego_gift_ids: [9001, 9003, 9004], specific_ego_gift_ids: [], floor_info: null },
    { id: 4, difficulty: 'hard', ego_gift_ids: [9004], specific_ego_gift_ids: [], floor_info: null },
    { id: 5, difficulty: 'hard', ego_gift_ids: [9001, 9003, 9004], specific_ego_gift_ids: [], floor_info: null },
  ],
})
const plan = (identities: string[], floors: { floor: number; theme: string; gifts?: string[] }[]) =>
  post(identities, { kind: 'planner', floors: floors.map(entry => ({ difficulty: 'hard', gifts: [], ...entry })) })
const model = buildFloorModel([
  ...times(6, () => plan(['B1', 'C1'], [{ floor: 4, theme: '4' }, { floor: 5, theme: '1', gifts: ['9001'] }])),
  ...times(6, () => plan(['E1', 'F1'], [{ floor: 4, theme: '3' }, { floor: 5, theme: '2', gifts: ['9003'] }])),
  ...times(2, () => plan(['Z1'], [{ floor: 4, theme: '4' }, { floor: 5, theme: '3', gifts: ['9004'] }])),
  post(['B1'], { kind: 'deck' }),
], catalog)
const ask = (extra = {}) => ({ floor: 5, identities: ['B1', 'C1'], candidates: ['1', '2', '3', '4'], now: NOW, ...extra })

describe('theme pack suggestions', () => {
  it('weighs each plan by how much it looks like this one, so the pack similar plans took on the floor comes first', () => {
    expect(rankThemes(model, ask())[0].id).toBe('1')
    expect(rankThemes(model, ask({ identities: ['E1', 'F1'] }))[0].id).toBe('2')
  })

  it('counts the plans like this one that took each pack, and falls back to what everyone takes when it knows nothing of the plan', () => {
    const rows = rankThemes(model, ask())
    expect(rows.find(row => row.id === '1')!.count).toBe(6)
    expect(rows.find(row => row.id === '2')!.count).toBe(0)
    const blank = rankThemes(model, ask({ identities: [] }))
    expect(blank.map(row => row.id).slice(0, 2).sort()).toEqual(['1', '2'])
    expect(blank.every(row => Number.isFinite(row.score))).toBe(true)
  })

  it('follows the packs already chosen on other floors', () => {
    // Plans that took pack 4 on floor 4 and also pack 1 on floor 5 are the six burn plans; the two Z1 plans took pack 3.
    const withOthers = rankThemes(model, ask({ identities: [], others: [{ floor: 4, theme: '3' }] }))
    expect(withOthers[0].id).toBe('2')
    expect(rankThemes(model, ask({ identities: [], others: [{ floor: 4, theme: '4' }] }))[0].id).toBe('1')
  })

  it('says why: the keyword the pack\'s gifts share with the team, else similar plans, else what is common', () => {
    const rows = rankThemes(model, ask())
    expect(rows.find(row => row.id === '1')!.reasons).toEqual(['keyword:화상', 'synergy'])
    expect(rows.find(row => row.id === '4')!.reasons).toEqual(['meta'])
  })
})

describe('gift suggestions', () => {
  it('ranks the pack\'s gifts by what similar plans took on this floor and drops the gifts the plan already has', () => {
    const rows = rankGifts(model, ask({ theme: '1', candidates: ['9001', '9002'] }))
    expect(rows.map(row => row.id)).toEqual(['9001', '9002'])
    expect(rows[0].count).toBe(6)
    expect(rankGifts(model, ask({ theme: '1', candidates: ['9001', '9002'], taken: ['9001'] })).map(row => row.id)).toEqual(['9002'])
  })

  it('prefers a gift whose keyword matches the team when nothing else separates them', () => {
    // Pack 5 has no plan behind it: only the keyword tells the gifts apart.
    const rows = rankGifts(model, ask({ theme: '5', candidates: ['9001', '9003', '9004'], identities: ['B1', 'C1'] }))
    expect(rows[0].id).toBe('9001')
    expect(rows[0].reasons[0]).toBe('keyword:화상')
    expect(rankGifts(model, ask({ theme: '5', candidates: ['9001', '9003', '9004'], identities: ['E1', 'F1'] }))[0].id).toBe('9003')
  })

  it('ranks by what plans took on the floor when the floor\'s pack is not known', () => {
    const rows = rankGifts(model, ask({ candidates: ['9001', '9003', '9004'] }))
    expect(rows[0].id).toBe('9001')
    expect(rows.every(row => Number.isFinite(row.score))).toBe(true)
  })
})
