import { expect, it } from 'vitest'
import { GIFT_PROMOTION_SCENES, getCurrentFloorPriorityGifts, nextGiftPromotion, planThemeGiftIds, type GiftPromotion } from '../../../lib/planner/run-priority-gifts'
import { createInitialRunState, normalizeRunState } from '../../../lib/planner/run-types'
import type { GiftData, ThemeData } from '../../../lib/planner/types'

const gift = (game_id: number) => ({ game_id, name: String(game_id) }) as GiftData
const theme = (id: string, common: number[], specific: number[]) => ({
  id, ego_gift_ids: common, specific_ego_gift_ids: specific,
}) as ThemeData
const gifts = new Map([10, 20, 30, 40, 50, 60].map(id => [id, gift(id)]))

it('orders this floor plan gifts before final targets, filtering the theme pool and owned enhancements', () => {
  const state = createInitialRunState()
  state.currentFloor = 2
  state.floorLogs[1].themeId = 'A'
  state.sourcePlanSnapshot = { floorPlan: [
    { floor: 1, gift_ids: ['50'] },
    { floor: 2, gift_ids: ['30_plus', '10', '20', '10'] },
  ] as NonNullable<typeof state.sourcePlanSnapshot>['floorPlan'] }
  state.targetGifts = ['20', 'final_40_plusplus', '50', '30', 'unknown']
  state.giftInventory = ['final_20_plusplus']
  const before = structuredClone(state)
  const result = getCurrentFloorPriorityGifts(state, [theme('A', [20, 30, 60], [10, 40])], gifts)
  expect(result.map(item => item.game_id)).toEqual([30, 10, 40, 60])
  expect(state).toEqual(before)
})

it('uses only the actual theme and shows guidance before a theme is observed', () => {
  const state = createInitialRunState()
  state.sourcePlanSnapshot = { floorPlan: [{ floor: 1, gift_ids: ['10', '20'], theme_id: 'A' }] as NonNullable<typeof state.sourcePlanSnapshot>['floorPlan'] }
  state.targetGifts = ['20']
  state.floorLogs[0].themeId = 'B'
  const themes = [theme('A', [10], []), theme('B', [], [20])]
  expect(getCurrentFloorPriorityGifts(state, themes, gifts).map(item => item.game_id)).toEqual([20])
  state.floorLogs[0].themeId = null
  expect(getCurrentFloorPriorityGifts(state, themes, gifts).map(item => item.game_id)).toEqual([])
  expect(state.floorLogs[0].themeId).toBeNull()
})

it('returns no unrelated gifts for missing themes or missing gift data', () => {
  const state = createInitialRunState()
  state.targetGifts = ['10', '50']
  expect(getCurrentFloorPriorityGifts(state, [theme('A', [10], [])], gifts)).toEqual([])
  state.floorLogs[0].themeId = 'missing'
  expect(getCurrentFloorPriorityGifts(state, [theme('A', [10], [])], gifts)).toEqual([])
  state.floorLogs[0].themeId = 'A'
  expect(getCurrentFloorPriorityGifts(state, [theme('A', [10, 50], [])], new Map([[10, gift(10)]])).map(item => item.game_id)).toEqual([10])
})

it('matches a numerically saved theme to normalized producer IDs for PiP guidance', () => {
  const state = normalizeRunState({
    floorLogs: [{ themeId: 1002 }],
    sourcePlanSnapshot: { floorPlan: [{ floor: 1, theme_id: 1002, gift_ids: ['10'] }] },
  })
  expect(getCurrentFloorPriorityGifts(state, [theme('1002', [10], [])], gifts).map(item => item.game_id)).toEqual([10])
})

it('shows the complete current theme pool when there is no plan or target', () => {
  const state = createInitialRunState()
  state.floorLogs[0].themeId = 'A'
  state.giftInventory = ['20_plus']
  expect(getCurrentFloorPriorityGifts(state, [theme('A', [10, 20, 30], [40])], gifts).map(item => item.game_id)).toEqual([40, 10, 30])
})

it('excludes out-of-theme targets while appending remaining common and exclusive gifts', () => {
  const state = createInitialRunState()
  state.floorLogs[0].themeId = 'A'
  state.targetGifts = ['50', '40']
  expect(getCurrentFloorPriorityGifts(state, [theme('A', [10, 20], [40])], gifts).map(item => item.game_id)).toEqual([40, 10, 20])
})

