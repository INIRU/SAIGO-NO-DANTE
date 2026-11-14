import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { fakeDb, type Query, type Reply } from '../../../helpers/fake-db'

const state = vi.hoisted(() => ({ reply: (() => undefined) as (query: Query) => Reply | undefined, calls: [] as Query[] }))

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('next/server', async importOriginal => ({ ...(await importOriginal<typeof import('next/server')>()), after: () => {} }))
vi.mock('@/lib/auth', () => ({ authOptions: {}, requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c', name: 'a', image: null } } }) }))
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

import { POST as createPlan } from '@/app/api/planner/route'
import { PATCH as patchPlan } from '@/app/api/planner/[id]/route'
import { POST as postComment } from '@/app/api/planner/[id]/comments/route'

const ctx = { params: Promise.resolve({ id: 'p1' }) }
const json = (url: string, method: string, body: string) => new NextRequest(`http://localhost${url}`, { method, body, headers: { 'content-type': 'application/json' } })
const FORMAT = { error: '요청 형식이 올바르지 않습니다.' }
const rollbackLogged = () => (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.some(call => String(call[0]).includes('rollback'))

beforeEach(() => {
  state.reply = () => undefined
  state.calls.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('a request body that is not JSON is a 400, not a 500', () => {
  it('POST /api/planner', async () => {
    const res = await createPlan(json('/api/planner', 'POST', '{"title":'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(FORMAT)
    expect(state.calls).toEqual([])
  })

  it('PATCH /api/planner/[id]', async () => {
    state.reply = ({ table }) => table === 'md_plans' ? { data: { id: 'p1', user_id: 'u1', difficulty: 'normal', floor_plan: [] } } : undefined
    const res = await patchPlan(json('/api/planner/p1', 'PATCH', '{"title":'), ctx)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(FORMAT)
    expect(state.calls.some(call => call.op === 'update')).toBe(false)
  })

  it('POST /api/planner/[id]/comments', async () => {
    const res = await postComment(json('/api/planner/p1/comments', 'POST', '{"content":'), ctx)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(FORMAT)
    expect(state.calls).toEqual([])
  })

  it.each([
    ['POST /api/planner', () => createPlan(json('/api/planner', 'POST', 'null'))],
    ['POST comments', () => postComment(json('/api/planner/p1/comments', 'POST', 'null'), ctx)],
    ['PATCH /api/planner/[id]', () => patchPlan(json('/api/planner/p1', 'PATCH', 'null'), ctx)],
  ])('%s: a JSON null is a 400 too', async (_name, call) => {
    state.reply = ({ table }) => table === 'md_plans' ? { data: { id: 'p1', user_id: 'u1', difficulty: 'normal', floor_plan: [] } } : undefined
    expect((await call()).status).toBe(400)
  })

  it('a good body still works', async () => {
    state.reply = ({ table, op }) => table === 'md_plans' && op === 'insert' ? { data: { id: 'p1' } } : undefined
    const res = await createPlan(json('/api/planner', 'POST', JSON.stringify({ title: 'plan' })))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'p1' })
  })
})

describe('creating a plan: the rollback delete', () => {
  const create = () => createPlan(json('/api/planner', 'POST', JSON.stringify({ title: 'plan' })))
  const failingActivity = (deleteError: boolean) => ({ table, op }: Query): Reply | undefined => {
    if (table === 'md_plans' && op === 'insert') return { data: { id: 'p1' } }
    if (table === 'rpc:community_record_plan') return { error: { message: 'down' } }
    if (table === 'md_plans' && op === 'delete' && deleteError) return { error: { message: 'delete refused' } }
    return undefined
  }

  it('a failed activity record answers as before, and a failed rollback is logged', async () => {
    state.reply = failingActivity(true)
    const res = await create()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '플랜을 저장하지 못했습니다. 다시 시도해주세요.' })
    expect(rollbackLogged()).toBe(true)
  })

  it('a rollback that works logs nothing about a rollback', async () => {
    state.reply = failingActivity(false)
    expect((await create()).status).toBe(500)
    expect(state.calls.some(call => call.table === 'md_plans' && call.op === 'delete')).toBe(true)
    expect(rollbackLogged()).toBe(false)
  })
})
