import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const calls: { op: string; args: unknown[] }[] = []
let tableError: { message: string } | null = null
let rpcError: { message: string } | null = null
let profile: string | null = 'user-1'
let signedIn = true
const groups = [{ name: '최우선 먹기', gifts: ['9001', '9002'], memo: '2층 전에' }]
vi.mock('@/lib/auth', () => ({
  requireActiveUser: async () => signedIn
    ? { error: false, session: { user: { email: 'a@b.c' } } }
    : { error: true, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) },
}))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({ findOrCreateSupabaseUser: async () => 'user-1' }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      rpc: async () => ({ data: rpcError ? null : profile, error: rpcError }),
      from: (table: string) => {
        calls.push({ op: 'from', args: [table] })
        const row = { slot: 2, name: '화상 덱', groups, updated_at: 't' }
        const chain: Record<string, unknown> = {}
        for (const op of ['select', 'eq', 'upsert', 'delete']) chain[op] = (...args: unknown[]) => { calls.push({ op, args }); return chain }
        chain.order = async () => ({ data: tableError ? null : [row], error: tableError })
        chain.single = async () => ({ data: tableError ? null : row, error: tableError })
        chain.then = (resolve: (value: unknown) => void) => resolve({ error: tableError })
        return chain
      },
    }),
  }),
}))

import { DELETE, GET, PUT } from '@/app/api/mirror-dungeon/gift-presets/route'

const req = (method: string, body?: unknown, query = '', origin = 'http://localhost') =>
  new NextRequest('http://localhost/api/mirror-dungeon/gift-presets' + query, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { origin } })

beforeEach(() => { calls.length = 0; tableError = null; rpcError = null; profile = 'user-1'; signedIn = true })

it('lists the session user\'s presets by slot', async () => {
  const res = await GET(req('GET'))
  expect(await res.json()).toEqual({ presets: [{ slot: 2, name: '화상 덱', groups, updatedAt: 't' }], slots: 5 })
  expect(res.headers.get('cache-control')).toContain('no-store')
  expect(calls.find(call => call.op === 'from')!.args).toEqual(['gift_presets'])
  expect(calls.filter(call => call.op === 'eq').map(call => call.args)).toEqual([['user_id', 'user-1']])
})

it('a session without a profile has no presets, and reading never creates one', async () => {
  profile = null
  expect(await (await GET(req('GET'))).json()).toEqual({ presets: [], slots: 5 })
  expect(calls.some(call => call.op === 'from')).toBe(false)
})

it('stores a checked preset in the session user\'s slot', async () => {
  const res = await PUT(req('PUT', { slot: 2, name: '화상 덱', groups, user_id: 'someone-else' }))
  expect(res.status).toBe(200)
  const upsert = calls.find(call => call.op === 'upsert')!
  expect(upsert.args[0]).toMatchObject({ user_id: 'user-1', slot: 2, name: '화상 덱', groups })
  expect(upsert.args[1]).toEqual({ onConflict: 'user_id,slot' })
})

it('refuses slots and presets outside the limits', async () => {
  const group = { name: '', gifts: [] as string[], memo: '' }
  for (const body of [
    { slot: 6, name: 'x', groups: [group] },
    { slot: 0, name: 'x', groups: [group] },
    { slot: 1, name: 'x'.repeat(21), groups: [group] },
    { slot: 1, name: 'x', groups: [] },
    { slot: 1, name: 'x', groups: Array(7).fill(group) },
    { slot: 1, name: 'x', groups: [{ ...group, memo: 'm'.repeat(101) }] },
    { slot: 1, name: 'x', groups: [{ ...group, gifts: ['1', '1'] }] },
    { slot: 1, name: 'x', groups: [{ ...group, gifts: Array.from({ length: 61 }, (_, i) => String(i)) }] },
    'not json',
  ]) expect((await PUT(req('PUT', body))).status).toBe(400)
  expect((await DELETE(req('DELETE', undefined, '?slot=0'))).status).toBe(400)
  expect(calls.some(call => call.op === 'upsert' || call.op === 'delete')).toBe(false)
})

it('deletes one slot of the session user', async () => {
  expect((await DELETE(req('DELETE', undefined, '?slot=3'))).status).toBe(200)
  expect(calls.filter(call => call.op === 'eq').map(call => call.args)).toEqual([['user_id', 'user-1'], ['slot', 3]])
})

it('needs a session, and a write from another origin is refused', async () => {
  signedIn = false
  expect((await GET(req('GET'))).status).toBe(401)
  expect((await PUT(req('PUT', { slot: 1, name: 'x', groups }))).status).toBe(401)
  signedIn = true
  expect((await PUT(req('PUT', { slot: 1, name: 'x', groups }, '', 'https://evil.example'))).status).toBe(403)
  expect((await DELETE(req('DELETE', undefined, '?slot=1', 'https://evil.example'))).status).toBe(403)
})

it('reports a missing table or a failed account lookup as 503, not as an empty list', async () => {
  tableError = { message: 'relation "limbus.gift_presets" does not exist' }
  expect((await GET(req('GET'))).status).toBe(503)
  expect((await PUT(req('PUT', { slot: 1, name: 'x', groups }))).status).toBe(503)
  tableError = null
  rpcError = { message: 'function limbus.discovery_user_id(text) does not exist' }
  expect((await GET(req('GET'))).status).toBe(503)
})
