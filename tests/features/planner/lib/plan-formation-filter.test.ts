import { expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { planFormationCount } from '@/features/planner/lib/plan-formation-count'

const slot = (identity_id: string, slot_order?: number) => ({ identity_id, sinner_id: identity_id, ...(slot_order === undefined ? {} : { slot_order }) })
const plans = [
  { id: 'six', lang: 'ko', deck: [0, 1, 2, 3, 4, 5].map(order => slot(`a${order}`, order)).concat(slot('bench', 99)), tags: [] },
  { id: 'five', lang: 'ko', deck: [0, 1, 2, 3, 4].map(order => slot(`b${order}`, order)), tags: [] },
  { id: 'six-with-x', lang: 'ko', deck: [0, 1, 2, 3, 4].map(order => slot(`c${order}`, order)).concat(slot('x', 5)), tags: [] },
]

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const builder = (table: string) => {
      const query: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'in', 'contains', 'order', 'range']) query[method] = () => query
      query.then = (resolve: (value: unknown) => void) => resolve(table === 'md_plans'
        ? { data: plans.map(plan => ({ ...plan, deck: structuredClone(plan.deck) })), count: plans.length, error: null }
        : { data: [], error: null })
      return query
    }
    return { schema: () => ({ from: builder }) }
  },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({ authOptions: {}, requireActiveUser: async () => ({ error: true }) }))
vi.mock('@/lib/supabase/find-or-create-user', () => ({ findOrCreateSupabaseUser: async () => null }))
vi.mock('@/lib/rate-limit', () => ({ checkRequestRateLimit: () => ({ ok: true }), rateLimitResponse: () => null }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: async () => {} }))
vi.mock('next/cache', () => ({ revalidateTag: () => {} }))

async function list(query: string) {
  const { GET } = await import('@/app/api/planner/route')
  const response = await GET(new NextRequest(`http://localhost/api/planner?${query}`))
  return { status: response.status, body: await response.json() as { plans?: { id: string }[]; total?: number } }
}

it('counts formation members like the deck board: identity slots with an order below 99', () => {
  expect(planFormationCount(plans[0].deck)).toBe(6)
  expect(planFormationCount([slot('a', 0), slot('b'), slot('c', 99), slot('', 1), { slot_order: 2 }, null, 'x'])).toBe(1)
  expect(planFormationCount(null)).toBe(0)
})

it('filters the plan list by exact formation count on the server, combined with other filters', async () => {
  const six = await list('formation_count=6')
  expect(six.body.plans?.map(plan => plan.id)).toEqual(['six', 'six-with-x'])
  expect(six.body.total).toBe(2)
  // The URL alias and identity filter combine with it.
  expect((await list('fc=6&identity_ids=x')).body.plans?.map(plan => plan.id)).toEqual(['six-with-x'])
  expect((await list('formation_count=5')).body.plans?.map(plan => plan.id)).toEqual(['five'])
  expect((await list('')).body.plans?.map(plan => plan.id)).toEqual(['six', 'five', 'six-with-x'])
})

it('rejects formation counts outside 1-12 like the deck board', async () => {
  for (const value of ['0', '13', 'abc', '2.5']) expect((await list(`formation_count=${value}`)).status).toBe(400)
})

