import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  rpcCalls: [] as { name: string; args: unknown }[],
  fromCalls: [] as string[],
  rpcResult: { data: true as boolean | null, error: null as { message: string } | null },
}))

const admin = {
  schema: () => ({
    from: (table: string) => { state.fromCalls.push(table); throw new Error('vote POST must not touch tables') },
    rpc: async (name: string, args: unknown) => { state.rpcCalls.push({ name, args }); return state.rpcResult },
  }),
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({ findOrCreateSupabaseUser: async () => 'u1' }))
vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({
  authOptions: {},
  requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c', name: 'a', image: null } } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { POST } from '@/app/api/decks/[id]/vote/route'

const post = () => POST(new NextRequest('http://localhost/api/decks/d1/vote', { method: 'POST' }), { params: Promise.resolve({ id: 'd1' }) })

describe('a deck vote changes the row and the count in one call', () => {
  beforeEach(() => {
    state.rpcCalls.length = 0
    state.fromCalls.length = 0
    state.rpcResult = { data: true, error: null }
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('calls toggle_deck_vote once and nothing else', async () => {
    const res = await post()
    expect(res.status).toBe(200)
    expect(state.rpcCalls).toEqual([{ name: 'toggle_deck_vote', args: { p_deck_id: 'd1', p_user_id: 'u1' } }])
    expect(state.fromCalls).toEqual([])
  })

  it.each([[true], [false]])('returns voted=%s as the function says', async voted => {
    state.rpcResult = { data: voted, error: null }
    expect(await (await post()).json()).toEqual({ voted })
  })

  it('a function error is a 500 with a fixed message', async () => {
    state.rpcResult = { data: null, error: { message: 'secret db text' } }
    const res = await post()
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret')
  })
})
