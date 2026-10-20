import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: {} as Record<string, { entity_id: string; recent: number; base: number; recent_total: number; base_total: number }[]>,
  fresh: new Set<string>(),
  rpcError: null as null | { message: string },
  asked: {} as Record<string, string[]>,
  gone: new Set<string>(),
  tags: [] as string[],
  life: [] as string[],
}))

vi.mock('next/cache', () => ({
  cacheLife: (profile: string) => state.life.push(profile),
  cacheTag: (...tags: string[]) => state.tags.push(...tags),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      rpc: async (name: string, args: { post_kind: string }) => name !== 'discovery_rising_shares' ? { data: null, error: { message: 'unknown function' } } : ({ data: state.rpcError ? null : state.rows[args.post_kind] ?? [], error: state.rpcError }),
      from: (table: string) => ({
        select: () => ({
          in: async (_column: string, ids: string[]) => {
            state.asked[table] = ids
            return { data: ids.filter(id => !state.gone.has(id)).map(id => ({ id, title: id, name_kr: id, sinner_id: 'yisang', profiles: null, created_at: state.fresh.has(id) ? new Date().toISOString() : '2026-01-01T00:00:00Z', release_date: state.fresh.has(id) ? new Date().toISOString().slice(0, 10) : '2026-01-01' })), error: null }
          },
        }),
      }),
    }),
  }),
}))

import { loadRising } from '@/lib/discovery/rising-feed'

const row = (entity_id: string, recent: number, base: number) => ({ entity_id, recent, base, recent_total: 500, base_total: 2000 })

beforeEach(() => {
  state.rows = {
    deck: [row('d1', 6, 14), row('d2', 30, 40), row('d3', 12, 100), row('d4', 20, 8), row('d5', 10, 0), row('d6', 6, 6), row('d7', 12, 10), row('d8', 5, 0)],
    identity: [row('i1', 40, 20), row('i2', 8, 0)],
    planner: [row('p1', 20, 4)],
  }
  state.rpcError = null
  state.asked = {}
  state.gone = new Set()
  state.fresh = new Set()
  state.tags = []
  state.life = []
})

describe('loadRising', () => {
  it('REQ-COMMUNITY-069 returns the biggest risers of the board and of identities, each with its multiplier', async () => {
    const result = await loadRising('deck')
    // d1 and d3 did not rise by ×1.5; the rest are ranked by (rise − 1) × √recent and cut to the five shown.
    expect(result.posts.map(item => item.post.id)).toEqual(['d4', 'd5', 'd2', 'd7', 'd8'])
    expect(result.posts.map(item => item.rise)).toEqual([4.6, 4.3, 2.5, 2.7, 2.7])
    expect(result.identities.map(item => item.identity.id)).toEqual(['i1', 'i2'])
    expect(state.asked.decks).not.toContain('d3')
  })

  it('REQ-COMMUNITY-069 leaves out posts and identities that are themselves new, so they stay with the new ones', async () => {
    state.fresh = new Set(['d4', 'i1'])
    const result = await loadRising('deck')
    expect(result.posts.map(item => item.post.id)).toEqual(['d5', 'd2', 'd7', 'd8', 'd6'])
    expect(result.identities.map(item => item.identity.id)).toEqual(['i2'])
  })

  it('REQ-COMMUNITY-069 skips a post deleted since the count and takes the next riser', async () => {
    state.gone = new Set(['d5'])
    expect((await loadRising('deck')).posts.map(item => item.post.id)).toEqual(['d4', 'd2', 'd7', 'd8', 'd6'])
  })

  it('REQ-COMMUNITY-069 reads plans from the plan table', async () => {
    const result = await loadRising('planner')
    expect(result.posts.map(item => item.post.id)).toEqual(['p1'])
    expect(state.asked.md_plans).toEqual(['p1'])
  })

  it('REQ-COMMUNITY-069 is cached under the board list tag', async () => {
    await loadRising('planner')
    expect(state.life).toHaveLength(1)
    expect(state.tags).toEqual(expect.arrayContaining(['plans-list']))
  })

  it('REQ-COMMUNITY-069 throws when the database function is missing, so the shelf is hidden', async () => {
    state.rpcError = { message: 'function limbus.discovery_rising_shares does not exist' }
    await expect(loadRising('deck')).rejects.toThrow()
  })
})
