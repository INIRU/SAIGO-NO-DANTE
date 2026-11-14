import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({ rpcCalls: [] as string[] }))

function from(table: string) {
  const row = table === 'deck_comments'
    ? { id: 'c1', content: 'hi', created_at: 't', user_id: 'u1', parent_id: null }
    : { username: 'n', avatar_url: null, role: 'user' }
  const chain: Record<string, unknown> = {
    select: () => chain, insert: () => chain, delete: () => chain, eq: () => chain,
    single: async () => ({ data: row, error: null }),
    maybeSingle: async () => ({ data: row, error: null }),
    // the delete call and the thread lookup are awaited directly: one child row hangs under c1
    then: (resolve: (value: unknown) => unknown) => resolve({ data: [{ id: 'c1', parent_id: null }, { id: 'c2', parent_id: 'c1' }], error: null }),
  }
  return chain
}
const admin = { schema: () => ({ from, rpc: async (name: string) => { state.rpcCalls.push(name); return { error: null } } }) }

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/supabase/find-or-create-user', () => ({ findOrCreateSupabaseUser: async () => 'u1' }))
vi.mock('@/lib/auth', () => ({
  requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c', name: 'a', image: null } } }),
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: async () => {} }))
vi.mock('@/lib/push/send', () => ({ pushForComment: async () => {} }))
vi.mock('@/lib/rate-limit', () => ({ checkRequestRateLimit: () => ({ allowed: true }), rateLimitResponse: () => new Response(null, { status: 429 }) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('next/server', async () => ({ ...(await vi.importActual<object>('next/server')), after: (fn: () => unknown) => { void fn() } }))

import { POST, DELETE } from '@/app/api/decks/[id]/comments/route'

const params = { params: Promise.resolve({ id: 'd1' }) }

describe('the database keeps the deck comment count', () => {
  beforeEach(() => { state.rpcCalls.length = 0; vi.spyOn(console, 'error').mockImplementation(() => {}) })

  it('writing a comment does not call increment_comment', async () => {
    const res = await POST(new NextRequest('http://localhost/api/decks/d1/comments', { method: 'POST', body: JSON.stringify({ content: 'hi' }) }), params)
    expect(res.status).toBe(200)
    expect(state.rpcCalls).toEqual([])
  })

  it('deleting a comment with a reply does not call decrement_comment', async () => {
    const res = await DELETE(new NextRequest('http://localhost/api/decks/d1/comments?commentId=c1', { method: 'DELETE' }), params)
    expect(res.status).toBe(200)
    expect(state.rpcCalls).toEqual([])
  })
})
