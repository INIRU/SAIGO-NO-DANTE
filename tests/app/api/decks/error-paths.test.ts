import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeDb, type Query, type Reply } from '../../../helpers/fake-db'

const state = vi.hoisted(() => ({ reply: (() => undefined) as (query: Query) => Reply | undefined, calls: [] as Query[], guestKey: false }))

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('next/server', async importOriginal => ({ ...(await importOriginal<typeof import('next/server')>()), after: () => {} }))
vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({
  authOptions: {},
  requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c', name: 'a', image: null } } }),
}))
vi.mock('@/lib/supabase/find-or-create-user', () => ({ findOrCreateSupabaseUser: async () => 'u1' }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: async () => {} }))
vi.mock('@/lib/push/send', () => ({ pushForComment: async () => {}, pushForPost: async () => {} }))
vi.mock('@/lib/rate-limit', () => ({ checkRequestRateLimit: () => ({ allowed: true }), rateLimitResponse: () => new Response(null, { status: 429 }) }))
vi.mock('@/features/account/server', () => ({
  resolveAuthor: async () => ({ author: { kind: 'user', userId: 'u1', isAdmin: false, email: 'a@b.c' } }),
  ownsPost: async () => true,
  authorRateKey: () => 'k',
  authorColumns: () => ({ user_id: 'u1' }),
  guestPinOf: () => null,
  recordGuestAuthorship: async () => null,
}))
vi.mock('@/features/community/server', () => ({ saveSeriesChoice: async () => null, revalidatePostSeries: async () => {}, withPostAuthors: async (rows: unknown[]) => rows }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeDb(query => state.reply(query), state.calls) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb(query => state.reply(query), state.calls) }))

import { DELETE as deleteDeck, PATCH as patchDeck } from '@/app/api/decks/[id]/route'
import { POST as createDeck } from '@/app/api/decks/route'
import { DELETE as deleteComment, POST as postComment } from '@/app/api/decks/[id]/comments/route'

const down = { code: '57P01', message: 'terminating connection' }
const ctx = { params: Promise.resolve({ id: 'd1' }) }
const FORMAT = { error: '요청 형식이 올바르지 않습니다.' }
const json = (url: string, method: string, body: string) => new NextRequest(`http://localhost${url}`, { method, body, headers: { 'content-type': 'application/json' } })
const goodPatch = JSON.stringify({ title: 't', identitySlots: [], egoSlots: [] })

