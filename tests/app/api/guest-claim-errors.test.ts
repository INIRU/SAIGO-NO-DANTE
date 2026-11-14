import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type Query, type Reply } from '../../helpers/fake-db'

const state = vi.hoisted(() => ({ reply: (() => undefined) as (query: Query) => Reply | undefined, calls: [] as Query[] }))

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c', name: 'a', image: null } } }) }))
vi.mock('@/lib/supabase/find-or-create-user', () => ({ findOrCreateSupabaseUser: async () => 'u1' }))
vi.mock('@/lib/rate-limit', () => ({ checkRequestRateLimit: () => ({ allowed: true }), rateLimitResponse: () => new Response(null, { status: 429 }) }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: async () => {} }))
vi.mock('@/features/account', () => ({ isGuestKey: () => true }))
vi.mock('@/features/account/server', () => ({ guestKeyHash: () => 'hash' }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb(query => state.reply(query), state.calls) }))

import { POST } from '@/app/api/guest/claim/route'

const claim = () => POST(new Request('http://localhost/api/guest/claim', { method: 'POST', body: JSON.stringify({ key: 'k' }) }))
const owned = ({ table, op }: Query): Reply | undefined => table === 'guest_authorship' && op === 'select' ? { data: [{ deck_id: 'd1', plan_id: 'p1' }] } : undefined
const withFailure = (failing: (query: Query) => boolean) => (query: Query): Reply | undefined => failing(query) ? { error: { message: 'down' } } : owned(query)

beforeEach(() => { state.reply = owned; state.calls.length = 0; vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('POST /api/guest/claim', () => {
  it('moves the posts and answers with the counts', async () => {
    const res = await claim()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ decks: 1, plans: 1 })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('a failed delete of the key rows is a 500 (a retry moves nothing twice and drops the key), not a 200', async () => {
    state.reply = withFailure(query => query.table === 'guest_authorship' && query.op === 'delete')
    const res = await claim()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '옮기지 못했습니다. 다시 시도해주세요.' })
    expect(state.calls.some(call => call.table.startsWith('rpc:'))).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  it.each([['community_record_deck'], ['community_record_plan']])('a failed %s is logged, and the claim still succeeds (the key rows are gone, so there is no retry)', async name => {
    state.reply = withFailure(query => query.table === `rpc:${name}`)
    const res = await claim()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ decks: 1, plans: 1 })
    expect((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.some(call => String(call[0]).includes(name))).toBe(true)
  })
})
