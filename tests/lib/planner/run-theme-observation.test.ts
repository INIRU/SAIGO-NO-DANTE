import { describe, expect, it } from 'vitest'
import { createInitialRunState, runReducer, type RunState } from '../../../lib/planner/run-types'
import { acquisitionAttributionFloor, clearedThemeFloors, floorThemeObservationAction, getRunThemeGuidance, observedRunTheme, pendingThemeSelectionFloor, recordedFloorBehind, themeSelectionTarget } from '../../../lib/planner/run-theme-guidance'
import type { ThemeData } from '../../../lib/planner/types'

const theme = (id: string, floorInfo: ThemeData['floor_info']): ThemeData =>
  ({ id, name: id, floor_info: floorInfo, dungeon_id: null, ego_gift_ids: [], specific_ego_gift_ids: [], image_url: null, difficulty: null })
const themes = [
  theme('1003', { '노말': [1, 2], '하드': [1] }),
  theme('1101', { '노말': [2], '하드': [2] }),
  theme('1102', { '노말': [2], '하드': [2, 3] }),
  theme('1505', { '익스트림': '전체' }),
]

function playing(): RunState {
  const state = runReducer(createInitialRunState('hard'), { type: 'START_RUN' })
  return { ...state, sourcePlanSnapshot: { floorPlan: [{ floor: 1, theme_id: '1003' }, { floor: 2, theme_id: '1102' }] } as RunState['sourcePlanSnapshot'] }
}

it('accepts only a forward floor within the run and a single pack allowed on that floor', () => {
  const state = playing()
  expect(observedRunTheme(state, themes, 1, ['1003'])).toBe('1003')
  expect(observedRunTheme(state, themes, 2, ['1101'])).toBe('1101')
  expect(observedRunTheme(state, themes, 1, ['1101'])).toBeNull()
  expect(observedRunTheme(state, themes, 2, ['1505'])).toBeNull()
  expect(observedRunTheme(state, themes, 2, ['1101', '1102'])).toBeNull()
  expect(observedRunTheme(state, themes, 6, ['1505'])).toBeNull()
  expect(observedRunTheme({ ...state, currentFloor: 2 }, themes, 1, ['1003'])).toBeNull()
  expect(observedRunTheme({ ...state, phase: 'setup' }, themes, 1, ['1003'])).toBeNull()
})

it('ignores a pack already recorded elsewhere and a repeat of the recorded current pack', () => {
  const state = runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' })
  expect(observedRunTheme(state, themes, 1, ['1003'])).toBeNull()
  const moved = { ...state, currentFloor: 2 }
  expect(observedRunTheme(moved, themes, 2, ['1003'])).toBeNull()
})

it('advances atomically, closes the floor left behind and keeps the source plan', () => {
  const before = runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' })
  const action = { type: 'OBSERVE_FLOOR_THEME', floor: 2, themeId: '1101', completedAt: '2026-09-23T00:00:00.000Z' } as const
  const after = runReducer(before, action)
  expect(after.currentFloor).toBe(2)
  expect(after.floorLogs[1].themeId).toBe('1101')
  expect(after.floorLogs[0]).toMatchObject({ themeId: '1003', completedAt: '2026-09-23T00:00:00.000Z' })
  expect(after.sourcePlanSnapshot).toEqual(before.sourcePlanSnapshot)
  expect(runReducer(before, action)).toEqual(after)
  expect(runReducer(after, { ...action, floor: 1, themeId: '1003' })).toBe(after)
  expect(runReducer({ ...before, phase: 'completed' }, action).currentFloor).toBe(1)
})

