import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type Query } from '../../helpers/fake-db'

const calls: Query[] = []

vi.mock('@/lib/auth', () => ({ requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c', name: 'a', image: null } } }) }))
vi.mock('@/lib/supabase/find-or-create-user', () => ({ findOrCreateSupabaseUser: async () => 'u1' }))
vi.mock('@/lib/rate-limit', () => ({ checkRequestRateLimit: () => ({ allowed: true }), rateLimitResponse: () => new Response(null, { status: 429 }) }))
vi.mock('@/features/account/server', () => ({ createApiKey: () => ({ key: 'k-secret', prefix: 'k', hash: 'h' }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb(() => undefined, calls) }))

import { POST, DELETE } from '@/app/api/developer/keys/route'

const request = (method: string, body: string) => new Request('http://localhost/api/developer/keys', { method, body, headers: { 'content-type': 'application/json' } })

beforeEach(() => { calls.length = 0 })

describe('developer keys: a request body that cannot be read is a 400', () => {
  it.each([['POST', POST], ['DELETE', DELETE]] as const)('%s with broken JSON', async (method, handler) => {
    const res = await handler(request(method, '{"name":'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid input' })
    expect(calls).toEqual([])
  })

  it.each([['POST', POST], ['DELETE', DELETE]] as const)('%s with a JSON null', async (method, handler) => {
    const res = await handler(request(method, 'null'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid input' })
    expect(calls).toEqual([])
  })

  it('a good body still makes a key', async () => {
    const res = await POST(request('POST', JSON.stringify({ name: 'my key' })))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ key: 'k-secret' })
  })
})
