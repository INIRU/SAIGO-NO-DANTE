import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

let allowed = true
const limits: unknown[] = []
const deleted: string[] = []
const afterTasks: (() => unknown)[] = []
const adminCalls: string[] = []

vi.mock('next/server', async importOriginal => ({ ...(await importOriginal<typeof import('next/server')>()), after: (task: () => unknown) => { afterTasks.push(task) } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRequestRateLimit: (_request: unknown, options: unknown) => { limits.push(options); return { allowed, retryAfter: 60 } },
  rateLimitResponse: () => NextResponse.json({ error: 'slow' }, { status: 429 }),
}))
vi.mock('@/features/account/server', () => ({ authorRateKey: () => null, guestPinOf: () => null, resolveAuthor: async () => ({}) }))
vi.mock('@/features/friends/server', () => ({
  friendAuthorColumns: '', isAuthorOf: () => false, isBlocked: async () => false, ownerFilter: () => ({ column: 'c', value: 'v' }), viewerOf: async () => null,
}))
vi.mock('@/lib/supabase/admin', () => {
  // Any query chain: every method returns the chain, awaiting it gives an empty result.
  const chain = (table: string): unknown => new Proxy({}, {
    get: (_target, method: string) => {
      if (method === 'then') return (resolve: (value: unknown) => void) => resolve({ data: [], error: null })
      return () => { if (method === 'delete') deleted.push(table); return chain(table) }
    },
  })
  return { createAdminClient: () => { adminCalls.push('client'); return { schema: () => ({ from: (table: string) => chain(table) }) } } }
})

import { GET } from '@/app/api/friend-codes/route'

const list = (kind: string) => GET(new NextRequest(`http://localhost/api/friend-codes?kind=${kind}`))

beforeEach(() => { allowed = true; limits.length = 0; deleted.length = 0; afterTasks.length = 0; adminCalls.length = 0 })

describe('REQ-COMMUNITY-098 friend code list', () => {
  it('REQ-COMMUNITY-098 is rate limited in the read bucket, and a refused request never reaches the database', async () => {
    allowed = false
    expect((await list('want')).status).toBe(429)
    expect(limits).toEqual([expect.objectContaining({ bucket: 'readonly' })])
    expect(adminCalls).toEqual([])
  })

  it('REQ-COMMUNITY-098 expired want posts are deleted after the response, not while reading', async () => {
    const res = await list('want')
    expect(res.status).toBe(200)
    expect(deleted).toEqual([])
    expect(afterTasks).toHaveLength(1)
    await afterTasks[0]()
    expect(deleted).toEqual(['friend_posts'])
  })

  it('REQ-COMMUNITY-098 a support list schedules no clean-up', async () => {
    expect((await list('support')).status).toBe(200)
    expect(afterTasks).toEqual([])
  })
})
