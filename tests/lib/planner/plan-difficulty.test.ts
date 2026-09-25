import { expect, it } from 'vitest'
import { planDifficultyBadge, computeDifficultySummary, storedPlanDifficulty } from '@/lib/planner/stripPlanForList'
import { normalizeFloorPlanDifficulty } from '@/lib/planner/floor-difficulty'

const floors = (count: number) => normalizeFloorPlanDifficulty(Array.from({ length: count }, (_, i) => ({ floor: i + 1, theme_id: 't' + i })), 'hard').floorPlan

// A plan saved with the base difficulty "hard" and floors up to 15 showed as hard on its detail page and missed the extreme filter.
it('stores and shows a plan with its hardest planned floor', () => {
  expect(storedPlanDifficulty(floors(15), 'hard')).toBe('extreme')
  expect(storedPlanDifficulty(floors(8), 'hard')).toBe('overlap')
  expect(storedPlanDifficulty(floors(5), 'hard')).toBe('hard')
  expect(storedPlanDifficulty([], 'normal')).toBe('normal')
  expect(planDifficultyBadge('hard', computeDifficultySummary(floors(15), 'hard')).labelKeys).toEqual(['extreme'])
})
