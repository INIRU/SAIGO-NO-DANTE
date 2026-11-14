import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const state = vi.hoisted(() => ({ used: [] as string[], userId: 'user-1' as string | null }))
const admin = { tag: 'admin' }
const session = { user: { email: 'a@b.c', name: 'Ann', image: 'https://img.example/a.png' } }
const denied = (status: number) => ({ error: true as const, response: NextResponse.json({ error: 'denied' }, { status }) })
let signedIn: ReturnType<typeof denied> | { error: false; session: typeof session }

vi.mock('@/lib/auth', () => ({
  requireUser: async () => { state.used.push('requireUser'); return signedIn },
  requireActiveUser: async () => { state.used.push('requireActiveUser'); return signedIn },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/supabase/find-or-create-user', () => ({
  findOrCreateSupabaseUser: async (...args: unknown[]) => { state.used.push(`lookup:${args.slice(1).join('|')}`); return state.userId },
}))

import { requireAccount } from '@/lib/auth-account'

beforeEach(() => { state.used = []; state.userId = 'user-1'; signedIn = { error: false, session } })

describe('requireAccount', () => {
  it('gives the session, the admin client and the account id', async () => {
    const auth = await requireAccount()
    expect(auth).toEqual({ error: false, session, admin, userId: 'user-1' })
    expect(state.used).toEqual(['requireUser', 'lookup:a@b.c|Ann|https://img.example/a.png'])
  })

  it('with activeOnly it also refuses a suspended account', async () => {
    await requireAccount({ activeOnly: true })
    expect(state.used).toEqual(['requireActiveUser', 'lookup:a@b.c|Ann|https://img.example/a.png'])
  })

  it.each([[false], [true]])('passes the refusal on as it is, without a lookup (activeOnly %s)', async activeOnly => {
    signedIn = denied(401)
    const auth = await requireAccount({ activeOnly })
    expect(auth).toBe(signedIn)
    expect(state.used).toEqual([activeOnly ? 'requireActiveUser' : 'requireUser'])
  })

  it('is a 500 with the account message when the account cannot be found or created', async () => {
    state.userId = null
    const auth = await requireAccount()
    if (!auth.error) throw new Error('expected a refusal')
    expect(auth.response.status).toBe(500)
    expect(await auth.response.json()).toEqual({ error: '사용자를 찾을 수 없습니다.' })
  })
})
