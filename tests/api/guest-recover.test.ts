import { beforeEach, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const KEY = 'snd_' + 'a'.repeat(43)
const POST_ID = '11111111-1111-4111-8111-111111111111'
let rpcResult: { data: string | null; error: { code?: string; message: string } | null }
let friendRow: { id: string } | null
let allowed = true
const rpcCalls: { name: string; args: Record<string, string> }[] = []
const lookups: Record<string, unknown>[] = []
const audits: unknown[] = []

vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: async (entry: unknown) => { audits.push(entry) } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRequestRateLimit: () => ({ allowed, retryAfter: 60 }),
  rateLimitResponse: () => NextResponse.json({ error: 'slow' }, { status: 429 }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      rpc: async (name: string, args: Record<string, string>) => { rpcCalls.push({ name, args }); return rpcResult },
      from: (table: string) => {
        const filters: Record<string, unknown> = { table }
        const query = {
          select: () => query, not: () => query,
          eq: (column: string, value: unknown) => { filters[column] = value; return query },
          maybeSingle: async () => { lookups.push(filters); return { data: friendRow, error: null } },
        }
        return query
      },
    }),
  }),
}))

import { POST } from '@/app/api/guest/recover/route'
import { guestKeyHash, guestPinHash } from '@/lib/guest/server'

process.env.NEXTAUTH_SECRET = 'test-secret'
const send = (body: unknown, key: string | null = KEY) => POST(new Request('http://localhost/api/guest/recover', {
  method: 'POST', headers: key ? { 'x-guest-key': key } : {}, body: JSON.stringify(body),
}))
const outcome = async (res: Response) => [res.status, (await res.json()).code]

beforeEach(() => { rpcCalls.length = 0; lookups.length = 0; audits.length = 0; allowed = true; friendRow = null; rpcResult = { data: 'ok', error: null } })

it('REQ-COMMUNITY-030 the right password ties the post to this browser\'s key; only hashes reach the database', async () => {
  const res = await send({ kind: 'deck', id: POST_ID, pin: '4821' })
  expect(res.status).toBe(200)
  expect(rpcCalls).toEqual([{ name: 'guest_pin_recover', args: { p_kind: 'deck', p_id: POST_ID, p_pin_hash: guestPinHash('deck', POST_ID, '4821'), p_key_hash: guestKeyHash(KEY) } }])
  expect(JSON.stringify(rpcCalls)).not.toContain(KEY)
  // Who took it: the tag the new key's posts are shown with ("익명 #1a2b").
  expect(audits).toEqual([{ actorId: null, action: 'guest_recover', targetType: 'deck', targetId: POST_ID, details: { tag: guestKeyHash(KEY).slice(0, 4) } }])
})

it('REQ-COMMUNITY-030 an id written in capitals is the same post: it is hashed as the database writes it', async () => {
  const upper = 'ABCDEF12-3456-4ABC-8DEF-ABCDEF123456'
  expect((await send({ kind: 'deck', id: upper, pin: '4821' })).status).toBe(200)
  expect(rpcCalls[0].args).toMatchObject({ p_id: upper.toLowerCase(), p_pin_hash: guestPinHash('deck', upper.toLowerCase(), '4821') })
})

it('REQ-COMMUNITY-030 a wrong password, a locked post and a post without a password are refused, each with its code', async () => {
  for (const [result, status, code] of [['wrong', 403, 'wrong_pin'], ['locked', 429, 'pin_locked'], ['none', 404, 'no_pin']] as const) {
    rpcResult = { data: result, error: null }
    expect(await outcome(await send({ kind: 'plan', id: POST_ID, pin: '123456' }))).toEqual([status, code])
  }
  expect(rpcCalls.map(call => call.args.p_kind)).toEqual(['plan', 'plan', 'plan'])
  expect(audits).toEqual([])
})

it('REQ-COMMUNITY-030 nothing is tried without a key, with a malformed password or target, or past the request limit', async () => {
  expect((await send({ kind: 'deck', id: POST_ID, pin: '4821' }, null)).status).toBe(400)
  for (const body of [{ kind: 'deck', id: POST_ID, pin: '48' }, { kind: 'deck', id: POST_ID }, { kind: 'deck', id: 'nope', pin: '4821' }, { kind: 'comment', id: POST_ID, pin: '4821' }, { kind: 'support', code: 'p482593721', pin: '4821' }, null]) {
    expect((await send(body)).status).toBe(400)
  }
  allowed = false
  expect((await send({ kind: 'deck', id: POST_ID, pin: '4821' })).status).toBe(429)
  expect(rpcCalls).toEqual([])
  expect(lookups).toEqual([])
})

it('REQ-COMMUNITY-030 a friend post is found by its kind and code', async () => {
  expect(await outcome(await send({ kind: 'want', code: 'P482593721', pin: '4821' }))).toEqual([404, 'not_found'])
  expect(rpcCalls).toEqual([])
  friendRow = { id: POST_ID }
  expect((await send({ kind: 'want', code: 'P482593721', pin: '4821' })).status).toBe(200)
  expect(lookups.at(-1)).toEqual({ table: 'friend_posts', kind: 'want', code: 'P482593721' })
  expect(rpcCalls[0].args).toEqual({ p_kind: 'friend', p_id: POST_ID, p_pin_hash: guestPinHash('friend', POST_ID, '4821'), p_key_hash: guestKeyHash(KEY) })
  expect(audits).toEqual([{ actorId: null, action: 'guest_recover', targetType: 'friend_post', targetId: POST_ID, details: { tag: guestKeyHash(KEY).slice(0, 4) } }])
})

it('REQ-COMMUNITY-030 a browser that already has a post of that kind gets 409; a failed call does not say why', async () => {
  friendRow = { id: POST_ID }
  rpcResult = { data: null, error: { code: '23505', message: 'duplicate key value violates friend_posts_guest' } }
  expect(await outcome(await send({ kind: 'support', code: 'P482593721', pin: '4821' }))).toEqual([409, 'has_post'])
  rpcResult = { data: null, error: { message: 'boom' } }
  const failed = await send({ kind: 'deck', id: POST_ID, pin: '4821' })
  expect(failed.status).toBe(500)
  expect(JSON.stringify(await failed.json())).not.toContain('boom')
  expect(audits).toEqual([])
})
