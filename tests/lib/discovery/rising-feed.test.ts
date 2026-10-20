import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: {} as Record<string, { entity_id: string; recent: number; base: number }[]>,
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
      rpc: async (_name: string, args: { post_kind: string }) => ({ data: state.rpcError ? null : state.rows[args.post_kind] ?? [], error: state.rpcError }),
      from: (table: string) => ({
        select: () => ({
          in: async (_column: string, ids: string[]) => {
            state.asked[table] = ids
            return { data: ids.filter(id => !state.gone.has(id)).map(id => ({ id, title: id, name_kr: id, sinner_id: 'yisang', profiles: null })), error: null }
          },
        }),
      }),
    }),
  }),
}))

import { loadRising } from '@/lib/discovery/rising-feed'

const row = (entity_id: string, recent: number, base = 0) => ({ entity_id, recent, base })

beforeEach(() => {
  state.rows = { deck: [row('d1', 6, 14), row('d2', 9, 0), row('d3', 12, 100), row('d4', 8, 5), row('d5', 7, 7), row('d6', 6, 6), row('d7', 6, 0), row('d8', 5, 0)], identity: [row('i1', 20, 10), row('i2', 8, 0)], planner: [row('p1', 7, 0)] }
  state.rpcError = null
  state.asked = {}
  state.gone = new Set()
  state.tags = []
  state.life = []
})

describe('loadRising', () => {
  it('REQ-COMMUNITY-069 returns the biggest risers of the board and of identities, each with its rise', async () => {
    const result = await loadRising('deck')
    // d3 did not rise; the rest are ranked by rise and cut to the three shown.
    expect(result.posts.map(item => item.post.id)).toEqual(['d2', 'd7', 'd8'])
    expect(result.posts.map(item => item.rise)).toEqual([600, 400, 333])
    expect(result.identities.map(item => item.identity.id)).toEqual(['i2', 'i1'])
    expect(state.asked.decks).not.toContain('d3')
  })

  it('REQ-COMMUNITY-069 skips a post deleted since the count and takes the next riser', async () => {
    state.gone = new Set(['d7'])
    expect((await loadRising('deck')).posts.map(item => item.post.id)).toEqual(['d2', 'd8', 'd4'])
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
    state.rpcError = { message: 'function limbus.discovery_rising does not exist' }
    await expect(loadRising('deck')).rejects.toThrow()
  })
})
