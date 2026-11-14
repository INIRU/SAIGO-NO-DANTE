import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type SessionUser = { email?: string | null; name?: string | null; image?: string | null; isSuspended?: boolean }
const state = vi.hoisted(() => ({
  session: null as { user: SessionUser } | null,
  lookup: { result: 'user-1' as string | null, error: null as Error | null },
  lookups: [] as unknown[][],
  tables: [] as string[],
}))

const admin = {
  schema: () => ({
    from: (table: string) => { state.tables.push(table); throw new Error('the user lookup must fail before any table is read') },
    rpc: async () => { throw new Error('the user lookup must fail before any rpc') },
  }),
  auth: { admin: { deleteUser: async () => { throw new Error('no user deletion') } } },
}

vi.mock('@sentry/nextjs', () => ({ captureException: () => {} }))
vi.mock('next-auth', () => ({ getServerSession: async () => state.session }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/features/community/server', () => ({ invalidateProfileDecks: async () => {} }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({
  findOrCreateSupabaseUser: async (...args: unknown[]) => {
    state.lookups.push(args)
    if (state.lookup.error) throw state.lookup.error
    return state.lookup.result
  },
}))

import { POST as acknowledge } from '@/app/api/legal/acknowledgements/route'
import { GET as legalStatus } from '@/app/api/legal/status/route'
import { GET as profile, DELETE as deleteProfile } from '@/app/api/profile/route'
import { GET as suspension } from '@/app/api/profile/suspension/route'
import { POST as vote } from '@/app/api/decks/[id]/vote/route'

const UNEXPECTED = { error: '요청을 처리하지 못했습니다.' }
const routes: { name: string; call: () => Promise<Response>; active: boolean; thrown: unknown }[] = [
  { name: 'POST /api/legal/acknowledgements', call: () => acknowledge(), active: false, thrown: UNEXPECTED },
  { name: 'GET /api/legal/status', call: () => legalStatus(new Request('http://localhost/api/legal/status')), active: false, thrown: UNEXPECTED },
  { name: 'GET /api/profile', call: () => profile(), active: false, thrown: UNEXPECTED },
  { name: 'GET /api/profile/suspension', call: () => suspension(), active: false, thrown: UNEXPECTED },
  { name: 'DELETE /api/profile', call: () => deleteProfile(), active: true, thrown: UNEXPECTED },
  {
    name: 'POST /api/decks/[id]/vote',
    call: () => vote(new NextRequest('http://localhost/api/decks/d1/vote', { method: 'POST' }), { params: Promise.resolve({ id: 'd1' }) }),
    active: true,
    thrown: { error: '투표 처리 중 오류가 발생했습니다.' },
  },
]

beforeEach(() => {
  state.session = null
  state.lookup = { result: 'user-1', error: null }
  state.lookups = []
  state.tables = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe.each(routes)('$name', ({ call, active, thrown }) => {
  it('is 401 without a session, and looks no account up', async () => {
    const res = await call()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: '로그인이 필요합니다.' })
    expect(state.lookups).toEqual([])
  })

  it('is 401 for a session without an email', async () => {
    state.session = { user: { name: 'a' } }
    const res = await call()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: '로그인이 필요합니다.' })
    expect(state.lookups).toEqual([])
  })

  it('is 500 when the account cannot be found or created', async () => {
    state.session = { user: { email: 'a@b.c' } }
    state.lookup.result = null
    const res = await call()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '사용자를 찾을 수 없습니다.' })
    expect(state.tables).toEqual([])
  })

  it('looks the account up with the session email, name and image', async () => {
    state.session = { user: { email: 'a@b.c', name: 'Ann', image: 'https://img.example/a.png' } }
    state.lookup.result = null
    await call()
    expect(state.lookups).toEqual([[admin, 'a@b.c', 'Ann', 'https://img.example/a.png']])
  })

  it('is 500 with the route\'s own message when the lookup throws', async () => {
    state.session = { user: { email: 'a@b.c' } }
    state.lookup.error = new Error('db down')
    const res = await call()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual(thrown)
  })

  it(active ? 'is 403 for a suspended account, before any lookup' : 'lets a suspended account through to the lookup', async () => {
    state.session = { user: { email: 'a@b.c', isSuspended: true } }
    state.lookup.result = null
    const res = await call()
    if (active) {
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: '이용이 정지된 계정입니다.' })
      expect(state.lookups).toEqual([])
    } else {
      expect(res.status).toBe(500)
      expect(state.lookups).toHaveLength(1)
    }
  })
})
