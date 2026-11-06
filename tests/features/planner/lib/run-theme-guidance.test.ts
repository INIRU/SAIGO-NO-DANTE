import { expect, it } from 'vitest'
import { createInitialRunState } from '@/features/planner/lib/run-types'
import { getRunThemeGuidance } from '@/features/planner/lib/run-theme-guidance'
import type { ThemeData } from '@/lib/planner/types'

const theme = (id: string, floors: number[], normalFloors: number[] = []): ThemeData => ({ id, name: id, floor_info: { '하드': floors, '노말': normalFloors }, ego_gift_ids: [], specific_ego_gift_ids: [], image_url: null, difficulty: null })
const plan = (ids: string[]) => ids.map((theme_id, index) => ({ floor: index + 1, theme_id })) as NonNullable<ReturnType<typeof createInitialRunState>['sourcePlanSnapshot']>['floorPlan']

it('offers only the current planned pack, even when other planned packs could be swapped in', () => {
  const state = createInitialRunState('hard')
  state.sourcePlanSnapshot = { floorPlan: plan(['A', 'B', 'C']) }
  const guidance = getRunThemeGuidance(state, [theme('A', [1, 2, 3]), theme('B', [1, 2]), theme('C', [1, 3])])
  expect(guidance.map(item => item.theme.id)).toEqual(['A'])
  expect(guidance[0].remainingOrder.map(item => [item.floor, item.theme.id])).toEqual([[2, 'B'], [3, 'C']])
})

it('rejects one-way and three-floor-chain alternatives', () => {
  const state = createInitialRunState('hard')
  state.sourcePlanSnapshot = { floorPlan: plan(['A', 'B', 'C']) }
  // B fits floor 1 and C fits floor 2, while A fits floor 3. A global matching
  // would accept B on floor 1, but A and B cannot exchange their two slots.
  const guidance = getRunThemeGuidance(state, [theme('A', [1, 3]), theme('B', [1, 2]), theme('C', [2, 3])])
  expect(guidance.map(item => item.theme.id)).toEqual(['A'])
})

it('replays a chosen swap so the displaced original pack appears on the next floor', () => {
  const state = createInitialRunState('hard')
  state.sourcePlanSnapshot = { floorPlan: plan(['A', 'B']) }
  state.floorLogs[0].themeId = 'B'
  state.floorLogs[0].completedAt = '2026-09-23T00:00:00Z'
  state.currentFloor = 2
  const guidance = getRunThemeGuidance(state, [theme('A', [1, 2]), theme('B', [1, 2])])
  expect(guidance.map(item => item.theme.id)).toEqual(['A'])
  expect(state.sourcePlanSnapshot.floorPlan?.[0].theme_id).toBe('A')
})

it('replays two consecutive direct swaps through already observed future slots', () => {
  const state = createInitialRunState('hard')
  state.sourcePlanSnapshot = { floorPlan: plan(['A', 'B', 'C']) }
  state.floorLogs[0].themeId = 'B'
  state.floorLogs[1].themeId = 'C'
  state.currentFloor = 3
  expect(getRunThemeGuidance(state, [theme('A', [1, 2, 3]), theme('B', [1, 2]), theme('C', [2, 3])])
    .map(item => item.theme.id)).toEqual(['A'])
  expect(state.sourcePlanSnapshot.floorPlan?.map(entry => entry.theme_id)).toEqual(['A', 'B', 'C'])
})

it('uses the floor\'s actual difficulty for the planned pack', () => {
  const state = createInitialRunState('hard')
  state.sourcePlanSnapshot = { floorPlan: plan(['A', 'B']) }
  const themes = [theme('A', [1, 2], []), theme('B', [1, 2], [2])]
  expect(getRunThemeGuidance(state, themes).map(item => item.theme.id)).toEqual(['A'])
  state.floorLogs[0].difficulty = 'normal'
  expect(getRunThemeGuidance(state, themes)).toEqual([])
})

it('does not suggest packs from completed, selected, or skipped plan floors', () => {
  const state = createInitialRunState('hard')
  state.sourcePlanSnapshot = { floorPlan: plan(['A', 'B', 'C']) }
  const themes = [theme('A', [1, 2, 3]), theme('B', [1, 2, 3]), theme('C', [1, 2, 3])]
  state.floorLogs[1].completedAt = '2026-09-23T00:00:00Z'
  expect(getRunThemeGuidance(state, themes).map(item => item.theme.id)).toEqual(['A'])
  state.floorLogs[2].themeId = 'C'
  expect(getRunThemeGuidance(state, themes).map(item => item.theme.id)).toEqual(['A'])
  state.floorLogs[0].themeId = 'A'
  expect(getRunThemeGuidance(state, themes)).toEqual([])
})

it('does not reuse a pack already selected on an unplanned floor', () => {
  const state = createInitialRunState('hard')
  state.currentFloor = 2
  state.sourcePlanSnapshot = { floorPlan: plan(['A', 'B']) }
  state.floorLogs[2].themeId = 'B'
  expect(getRunThemeGuidance(state, [theme('A', [1, 2]), theme('B', [2, 3])])).toEqual([])
})

it('shows no artwork in blank mode or without a planned current slot', () => {
  const state = createInitialRunState('hard')
  const themes = [theme('A', [1]), theme('B', [2])]
  expect(getRunThemeGuidance(state, themes)).toEqual([])
  state.sourcePlanSnapshot = { floorPlan: plan(['A']) }
  expect(getRunThemeGuidance(state, themes).map(item => item.theme.id)).toEqual(['A'])
  state.currentFloor = 2
  expect(getRunThemeGuidance(state, themes)).toEqual([])
})
