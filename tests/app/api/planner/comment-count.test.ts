import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ ops: [] as string[] }))

function from(table: string) {
  const chain: Record<string, unknown> = {
    select: (_cols?: string, opts?: { head?: boolean }) => { state.ops.push(`select ${table}${opts?.head ? ' head' : ''}`); return chain },
    insert: () => { state.ops.push(`insert ${table}`); return chain },
    update: () => { state.ops.push(`update ${table}`); return chain },
    eq: () => chain,
    single: async () => ({ data: { id: 'c1', content: 'hi', parent_id: null, created_at: 't' }, error: null }),
    then: (resolve: (value: unknown) => unknown) => resolve({ data: null, count: 1, error: null }),
  }
  return chain
}
const admin = { schema: () => ({ from }) }

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({ findOrCreateSupabaseUser: async () => 'u1' }))
vi.mock('@/lib/auth', () => ({
  requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c', name: 'a', image: null } } }),
}))
vi.mock('@/lib/push/send', () => ({ pushForComment: async () => {} }))
vi.mock('@/lib/rate-limit', () => ({ checkRequestRateLimit: () => ({ allowed: true }), rateLimitResponse: () => new Response(null, { status: 429 }) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('next/server', async () => ({ ...(await vi.importActual<object>('next/server')), after: (fn: () => unknown) => { void fn() } }))

import { POST } from '@/app/api/planner/[id]/comments/route'

describe('the database keeps the plan comment count', () => {
  beforeEach(() => { state.ops.length = 0; vi.spyOn(console, 'error').mockImplementation(() => {}) })

  it('writing a comment only inserts it, with no count query or md_plans update', async () => {
    const res = await POST(new NextRequest('http://localhost/api/planner/p1/comments', { method: 'POST', body: JSON.stringify({ content: 'hi' }) }), { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(201)
    // the insert's own `.select()` returns the new row; nothing counts rows or touches md_plans
    expect(state.ops).toEqual(['insert md_plan_comments', 'select md_plan_comments'])
  })
})
