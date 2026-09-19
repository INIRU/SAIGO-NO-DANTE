import { expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      rpc: async (name: string) => ({
        data: name === 'discovery_counts'
          ? [{ kind: 'deck', entity_id: 'deck-1', visitors: 1 }]
          : [{ entity_id: 'deck-1' }],
        error: null,
      }),
      from: () => ({
        select: (columns: string) => {
          const result = {
            data: ['거던15층', null].map((type, index) => ({
              id: `deck-${index + 1}`,
              ...(columns.split(',').includes('content_type') ? { content_type: type } : {}),
            })),
            error: null,
          }
          return { order: () => ({ limit: async () => result }), in: async () => result }
        },
      }),
    }),
  }),
}))

import { GET } from '@/app/api/discovery/route'

it('preserves content types for all discovery deck shelves without inventing missing metadata', async () => {
  const response = await GET(new Request('http://localhost/api/discovery?kind=deck'))
  expect(response.status).toBe(200)
  const body = await response.json()
  for (const shelf of ['recent', 'updated', 'popular']) {
    expect(body[shelf].find((deck: { id: string }) => deck.id === 'deck-1').content_type).toBe('거던15층')
    expect(body[shelf].find((deck: { id: string }) => deck.id === 'deck-2').content_type).toBeNull()
  }
})