beforeEach(() => {
  state.reply = () => undefined
  state.calls.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('deck delete and update: the ownership read', () => {
  const request = (method: 'DELETE' | 'PATCH') => method === 'DELETE' ? deleteDeck(json('/api/decks/d1', 'DELETE', ''), ctx) : patchDeck(json('/api/decks/d1', 'PATCH', goodPatch), ctx)

  it.each(['DELETE', 'PATCH'] as const)('%s: a failed read is a 500 and is logged, not a 404', async method => {
    state.reply = ({ table }) => table === 'decks' ? { error: down } : undefined
    const res = await request(method)
    expect(res.status).toBe(500)
    expect(state.calls.some(call => call.op === 'delete' || call.op === 'rpc')).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  it.each(['DELETE', 'PATCH'] as const)('%s: a deck that is not there is still a 404', async method => {
    state.reply = ({ table }) => table === 'decks' ? { error: { code: 'PGRST116', message: 'The result contains 0 rows' } } : undefined
    expect((await request(method)).status).toBe(404)
  })

  it.each(['DELETE', 'PATCH'] as const)('%s: an id that is not a uuid is still a 404', async method => {
    state.reply = ({ table }) => table === 'decks' ? { error: { code: '22P02', message: 'invalid input syntax for type uuid' } } : undefined
    expect((await request(method)).status).toBe(404)
  })
})

describe('a request body that is not JSON is a 400, not a 500', () => {
  it('POST /api/decks', async () => {
    const res = await createDeck(json('/api/decks', 'POST', '{"title":'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(FORMAT)
    expect(state.calls).toEqual([])
  })

  it('PATCH /api/decks/[id]', async () => {
    const res = await patchDeck(json('/api/decks/d1', 'PATCH', '{"title":'), ctx)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(FORMAT)
    expect(state.calls).toEqual([])
  })

  it('POST /api/decks/[id]/comments', async () => {
    const res = await postComment(json('/api/decks/d1/comments', 'POST', '{"content":'), ctx)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(FORMAT)
    expect(state.calls).toEqual([])
  })

  it.each([['POST /api/decks', () => createDeck(json('/api/decks', 'POST', 'null'))], ['POST comments', () => postComment(json('/api/decks/d1/comments', 'POST', 'null'), ctx)]])('%s: a JSON null is a 400 too', async (_name, call) => {
    expect((await call()).status).toBe(400)
  })
})

describe('deck comments', () => {
  const del = () => deleteComment(json('/api/decks/d1/comments?commentId=c1', 'DELETE', ''), ctx)

  it('delete: a failed ownership read is a 500, not a 403, and nothing is deleted', async () => {
    state.reply = ({ table, op }) => table === 'deck_comments' && op === 'select' ? { error: down } : undefined
    const res = await del()
    expect(res.status).toBe(500)
    expect(state.calls.some(call => call.op === 'delete')).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })

  it('delete: someone else\'s comment is still a 403, and so is a comment that is not there', async () => {
    state.reply = ({ table, op }) => table === 'deck_comments' && op === 'select' ? { data: { user_id: 'someone-else' } } : undefined
    expect((await del()).status).toBe(403)
    state.reply = ({ table, op }) => table === 'deck_comments' && op === 'select' ? { error: { code: 'PGRST116', message: '0 rows' } } : undefined
    expect((await del()).status).toBe(403)
  })

  it('post: the comment is saved even when the author lookup afterwards fails, and the failure is logged', async () => {
    state.reply = ({ table, op }) => {
      if (table === 'deck_comments' && op === 'insert') return { data: { id: 'c1', content: 'hi', created_at: 't', user_id: 'u1', parent_id: null } }
      if (table === 'profiles') return { error: down }
      return undefined
    }
    const res = await postComment(json('/api/decks/d1/comments', 'POST', '{"content":"hi"}'), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: 'c1', username: 'a', role: 'user' })
    expect(console.error).toHaveBeenCalled()
  })
})

describe('creating a deck: the rollback delete', () => {
  const body = JSON.stringify({ title: 't', identitySlots: [{ identity_id: 'i1', slot_order: 0 }], egoSlots: [{ ego_id: 'e1', grade: 'ZAYIN' }] })
  const rollbackLogged = () => (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.some(call => String(call[0]).includes('rollback'))

  it.each([['deck_identities'], ['deck_egos']])('a failed %s insert answers as before, and a failed rollback is logged', async failing => {
    state.reply = ({ table, op }) => {
      if (table === 'decks' && op === 'insert') return { data: { id: 'd1', content_type: '없음', tags: [] } }
      if (table === failing && op === 'insert') return { error: down }
      if (table === 'decks' && op === 'delete') return { error: { message: 'delete refused' } }
      return undefined
    }
    const res = await createDeck(json('/api/decks', 'POST', body))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '요청을 처리하지 못했습니다. 다시 시도해주세요.' })
    expect(state.calls.some(call => call.table === 'decks' && call.op === 'delete')).toBe(true)
    expect(rollbackLogged()).toBe(true)
  })

  it('a rollback that works logs nothing about a rollback', async () => {
    state.reply = ({ table, op }) => {
      if (table === 'decks' && op === 'insert') return { data: { id: 'd1', content_type: '없음', tags: [] } }
      if (table === 'deck_identities' && op === 'insert') return { error: down }
      return undefined
    }
    expect((await createDeck(json('/api/decks', 'POST', body))).status).toBe(500)
    expect(rollbackLogged()).toBe(false)
  })

  it('a failed activity record rolls the deck back with the same answer, and a failed rollback is logged', async () => {
    state.reply = ({ table, op }) => {
      if (table === 'decks' && op === 'insert') return { data: { id: 'd1', content_type: '없음', tags: [] } }
      if (table === 'rpc:community_record_deck') return { error: down }
      if (table === 'decks' && op === 'delete') return { error: { message: 'delete refused' } }
      return undefined
    }
    const res = await createDeck(json('/api/decks', 'POST', JSON.stringify({ title: 't' })))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '덱을 저장하지 못했습니다. 다시 시도해주세요.' })
    expect(rollbackLogged()).toBe(true)
  })
})