it('orders by floor plan, then registered targets, then theme exclusives, then the theme catalog', () => {
  const state = createInitialRunState()
  state.floorLogs[0].themeId = 'A'
  state.sourcePlanSnapshot = { floorPlan: [{ floor: 1, gift_ids: ['40', '10'] }] as NonNullable<typeof state.sourcePlanSnapshot>['floorPlan'] }
  // Registration order is kept: 60 before 30. 50 is exclusive to another theme and never shown here.
  state.targetGifts = ['final_60', '50', '30_plus']
  state.giftInventory = ['20_plus']
  const themes = [theme('A', [10, 30, 60, 70], [80, 20, 40]), theme('B', [], [50])]
  const all = new Map([10, 20, 30, 40, 50, 60, 70, 80].map(id => [id, gift(id)]))
  expect(getCurrentFloorPriorityGifts(state, themes, all).map(item => item.game_id)).toEqual([40, 10, 60, 30, 80, 70])
})

it('promotes seen gifts only below plan, targets and exclusives, in catalog order whatever the sighting order', () => {
  const state = createInitialRunState()
  state.floorLogs[0].themeId = 'A'
  state.sourcePlanSnapshot = { floorPlan: [{ floor: 1, gift_ids: ['10'] }] as NonNullable<typeof state.sourcePlanSnapshot>['floorPlan'] }
  state.targetGifts = ['30']
  const themes = [theme('A', [10, 20, 30, 60, 70], [40])]
  const all = new Map([10, 20, 30, 40, 60, 70].map(id => [id, gift(id)]))
  const order = (promoted?: number[]) => getCurrentFloorPriorityGifts(state, themes, all, promoted).map(item => item.game_id)
  expect(order()).toEqual([10, 30, 40, 20, 60, 70])
  expect(order([70, 60])).toEqual([10, 30, 40, 60, 70, 20])
  expect(order([60, 70])).toEqual([10, 30, 40, 60, 70, 20])
  // Seeing a planned, target or exclusive gift never lifts it above its own tier.
  expect(order([40, 30, 10, 70])).toEqual([10, 30, 40, 70, 20, 60])
  expect(order([999])).toEqual(order())
})

const ids = (promotion: GiftPromotion | null) => promotion?.ids ?? []
const sceneAt = (label: string) => ({ label, since: 0 })

it('moves seen gifts forward on non-combat screens and holds the order still through battle', () => {
  const state = createInitialRunState()
  state.phase = 'playing'
  state.floorLogs[0].themeId = 'A'
  const themes = [theme('A', [10, 20, 30, 60, 70], [40])]
  const all = new Map([10, 20, 30, 40, 60, 70].map(id => [id, gift(id)]))
  const step = (previous: GiftPromotion | null, label: string | null, observed: number[]) =>
    nextGiftPromotion(previous, { state, running: true, scene: label ? sceneAt(label) : null, observedGiftIds: observed })
  const order = (promotion: GiftPromotion | null) => getCurrentFloorPriorityGifts(state, themes, all, promotion?.ids).map(item => item.game_id)

  let promotion = step(null, 'shop', [60])
  expect(order(promotion)).toEqual([40, 60, 10, 20, 30, 70])
  // A shop frame that misses the icon does not demote it; a new sighting adds to it.
  const kept = step(promotion, 'shop', [])
  expect(kept).toBe(promotion)
  promotion = step(kept, 'reward_choice', [70])
  expect(order(promotion)).toEqual([40, 60, 70, 10, 20, 30])

  // Battle icons appearing and disappearing every frame leave the list exactly as it was.
  const before = order(promotion)
  for (const [label, observed] of [['battle_setup', [20]], ['battle', [20, 30]], ['battle', []], ['battle', [10]], ['battle', []]] as const) {
    const next = step(promotion, label, [...observed])
    expect(next).toBe(promotion)
    expect(order(next)).toEqual(before)
  }
  // Uncertain scenes do not disturb it either.
  expect(step(promotion, 'loading', [20])).toBe(promotion)
  expect(step(promotion, null, [20])).toBe(promotion)
  expect(step(promotion, 'not-a-label', [20])).toBe(promotion)
  // Re-applying the same inputs is a no-op (safe for render-time or StrictMode double calls).
  expect(step(step(promotion, 'shop', [60, 70]), 'shop', [60, 70])).toBe(promotion)
})

