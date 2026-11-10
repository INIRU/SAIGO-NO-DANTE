import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_BASE } from '@/lib/constants/game'

let existing: { id: string } | null
let dupError: { message: string } | null
let updateError: { code?: string; message: string } | null
let updates: Record<string, unknown>[]

vi.mock('@sentry/nextjs', () => ({ captureException: () => {} }))
vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({
  authOptions: {},
  requireActiveUser: async () => ({ error: false, session: { user: { email: 'a@b.c', name: 'a', image: null } } }),
}))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({ findOrCreateSupabaseUser: async () => 'user-1' }))
vi.mock('@/features/community/server', () => ({ invalidateProfileDecks: async () => {} }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ neq: () => ({ maybeSingle: async () => ({ data: existing, error: dupError }) }) }) }),
        update: (values: Record<string, unknown>) => ({ eq: async () => { updates.push(values); return { error: updateError } } }),
      }),
    }),
  }),
}))

import { PATCH } from '@/app/api/profile/route'

const patch = (body: unknown) => PATCH(new Request('http://localhost/api/profile', { method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body) }) as never)

beforeEach(() => { existing = null; dupError = null; updateError = null; updates = []; vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('REQ-SHARED-102 profile PATCH validation', () => {
  it('REQ-SHARED-102 rejects values that are not strings with 400 instead of throwing 500', async () => {
    for (const body of [{ username: 123 }, { bio: ['a'] }, { collection_code: 5 }, { avatar_url: 7 }, 'not json', [], null]) {
      const res = await patch(body)
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
    expect(updates).toEqual([])
  })

  it('REQ-SHARED-102 keeps the length limits: nickname 1~20, bio 300, collection code bounded', async () => {
    expect((await patch({ username: '   ' })).status).toBe(400)
    expect((await patch({ username: 'a'.repeat(21) })).status).toBe(400)
    expect((await patch({ username: '<script>' })).status).toBe(400)
    expect((await patch({ bio: 'a'.repeat(301) })).status).toBe(400)
    expect((await patch({ collection_code: 'a'.repeat(100_000) })).status).toBe(400)
    expect(updates).toEqual([])
  })

  it('REQ-SHARED-102 the avatar address must start with the storage address and a slash', async () => {
    expect((await patch({ avatar_url: `${STORAGE_BASE}.evil.example/a.png` })).status).toBe(400)
    expect((await patch({ avatar_url: 'https://evil.example/a.png' })).status).toBe(400)
    expect((await patch({ avatar_url: `${STORAGE_BASE}/sinners/a.webp` })).status).toBe(200)
    expect((await patch({ avatar_url: null })).status).toBe(200)
    expect(updates).toEqual([{ avatar_url: `${STORAGE_BASE}/sinners/a.webp` }, { avatar_url: null }])
  })

  it('REQ-SHARED-102 saves the trimmed nickname, bio and collection code', async () => {
    expect((await patch({ username: ' 림버스 ', bio: '소개', collection_code: '' })).status).toBe(200)
    expect(updates).toEqual([{ username: '림버스', bio: '소개', collection_code: null }])
  })

  it('REQ-SHARED-102 a taken nickname is 409, and so is a unique violation that slips past the check', async () => {
    existing = { id: 'other' }
    expect((await patch({ username: 'taken' })).status).toBe(409)
    existing = null
    updateError = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const res = await patch({ username: 'taken' })
    expect(res.status).toBe(409)
    expect(JSON.stringify(await res.json())).not.toContain('duplicate key')
  })

  it('REQ-SHARED-102 a failed duplicate check is a 500 with a fixed message, not a silent pass', async () => {
    dupError = { message: 'relation "profiles" is down' }
    const res = await patch({ username: 'fresh' })
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('relation')
    expect(updates).toEqual([])
  })
})