it('applies one observation once, so Undo is not overwritten by the same banner', () => {
  const consumed = new Set<string>()
  const observation = { floor: 2, themeIds: ['1101'], observedAt: 1_000, token: '2:1101' }
  const before = runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' })
  const action = floorThemeObservationAction(before, themes, observation, consumed, 2_000)
  expect(action).toMatchObject({ type: 'OBSERVE_FLOOR_THEME', floor: 2, themeId: '1101' })
  const undone = runReducer(runReducer(before, action!), { type: 'LOAD_RUN', state: before })
  expect(undone.currentFloor).toBe(1)
  expect(floorThemeObservationAction(undone, themes, { ...observation, observedAt: 3_000 }, consumed, 3_500)).toBeNull()
  expect(floorThemeObservationAction(undone, themes, { floor: 2, themeIds: ['1102'], observedAt: 4_000, token: '2:1102' }, consumed, 4_100))
    .toMatchObject({ floor: 2, themeId: '1102' })
})

it('drops stale or future-dated observations without consuming them for a later valid read', () => {
  const consumed = new Set<string>()
  const state = playing()
  const observation = { floor: 1, themeIds: ['1003'], observedAt: 1_000, token: '1:1003' }
  expect(floorThemeObservationAction(state, themes, observation, consumed, 20_000)).toBeNull()
  expect(floorThemeObservationAction(state, themes, observation, consumed, 500)).toBeNull()
  expect(floorThemeObservationAction(state, themes, { ...observation, observedAt: 19_000 }, consumed, 20_000))
    .toMatchObject({ floor: 1, themeId: '1003' })
})

it('reports a recorded floor behind the screen only for a later floor inside the run', () => {
  const state = playing()
  expect(recordedFloorBehind(state, null)).toBe(false)
  expect(recordedFloorBehind(state, 1)).toBe(false)
  expect(recordedFloorBehind(state, 3)).toBe(true)
  expect(recordedFloorBehind(state, 9)).toBe(false)
  expect(recordedFloorBehind({ ...state, currentFloor: 3 }, 3)).toBe(false)
  expect(recordedFloorBehind({ ...state, phase: 'completed' }, 3)).toBe(false)
})

it('registers an acquired gift in the inventory even when its floor is unknown or already left', () => {
  const moved = runReducer(runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' }),
    { type: 'OBSERVE_FLOOR_THEME', floor: 2, themeId: '1101', completedAt: '2026-09-23T00:00:00.000Z' })
  const current = runReducer(moved, { type: 'ACQUIRE_GIFT', giftId: '9702' })
  expect(current.giftInventory).toEqual(['9702'])
  expect(current.floorLogs[1].acquiredGifts).toEqual(['9702'])
  const delayed = runReducer(moved, { type: 'ACQUIRE_GIFT', giftId: '9701', floor: 1 })
  expect(delayed.giftInventory).toEqual(['9701'])
  expect(delayed.floorLogs.map(log => log.acquiredGifts)).toEqual([['9701'], [], [], [], []])
  const unknown = runReducer(moved, { type: 'ACQUIRE_GIFT', giftId: '9007', floor: null })
  expect(unknown.giftInventory).toEqual(['9007'])
  expect(unknown.floorLogs.every(log => log.acquiredGifts.length === 0)).toBe(true)
  expect(runReducer(moved, { type: 'ACQUIRE_GIFT', giftId: '9007', floor: 9 }).floorLogs.every(log => !log.acquiredGifts.length)).toBe(true)
})

it('targets the floor being chosen on a pack selection screen, never a floor that already has a pack', () => {
  const first = runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' })
  expect(themeSelectionTarget(first, null)).toBe(2)
  expect(themeSelectionTarget(first, 2)).toBe(2)
  expect(themeSelectionTarget(first, 1)).toBeNull()
  expect(themeSelectionTarget(playing(), null)).toBe(1)
  expect(themeSelectionTarget({ ...first, currentFloor: 5, floorLogs: first.floorLogs.map(log => ({ ...log, themeId: log.floor === 5 ? '1003' : log.themeId })) }, null)).toBeNull()
  expect(themeSelectionTarget({ ...first, phase: 'setup' }, 2)).toBeNull()
  // A misread header past the run's last floor falls back to the next open floor instead of dropping the target.
  expect(themeSelectionTarget(first, 22)).toBe(2)
  expect(themeSelectionTarget(playing(), 22)).toBe(1)
  const guidance = getRunThemeGuidance({ ...first, currentFloor: 2 }, themes)
  expect(guidance[0]?.theme.id).toBe('1102')
  expect(first.sourcePlanSnapshot?.floorPlan?.[1]?.theme_id).toBe('1102')
})

