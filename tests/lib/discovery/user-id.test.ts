import { describe, expect, it } from 'vitest'
import { discoveryUserId } from '@/lib/discovery/user-id'

const db = (result: { data: unknown; error: { message: string } | null }) => ({ rpc: async (name: string, args: { user_email: string }) => ({ ...result, name, args }) })

describe('REQ-PLANNER-020 account lookup for personal data', () => {
  it('REQ-PLANNER-020 returns the profile id of the session email', async () => {
    expect(await discoveryUserId(db({ data: 'user-1', error: null }), 'a@b.c')).toBe('user-1')
  })

  it('REQ-PLANNER-020 returns null for an email without a profile yet', async () => {
    expect(await discoveryUserId(db({ data: null, error: null }), 'a@b.c')).toBeNull()
  })

  it('REQ-PLANNER-020 throws when the lookup itself fails (e.g. the function is missing), instead of looking like "no account"', async () => {
    await expect(discoveryUserId(db({ data: null, error: { message: 'function limbus.discovery_user_id(text) does not exist' } }), 'a@b.c'))
      .rejects.toThrow(/discovery_user_id/)
  })
})
