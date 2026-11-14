import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('@/features/community/server/feed', () => ({ loadDiscovery: state.load }))

import { loadInitialShelf } from '@/features/community/server/initial-shelf'

beforeEach(() => { state.load.mockReset() })

describe('board first paint', () => {
  it('loads the default (this week) shelves and drops the visit counts', async () => {
    state.load.mockResolvedValue({ recent: [{ id: 'r' }], updated: [], popular: [], identities: [], counts: [{ kind: 'deck' }] })
    const shelf = await loadInitialShelf('deck')
    expect(state.load).toHaveBeenCalledWith('deck', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(shelf).toEqual({ recent: [{ id: 'r' }], updated: [], popular: [], identities: [] })
    expect(shelf).not.toHaveProperty('counts')
  })

  it('returns undefined when the feed is unavailable, so the client loads it', async () => {
    state.load.mockImplementation(() => { throw new Error('Discovery unavailable') })
    expect(await loadInitialShelf('planner')).toBeUndefined()
  })
})