it('keeps the next floor pending after its selection screen ends unread, until a pack lands on it once', () => {
  const first = runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' })
  const select = { label: 'theme_select', since: 100 }
  const step = (pending: number | null, state: RunState, scene: { label: string; since: number } | null, extra: Partial<Parameters<typeof pendingThemeSelectionFloor>[1]> = {}) =>
    pendingThemeSelectionFloor(pending, { state, running: true, scene, header: null, chosenInScene: null, ...extra })

  const pending = step(null, first, select)
  expect(pending).toBe(2)
  // The game picked a pack but capture never read it: exploration (or a gap in the scene) must not return to floor 1.
  expect(step(pending, first, { label: 'exploration', since: 200 })).toBe(2)
  expect(step(pending, first, null)).toBe(2)
  expect(step(step(pending, first, { label: 'unknown', since: 250 }), first, { label: 'exploration', since: 260 })).toBe(2)
  // The planned and alternate packs stay offered for floor 2.
  expect(getRunThemeGuidance({ ...first, currentFloor: pending! }, themes)[0]?.theme.id).toBe('1102')
  // The selection screen showing again while floor 2 is still open targets floor 2, not 3.
  expect(step(2, first, { label: 'theme_select', since: 300 })).toBe(2)

  // A manual pick after the screen ended is applied to floor 2 (as CompanionPanel.chooseTheme records it).
  const picked = runReducer(first, { type: 'OBSERVE_FLOOR_THEME', floor: 2, themeId: '1101', completedAt: '2026-09-23T00:00:00.000Z' })
  expect(picked.currentFloor).toBe(2)
  expect(picked.floorLogs.map(log => log.themeId)).toEqual(['1003', '1101', null, null, null])
  expect(picked.floorLogs[0].completedAt).toBe('2026-09-23T00:00:00.000Z')
  expect(picked.sourcePlanSnapshot?.floorPlan?.[1]?.theme_id).toBe('1102')
  expect(step(2, picked, { label: 'exploration', since: 200 })).toBeNull()
  // Repeating the pick or the observation never advances a second floor.
  expect(runReducer(picked, { type: 'OBSERVE_FLOOR_THEME', floor: 2, themeId: '1101', completedAt: '2026-09-23T00:00:01.000Z' })).toEqual(picked)
  expect(observedRunTheme(picked, themes, 2, ['1101'])).toBeNull()
  // The same selection screen, still up after its pick, does not start choosing floor 3.
  expect(step(null, picked, select, { chosenInScene: select.since })).toBeNull()

  // A confirmed pack read also settles it; Undo restores the pending floor, which then stays through exploration.
  const seen = floorThemeObservationAction(first, themes, { floor: 2, themeIds: ['1102'], observedAt: 1000, token: 't' }, new Set(), 2000)!
  expect(step(2, runReducer(first, seen), { label: 'exploration', since: 200 })).toBeNull()
  expect(step(2, first, { label: 'exploration', since: 400 })).toBe(2)

  // Only stopping capture or leaving the run clears it.
  expect(step(2, first, { label: 'exploration', since: 200 }, { running: false })).toBeNull()
  expect(step(2, { ...first, phase: 'completed' }, { label: 'exploration', since: 200 })).toBeNull()
  expect(step(2, runReducer(first, { type: 'RESET' }), { label: 'exploration', since: 200 })).toBeNull()
})

