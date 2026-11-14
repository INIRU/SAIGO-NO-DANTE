import { describe, expect, it } from 'vitest'
import * as pako from 'pako'

import { decodePlan } from '@/features/planner/lib/encoder'
import { createInitialState, plannerReducer, type PlannerState } from '@/lib/planner/types'

describe('plannerReducer LOAD_PLAN floor plan normalization', () => {
  it('preserves numeric floor theme IDs with gifts and memo intact', () => {
    const state = createInitialState('hard')
    const loadedState = {
      difficulty: 'hard',
      floorPlan: [
        {
          floor: 1,
          difficulty: 'hard',
          theme_id: 1013,
          gift_ids: ['9273', 1014],
          memo: '1층 메모',
        },
      ],
    } as unknown as Partial<PlannerState>

    const nextState = plannerReducer(state, { type: 'LOAD_PLAN', state: loadedState })

    expect(nextState.floorPlan[0]).toMatchObject({
      floor: 1,
      difficulty: 'hard',
      theme_id: '1013',
      gift_ids: ['9273', '1014'],
      memo: '1층 메모',
    })
  })
})

describe('decodePlan floor theme normalization', () => {
  it('normalizes numeric encoded floor theme IDs to strings', async () => {
    const payload = {
      v: 2,
      d: 'h',
      i: [],
      e: [],
      f: [1013, null],
      g: [],
    }
    const compressed = pako.deflate(new TextEncoder().encode(JSON.stringify(payload)))
    const encoded = Buffer.from(compressed)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const decoded = await decodePlan(encoded)

    expect(decoded.floorThemeIds).toEqual(['1013', null])
  })
})

describe('plannerReducer partial LOAD_PLAN', () => {
  it('keeps the floor plan when only formation slots are loaded', () => {
    const planned = plannerReducer(createInitialState('hard'), { type: 'LOAD_PLAN', state: { floorPlan: [{ floor: 1, difficulty: 'hard', theme_id: '1013', gift_ids: ['9273'], memo: 'm' }] } as never })
    const next = plannerReducer(planned, { type: 'LOAD_PLAN', state: { egoSlots: [] } })
    expect(next.floorPlan[0]).toMatchObject({ theme_id: '1013', gift_ids: ['9273'], memo: 'm' })
  })
})

describe('floor gifts without a theme pack', () => {
  it('keeps gifts picked before the pack, and clears them when the pack changes or is removed', () => {
    let state = createInitialState('hard')
    state = plannerReducer(state, { type: 'SET_FLOOR_GIFTS', floor: 1, giftIds: ['9001', '9002'] })
    expect(state.floorPlan[0].theme_id).toBeNull()
    expect(state.floorPlan[0].gift_ids).toEqual(['9001', '9002'])
    state = plannerReducer(state, { type: 'SET_FLOOR_THEME', floor: 1, themeId: '1003' })
    expect(state.floorPlan[0]).toMatchObject({ theme_id: '1003', gift_ids: ['9001', '9002'] })
    expect(plannerReducer(state, { type: 'SET_FLOOR_THEME', floor: 1, themeId: '1102' }).floorPlan[0].gift_ids).toEqual([])
    expect(plannerReducer(state, { type: 'SET_FLOOR_THEME', floor: 1, themeId: null }).floorPlan[0].gift_ids).toEqual([])
  })
})

