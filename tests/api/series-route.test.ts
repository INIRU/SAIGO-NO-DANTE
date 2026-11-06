import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const U = '11111111-1111-4111-8111-111111111111'
const D1 = '22222222-2222-4222-8222-222222222222'
const D2 = '33333333-3333-4333-8333-333333333333'
const S = '44444444-4444-4444-8444-444444444444'
let owner = 'user-1'
let signedIn = true
const updates: { table: string; values: unknown }[] = []

vi.mock('@/lib/auth', () => ({
  requireActiveUser: async () => signedIn
    ? { error: false, session: { user: { email: 'a@b.c' } } }
    : { error: true, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) },
}))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({ findOrCreateSupabaseUser: async () => 'user-1' }))
vi.mock('@/features/community/lib/user-id', () => ({ discoveryUserId: async () => 'user-1' }))
vi.mock('next/cache', () => ({ revalidateTag: () => {} }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: (table: string) => {
        const chain: Record<string, unknown> = {}
        for (const op of ['select', 'eq', 'in', 'order', 'insert', 'delete']) chain[op] = () => chain
        chain.update = (values: unknown) => { updates.push({ table, values }); return chain }
        const rows: Record<string, unknown> = {
          series: { id: S, title: '시리즈', user_id: owner },
          series_items: [{ series_id: S, deck_id: D1, plan_id: null, position: 0 }, { series_id: S, deck_id: D2, plan_id: null, position: 1 }],
          decks: [{ id: D1, title: 'A' }, { id: D2, title: 'B' }],
          md_plans: [],
        }
        chain.maybeSingle = async () => ({ data: rows[table], error: null })
        chain.single = async () => ({ data: { id: S, title: '시리즈' }, error: null })
        chain.then = (resolve: (value: unknown) => void) => resolve({ data: rows[table], error: null })
        return chain
      },
    }),
  }),
}))

import { POST } from '@/app/api/series/route'
import { DELETE, PATCH } from '@/app/api/series/[id]/route'

const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/series', { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { origin: 'http://localhost' } })
const ctx = (id = S) => ({ params: Promise.resolve({ id }) })

beforeEach(() => { owner = 'user-1'; signedIn = true; updates.length = 0 })

it('REQ-COMMUNITY-042 rejects a blank or oversized title before anything else', async () => {
  expect((await POST(req('POST', { title: ' ' }))).status).toBe(400)
  expect((await POST(req('POST', { title: 'x'.repeat(61) }))).status).toBe(400)
})

it('REQ-COMMUNITY-042 creates a series for the signed-in user', async () => {
  const res = await POST(req('POST', { title: '화상 시리즈' }))
  expect(res.status).toBe(201)
  expect((await res.json()).series).toEqual({ id: S, title: '시리즈', count: 0 })
})

it('REQ-COMMUNITY-042 signed-out writes are refused', async () => {
  signedIn = false
  expect((await POST(req('POST', { title: 'x' }))).status).toBe(401)
})

it('REQ-COMMUNITY-042 only the owner changes or deletes a series', async () => {
  owner = 'someone-else'
  expect((await PATCH(req('PATCH', { title: 'x' }), ctx())).status).toBe(404)
  expect((await DELETE(req('DELETE'), ctx())).status).toBe(404)
  expect(updates).toEqual([])
})

it('REQ-COMMUNITY-042 an order must list exactly the posts of the series', async () => {
  expect((await PATCH(req('PATCH', { order: [{ kind: 'deck', id: D1 }] }), ctx())).status).toBe(400)
  expect((await PATCH(req('PATCH', { order: [{ kind: 'plan', id: D1 }, { kind: 'deck', id: D2 }] }), ctx())).status).toBe(400)
  expect((await PATCH(req('PATCH', { order: [{ kind: 'deck', id: D2 }, { kind: 'deck', id: D1 }] }), ctx())).status).toBe(200)
  expect(updates.filter(update => update.table === 'series_items').map(update => update.values)).toEqual([{ position: 0 }, { position: 1 }])
})

it('REQ-COMMUNITY-042 a malformed series id is not found', async () => {
  expect((await PATCH(req('PATCH', { title: 'x' }), ctx('nope'))).status).toBe(404)
  void U
})