describe('pending pack floor across the floor transition (user sequence)', () => {
  const step = (pending: number | null, state: RunState, scene: { label: string; since: number } | null,
    extra: Partial<Parameters<typeof pendingThemeSelectionFloor>[1]> = {}) =>
    pendingThemeSelectionFloor(pending, { state, running: true, scene, header: null, chosenInScene: null, observedFloor: null, ...extra })

  it('keeps floor 2 through an old floor-1 header, the floor-1 exploration animation and scene flicker', () => {
    const first = runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' })
    let pending = step(null, first, { label: 'theme_select', since: 100 }, { header: { floor: 2, observedAt: 110 } })
    expect(pending).toBe(2)
    // A late read of the previous floor's header on the same or a re-entered selection screen does not lower it.
    pending = step(pending, first, { label: 'theme_select', since: 100 }, { header: { floor: 1, observedAt: 120 } })
    expect(pending).toBe(2)
    pending = step(pending, first, { label: 'theme_select', since: 300 }, { header: { floor: 1, observedAt: 310 } })
    expect(pending).toBe(2)
    // The transition still shows the floor-1 exploration banner, read twice.
    pending = step(pending, first, { label: 'exploration', since: 400 }, { observedFloor: 1 })
    expect(pending).toBe(2)
    pending = step(pending, first, { label: 'unknown', since: 450 }, { observedFloor: 1 })
    pending = step(pending, first, { label: 'theme_select', since: 460 })
    expect(pending).toBe(2)
    // Floor 2 exploration with an unread pack name keeps floor 2 until a pack is recorded.
    pending = step(pending, first, { label: 'exploration', since: 500 }, { observedFloor: 2 })
    expect(pending).toBe(2)
  })

  it('keeps floor 2 when floor 1 never got a pack and the header disappears', () => {
    const unrecorded = playing()
    let pending = step(null, unrecorded, { label: 'theme_select', since: 100 }, { header: { floor: 2, observedAt: 110 } })
    expect(pending).toBe(2)
    pending = step(pending, unrecorded, { label: 'theme_select', since: 200 })
    expect(pending).toBe(2)
    pending = step(pending, unrecorded, { label: 'theme_select', since: 200 }, { header: { floor: 1, observedAt: 50 } })
    expect(pending).toBe(2)
  })

  it('raises the view to a stably observed later floor without a pack name, never from the plan', () => {
    const first = runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' })
    const pending = step(null, first, { label: 'exploration', since: 100 }, { observedFloor: 2 })
    expect(pending).toBe(2)
    expect(first.floorLogs[1].themeId).toBeNull()
    expect(step(null, first, { label: 'exploration', since: 100 }, { observedFloor: 1 })).toBeNull()
    expect(step(null, first, { label: 'exploration', since: 100 }, { observedFloor: 9 })).toBeNull()
    expect(step(null, first, { label: 'exploration', since: 100 }, { observedFloor: 2, running: false })).toBeNull()
  })

  it('settles on a manual pick or a confirmed read for floor 2, once, and Undo returns to pending 2', () => {
    const first = runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' })
    const pending = step(null, first, { label: 'exploration', since: 500 }, { observedFloor: 2 })
    const picked = runReducer(first, { type: 'OBSERVE_FLOOR_THEME', floor: 2, themeId: '1101', completedAt: '2026-09-23T00:00:00.000Z' })
    expect(picked.currentFloor).toBe(2)
    expect(step(pending, picked, { label: 'exploration', since: 500 }, { observedFloor: 2 })).toBeNull()
    // Neither the same pick again nor the banner read afterwards advances another floor.
    expect(runReducer(picked, { type: 'OBSERVE_FLOOR_THEME', floor: 2, themeId: '1101', completedAt: '2026-09-23T00:00:01.000Z' })).toEqual(picked)
    expect(observedRunTheme(picked, themes, 2, ['1101'])).toBeNull()
    expect(step(null, picked, { label: 'theme_select', since: 600 }, { chosenInScene: 600 })).toBeNull()
    // Undo restores the run and the saved pending floor, which the observed floor keeps.
    expect(step(pending, first, { label: 'exploration', since: 500 }, { observedFloor: 2 })).toBe(2)
    expect(step(null, runReducer(first, { type: 'RESET' }), { label: 'exploration', since: 500 }, { observedFloor: 2 })).toBeNull()
    expect(picked.giftInventory).toEqual(first.giftInventory)
  })
})

