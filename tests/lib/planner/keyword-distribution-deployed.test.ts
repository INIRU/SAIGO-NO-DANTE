import { describe, expect, it } from 'vitest'
import { DEPLOYED_SLOT_COUNT, isDeployedSlot } from '@/lib/constants/game'
import { computeKeywordDistribution } from '@/lib/planner/fusion'

describe('formation size in one place', () => {
  it('deploys the first DEPLOYED_SLOT_COUNT slots (0-based) only', () => {
    expect(DEPLOYED_SLOT_COUNT).toBe(7)
    expect(isDeployedSlot(0)).toBe(true)
    expect(isDeployedSlot(DEPLOYED_SLOT_COUNT - 1)).toBe(true)
    expect(isDeployedSlot(DEPLOYED_SLOT_COUNT)).toBe(false)
    expect(isDeployedSlot(99)).toBe(false)
    expect(isDeployedSlot(-1)).toBe(false)
    expect(isDeployedSlot(null)).toBe(false)
  })
})

describe('keyword distribution of deployed and all identities', () => {
  it('counts every identity once per keyword and, with flags, the deployed ones', () => {
    const keywords = [['화상', '출혈'], ['화상'], ['화상', '화상'], ['출혈']]
    expect(computeKeywordDistribution(keywords, [true, false, true, false])).toEqual([
      { keyword: '화상', count: 3, deployed: 2 },
      { keyword: '출혈', count: 2, deployed: 1 },
    ])
    // Without flags the rows stay as before (no deployed field).
    expect(computeKeywordDistribution(keywords)).toEqual([{ keyword: '화상', count: 3 }, { keyword: '출혈', count: 2 }])
  })

  it('orders equal totals by the deployed count', () => {
    expect(computeKeywordDistribution([['화상'], ['출혈']], [false, true]).map(row => row.keyword)).toEqual(['출혈', '화상'])
  })
})
