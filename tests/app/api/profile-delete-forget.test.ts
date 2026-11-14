import { beforeEach, expect, it, vi } from 'vitest'

const { state, forget, admin } = vi.hoisted(() => {
  const state = { dataError: null as unknown, deleteError: null as unknown }
  return {
    state,
    forget: vi.fn(),
    admin: {
      schema: () => ({ rpc: async () => ({ error: state.dataError }) }),
      auth: { admin: { deleteUser: async () => ({ error: state.deleteError }) } },
    },
  }
})

vi.mock('@sentry/nextjs', () => ({ captureException: () => {} }))
vi.mock('@/features/community/server', () => ({ invalidateProfileDecks: async () => {} }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/auth-account', () => ({
  requireAccount: async () => ({ error: false, session: { user: { email: 'gone@example.com' } }, admin, userId: 'u1' }),
}))
vi.mock('@/lib/supabase/find-or-create-user', () => ({ findOrCreateSupabaseUser: async () => 'u1', forgetSupabaseUser: forget }))

import { DELETE } from '@/app/api/profile/route'

beforeEach(() => { forget.mockClear(); state.dataError = null; state.deleteError = null })

// A remembered id would point the next sign-in with the same email at an account without a profile.
it('forgets the remembered user id once the account is deleted', async () => {
  const res = await DELETE()
  expect(res.status).toBe(200)
  expect(forget).toHaveBeenCalledWith('gone@example.com')
})

it('forgets it as soon as the app data is gone, even when the auth user stays', async () => {
  state.deleteError = { message: 'boom' }
  const res = await DELETE()
  expect(res.status).toBe(500)
  expect(forget).toHaveBeenCalledWith('gone@example.com')
})

it('keeps it when nothing was deleted', async () => {
  state.dataError = { message: 'boom' }
  const res = await DELETE()
  expect(res.status).toBe(500)
  expect(forget).not.toHaveBeenCalled()
})
