import { describe, expect, it } from 'vitest'
import { planFromRunDraft } from '../../../lib/fun/prescript-plan'

describe('the plan the prescripts weigh against', () => {
  it('takes the target gifts, every floor planned gift and the main keywords from the run draft', () => {
    const draft = JSON.stringify({ version: 0, state: { targetGifts: ['final_9083', '9101'],
      sourcePlanSnapshot: { mainKeywords: ['Bleeding'], floorPlan: [{ floor: 1, gift_ids: ['9001', '9002'] }, { floor: 2, gift_ids: [] }] } } })
    const plan = planFromRunDraft(draft)
    expect([...plan.giftIds].sort()).toEqual([9001, 9002, 9083, 9101])
    expect(plan.keywords).toEqual(['Bleeding'])
  })

  it('is empty without a draft or with a broken one', () => {
    expect(planFromRunDraft(null).giftIds.size).toBe(0)
    expect(planFromRunDraft('{not json').keywords).toEqual([])
  })
})
