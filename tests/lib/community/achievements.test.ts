import { describe, expect, it } from 'vitest'
import { achievementProgress, nextPointsBadge } from '@/lib/community/achievements'

const stats = (over: Partial<Record<'deck' | 'plan' | 'like' | 'contribution' | 'points', number>> = {}) =>
  ({ deck: 0, plan: 0, like: 0, contribution: 0, points: 0, ...over })

describe('achievements', () => {
  it('earns a badge exactly at its goal and caps progress there', () => {
    const list = achievementProgress(stats({ deck: 5, plan: 1, points: 140 }))
    const by = (id: string) => list.find(a => a.id === id)!
    expect(by('deck-1').earned).toBe(true)
    expect(by('deck-5')).toMatchObject({ earned: true, value: 5 })
    expect(by('deck-20')).toMatchObject({ earned: false, value: 5 })
    expect(by('plan-5')).toMatchObject({ earned: false, value: 1 })
    expect(by('points-100').earned).toBe(true)
    expect(by('points-500')).toMatchObject({ earned: false, value: 140 })
  })

  it('earns each easter egg badge on its own and the collector badge only with all of them', () => {
    const some = achievementProgress(stats(), ['konami', 'lost-manager'])
    expect(some.filter(a => a.hidden && a.earned).map(a => a.id)).toEqual(['egg-konami', 'egg-lost-manager'])
    expect(some.find(a => a.id === 'egg-all')).toMatchObject({ earned: false, value: 2 })
    const all = achievementProgress(stats(), ['faust-faces', 'clock-head', 'twisted-star', 'konami', 'lost-manager'])
    expect(all.find(a => a.id === 'egg-all')?.earned).toBe(true)
  })

  it('points to the next score badge from the previous one', () => {
    expect(nextPointsBadge(0)).toEqual({ goal: 100, remaining: 100, ratio: 0 })
    expect(nextPointsBadge(300)).toEqual({ goal: 500, remaining: 200, ratio: 0.5 })
    expect(nextPointsBadge(3000)).toBeNull()
  })
})
