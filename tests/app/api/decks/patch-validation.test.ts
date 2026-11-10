import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; op: 'select' | 'update' | 'delete' | 'insert'; payload?: unknown }

const calls: Call[] = []
let failOn: (call: Call) => boolean = () => false
let rateAllowed = true

const deckRow = { id: 'd1', user_id: 'u1', title: 'old', description: null, tags: ['keep'], main_keywords: [], content_type: '없음', content_edited_at: null }
const origChildren: Record<string, unknown[]> = {
  deck_identities: [{ deck_id: 'd1', identity_id: 'orig-identity', slot_order: 0 }],
  deck_egos: [{ deck_id: 'd1', ego_id: 'orig-ego', grade: 'ZAYIN' }],
}

function from(table: string) {
  const make = (op: Call['op'], payload?: unknown) => {
    const call: Call = { table, op, payload }
    calls.push(call)
    const result = { data: op === 'select' ? (origChildren[table] ?? []) : null, error: failOn(call) ? { message: 'secret db text' } : null }
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
const admin = { schema: () => ({ from }) }

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
const writes = () => calls.filter(c => c.op !== 'select')

beforeEach(() => {
  calls.length = 0
  failOn = () => false
  rateAllowed = true
  vi.restoreAllMocks()
})

describe('REQ-DECKS-058 the deck update API checks its input', () => {
  it.each([
    ['a title that is not a string', { ...goodBody, title: 5 }],
    ['a title that is too long', { ...goodBody, title: 'x'.repeat(201) }],
    ['identitySlots that is not an array', { ...goodBody, identitySlots: 'nope' }],
    ['more than 12 identity slots', { ...goodBody, identitySlots: Array.from({ length: 13 }, (_, n) => identitySlot(n)) }],
    ['more than 60 ego slots', { ...goodBody, egoSlots: Array.from({ length: 61 }, (_, n) => ({ ego_id: `e${n}`, grade: 'ZAYIN' })) }],
    ['an ego slot without an id', { ...goodBody, egoSlots: [{ grade: 'ZAYIN' }] }],
    ['tags that is not an array', { ...goodBody, tags: 'tag' }],
    ['a tag that is not a string', { ...goodBody, tags: [1] }],
  ])('REQ-DECKS-058 %s is a 400 and writes nothing', async (_label, body) => {
    const res = await patch(body)
    expect(res.status).toBe(400)
    expect(writes()).toEqual([])
  })

  it('REQ-DECKS-058 a blocked rate limit is a 429 before any database call', async () => {
    rateAllowed = false
    const res = await patch(goodBody)
    expect(res.status).toBe(429)
    expect(calls).toEqual([])
  })

  it('REQ-DECKS-058 the bookmark toggle is rate limited too', async () => {
    rateAllowed = false
    const res = await BOOKMARK(new NextRequest('http://localhost/api/decks/d1/bookmark', { method: 'POST' }), { params: Promise.resolve({ id: 'd1' }) })
    expect(res.status).toBe(429)
    expect(calls).toEqual([])
  })

  it('REQ-DECKS-058 tags are written only when the body has them', async () => {
    expect((await patch(goodBody)).status).toBe(200)
    expect(calls.find(c => c.table === 'decks' && c.op === 'update')?.payload).not.toHaveProperty('tags')

    calls.length = 0
    expect((await patch({ ...goodBody, tags: ['a'] })).status).toBe(200)
    expect(calls.find(c => c.table === 'decks' && c.op === 'update')?.payload).toMatchObject({ tags: ['a'] })
  })

  it('REQ-DECKS-058 a failed ego insert deletes the new rows, then puts the original rows back', async () => {
    failOn = c => c.table === 'deck_egos' && c.op === 'insert' && JSON.stringify(c.payload).includes('"e1"')
    const res = await patch(goodBody)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret')

    const failedAt = calls.findIndex(c => c.table === 'deck_egos' && c.op === 'insert')
    const after = calls.slice(failedAt + 1).map(c => `${c.op} ${c.table}`)
    expect(after).toEqual([
      'delete deck_identities', 'delete deck_egos', 'update decks', 'insert deck_identities', 'insert deck_egos',
    ])
    expect(calls.at(-2)?.payload).toEqual(origChildren.deck_identities)
    expect(calls.at(-1)?.payload).toEqual(origChildren.deck_egos)
  })

  it('REQ-DECKS-058 a rollback step that fails is logged and the response is still a 500', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    failOn = c => c.op === 'insert' && c.table === 'deck_egos'
    const res = await patch(goodBody)
    expect(res.status).toBe(500)
    // the failed insert itself, then the failed restore of the original ego rows
    expect(log.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
