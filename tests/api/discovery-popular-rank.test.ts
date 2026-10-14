import { expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ asked: [] as string[] }))

// Visit ranks as discovery_counts returns them (up to twelve per kind). d1 and d8 were deleted.
const counts = [
  ['d1', 50], ['d2', 40], ['d3', 30], ['d4', 20], ['d5', 10], ['d6', 10],
  ['d7', 10], ['d8', 5], ['d9', 4], ['d10', 3], ['d11', 2], ['d12', 1],
].map(([entity_id, visitors]) => ({ kind: 'deck', entity_id, visitors }))
const day = (d: string) => `2026-${d}T00:00:00+00:00`
const rows = [
  { id: 'd12', user_id: null, guest_tag: null, vote_count: 0, created_at: day('10-01') },
  { id: 'd5', user_id: 'B', guest_tag: null, vote_count: 1, created_at: day('10-01') },
  { id: 'd11', user_id: null, guest_tag: 'ab12', vote_count: 0, created_at: day('10-01') },
  { id: 'd4', user_id: 'A', guest_tag: null, vote_count: 0, created_at: day('10-01') },
  { id: 'd7', user_id: 'D', guest_tag: null, vote_count: 1, created_at: day('10-05') },
  { id: 'd10', user_id: null, guest_tag: 'ab12', vote_count: 0, created_at: day('10-01') },
  { id: 'd3', user_id: 'A', guest_tag: null, vote_count: 0, created_at: day('10-01') },
  { id: 'd6', user_id: 'C', guest_tag: null, vote_count: 5, created_at: day('09-01') },
  { id: 'd9', user_id: null, guest_tag: 'ab12', vote_count: 0, created_at: day('10-01') },
  { id: 'd2', user_id: 'A', guest_tag: null, vote_count: 0, created_at: day('10-01') },
]

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      rpc: async (name: string) => ({ data: name === 'discovery_counts' ? counts : [], error: null }),
      from: () => ({
        select: () => ({
          order: () => ({ limit: async () => ({ data: [], error: null }) }),
          // PostgREST .in() returns only the rows that exist, in no promised order.
          in: async (_column: string, ids: string[]) => {
            state.asked = ids
            return { data: rows.filter(row => ids.includes(row.id)), error: null }
          },
        }),
      }),
    }),
  }),
}))

import { GET } from '@/app/api/discovery/route'

it('REQ-COMMUNITY-033 REQ-COMMUNITY-034 REQ-COMMUNITY-035 sends six existing posts in rank order, two per author', async () => {
  const response = await GET(new Request('http://localhost/api/discovery?kind=deck'))
  expect(response.status).toBe(200)
  const body = await response.json()
  // All twelve ranked ids are looked up, so a deleted post leaves no hole.
  expect(state.asked).toHaveLength(12)
  // d1, d8: deleted. d4: third post of A. d6 > d7 > d5: same visitors, then votes, then newest.
  expect(body.popular.map((post: { id: string }) => post.id)).toEqual(['d2', 'd3', 'd6', 'd7', 'd5', 'd9'])
})
