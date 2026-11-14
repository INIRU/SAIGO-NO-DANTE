import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/legal', () => ({
  getCurrentLegalDocs: async () => [{ type: 'terms', version: 'v6' }, { type: 'privacy', version: 'v3' }],
}))

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>

/** A fake admin client that records every auth and database call. */
function fakeAdmin(opts: {
  lookup?: Rpc
  profiles?: Set<string>
  createUser?: () => Promise<{ data: { user: { id: string } } | null; error: unknown }>
  users?: { id: string; email: string }[]
}) {
  const calls = { rpc: 0, createUser: 0, listUsers: 0, profileUpserts: [] as string[], legalUpserts: 0 }
  const profiles = opts.profiles ?? new Set<string>()
  const from = (table: string) => {
    const filters: Record<string, unknown> = {}
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (column: string, value: unknown) => { filters[column] = value; return chain },
      limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: profiles.has(String(filters.id)) ? { id: filters.id } : null, error: null }),
      upsert: async (row: { id?: string } | unknown[]) => {
        if (table === 'profiles' && !Array.isArray(row) && row.id) { calls.profileUpserts.push(row.id); profiles.add(row.id) }
        if (table === 'legal_acknowledgements') calls.legalUpserts++
        return { error: null }
      },
    }
    return chain
  }
  const admin = {
    schema: () => ({
      from,
      rpc: (name: string, args: Record<string, unknown>) => {
        calls.rpc++
        return (opts.lookup ?? (async () => ({ data: null, error: { message: 'function does not exist' } })))(name, args)
      },
    }),
    auth: {
      admin: {
        createUser: async () => {
          calls.createUser++
          return (opts.createUser ?? (async () => ({ data: null, error: { status: 422, message: 'A user with this email address has already been registered' } })))()
        },
        listUsers: async () => { calls.listUsers++; return { data: { users: opts.users ?? [] }, error: null } },
      },
    },
  }
  return { admin: admin as never, calls }
}

let mod: typeof import('@/lib/supabase/find-or-create-user')
beforeEach(async () => {
  vi.resetModules()
  mod = await import('@/lib/supabase/find-or-create-user')
})

describe('findOrCreateSupabaseUser', () => {
  it('finds an existing user by email without trying to create one or listing users', async () => {
    const { admin, calls } = fakeAdmin({ lookup: async () => ({ data: 'u1', error: null }), profiles: new Set(['u1']) })
    expect(await mod.findOrCreateSupabaseUser(admin, 'a@example.com')).toBe('u1')
    expect(calls.createUser).toBe(0)
    expect(calls.listUsers).toBe(0)
    expect(calls.profileUpserts).toEqual([])
  })

  it('remembers the id, so the next request makes no call', async () => {
    const { admin, calls } = fakeAdmin({ lookup: async () => ({ data: 'u1', error: null }), profiles: new Set(['u1']) })
    await mod.findOrCreateSupabaseUser(admin, 'a@example.com')
    expect(await mod.findOrCreateSupabaseUser(admin, 'a@example.com')).toBe('u1')
    expect(calls.rpc).toBe(1)
  })

  it('looks the email up again after it is forgotten', async () => {
    const { admin, calls } = fakeAdmin({ lookup: async () => ({ data: 'u1', error: null }), profiles: new Set(['u1']) })
    await mod.findOrCreateSupabaseUser(admin, 'a@example.com')
    mod.forgetSupabaseUser('a@example.com')
    await mod.findOrCreateSupabaseUser(admin, 'a@example.com')
    expect(calls.rpc).toBe(2)
  })

  it('creates a profile for an existing user that has none', async () => {
    const { admin, calls } = fakeAdmin({ lookup: async () => ({ data: 'u1', error: null }) })
    expect(await mod.findOrCreateSupabaseUser(admin, 'a@example.com')).toBe('u1')
    expect(calls.profileUpserts).toEqual(['u1'])
    expect(calls.createUser).toBe(0)
  })

  it('creates a new user with a profile and the current consent records', async () => {
    const { admin, calls } = fakeAdmin({
      lookup: async () => ({ data: null, error: null }),
      createUser: async () => ({ data: { user: { id: 'new' } }, error: null }),
    })
    expect(await mod.findOrCreateSupabaseUser(admin, 'new@example.com')).toBe('new')
    expect(calls.createUser).toBe(1)
    expect(calls.profileUpserts).toEqual(['new'])
    expect(calls.legalUpserts).toBe(1)
    expect(calls.listUsers).toBe(0)
  })

  it('finds the user another request just created by looking up again, not by listing users', async () => {
    let lookups = 0
    const { admin, calls } = fakeAdmin({
      lookup: async () => ({ data: lookups++ === 0 ? null : 'u2', error: null }),
      profiles: new Set(['u2']),
    })
    expect(await mod.findOrCreateSupabaseUser(admin, 'race@example.com')).toBe('u2')
    expect(calls.createUser).toBe(1)
    expect(calls.listUsers).toBe(0)
  })

  it('does not list users when the lookup works and finds no one', async () => {
    let creates = 0
    const { admin, calls } = fakeAdmin({
      lookup: async () => ({ data: null, error: null }),
      createUser: async () => (creates++ === 0
        ? { data: null, error: { status: 500, message: 'temporary' } }
        : { data: { user: { id: 'new' } }, error: null }),
    })
    expect(await mod.findOrCreateSupabaseUser(admin, 'new@example.com')).toBe('new')
    expect(calls.listUsers).toBe(0)
  })

  it('works as before when the lookup call throws', async () => {
    const { admin, calls } = fakeAdmin({
      lookup: async () => { throw new Error('network') },
      users: [{ id: 'old', email: 'old@example.com' }],
      profiles: new Set(['old']),
    })
    expect(await mod.findOrCreateSupabaseUser(admin, 'old@example.com')).toBe('old')
    expect(calls.listUsers).toBe(1)
  })

  it('looks the email up again once the remembered id is ten minutes old', async () => {
    vi.useFakeTimers()
    try {
      const { admin, calls } = fakeAdmin({ lookup: async () => ({ data: 'u1', error: null }), profiles: new Set(['u1']) })
      await mod.findOrCreateSupabaseUser(admin, 'a@example.com')
      vi.advanceTimersByTime(10 * 60 * 1000 + 1)
      await mod.findOrCreateSupabaseUser(admin, 'a@example.com')
      expect(calls.rpc).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('works as before when the lookup function is missing', async () => {
    const { admin, calls } = fakeAdmin({ users: [{ id: 'old', email: 'old@example.com' }], profiles: new Set(['old']) })
    expect(await mod.findOrCreateSupabaseUser(admin, 'old@example.com')).toBe('old')
    expect(calls.createUser).toBe(1)
    expect(calls.listUsers).toBe(1)
  })
})
