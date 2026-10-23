import { describe, expect, it } from 'vitest'
import * as pako from 'pako'

import { decodePlan } from '../../../lib/planner/encoder'
import { createInitialState, plannerReducer, type PlannerState } from '../../../lib/planner/types'

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

describe('REQ-PLANNER-044 floor gifts without a theme pack', () => {
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
