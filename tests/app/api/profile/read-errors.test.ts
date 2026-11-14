import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DbError, Reply } from '../../../helpers/fake-db'

const state = vi.hoisted(() => ({ replies: {} as Record<string, unknown>, session: true }))

vi.mock('@sentry/nextjs', () => ({ captureException: () => {} }))
vi.mock('next-auth', () => ({ getServerSession: async () => (state.session ? { user: { email: 'a@b.c', name: 'a', image: null } } : null) }))
vi.mock('@/lib/auth', () => ({ authOptions: {}, requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c', name: 'a', image: null } } }) }))
vi.mock('@/features/community/server', () => ({ invalidateProfileDecks: async () => {} }))
vi.mock('@/lib/supabase/find-or-create-user', () => ({ findOrCreateSupabaseUser: async () => 'user-1' }))
vi.mock('@/lib/auth-account', async () => {
  const { fakeDb } = await import('../../../helpers/fake-db')
  return {
    requireAccount: async () => ({
      error: false,
      session: { user: { email: 'a@b.c', name: 'nick' } },
      userId: 'user-1',
      admin: fakeDb(({ table, payload }) => (state.replies[(payload as { options?: { head?: boolean } } | undefined)?.options?.head ? `${table}:count` : table] as Reply | undefined)),
    }),
  }
})
vi.mock('@/lib/supabase/admin', async () => {
  const { fakeDb } = await import('../../../helpers/fake-db')
  return { createAdminClient: () => fakeDb(({ table }) => state.replies[table] as Reply | undefined) }
})

import { GET } from '@/app/api/profile/route'
import { GET as GET_AVATAR } from '@/app/api/profile/avatar/route'

const down: DbError = { code: '57P01', message: 'terminating connection' }
const healthy = () => ({
  profiles: { data: { username: 'nick', bio: null, avatar_url: null, created_at: 't', collection_code: null } },
  decks: { data: [{ id: 'd1', vote_count: 2 }] },
  deck_bookmarks: { data: [] },
  'md_plans:count': { count: 3 },
  md_plans: { data: [{ vote_count: 4 }] },
})

beforeEach(() => { state.replies = healthy(); state.session = true; vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('GET /api/profile', () => {
  it('answers with the account when every read works', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ stats: { deckCount: 1, planCount: 3, bookmarkCount: 0, totalVotesReceived: 6 } })
  })

  it.each([['profiles'], ['decks'], ['deck_bookmarks'], ['md_plans:count'], ['md_plans']])('a failed %s read is a 500 and is logged, not an empty 200', async key => {
    state.replies[key] = { error: down }
    const res = await GET()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: '요청을 처리하지 못했습니다.' })
    expect(console.error).toHaveBeenCalled()
  })

  it('an account without a profile row yet still gets the session name', async () => {
    state.replies.profiles = { error: { code: 'PGRST116', message: 'The result contains 0 rows' } }
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).profile).toMatchObject({ username: 'nick', bio: null })
  })
})

describe('GET /api/profile/avatar', () => {
  it('answers with the nickname and avatar', async () => {
    state.replies.profiles = { data: { avatar_url: 'a.webp', username: 'nick' } }
    const res = await GET_AVATAR()
    expect(await res.json()).toEqual({ id: 'user-1', avatar_url: 'a.webp', username: 'nick' })
  })

  it('a failed profile read is a 500, not a signed-in user with no name', async () => {
    state.replies.profiles = { error: down }
    const res = await GET_AVATAR()
    expect(res.status).toBe(500)
    expect(console.error).toHaveBeenCalled()
  })

  it('a missing profile row is still a null name', async () => {
    state.replies.profiles = { error: { code: 'PGRST116', message: 'The result contains 0 rows' } }
    const res = await GET_AVATAR()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'user-1', avatar_url: null, username: null })
  })
})
