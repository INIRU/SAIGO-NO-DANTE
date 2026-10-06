import { expect, it } from 'vitest'
import { createInitialRunState, normalizeRunState, runReducer } from '../../../lib/planner/run-types'
import { decodedPlanToPlannerState, decodePlan, encodePlan, loadRunDraft, runStateToPlannerState } from '../../../lib/planner/encoder'
import { createInitialState, type EgoData, type IdentityData } from '../../../lib/planner/types'

it('keeps planned goals separate from observations and preserves the source', () => {
  const plan = createInitialState('hard')
  plan.floorPlan[0] = { ...plan.floorPlan[0], theme_id: '1013', gift_ids: ['9273'], memo: 'Keep this gift', constraints: [1] }
  plan.giftInventory = ['9273', 'final_9274_plusplus']
  const run = runReducer(createInitialRunState(), { type: 'LOAD_FROM_PLAN', planState: plan })
  expect(run.maxFloors).toBe(5)
  expect(run.giftInventory).toEqual([])
  expect(run.floorLogs[0].themeId).toBeNull()
  expect(run.sourcePlanSnapshot).toEqual(plan)
  plan.floorPlan[0].memo = 'Changed after import'
  expect(run.sourcePlanSnapshot?.floorPlan?.[0].memo).toBe('Keep this gift')
})

it('preserves acquisition history when a duplicate is removed and rejects missing fusion materials', () => {
  let run = createInitialRunState()
  run = runReducer(run, { type: 'ACQUIRE_GIFT', giftId: '1' })
  run = runReducer(run, { type: 'ACQUIRE_GIFT', giftId: '1' })
  run = runReducer(run, { type: 'REMOVE_GIFT', giftId: '1' })
  expect(run.giftInventory).toEqual(['1'])
  expect(run.floorLogs[0].acquiredGifts).toEqual(['1', '1'])
  expect(runReducer(run, { type: 'CRAFT_FUSION', materialIds: ['1', '1'], resultId: '2' })).toBe(run)
  expect(runReducer(run, { type: 'REMOVE_GIFT', giftId: 'missing' })).toBe(run)
  expect(runReducer(run, { type: 'CRAFT_FUSION', materialIds: [], resultId: '2' })).toBe(run)
  expect(runReducer(run, { type: 'CRAFT_FUSION', materialIds: ['1'], resultId: '' })).toBe(run)
  const fused = runReducer(run, { type: 'CRAFT_FUSION', materialIds: ['1'], resultId: '2' })
  expect(fused.giftInventory).toEqual(['2'])
  expect(fused.floorLogs[0].acquiredGifts).toEqual(['1', '1', '2'])
  expect(fused.floorLogs[0].removedGifts).toEqual(['1', '1'])
  // A result already held is not duplicated; the materials still leave.
  const held = runReducer(runReducer(runReducer(createInitialRunState(), { type: 'ACQUIRE_GIFT', giftId: '3' }), { type: 'ACQUIRE_GIFT', giftId: '4' }),
    { type: 'CRAFT_FUSION', materialIds: ['3'], resultId: '4' })
  expect(held.giftInventory).toEqual(['4'])
  expect(held.floorLogs[0].acquiredGifts).toEqual(['3', '4'])
  expect(held.floorLogs[0].removedGifts).toEqual(['3'])
})

it('restores incomplete legacy run state with usable defaults and keeps recorded history', () => {
  const restored = normalizeRunState({
    phase: 'playing', difficulty: 'hard', currentFloor: 0,
    giftInventory: ['42', '42'],
    floorLogs: [{ acquiredGifts: ['42', '42'], removedGifts: ['42'], memo: 'Seen', difficulty: 'invalid' }],
    sourcePlanSnapshot: { floorPlan: [{ floor: 1, memo: 'Planned' }] },
  })
  expect(restored.currentFloor).toBe(1)
  expect(restored.floorLogs).toHaveLength(5)
  expect(restored.floorLogs[0]).toMatchObject({
    floor: 1, acquiredGifts: ['42', '42'], removedGifts: ['42'], memo: 'Seen', themeId: null,
  })
  expect(restored.floorLogs[1].acquiredGifts).toEqual([])
  expect(restored.giftInventory).toEqual(['42', '42'])
  expect(restored.sourcePlanSnapshot?.floorPlan?.[0].memo).toBe('Planned')
  expect(runReducer(createInitialRunState(), { type: 'LOAD_RUN', state: restored }).floorLogs).toHaveLength(5)
})

it('keeps numeric theme IDs from older run drafts after reload', () => {
  const restored = normalizeRunState({
    difficulty: 'hard', floorLogs: [{ themeId: 1002 }],
    sourcePlanSnapshot: { floorPlan: [{ floor: 1, theme_id: 1002, gift_ids: ['10'] }] },
  })
  expect(restored.floorLogs[0].themeId).toBe('1002')
  expect(restored.sourcePlanSnapshot?.floorPlan?.[0].theme_id).toBe('1002')
  expect(runReducer(createInitialRunState(), { type: 'SET_FLOOR_THEME', themeId: 1002 as unknown as string }).floorLogs[0].themeId).toBe('1002')
})

