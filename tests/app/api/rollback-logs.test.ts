import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type Query, type Reply } from '../../helpers/fake-db'

const state = vi.hoisted(() => ({ reply: (() => undefined) as (query: Query) => Reply | undefined, calls: [] as Query[], afterTasks: [] as (() => unknown)[] }))

vi.mock('next/server', async importOriginal => ({ ...(await importOriginal<typeof import('next/server')>()), after: (task: () => unknown) => { state.afterTasks.push(task) } }))
vi.mock('@/lib/auth', () => ({ requireUser: async () => ({ error: false, session: { user: { email: 'a@b.c' } } }) }))
vi.mock('@/lib/supabase/find-or-create-user', () => ({ findOrCreateSupabaseUser: async () => 'u1' }))
vi.mock('@/lib/rate-limit', () => ({ checkRequestRateLimit: () => ({ allowed: true }), rateLimitResponse: () => new Response(null, { status: 429 }) }))
vi.mock('@/features/assist', () => ({ parseAssistReport: () => ({ session: 's', build: null, counts: {}, corrections: [] }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb(query => state.reply(query), state.calls) }))

import { POST as postInquiry } from '@/app/api/inquiries/route'
import { POST as postReport } from '@/app/api/assist/reports/route'

const logged = (word: string) => (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.some(call => String(call[0]).includes(word))
const inquiry = () => postInquiry(new Request('http://localhost/api/inquiries', { method: 'POST', body: JSON.stringify({ title: 't', content: 'c', category: 'bug' }) }))

beforeEach(() => { state.reply = () => undefined; state.calls.length = 0; state.afterTasks.length = 0; vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('inquiry: the rollback delete', () => {
  const failingFirstMessage = (deleteError: boolean) => ({ table, op }: Query): Reply | undefined => {
    if (table === 'inquiries' && op === 'insert') return { data: { id: 'i1' } }
    if (table === 'support_messages') return { error: { message: 'down' } }
    if (table === 'inquiries' && op === 'delete' && deleteError) return { error: { message: 'delete refused' } }
    return undefined
  }

  it('answers as before and logs a rollback that failed', async () => {
    state.reply = failingFirstMessage(true)
    const res = await inquiry()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '문의를 저장하지 못했습니다.' })
    expect(logged('rollback')).toBe(true)
  })

  it('logs nothing about a rollback that worked', async () => {
    state.reply = failingFirstMessage(false)
    expect((await inquiry()).status).toBe(500)
    expect(state.calls.some(call => call.table === 'inquiries' && call.op === 'delete')).toBe(true)
    expect(logged('rollback')).toBe(false)
  })
})

describe('assist report: the purge of old reports', () => {
  it('logs a purge that failed, after the 204', async () => {
    state.reply = ({ table, op }) => table === 'assist_reports' && op === 'delete' ? { error: { message: 'delete refused' } } : undefined
    const res = await postReport(new Request('http://localhost/api/assist/reports', { method: 'POST', body: JSON.stringify({ v: 1 }) }))
    expect(res.status).toBe(204)
    expect(state.afterTasks).toHaveLength(1)
    await state.afterTasks[0]()
    expect(logged('purge')).toBe(true)
  })
})
