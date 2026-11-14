import { beforeEach, it, expect, vi } from 'vitest'
vi.mock('@/lib/data/legal', () => ({ getCurrentLegalDocs: async () => [] }))
import { findOrCreateSupabaseUser, forgetSupabaseUser } from '@/lib/supabase/find-or-create-user'

// The ids are remembered per email; each test starts without one.
beforeEach(() => forgetSupabaseUser('qa@example.invalid'))

function mockAdmin(existing: boolean) {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const profile = {
    select: () => ({
      eq: () => ({ limit: async () => ({ data: [], error: null }) }),
    }),
    upsert,
  }
  return {
    upsert,
    client: {
      schema: () => ({ from: () => profile }),
      auth: {
        admin: {
          createUser: async () =>
            existing
              ? { error: { message: 'exists' } }
              : { data: { user: { id: 'owner' } }, error: null },
          listUsers: async () => ({
            data: { users: [{ id: 'owner', email: 'qa@example.invalid' }] },
          }),
        },
      },
    },
  }
}
it('repairs a missing profile without overwriting an existing account', async () => {
  const m = mockAdmin(true)
  expect(
    await findOrCreateSupabaseUser(m.client as never, 'qa@example.invalid'),
  ).toBe('owner')
  expect(m.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'owner', username: expect.any(String) }),
    { onConflict: 'id', ignoreDuplicates: true },
  )
  expect(m.upsert.mock.calls[0][0]).not.toHaveProperty('role')
})
it('creates the profile when the auth trigger is absent', async () => {
  const m = mockAdmin(false)
  expect(
    await findOrCreateSupabaseUser(m.client as never, 'qa@example.invalid'),
  ).toBe('owner')
  expect(m.upsert).toHaveBeenCalledOnce()
})