it('normalizes malformed nested draft and plan fields before the UI reads them', () => {
  const malformed = {
    difficulty: 'hard',
    identitySlots: [{ identity_id: 'i', sinner_id: 's', keywords: {}, skill_keyword_list: 'broken', slot_order: 'wrong' }, {}],
    egoSlots: [{ ego_id: 'e', sinner_id: 's', grade: 7 }, null],
    floorLogs: [{ deckChanges: [{ type: 'swap_identity', detail: null }, { type: 'bad' }], selectedEventOptions: [{ eventId: 1, optionIndex: 0, rewardGiftIds: 7 }] }],
    sourcePlanSnapshot: { floorPlan: [{ floor: 1, theme_id: 1013, gift_ids: {}, memo: 5, constraints: 'bad' }, null] },
  }
  const restored = normalizeRunState(malformed)
  expect(restored.identitySlots).toHaveLength(1)
  expect(restored.identitySlots[0]).toMatchObject({ keywords: [], skill_keyword_list: [], slot_order: 99, s1_count: 3, s2_count: 2, s3_count: 1 })
  expect(restored.egoSlots).toHaveLength(1)
  expect(restored.egoSlots[0]).toMatchObject({ grade: '', name_kr: '' })
  expect(restored.floorLogs[0].deckChanges).toEqual([{ type: 'swap_identity', sinnerId: '', detail: '' }])
  expect(restored.floorLogs[0].selectedEventOptions[0].rewardGiftIds).toEqual([])
  expect(restored.sourcePlanSnapshot?.floorPlan?.[0]).toMatchObject({ theme_id: '1013', gift_ids: [], memo: '', constraints: [] })
  expect(restored.sourcePlanSnapshot?.floorPlan?.[1]).toMatchObject({ floor: 2, gift_ids: [] })

  const planInput = { difficulty: 'invalid', floorPlan: [{ floor: 1, gift_ids: {} }], identitySlots: [{ identity_id: 'i', sinner_id: 's', keywords: null }], giftInventory: 42 }
  const fromPlan = runReducer(createInitialRunState(), { type: 'LOAD_FROM_PLAN', planState: planInput as unknown as Partial<ReturnType<typeof createInitialState>> })
  expect(fromPlan.difficulty).toBe('hard')
  expect(fromPlan.sourcePlanSnapshot?.floorPlan?.[0].gift_ids).toEqual([])
  expect(fromPlan.identitySlots[0].keywords).toEqual([])
  expect(planInput.floorPlan[0].gift_ids).toEqual({})
})

it('keeps an existing gift and acquisition history when an event reward is undone', () => {
  let run = runReducer(createInitialRunState(), { type: 'ACQUIRE_GIFT', giftId: '42' })
  run = runReducer(run, { type: 'SELECT_EVENT_OPTION', eventId: 1, optionIndex: 0, rewardGiftIds: ['42', '42'] })
  expect(run.giftInventory).toEqual(['42', '42', '42'])
  run = runReducer(run, { type: 'SELECT_EVENT_OPTION', eventId: 1, optionIndex: 0, rewardGiftIds: ['wrong'] })
  expect(run.giftInventory).toEqual(['42'])
  expect(run.floorLogs[0].acquiredGifts).toEqual(['42', '42', '42'])
  expect(run.floorLogs[0].removedGifts).toEqual(['42', '42'])
})

it('does not remove a later same-ID gift when the event reward was consumed', () => {
  let run = runReducer(createInitialRunState(), { type: 'ACQUIRE_GIFT', giftId: '42' })
  run = runReducer(run, { type: 'SELECT_EVENT_OPTION', eventId: 1, optionIndex: 0, rewardGiftIds: ['42'] })
  run = runReducer(run, { type: 'REMOVE_GIFT', giftId: '42' })
  run = runReducer(run, { type: 'REMOVE_GIFT', giftId: '42' })
  run = runReducer(run, { type: 'ACQUIRE_GIFT', giftId: '42' })
  run = runReducer(run, { type: 'SELECT_EVENT_OPTION', eventId: 1, optionIndex: 0 })
  expect(run.giftInventory).toEqual(['42'])
  expect(run.floorLogs[0].selectedEventOptions).toEqual([])
  expect(run.floorLogs[0].removedGifts).toEqual(['42', '42'])
})

