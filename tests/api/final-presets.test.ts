import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const calls: { op: string; args: unknown[] }[] = []
let tableError: { message: string } | null = null
let rpcError: { message: string } | null = null
vi.mock('@/lib/auth', () => ({ requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c' } } }) }))
vi.mock('@/lib/supabase/find-or-create-user', () => ({ findOrCreateSupabaseUser: async () => 'user-1' }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      rpc: async () => ({ data: rpcError ? null : 'user-1', error: rpcError }),
      from: () => {
        const row = { slot: 2, name: '화상', gift_keys: ['final_9250_plus'], updated_at: 't' }
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

import { DELETE, GET, PUT } from '@/app/api/planner/final-presets/route'

const req = (method: string, body?: unknown, query = '') =>
  new NextRequest('http://localhost/api/planner/final-presets' + query, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { origin: 'http://localhost' } })

beforeEach(() => { calls.length = 0; tableError = null; rpcError = null })

it('lists the user presets', async () => {
  const res = await GET(req('GET'))
  expect(await res.json()).toEqual({ presets: [{ slot: 2, name: '화상', giftKeys: ['final_9250_plus'], updatedAt: 't' }], slots: 10 })
})

it('upserts a validated slot for the session user', async () => {
  const res = await PUT(req('PUT', { slot: 2, name: ' 화상 ', gift_keys: ['final_9250_plus'] }))
  expect(res.status).toBe(200)
  const upsert = calls.find(call => call.op === 'upsert')!
  expect(upsert.args[0]).toMatchObject({ user_id: 'user-1', slot: 2, name: '화상', gift_keys: ['final_9250_plus'] })
})

it('rejects bad slots, names and non-final keys', async () => {
  for (const body of [{ slot: 11, name: 'x', gift_keys: [] }, { slot: 1, name: ' ', gift_keys: [] }, { slot: 1, name: 'x', gift_keys: ['start_1'] }, { slot: 1, name: 'x', gift_keys: Array(61).fill('final_1') }])
    expect((await PUT(req('PUT', body))).status).toBe(400)
  expect((await DELETE(req('DELETE', undefined, '?slot=0'))).status).toBe(400)
})

it('deletes by slot and reports a missing table as a plain error', async () => {
  expect((await DELETE(req('DELETE', undefined, '?slot=3'))).status).toBe(200)
  expect(calls.filter(call => call.op === 'eq').map(call => call.args)).toEqual([['user_id', 'user-1'], ['slot', 3]])
  tableError = { message: 'relation does not exist' }
  expect((await GET(req('GET'))).status).toBe(503)
})

it('reports a failed account lookup as 503, not as an empty preset list', async () => {
  rpcError = { message: 'function limbus.discovery_user_id(text) does not exist' }
  const res = await GET(req('GET'))
  expect(res.status).toBe(503)
})
