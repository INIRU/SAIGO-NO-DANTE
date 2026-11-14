import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { fakeDb, type Query, type Reply } from '../../../helpers/fake-db'

const state = vi.hoisted(() => ({ reply: (() => undefined) as (query: Query) => Reply | undefined, calls: [] as Query[], afterTasks: [] as (() => unknown)[] }))

vi.mock('next/server', async importOriginal => ({ ...(await importOriginal<typeof import('next/server')>()), after: (task: () => unknown) => { state.afterTasks.push(task) } }))
vi.mock('@/lib/rate-limit', () => ({ checkRequestRateLimit: () => ({ allowed: true }), rateLimitResponse: () => NextResponse.json({ error: 'slow' }, { status: 429 }) }))
vi.mock('@/features/account/server', () => ({ authorRateKey: () => null, guestPinOf: () => null, resolveAuthor: async () => ({}) }))
vi.mock('@/features/friends/server', () => ({
  friendAuthorColumns: '', isAuthorOf: () => false, isBlocked: async () => false, ownerFilter: () => ({ column: 'c', value: 'v' }), viewerOf: async () => null,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeDb(query => state.reply(query), state.calls) }))

import { GET } from '@/app/api/friend-codes/route'

const list = () => GET(new NextRequest('http://localhost/api/friend-codes?kind=want'))
const logged = () => (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(call => String(call[0]).includes('expired wants'))

beforeEach(() => { state.reply = () => undefined; state.calls.length = 0; state.afterTasks.length = 0; vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('friend code list: deleting expired want posts after the answer', () => {
  it('logs a delete that the database refused (it does not throw, so there is nothing to catch)', async () => {
    state.reply = ({ table, op }) => table === 'friend_posts' && op === 'delete' ? { error: { message: 'delete refused' } } : { data: [] }
    expect((await list()).status).toBe(200)
    await state.afterTasks[0]()
    expect(logged()).toHaveLength(1)
  })

  it('logs nothing when the delete worked', async () => {
    state.reply = () => ({ data: [] })
    expect((await list()).status).toBe(200)
    await state.afterTasks[0]()
    expect(logged()).toHaveLength(0)
  })
})