it('persists skill distribution changes in the run and exported review draft', () => {
  const plan = createInitialState('hard')
  plan.identitySlots = [{
    identity_id: 'i1', sinner_id: 's1', name_kr: 'Tester', rarity: 3, keywords: [],
    game_id: '100', folder_name: 'test', slot_order: 0, s1_count: 3, s2_count: 2, s3_count: 1,
  }]
  const source = runReducer(createInitialRunState(), { type: 'LOAD_FROM_PLAN', planState: plan })
  expect(runReducer(source, { type: 'SET_SKILL_DISTRIBUTION', sinnerId: 'missing', distribution: [2, 2, 2] })).toBe(source)
  const changed = runReducer(source, { type: 'SET_SKILL_DISTRIBUTION', sinnerId: 's1', distribution: [1, 3, 2] })
  expect(changed.identitySlots[0]).toMatchObject({ s1_count: 1, s2_count: 3, s3_count: 2 })
  expect(changed.floorLogs[0].deckChanges).toHaveLength(1)
  expect(changed.sourcePlanSnapshot?.identitySlots?.[0]).toMatchObject({ s1_count: 3, s2_count: 2, s3_count: 1 })
  expect(runStateToPlannerState(changed).identitySlots[0]).toMatchObject({ s1_count: 1, s2_count: 3, s3_count: 2 })
  expect(normalizeRunState(changed).identitySlots[0]).toMatchObject({ s1_count: 1, s2_count: 3, s3_count: 2 })
  expect(runReducer(changed, { type: 'SET_SKILL_DISTRIBUTION', sinnerId: 's1', distribution: [1, 3, 2] })).toBe(changed)
})

it('restores the Zustand draft shape shown by RunSetup', () => {
  const previous = globalThis.localStorage
  const raw = JSON.stringify({ state: { phase: 'playing', difficulty: 'normal', currentFloor: 2 }, version: 0 })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => raw } })
  try {
    const draft = loadRunDraft()
    expect(draft?.state.currentFloor).toBe(2)
    expect(draft?.state.floorLogs).toHaveLength(5)
    expect(draft?.label).toContain('2/5')
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous })
  }
})

it('converts decoded plans without dropping goals, notes, constraints, or skill distribution', async () => {
  const plan = createInitialState('hard')
  plan.title = 'Test plan'
  plan.description = 'Route'
  plan.mainKeywords = ['burn']
  plan.mainKeywordsManual = true
  plan.identitySlots = [{
    identity_id: 'identity-1', sinner_id: 'sinner-1', name_kr: 'Tester', rarity: 3,
    keywords: ['burn'], game_id: '100', folder_name: 'test', slot_order: 0,
    s1_count: 2, s2_count: 2, s3_count: 2,
  }]
  plan.egoSlots = [{ ego_id: 'ego-1', sinner_id: 'sinner-1', name_kr: 'EGO', grade: 'HE', sin_affinity: 'wrath' }]
  plan.floorPlan[0] = { ...plan.floorPlan[0], theme_id: '1013', gift_ids: ['9273'], memo: 'Keep this gift', constraints: [1] }
  plan.giftInventory = ['final_9274_plusplus']
  const decoded = await decodePlan(await encodePlan(plan))
  const identities = [{ id: 'identity-1', sinner_id: 'sinner-1', name_kr: 'Tester', rarity: 3, keywords: ['burn'], game_id: '100', folder_name: 'test' }] as IdentityData[]
  const egos = [{ id: 'ego-1', sinner_id: 'sinner-1', name: 'EGO', name_kr: null, grade: 'HE', sin_affinity: 'wrath' }] as EgoData[]
  const restored = decodedPlanToPlannerState(decoded, identities, egos)
  expect(restored).toMatchObject({
    title: 'Test plan', description: 'Route', mainKeywords: ['burn'], mainKeywordsManual: true,
    giftInventory: ['final_9274_plusplus'],
  })
  expect(restored.identitySlots[0]).toMatchObject({ s1_count: 2, s2_count: 2, s3_count: 2 })
  expect(restored.egoSlots[0]).toMatchObject({ name_kr: 'EGO', grade: 'HE' })
  expect(restored.floorPlan[0]).toMatchObject({ theme_id: '1013', gift_ids: ['9273'], memo: 'Keep this gift', constraints: [1] })
  expect(runReducer(createInitialRunState(), { type: 'LOAD_FROM_PLAN', planState: restored }).sourcePlanSnapshot).toEqual(restored)
})

it('REQ-ASSIST-068 a fusion whose result is not recorded (a vestige) only removes its materials', () => {
  let run = createInitialRunState()
  for (const giftId of ['1', '2', '3']) run = runReducer(run, { type: 'ACQUIRE_GIFT', giftId })
  const fused = runReducer(run, { type: 'CRAFT_FUSION', materialIds: ['1', '2'], resultId: null })
  expect(fused.giftInventory).toEqual(['3'])
  expect(fused.floorLogs[0].removedGifts).toEqual(['1', '2'])
  expect(fused.floorLogs[0].acquiredGifts).toEqual(['1', '2', '3'])
  expect(runReducer(run, { type: 'CRAFT_FUSION', materialIds: [], resultId: null })).toBe(run)
  expect(runReducer(run, { type: 'CRAFT_FUSION', materialIds: ['9'], resultId: null })).toBe(run)
})