describe('blank run (no plan, no packs recorded)', () => {
  const blank = () => runReducer(createInitialRunState('hard'), { type: 'START_RUN' })

  it('registers the entered pack from the whole catalog on floor 1, then floor 2, never from a plan', () => {
    const start = blank()
    expect(start.sourcePlanSnapshot).toBeNull()
    expect(start.floorLogs.every(log => log.themeId === null)).toBe(true)
    const consumed = new Set<string>()
    const first = floorThemeObservationAction(start, themes, { floor: 1, themeIds: ['1003'], observedAt: 1_000, token: '1:1003' }, consumed, 1_500)
    expect(first).toMatchObject({ type: 'OBSERVE_FLOOR_THEME', floor: 1, themeId: '1003' })
    const onFirst = runReducer(start, first!)
    expect(onFirst.currentFloor).toBe(1)
    const second = floorThemeObservationAction(onFirst, themes, { floor: 2, themeIds: ['1101'], observedAt: 2_000, token: '2:1101' }, consumed, 2_500)
    const onSecond = runReducer(onFirst, second!)
    expect(onSecond.currentFloor).toBe(2)
    expect(onSecond.floorLogs.map(log => log.themeId)).toEqual(['1003', '1101', null, null, null])
    expect(onSecond.sourcePlanSnapshot).toBeNull()
    // Floor 1 unread: floor 2 is still applied directly and floor 1 stays empty rather than guessed.
    const skipped = runReducer(start, floorThemeObservationAction(start, themes, { floor: 2, themeIds: ['1101'], observedAt: 1_000, token: 'x' }, new Set(), 1_200)!)
    expect(skipped.floorLogs.map(log => log.themeId)).toEqual([null, '1101', null, null, null])
  })

  it('keeps the observed floor 2 in view while its pack name is unread and floor 1 has none', () => {
    const view = pendingThemeSelectionFloor(null, { state: blank(), running: true, scene: { label: 'exploration', since: 1 }, header: null,
      chosenInScene: null, observedFloor: 2 })
    expect(view).toBe(2)
  })
})

describe('user clearing a recorded pack', () => {
  it('detects the cleared floor and keeps a banner still on screen from picking it again', () => {
    const recorded = runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' })
    const cleared = runReducer(recorded, { type: 'SET_FLOOR_THEME', themeId: null })
    expect(cleared.currentFloor).toBe(1)
    expect(cleared.giftInventory).toEqual(recorded.giftInventory)
    expect(cleared.sourcePlanSnapshot).toEqual(recorded.sourcePlanSnapshot)
    expect(clearedThemeFloors(recorded, cleared)).toEqual([1])
    expect(clearedThemeFloors(cleared, recorded)).toEqual([])
    const blocked = new Set(clearedThemeFloors(recorded, cleared))
    const consumed = new Set<string>()
    const observation = { floor: 1, themeIds: ['1003'], observedAt: 5_000, token: '1:1003' }
    expect(floorThemeObservationAction(cleared, themes, observation, consumed, 5_100, blocked)).toBeNull()
    expect(floorThemeObservationAction(cleared, themes, { ...observation, token: '1:1003b' }, consumed, 5_200, blocked)).toBeNull()
    // Other floors are still observed.
    expect(floorThemeObservationAction(cleared, themes, { floor: 2, themeIds: ['1101'], observedAt: 5_000, token: '2:1101' }, consumed, 5_100, blocked))
      .toMatchObject({ floor: 2, themeId: '1101' })
  })
})

