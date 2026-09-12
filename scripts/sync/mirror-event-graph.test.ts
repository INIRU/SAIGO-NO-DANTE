import { describe, expect, it } from 'vitest'
import { registerEventParent } from './mirror-event-graph'

describe('Mirror Dungeon event parents', () => {
  it('keeps the entry to the thirsty tree when its child retries itself', () => {
    const parents = new Map<number, number>()
    registerEventParent(parents, 901023, 90102301)
    registerEventParent(parents, 90102301, 90102301)
    expect(parents.get(90102301)).toBe(901023)
  })

  it('does not create a parent for a root that loops or overwrite the first entry', () => {
    const parents = new Map<number, number>()
    registerEventParent(parents, 1, 1)
    registerEventParent(parents, 1, 2)
    registerEventParent(parents, 3, 2)
    expect([...parents]).toEqual([[2, 1]])
  })
})
