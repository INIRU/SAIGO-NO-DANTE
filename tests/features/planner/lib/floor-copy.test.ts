import { describe, expect, it } from 'vitest'
import { previousFloorGifts } from '@/features/planner/lib/floor-copy'

const plan = [{ floor: 1, gift_ids: ['1', '2'] }, { floor: 2, gift_ids: [] }, { floor: 3, gift_ids: ['5'] }]
describe('previousFloorGifts', () => {
  it('returns a copy of the floor before', () => {
    const copy = previousFloorGifts(plan, 2)
    expect(copy).toEqual(['1', '2'])
    expect(copy).not.toBe(plan[0].gift_ids)
  })
  it('is empty for the first floor, an empty or missing previous floor', () => {
    expect(previousFloorGifts(plan, 1)).toEqual([])
    expect(previousFloorGifts(plan, 3)).toEqual([])
    expect(previousFloorGifts(plan, 9)).toEqual([])
  })
})
