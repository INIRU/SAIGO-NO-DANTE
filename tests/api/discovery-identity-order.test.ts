import { expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      rpc: async (name: string) => ({
        data: name === 'discovery_counts'
          ? [
              { kind: 'identity', entity_id: 'identity-top', visitors: 20 },
              { kind: 'identity', entity_id: 'identity-tie-b', visitors: 10 },
              { kind: 'identity', entity_id: 'identity-tie-a', visitors: 10 },
            ]
          : [],
        error: null,
      }),
      from: (table: string) => ({
        select: () => ({
          order: () => ({ limit: async () => ({ data: [], error: null }) }),
          in: async () => ({
            // PostgREST .in() does not promise to retain the supplied ID order.
            data: table === 'identities'
              ? [
                  { id: 'identity-tie-a', name_kr: '가' },
                  { id: 'identity-tie-b', name_kr: '나' },
                  { id: 'identity-top', name_kr: '다' },
                ]
              : [],
            error: null,
          }),
        }),
      }),
    }),
  }),
}))

import { GET } from '@/app/api/discovery/route'

it('returns popular identities in visit-count rank order, including deterministic ties', async () => {
  const response = await GET(new Request('http://localhost/api/discovery?kind=deck'))
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.identities.map((identity: { id: string }) => identity.id)).toEqual([
    'identity-top',
    'identity-tie-a',
    'identity-tie-b',
  ])
})