describe('automatic acquisition while the next floor is pending', () => {
  const first = () => runReducer(playing(), { type: 'SET_FLOOR_THEME', themeId: '1003' })

  it('puts a gift captured after floor 2 became pending into inventory and the floor 2 log, keeping floor 1 current', () => {
    const state = first()
    const floor = acquisitionAttributionFloor(state, { evidenceFloor: null, pendingFloor: 2, pendingSince: 5_000, capturedAt: 5_200 })
    expect(floor).toBe(2)
    const after = runReducer(state, { type: 'ACQUIRE_GIFT', giftId: '9701', floor })
    expect(after.giftInventory).toEqual(['9701'])
    expect(after.currentFloor).toBe(1)
    expect(after.floorLogs.map(log => log.acquiredGifts)).toEqual([[], ['9701'], [], [], []])
    // The pack read later moves the run to floor 2; the gift stays in the floor 2 log.
    const entered = runReducer(after, { type: 'OBSERVE_FLOOR_THEME', floor: 2, themeId: '1101', completedAt: '2026-09-23T00:00:00.000Z' })
    expect(entered.currentFloor).toBe(2)
    expect(entered.floorLogs[1].acquiredGifts).toEqual(['9701'])
    // Undo of the acquisition returns to the exact previous run; repeated tokens are consumed by the panel.
    const undone = runReducer(after, { type: 'LOAD_RUN', state })
    expect(undone.giftInventory).toEqual([])
    expect(undone.floorLogs.every(log => log.acquiredGifts.length === 0)).toBe(true)
    expect(undone.currentFloor).toBe(1)
  })

  it('keeps earlier captures, closed pending floors and missing evidence on their own floor or inventory only', () => {
    const state = first()
    expect(acquisitionAttributionFloor(state, { evidenceFloor: 1, pendingFloor: 2, pendingSince: 5_000, capturedAt: 4_900 })).toBe(1)
    expect(acquisitionAttributionFloor(state, { evidenceFloor: 1, pendingFloor: null, pendingSince: null, capturedAt: 6_000 })).toBe(1)
    expect(acquisitionAttributionFloor(state, { evidenceFloor: null, pendingFloor: null, pendingSince: null, capturedAt: 6_000 })).toBeNull()
    expect(acquisitionAttributionFloor(state, { evidenceFloor: 1, pendingFloor: 9, pendingSince: 5_000, capturedAt: 6_000 })).toBe(1)
    expect(acquisitionAttributionFloor(state, { evidenceFloor: null, pendingFloor: 2, pendingSince: 5_000, capturedAt: undefined })).toBeNull()
    const packed = runReducer(state, { type: 'OBSERVE_FLOOR_THEME', floor: 2, themeId: '1101', completedAt: '2026-09-23T00:00:00.000Z' })
    expect(acquisitionAttributionFloor(packed, { evidenceFloor: 2, pendingFloor: 2, pendingSince: 5_000, capturedAt: 6_000 })).toBe(2)
    expect(acquisitionAttributionFloor(state, { evidenceFloor: 12, pendingFloor: null, pendingSince: null, capturedAt: 6_000 })).toBeNull()
    // Floor 2 was pending when the popup was captured and its pack was recorded before the gift was confirmed.
    expect(acquisitionAttributionFloor(packed, { evidenceFloor: null, pendingFloor: 2, pendingSince: 5_000, pendingActive: false, capturedAt: 5_500 })).toBe(2)
    // A pending floor dropped without being entered (Undo, stop) no longer attributes.
    expect(acquisitionAttributionFloor(state, { evidenceFloor: null, pendingFloor: 2, pendingSince: 5_000, pendingActive: false, capturedAt: 5_500 })).toBeNull()
  })
})
