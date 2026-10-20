import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Formation } from '@/lib/discovery/co-occurrence'

const state = vi.hoisted(() => ({
  formations: [] as Formation[],
  rows: [] as { entity_id: string; covisitors: number; visitors: number }[],
  rpcError: null as null | { message: string },
  rpcArgs: null as unknown,
  asked: {} as Record<string, string[]>,
  gone: new Set<string>(),
  tags: [] as string[],
  life: [] as string[],
}))

vi.mock('next/cache', () => ({
  cacheLife: (profile: string) => state.life.push(profile),
  cacheTag: (...tags: string[]) => state.tags.push(...tags),
}))
vi.mock('@/lib/db/meta', () => ({ getFormations: async () => state.formations }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      rpc: async (_name: string, args: unknown) => {
        state.rpcArgs = args
        return { data: state.rpcError ? null : state.rows, error: state.rpcError }
      },
      from: (table: string) => ({
        select: () => ({
          in: async (_column: string, ids: string[]) => {
            state.asked[table] = ids
            return { data: ids.filter(id => !state.gone.has(id)).map(id => ({ id, title: id, profiles: null })), error: null }
          },
        }),
      }),
    }),
  }),
}))

import { similarTo } from '@/lib/discovery/co-occurrence'
import { getCoVisited } from '@/lib/discovery/co-visited'

const f = (id: string, identities: string[], extra: Partial<Formation> = {}): Formation =>
  ({ kind: 'deck', id, identities, votes: 0, views: 0, ...extra })
const row = (entity_id: string) => ({ entity_id, covisitors: 5, visitors: 9 })

beforeEach(() => {
  state.rows = []
  state.rpcError = null
  state.rpcArgs = null
  state.asked = {}
  state.gone = new Set()
  state.tags = []
  state.life = []
  state.formations = [
    f('me', ['A', 'B', 'C', 'D']),
    f('s1', ['A', 'B', 'C']),
    f('s2', ['A', 'B', 'X']),
    f('s3', ['A', 'Y', 'Z', 'W']),
    f('far', ['Q']),
    f('p1', ['A', 'B', 'C', 'D'], { kind: 'planner' }),
  ]
})

describe('similarTo', () => {
  it('REQ-COMMUNITY-065 ranks same-kind posts by shared identities over the union, then votes, views and id', () => {
    const rows = [...state.formations, f('s4', ['A', 'B', 'C'], { votes: 2 })]
    // me = A B C D. s1 and s4 share 3 of 4 (0.75), s2 shares 2 of 5 (0.4), s3 shares 1 of 7; far and the plan are not candidates.
    expect(similarTo(rows, 'deck', 'me').map(post => post.id)).toEqual(['s4', 's1', 's2', 's3'])
  })

  it('REQ-COMMUNITY-065 returns nothing for a post without a formation', () => {
    expect(similarTo(state.formations, 'deck', 'missing')).toEqual([])
  })
})

describe('getCoVisited', () => {
  it('REQ-COMMUNITY-064 asks the database function for the post and window, and keeps its order', async () => {
    state.rows = [row('c2'), row('c1'), row('c3'), row('c4')]
    const posts = await getCoVisited('deck', 'me', [])
    expect(state.rpcArgs).toMatchObject({ entity: 'me', post_kind: 'deck' })
    expect(posts.map(post => post.id)).toEqual(['c2', 'c1', 'c3'])
  })

  it('REQ-COMMUNITY-064 leaves out the post itself and posts the page already shows elsewhere', async () => {
    state.rows = [row('me'), row('shown'), row('c1'), row('c2')]
    const posts = await getCoVisited('deck', 'me', ['shown'])
    expect(posts.map(post => post.id)).toEqual(['c1', 'c2', 's1'])
  })

  it('REQ-COMMUNITY-065 fills a sparse lane from similar formations of the same kind', async () => {
    state.rows = [row('c1')]
    expect((await getCoVisited('deck', 'me', [])).map(post => post.id)).toEqual(['c1', 's1', 's2'])
    state.rows = []
    expect((await getCoVisited('planner', 'p1', [])).map(post => post.id)).toEqual([])
    expect(state.asked.md_plans).toBeUndefined()
  })

  it('REQ-COMMUNITY-064 skips a deleted post and takes the next one', async () => {
    state.rows = [row('c1'), row('c2'), row('c3'), row('c4')]
    state.gone = new Set(['c1'])
    expect((await getCoVisited('deck', 'me', [])).map(post => post.id)).toEqual(['c2', 'c3', 'c4'])
  })

  it('REQ-COMMUNITY-066 is cached for hours under the board list tag', async () => {
    await getCoVisited('planner', 'p1', [])
    expect(state.life).toEqual(['hours'])
    expect(state.tags).toEqual(expect.arrayContaining(['plans-list']))
  })

  it('REQ-COMMUNITY-066 throws when the database function is missing, so the lane is hidden', async () => {
    state.rpcError = { message: 'function limbus.discovery_covisited does not exist' }
    await expect(getCoVisited('deck', 'me', [])).rejects.toThrow()
  })
})