describe('fallback theme packs', () => {
  const floor1 = (state: ReturnType<typeof createInitialState>) => state.floorPlan[0]
  const withPacks = (...ids: string[]) => ids.reduce(
    (state, themeId, i) => plannerReducer(state, i ? { type: 'ADD_FLOOR_THEME_ALT', floor: 1, themeId } : { type: 'SET_FLOOR_THEME', floor: 1, themeId }),
    createInitialState('hard'),
  )

  it('reads an old plan with no fallbacks', () => {
    const loaded = plannerReducer(createInitialState('hard'), { type: 'LOAD_PLAN', state: { floorPlan: [{ floor: 1, difficulty: 'hard', theme_id: '1013', gift_ids: ['9273'], memo: 'm' }] } as never })
    expect(floor1(loaded)).toMatchObject({ theme_id: '1013', theme_alt_ids: [], gift_ids: ['9273'] })
  })

  it('drops fallbacks that repeat, equal the first choice, or have no first choice', () => {
    const load = (entry: object) => floor1(plannerReducer(createInitialState('hard'), { type: 'LOAD_PLAN', state: { floorPlan: [entry] } as never }))
    expect(load({ floor: 1, theme_id: '1', theme_alt_ids: [2, '2', '1', null, '3'] }).theme_alt_ids).toEqual(['2', '3'])
    expect(load({ floor: 1, theme_id: null, theme_alt_ids: ['2'] }).theme_alt_ids).toEqual([])
  })

  it('adds, removes and reorders; the first pack is the first choice', () => {
    let state = withPacks('1', '2', '3', '2')
    expect(floor1(state)).toMatchObject({ theme_id: '1', theme_alt_ids: ['2', '3'] })
    state = plannerReducer(state, { type: 'REMOVE_FLOOR_THEME_ALT', floor: 1, themeId: '2' })
    expect(floor1(state).theme_alt_ids).toEqual(['3'])
    state = plannerReducer(state, { type: 'REORDER_FLOOR_THEME', floor: 1, themeIds: ['3', '1'] })
    expect(floor1(state)).toMatchObject({ theme_id: '3', theme_alt_ids: ['1'] })
    // A new first choice replaces the old one and keeps the fallbacks; clearing it promotes the next fallback.
    state = plannerReducer(state, { type: 'SET_FLOOR_THEME', floor: 1, themeId: '5' })
    expect(floor1(state)).toMatchObject({ theme_id: '5', theme_alt_ids: ['1'] })
    state = plannerReducer(state, { type: 'SET_FLOOR_THEME', floor: 1, themeId: null })
    expect(floor1(state)).toMatchObject({ theme_id: '1', theme_alt_ids: [] })
    expect(floor1(plannerReducer(state, { type: 'SET_FLOOR_THEME', floor: 1, themeId: null })).theme_id).toBeNull()
  })

  it('keeps the floor gifts unless the first choice changes', () => {
    let state = plannerReducer(withPacks('1'), { type: 'SET_FLOOR_GIFTS', floor: 1, giftIds: ['9273'] })
    state = plannerReducer(state, { type: 'ADD_FLOOR_THEME_ALT', floor: 1, themeId: '2' })
    expect(floor1(state).gift_ids).toEqual(['9273'])
    state = plannerReducer(state, { type: 'REORDER_FLOOR_THEME', floor: 1, themeIds: ['2', '1'] })
    expect(floor1(state).gift_ids).toEqual([])
  })

  it('survives the share code, and a plan without fallbacks encodes exactly as before', async () => {
    const { encodePlan, decodedPlanToPlannerState } = await import('@/features/planner/lib/encoder')
    const plain = withPacks('1013')
    const decodeJson = (code: string) => JSON.parse(new TextDecoder().decode(pako.inflate(Buffer.from(code.replace(/-/g, '+').replace(/_/g, '/'), 'base64'))))
    expect(decodeJson(await encodePlan(plain))).not.toHaveProperty('fa')

    const code = await encodePlan(withPacks('1013', '1014', '1015'))
    const back = decodedPlanToPlannerState(await decodePlan(code), [], [])
    expect(floor1(back)).toMatchObject({ theme_id: '1013', theme_alt_ids: ['1014', '1015'] })

    // Two fallbacks on every floor: the share link grows by well under 100 characters.
    let full = createInitialState('hard')
    for (const f of full.floorPlan) for (const themeId of [`${1000 + f.floor}`, `${1100 + f.floor}`, `${1200 + f.floor}`]) full = plannerReducer(full, { type: full.floorPlan[f.floor - 1].theme_id ? 'ADD_FLOOR_THEME_ALT' : 'SET_FLOOR_THEME', floor: f.floor, themeId })
    const bare = { ...full, floorPlan: full.floorPlan.map(f => ({ ...f, theme_alt_ids: [] })) }
    expect((await encodePlan(full)).length - (await encodePlan(bare)).length).toBeLessThan(100)
  })
})
