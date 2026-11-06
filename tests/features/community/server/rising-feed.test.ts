import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  rows: {} as Record<string, { entity_id: string; recent: number; base: number; recent_total: number; base_total: number }[]>,
  fresh: new Set<string>(),
  rpcError: null as null | { message: string },
  asked: {} as Record<string, string[]>,
  gone: new Set<string>(),
  asks: [] as { post_kind: string; max_rows?: number }[],
  formations: [] as { kind: 'deck' | 'planner'; id: string; identities: string[]; votes: number; views: number; createdAt?: number; deployed?: string[] }[],
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
      rpc: async (name: string, args: { post_kind: string; max_rows?: number }) => name !== 'discovery_rising_windows' ? { data: null, error: { message: 'unknown function' } } : (state.asks.push(args), { data: state.rpcError ? null : state.rows[args.post_kind] ?? [], error: state.rpcError }),
      from: (table: string) => ({
        select: () => ({
          gte: async () => ({ data: [...state.fresh].map(id => ({ id })), error: null }),
          in: async (_column: string, ids: string[]) => {
            state.asked[table] = ids
            return { data: ids.filter(id => !state.gone.has(id)).map(id => ({ id, title: id, name_kr: id, sinner_id: 'yisang', profiles: null, created_at: state.fresh.has(id) ? new Date().toISOString() : '2026-01-01T00:00:00Z', release_date: state.fresh.has(id) ? new Date().toISOString().slice(0, 10) : '2026-01-01' })), error: null }
          },
        }),
      }),
    }),
  }),
}))

vi.mock('@/features/community/server/rec-data', () => ({ getFormations: async () => state.formations }))
vi.mock('@/lib/db/meta', () => ({
  getMetaCatalog: async () => ({ identities: [{ id: 'lcb-1', game_id: '10101' }, { id: 'i1', game_id: '10315' }], egos: [], keywords: [] }),
}))

import { loadRising } from '@/features/community/server/rising-feed'

const row = (entity_id: string, recent: number, base: number) => ({ entity_id, recent, base, recent_total: 500, base_total: 2000 })

const plan = (id: string, identities: string[]) => ({ kind: 'planner' as const, id, identities, deployed: identities, votes: 0, views: 0, createdAt: Date.now() })

beforeEach(() => {
  state.rows = {
    deck: [row('d1', 6, 14), row('d2', 30, 40), row('d3', 12, 100), row('d4', 20, 8), row('d6', 6, 6), row('d7', 12, 10), row('d8', 5, 0)],
    planner: [row('p1', 20, 4), row('p2', 7, 0), row('p3', 7, 0), row('p4', 4, 20), ...['q1', 'q2', 'q3', 'r1', 'r2', 'r3'].map(id => row(id, 7, 0))],
  }
  // i1, i3 and i4 each stand on three recent plans; i2 on one;
  // lcb-1 is a default LCB identity fielded just like i1.
  state.formations = [
    ...['p1', 'p2', 'p3'].map(id => plan(id, ['i1', 'lcb-1'])), plan('p4', ['i2']),
    ...['q1', 'q2', 'q3'].map(id => plan(id, ['i3'])), ...['r1', 'r2', 'r3'].map(id => plan(id, ['i4'])),
  ]
  state.asks = []
  state.rpcError = null
  state.asked = {}
  state.gone = new Set()
  state.fresh = new Set()
  state.tags = []
  state.life = []
})

describe('loadRising', () => {
  it('REQ-COMMUNITY-074 returns one row of the biggest risers of the board and of identities, each with its multiplier', async () => {
    const result = await loadRising('deck')
    // d1, d3, d6 and d8 are below the evidence of eight recent visitors or did not rise; the three biggest by (rise − 1) × √recent are d4, d2, d7.
    expect(result.posts.map(item => item.post.id)).toEqual(['d4', 'd7', 'd2'])
    expect(state.asked.decks).not.toContain('d3')
  })

  it('REQ-COMMUNITY-079 shows the biggest multiplier first, not the order they were picked in', async () => {
    const result = await loadRising('deck')
    // By score d2 (×2.5, more visitors) comes before d7 (×2.7); shown, the larger multiplier leads.
    expect(result.posts.map(item => item.rise)).toEqual([4.6, 2.7, 2.5])
  })

  it('REQ-COMMUNITY-079 fills the row from thinner evidence when the stricter floor leaves it short', async () => {
    state.gone = new Set(['d4'])
    // Without d4 (deleted) only d2 and d7 have eight recent visitors; d8 (five, ×2.7) comes in under the relaxed floor, ahead of d6 and d1.
    expect((await loadRising('deck')).posts.map(item => item.post.id)).toEqual(['d7', 'd8', 'd2'])
  })

  it('REQ-COMMUNITY-074 lets a new post and a new identity rise like any other, like a live ranking', async () => {
    state.fresh = new Set(['d4', 'i3'])
    expect((await loadRising('deck')).posts.map(item => item.post.id)).toContain('d4')
    expect((await loadRising('planner')).identities.map(item => item.identity.id)).toContain('i3')
  })

  it('REQ-COMMUNITY-079 leaves a section out when fewer than three qualify, and a deleted post counts as missing', async () => {
    state.rows.deck = [row('d4', 20, 8), row('d2', 30, 40)]
    expect((await loadRising('deck')).posts).toEqual([])
    state.rows.deck = [row('d4', 20, 8), row('d2', 30, 40), row('d7', 12, 10)]
    state.gone = new Set(['d7'])
    expect((await loadRising('deck')).posts).toEqual([])
  })

  it('REQ-COMMUNITY-079 fills the place of a deleted riser with the next one instead of dropping the row', async () => {
    // d4 rose the most but was deleted; d9 (×2.6 on ten visitors) is next in line and takes its place.
    state.rows.deck = [row('d4', 20, 8), row('d2', 30, 40), row('d7', 12, 10), row('d9', 10, 8)]
    state.gone = new Set(['d4'])
    expect((await loadRising('deck')).posts.map(item => item.post.id)).toEqual(['d7', 'd9', 'd2'])
  })

  it('REQ-COMMUNITY-074 reads plans from the plan table', async () => {
    const result = await loadRising('planner')
    expect(result.posts.map(item => item.post.id)).toEqual(['p1', 'p2', 'p3'])
    expect(state.asked.md_plans).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']))
  })

  it('REQ-COMMUNITY-076 shows how many recent posts of its own board field each identity, and skips the LCB defaults', async () => {
    const plans = await loadRising('planner')
    expect(plans.identities.map(item => [item.identity.id, item.count])).toEqual([['i1', 3], ['i3', 3], ['i4', 3]])
    expect((await loadRising('deck')).identities).toEqual([])
  })

  it('REQ-COMMUNITY-078 asks only for the posts of its own board, and never for identity visits', async () => {
    await loadRising('deck')
    expect(state.asks.map(ask => ask.post_kind)).toEqual(['deck'])
  })

  it('REQ-COMMUNITY-074 is cached under the board list tag', async () => {
    await loadRising('planner')
    expect(state.life).toHaveLength(1)
    expect(state.tags).toEqual(expect.arrayContaining(['plans-list']))
  })

  it('REQ-COMMUNITY-074 throws when the database function is missing, so the shelf is hidden', async () => {
    state.rpcError = { message: 'function limbus.discovery_rising_windows does not exist' }
    await expect(loadRising('deck')).rejects.toThrow()
  })
})
