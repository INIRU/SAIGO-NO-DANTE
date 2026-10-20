import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Formation } from '@/lib/discovery/co-occurrence'
import { catalogOf, identity } from './rec-fixtures'

const state = vi.hoisted(() => ({
  formations: [] as Formation[],
  catalog: null as unknown,
  rpcError: null as null | { message: string },
  asked: {} as Record<string, string[]>,
  tags: [] as string[],
  life: [] as string[],
}))

vi.mock('next/cache', () => ({
  cacheLife: (profile: string) => state.life.push(profile),
  cacheTag: (...tags: string[]) => state.tags.push(...tags),
}))
vi.mock('@/lib/db/meta', () => ({ getFormations: async () => state.formations, getRecCatalog: async () => state.catalog }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      rpc: async () => ({
        data: state.rpcError ? null : [{ kind: 'deck', entity_id: 'd2', visitors: 7 }, { kind: 'identity', entity_id: 'A', visitors: 99 }],
        error: state.rpcError,
      }),
      from: (table: string) => ({
        select: () => ({
          in: async (_column: string, ids: string[]) => {
            state.asked[table] = ids
            const rows = table === 'identities'
              ? ids.map(id => ({ id, sinner_id: 'yisang', rarity: 3, game_id: '10101', folder_name: 'x', name_kr: id }))
              : ids.filter(id => id !== 'gone').map(id => ({ id, title: id, profiles: null }))
            return { data: rows, error: null }
          },
        }),
      }),
    }),
  }),
}))

import { getIdentityRecommendations } from '@/lib/discovery/identity-recommendations'

const f = (id: string, identities: string[], extra: Partial<Formation> = {}): Formation =>
  ({ kind: 'deck', id, identities, votes: 0, views: 0, ...extra })

beforeEach(() => {
  state.catalog = catalogOf({ identities: [identity('A', 'x'), identity('B', 'y'), identity('C', 'z')] })
  state.rpcError = null
  state.asked = {}
  state.tags = []
  state.life = []
  state.formations = [
    f('d1', ['A', 'B'], { votes: 3 }),
    f('d2', ['A', 'B']),
    f('gone', ['A', 'B'], { votes: 50 }),
    f('p1', ['A', 'B'], { kind: 'planner', votes: 1 }),
    f('d3', ['C']),
  ]
})

describe('getIdentityRecommendations', () => {
  it('REQ-COMMUNITY-067 sends companions with their card fields and the identity posts in window order, skipping deleted posts', async () => {
    const result = await getIdentityRecommendations('A')
    expect(result.companions).toEqual([expect.objectContaining({ id: 'B', sinner_id: 'yisang', count: 4 })])
    // d2 has window visitors; then votes: gone (deleted) 50, d1 3, p1 1.
    expect(result.posts.map(item => `${item.kind}:${item.post.id}`)).toEqual(['deck:d2', 'deck:d1', 'planner:p1'])
    expect(state.asked.decks).toEqual(expect.arrayContaining(['d2', 'gone', 'd1']))
    expect(state.asked.md_plans).toEqual(['p1'])
  })

  it('REQ-COMMUNITY-068 is cached for hours under the deck and plan list tags', async () => {
    await getIdentityRecommendations('A')
    expect(state.life).toEqual(['hours'])
    expect(state.tags).toEqual(expect.arrayContaining(['decks-list', 'plans-list']))
  })

  it('REQ-COMMUNITY-068 fails loudly on a read error so the page hides the section', async () => {
    state.rpcError = { message: 'down' }
    await expect(getIdentityRecommendations('A')).rejects.toThrow()
  })

  it('REQ-COMMUNITY-068 returns empty lists for an identity no formation fields', async () => {
    expect(await getIdentityRecommendations('nobody')).toEqual({ companions: [], posts: [] })
  })
})
