import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const upserts: unknown[] = []
vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/features/community/lib/user-id', () => ({ discoveryUserId: async () => null }))
vi.mock('@/lib/rate-limit', () => ({ checkRequestRateLimit: () => ({ allowed: true }), rateLimitResponse: () => new Response(null, { status: 429 }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: (table: string) => {
        const chain: Record<string, unknown> = {}
        for (const op of ['select', 'eq']) chain[op] = () => chain
        chain.maybeSingle = async () => ({ data: { id: 'x' }, error: null })
        chain.upsert = async (row: unknown) => { upserts.push({ table, row }); return { error: null } }
        return chain
      },
    }),
  }),
}))

import { POST } from '@/app/api/discovery/visit/route'

const ID = 'f54062c4-426a-4091-944d-0af340b385de'
// Behind Cloudflare Tunnel the app sees http://<host>; the browser sends the https origin.
const visit = (headers: Record<string, string>) =>
  POST(new NextRequest('http://saigo-no-dante.com/api/discovery/visit', {
    method: 'POST',
    body: JSON.stringify({ kind: 'identity', id: ID }),
    headers: { 'content-type': 'application/json', host: 'saigo-no-dante.com', ...headers },
  }))

beforeEach(() => { upserts.length = 0; vi.stubEnv('NEXTAUTH_SECRET', 'test') })

it('REQ-COMMUNITY-047 records a same-site visit when the app sits behind an https proxy', async () => {
  const res = await visit({ origin: 'https://saigo-no-dante.com', 'x-forwarded-proto': 'https' })
  expect(res.status).toBe(204)
  expect(upserts).toHaveLength(1)
  expect(res.headers.get('set-cookie')).toMatch(/Secure/i)
})

it('REQ-COMMUNITY-047 still refuses a visit sent from another site', async () => {
  const res = await visit({ origin: 'https://evil.example', 'x-forwarded-proto': 'https' })
  expect(res.status).toBe(403)
  expect(upserts).toHaveLength(0)
})
