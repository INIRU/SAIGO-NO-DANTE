import { describe, expect, it } from 'vitest'
import { FINAL_FLOOR } from '@/lib/planner/types'
import { withThemeRewards } from '@/lib/planner/fusion'

const pack = { fixed_reward_gift_ids: [9250, 9251] }

describe('REQ-PLANNER-047 floor 15 gets no automatic clear rewards', () => {
  it('REQ-PLANNER-047 adds the pack clear rewards to an earlier floor', () => {
    expect(withThemeRewards(['10', '9250_plus'], pack, 1)).toEqual(['10', '9250_plus', '9251'])
    expect(withThemeRewards(['10'], pack, FINAL_FLOOR - 1)).toEqual(['10', '9250', '9251'])
    expect(withThemeRewards(['10'], pack, undefined)).toEqual(['10', '9250', '9251'])
  })
  it('REQ-PLANNER-047 adds nothing on floor 15 and keeps the gifts picked there', () => {
    expect(FINAL_FLOOR).toBe(15)
    expect(withThemeRewards(['10', '9250'], pack, FINAL_FLOOR)).toEqual(['10', '9250'])
    expect(withThemeRewards([], pack, FINAL_FLOOR)).toEqual([])
  })
})