it('still drops acquired gifts while the promotion is frozen', () => {
  const state = createInitialRunState()
  state.phase = 'playing'
  state.floorLogs[0].themeId = 'A'
  const themes = [theme('A', [10, 20, 60], [40])]
  const frozen = nextGiftPromotion(null, { state, running: true, scene: sceneAt('shop'), observedGiftIds: [60] })
  expect(getCurrentFloorPriorityGifts(state, themes, gifts, frozen?.ids).map(item => item.game_id)).toEqual([40, 60, 10, 20])
  state.giftInventory = ['60_plus']
  const inBattle = nextGiftPromotion(frozen, { state, running: true, scene: sceneAt('battle'), observedGiftIds: [10] })
  expect(inBattle).toBe(frozen)
  expect(getCurrentFloorPriorityGifts(state, themes, gifts, inBattle?.ids).map(item => item.game_id)).toEqual([40, 10, 20])
})

it('starts over for a new floor or theme and clears when capture stops or the run leaves play', () => {
  const state = createInitialRunState()
  state.phase = 'playing'
  state.floorLogs[0].themeId = 'A'
  const input = { state, running: true, scene: sceneAt('shop'), observedGiftIds: [60] }
  const first = nextGiftPromotion(null, input)
  expect(ids(first)).toEqual([60])
  // New theme on the same floor, then a new floor, even when the next scene is a battle.
  const retheme = { ...state, floorLogs: state.floorLogs.map((log, i) => i === 0 ? { ...log, themeId: 'B' } : log) }
  expect(ids(nextGiftPromotion(first, { ...input, state: retheme, scene: sceneAt('battle') }))).toEqual([])
  expect(ids(nextGiftPromotion(first, { ...input, state: { ...state, currentFloor: 2 }, observedGiftIds: [] }))).toEqual([])
  expect(nextGiftPromotion(first, { ...input, running: false })).toBeNull()
  expect(nextGiftPromotion(first, { ...input, state: { ...state, phase: 'completed' } })).toBeNull()
  expect(GIFT_PROMOTION_SCENES.has('battle') || GIFT_PROMOTION_SCENES.has('battle_setup') || GIFT_PROMOTION_SCENES.has('loading')).toBe(false)
})

it('closes the gap when an acquired gift leaves any tier, without reordering the rest', () => {
  const state = createInitialRunState()
  state.floorLogs[0].themeId = 'A'
  state.sourcePlanSnapshot = { floorPlan: [{ floor: 1, gift_ids: ['10'] }] as NonNullable<typeof state.sourcePlanSnapshot>['floorPlan'] }
  state.targetGifts = ['30']
  const themes = [theme('A', [10, 20, 30, 60], [40])]
  const order = () => getCurrentFloorPriorityGifts(state, themes, gifts, [20]).map(item => item.game_id)
  expect(order()).toEqual([10, 30, 40, 20, 60])
  for (const [owned, left] of [['10', [30, 40, 20, 60]], ['final_30_plusplus', [40, 20, 60]], ['40', [20, 60]], ['20_plus', [60]]] as const) {
    state.giftInventory = [...state.giftInventory, owned]
    expect(order()).toEqual(left)
  }
})
it('reads the plan gifts for a pack wherever the plan placed it, plus the given floor entry', () => {
  const state = createInitialRunState()
  state.sourcePlanSnapshot = { floorPlan: [
    { floor: 1, theme_id: 'A', gift_ids: ['10_plus', '20'] },
    { floor: 2, theme_id: 'B', gift_ids: ['30', 'final_40_plusplus', '30', 'bad'] },
    { floor: 3, gift_ids: ['50'] },
  ] as NonNullable<typeof state.sourcePlanSnapshot>['floorPlan'] }
  // A pack picked on another floor than planned keeps its own gifts.
  expect(planThemeGiftIds(state, 'B')).toEqual([30, 40])
  expect(planThemeGiftIds(state, 'A', 3)).toEqual([10, 20, 50])
  expect(planThemeGiftIds(state, 'C')).toEqual([])
  expect(planThemeGiftIds(createInitialRunState(), 'A', 1)).toEqual([])
})
