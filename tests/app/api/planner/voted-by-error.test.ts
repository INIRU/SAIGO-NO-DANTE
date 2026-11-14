import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ votesError: null as { message: string } | null, plansError: null as { message: string } | null }))

vi.mock('next-auth', () => ({ getServerSession: async () => ({ user: { email: 'a@b.c' } }) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({ findOrCreateSupabaseUser: async () => 'user-1' }))
vi.mock('@/lib/push/send', () => ({ pushForPost: async () => {} }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: async () => {} }))
vi.mock('@/features/community/server', () => ({ saveSeriesChoice: async () => null, withPostAuthors: async (rows: unknown[]) => rows }))
vi.mock('@/features/account/server', () => ({ authorColumns: () => ({}), authorRateKey: () => 'k', guestPinOf: () => null, recordGuestAuthorship: async () => null, resolveAuthor: async () => ({ response: new Response(null, { status: 401 }) }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeDb() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb() }))

function fakeDb() {
  return {
    schema: () => ({
      from: (table: string) => {
        const result = table === 'md_plan_votes'
          ? { data: state.votesError ? null : [{ plan_id: 'p1' }], error: state.votesError }
          : { data: state.plansError ? null : [], count: 0, error: state.plansError }
        const chain: Record<string, unknown> = { then: (resolve: (value: typeof result) => unknown) => resolve(result) }
        for (const method of ['select', 'eq', 'in', 'contains', 'order', 'range']) chain[method] = () => chain
        return chain
      },
    }),
  }
}

import { GET } from '@/app/api/planner/route'

const get = (query: string) => GET(new NextRequest('http://localhost/api/planner?' + query))

describe('planner list votedBy and userId', () => {
  beforeEach(() => { state.votesError = null; state.plansError = null; vi.spyOn(console, 'error').mockImplementation(() => {}) })

  it('a votedBy lookup DB error is a 500 with a fixed message, not an empty list', async () => {
    state.votesError = { message: 'relation "md_plan_votes" does not exist' }
    const res = await get('votedBy=me')
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('md_plan_votes')
  })

  it('a userId that is not "me" is a 400', async () => {
    expect((await get('userId=someone-else')).status).toBe(400)
  })

  it('userId=me still works', async () => {
    expect((await get('userId=me')).status).toBe(200)
  })

  it('the list query error does not leak the DB message', async () => {
    state.plansError = { message: 'permission denied for table md_plans' }
    const res = await get('')
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('md_plans')
  })
})
