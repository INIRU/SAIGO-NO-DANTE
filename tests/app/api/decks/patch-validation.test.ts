import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; op: 'select' | 'update' | 'delete' | 'insert'; payload?: unknown }

const calls: Call[] = []
const rpcCalls: { name: string; args: Record<string, unknown> }[] = []
let rpcError: { message: string } | null = null
let failOn: (call: Call) => boolean = () => false
let rateAllowed = true

const deckRow = { id: 'd1', user_id: 'u1', title: 'old', description: null, tags: ['keep'], main_keywords: [], content_type: '없음', content_edited_at: null }

function from(table: string) {
  const make = (op: Call['op'], payload?: unknown) => {
    const call: Call = { table, op, payload }
    calls.push(call)
    const result = { data: null, error: failOn(call) ? { message: 'secret db text' } : null }
    const chain: Record<string, unknown> = {
      eq: () => chain,
      single: async () => ({ data: table === 'decks' ? deckRow : null, error: null }),
      then: (resolve: (value: typeof result) => unknown) => resolve(result),
    }
    return chain
  }
  return {
    select: () => make('select'),
    update: (payload: unknown) => make('update', payload),
    delete: () => make('delete'),
    insert: (payload: unknown) => make('insert', payload),
  }
}
const rpc = async (name: string, args: Record<string, unknown>) => {
  rpcCalls.push({ name, args })
  return { data: null, error: rpcError }
}
const admin = { schema: () => ({ from, rpc }) }

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => admin }))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({ findOrCreateSupabaseUser: async () => 'u1' }))
vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({
  authOptions: {},
  requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c', name: 'a', image: null } } }),
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: async () => {} }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('@/features/account/server', () => ({
  resolveAuthor: async () => ({ author: { kind: 'user', userId: 'u1', isAdmin: false, email: 'a@b.c' } }),
  ownsPost: async () => true,
  authorRateKey: (author: { email?: string }) => author.email,
}))
vi.mock('@/features/community/server', () => ({
  saveSeriesChoice: async () => null,
  revalidatePostSeries: async () => {},
  withPostAuthors: async (rows: unknown[]) => rows,
}))
vi.mock('@/lib/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit')
  return { ...actual, checkRequestRateLimit: () => (rateAllowed ? { allowed: true } : { allowed: false, retryAfter: 7 }) }
})

import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/decks/[id]/route'
import { POST as BOOKMARK } from '@/app/api/decks/[id]/bookmark/route'

const identitySlot = (n: number) => ({ identity_id: `i${n}`, gacksung: false, slot_order: n, uptie: 4 })
const goodBody = { title: 'new', description: null, identitySlots: [identitySlot(0)], egoSlots: [{ ego_id: 'e1', grade: 'ZAYIN' }] }
const patch = (body: unknown) => PATCH(
  new NextRequest('http://localhost/api/decks/d1', { method: 'PATCH', body: JSON.stringify(body) }),
  { params: Promise.resolve({ id: 'd1' }) },
)
const writes = () => [...calls.filter(c => c.op !== 'select'), ...rpcCalls]

beforeEach(() => {
  calls.length = 0
  rpcCalls.length = 0
  rpcError = null
  failOn = () => false
  rateAllowed = true
  vi.restoreAllMocks()
})

describe('the deck update API checks its input', () => {
  it.each([
    ['a title that is not a string', { ...goodBody, title: 5 }],
    ['a title that is too long', { ...goodBody, title: 'x'.repeat(201) }],
    ['identitySlots that is not an array', { ...goodBody, identitySlots: 'nope' }],
    ['more than 12 identity slots', { ...goodBody, identitySlots: Array.from({ length: 13 }, (_, n) => identitySlot(n)) }],
    ['more than 60 ego slots', { ...goodBody, egoSlots: Array.from({ length: 61 }, (_, n) => ({ ego_id: `e${n}`, grade: 'ZAYIN' })) }],
    ['an ego slot without an id', { ...goodBody, egoSlots: [{ grade: 'ZAYIN' }] }],
    ['tags that is not an array', { ...goodBody, tags: 'tag' }],
    ['a tag that is not a string', { ...goodBody, tags: [1] }],
  ])('%s is a 400 and writes nothing', async (_label, body) => {
    const res = await patch(body)
    expect(res.status).toBe(400)
    expect(writes()).toEqual([])
  })

  it('a blocked rate limit is a 429 before any database call', async () => {
    rateAllowed = false
    const res = await patch(goodBody)
    expect(res.status).toBe(429)
    expect(calls).toEqual([])
    expect(rpcCalls).toEqual([])
  })

  it('the bookmark toggle is rate limited too', async () => {
    rateAllowed = false
    const res = await BOOKMARK(new NextRequest('http://localhost/api/decks/d1/bookmark', { method: 'POST' }), { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(429)
    expect(calls).toEqual([])
  })

  it('tags are written only when the body has them', async () => {
    expect((await patch(goodBody)).status).toBe(200)
    expect(rpcCalls[0].args.p_patch).not.toHaveProperty('tags')

    rpcCalls.length = 0
    expect((await patch({ ...goodBody, tags: ['a'] })).status).toBe(200)
    expect(rpcCalls[0].args.p_patch).toMatchObject({ tags: ['a'] })
  })

  it('a valid update is one replace_deck call and no other write', async () => {
    const res = await patch({ ...goodBody, content_type: '무한', main_keywords: ['참격'] })
    expect(res.status).toBe(200)
    expect(calls.filter(c => c.op !== 'select')).toEqual([])
    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0].name).toBe('replace_deck')
    expect(rpcCalls[0].args).toEqual({
      p_deck_id: 'd1',
      p_patch: { title: 'new', description: null, main_keywords: ['참격'], content_type: '무한', content_edited_at: expect.any(String) },
      p_identities: [{ deck_id: 'd1', identity_id: 'i0', slot_order: 0, gacksung: true, s1_count: 3, s2_count: 2, s3_count: 1, uptie: 4 }],
      p_egos: [{ deck_id: 'd1', ego_id: 'e1', grade: 'ZAYIN' }],
    })
  })

  it('a failed replace_deck is a 500 with a fixed message and no other write', async () => {
    rpcError = { message: 'secret db text' }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await patch(goodBody)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret')
    expect(log).toHaveBeenCalled()
    expect(rpcCalls).toHaveLength(1)
    expect(calls.filter(c => c.op !== 'select')).toEqual([])
  })
})
