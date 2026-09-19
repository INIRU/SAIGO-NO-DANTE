import { expect, it, vi } from 'vitest'
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
import { withEgoStage } from '../db/queries'
it('uses each EGO actual maximum rather than the identity uptie limit', () => {
  expect(withEgoStage({stage_levels:[{construe_level:3},{construe_level:5}]}).max_construe_level).toBe(5)
  expect(withEgoStage({stage_levels:[{construe_level:1},{construe_level:4}]}).max_construe_level).toBe(4)
  expect(withEgoStage({stage_levels:[]}).max_construe_level).toBe(1)
})
