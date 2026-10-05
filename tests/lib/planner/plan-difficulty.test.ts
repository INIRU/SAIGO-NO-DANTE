import { expect, it } from 'vitest'
import { planDifficultyBadge, planMatchesDifficulty, computeDifficultySummary, storedDifficultiesFor, storedPlanDifficulty } from '@/lib/planner/stripPlanForList'
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

// A plan with normal and hard floors is shown as "노말/하드" and stored as hard: the normal filter found nothing at all.
it('REQ-PLANNER-021 a difficulty filter finds every plan shown with that difficulty, a normal/hard plan under both', () => {
  const mixed = computeDifficultySummary([1, 2, 3, 4, 5].map(floor => ({ floor, theme_id: 't' + floor, difficulty: floor < 4 ? 'normal' : 'hard' })), 'hard')
  expect(planDifficultyBadge('hard', mixed).labelKeys).toEqual(['normal', 'hard'])
  expect(planMatchesDifficulty('hard', mixed, 'normal')).toBe(true)
  expect(planMatchesDifficulty('hard', mixed, 'hard')).toBe(true)
  expect(planMatchesDifficulty('hard', mixed, 'extreme')).toBe(false)
  const hard = computeDifficultySummary(floors(5), 'hard')
  expect(planMatchesDifficulty('hard', hard, 'hard')).toBe(true)
  expect(planMatchesDifficulty('hard', hard, 'normal')).toBe(false)
  // The hardest segment still decides the rest: fifteen floors are extreme only.
  const extreme = computeDifficultySummary(floors(15), 'hard')
  expect(planMatchesDifficulty('extreme', extreme, 'extreme')).toBe(true)
  expect(planMatchesDifficulty('extreme', extreme, 'hard')).toBe(false)
  // What the list asks the database for: a normal/hard plan is stored as hard.
  expect(storedDifficultiesFor('normal')).toEqual(['normal', 'hard'])
  expect(storedDifficultiesFor('hard')).toEqual(['hard'])
  expect(storedDifficultiesFor('extreme')).toEqual(['extreme'])
})
