import { describe, expect, it, vi } from 'vitest'

const calls: string[] = []
const result = { data: [], error: null }
const chain: Record<string, unknown> = new Proxy({}, {
  get: (_t, name) => name === 'then' ? (resolve: (v: typeof result) => unknown) => resolve(result) : () => chain,
})
const admin = { schema: () => ({ from: (table: string) => { calls.push(table); return chain } }) }

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => admin }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/features/community/server', () => ({ withPostAuthors: async (rows: unknown[]) => rows, saveSeriesChoice: async () => null }))
vi.mock('@/features/account/server', () => ({ authorColumns: () => ({}), authorRateKey: () => undefined, guestPinOf: () => null, recordGuestAuthorship: async () => null, resolveAuthor: async () => ({}) }))
vi.mock('@/lib/push/send', () => ({ pushForPost: async () => {} }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: async () => {} }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }))

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/decks/route'

const get = (query: string) => GET(new NextRequest(`http://localhost/api/decks?${query}`))

describe('REQ-SHARED-100 the identity filter takes only a UUID', () => {
  it('REQ-SHARED-100 an identity_id that is not a UUID is a 400 and reaches no table', async () => {
    const res = await get('identity_id=not-a-uuid')
    expect(res.status).toBe(400)
    expect(calls).toEqual([])
  })

  it('REQ-SHARED-100 a UUID identity_id goes on to the lookup', async () => {
    const res = await get('identity_id=123e4567-e89b-12d3-a456-426614174000')
    expect(res.status).toBe(200)
    expect(calls).toContain('deck_identities')
  })
})
