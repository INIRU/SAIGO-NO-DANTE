import { expect, it } from 'vitest'
import { runStateToPlannerState, saveDraftToLocal, saveRunToHistory } from '../../../lib/planner/encoder'
import { createInitialRunState, runReducer } from '../../../lib/planner/run-types'
import { createInitialState } from '../../../lib/planner/types'

it('exports observed run data while leaving unobserved plan goals and source untouched', () => {
  const source = createInitialState('hard')
  source.title = 'Original plan'
  source.floorPlan[0] = { ...source.floorPlan[0], theme_id: '101', gift_ids: ['planned'], memo: 'planned memo', constraints: [1] }
  source.floorPlan[1] = { ...source.floorPlan[1], theme_id: '102', gift_ids: ['not acquired'], memo: 'later' }
  const original = structuredClone(source)
  let run = runReducer(createInitialRunState(), { type: 'LOAD_FROM_PLAN', planState: source })
  run = runReducer(run, { type: 'SET_FLOOR_THEME', themeId: '101' })
  run = runReducer(run, { type: 'ACQUIRE_GIFT', giftId: 'actual' })
  run = runReducer(run, { type: 'SET_FLOOR_MEMO', memo: 'observed memo' })
  run = runReducer(run, { type: 'SWAP_IDENTITY', sinnerId: 's1', newSlot: {
    identity_id: 'i1', sinner_id: 's1', name_kr: 'Observed', rarity: 3, keywords: [],
    game_id: '100', folder_name: 'folder', slot_order: 0, s1_count: 2, s2_count: 3, s3_count: 1,
  } })
  run = runReducer(run, { type: 'NEXT_FLOOR' })
  const draft = runStateToPlannerState(run)
  expect(draft.floorPlan[0]).toMatchObject({ theme_id: '101', gift_ids: ['actual'], memo: 'observed memo', constraints: [1] })
  expect(draft.floorPlan[1]).toMatchObject({ theme_id: null, gift_ids: [], memo: '', constraints: [] })
  expect(draft.giftInventory).toEqual(['final_actual'])
  expect(draft.identitySlots[0]).toMatchObject({ identity_id: 'i1', s1_count: 2, s2_count: 3, s3_count: 1 })
  expect(draft.title).toBe('Original plan')
  draft.identitySlots[0].name_kr = 'Edited draft'
  expect(run.identitySlots[0].name_kr).toBe('Observed')
  expect(source).toEqual(original)
  expect(run.sourcePlanSnapshot?.floorPlan?.[0].gift_ids).toEqual(['planned'])
})

it('does not carry constraints when the observed theme diverges from the plan', () => {
  const source = createInitialState('hard')
  source.floorPlan[0] = { ...source.floorPlan[0], theme_id: '101', constraints: [1] }
  let run = runReducer(createInitialRunState(), { type: 'LOAD_FROM_PLAN', planState: source })
  run = runReducer(run, { type: 'SET_FLOOR_THEME', themeId: 'different' })
  expect(runStateToPlannerState(run).floorPlan[0]).toMatchObject({ theme_id: 'different', constraints: [] })
})

it('reports whether the planner draft handoff was actually stored', () => {
  const previous = globalThis.localStorage
  let written = ''
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem: (_: string, value: string) => { written = value } } })
  try {
    const draft = runStateToPlannerState(createInitialRunState())
    expect(saveDraftToLocal(draft)).toBe(true)
    expect(JSON.parse(written).floorPlan).toHaveLength(15)
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem: () => { throw new Error('quota') } } })
    expect(saveDraftToLocal(draft)).toBe(false)
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous })
  }
})

it('reports run history write success and quota failure', () => {
  const previous = globalThis.localStorage
  let written = ''
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => '[]', setItem: (_: string, value: string) => { written = value },
  } })
  try {
    const run = createInitialRunState()
    expect(saveRunToHistory(run)).toBe(true)
    expect(JSON.parse(written)[0].state.difficulty).toBe('hard')
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: () => '[]', setItem: () => { throw new Error('quota') },
    } })
    expect(saveRunToHistory(run)).toBe(false)
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous })
  }
})

it('REQ-ASSIST-076 exports the gifts held at the end as final gifts, keeping the plan\'s start and observed gifts and enhancements', () => {
  const source = createInitialState('hard')
  source.giftInventory = ['start_100', 'observe_200', 'final_300_plus', 'final_400']
  let run = runReducer(createInitialRunState(), { type: 'LOAD_FROM_PLAN', planState: source })
  for (const giftId of ['100', '300', '500', '500']) run = runReducer(run, { type: 'ACQUIRE_GIFT', giftId })
  run = runReducer(run, { type: 'NEXT_FLOOR' })
  run = runReducer(run, { type: 'ACQUIRE_GIFT', giftId: '600' })
  run = runReducer(run, { type: 'CRAFT_FUSION', materialIds: ['500', '600'], resultId: '700' })
  const draft = runStateToPlannerState(run)
  // 100 is the start gift, 300 keeps its planned +, 400 was never held, the fused 500 and 600 became 700; one 500 is still held.
  expect(draft.giftInventory).toEqual(['start_100', 'observe_200', 'final_300_plus', 'final_500', 'final_700'])
  // Each floor still lists what was taken there, fused or not (the fusion result on the floor it was made).
  expect(draft.floorPlan[0].gift_ids).toEqual(['100', '300', '500', '500'])
  expect(draft.floorPlan[1].gift_ids).toEqual(['600', '700'])
})
