import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ calls: [] as unknown[][], result: { data: [] as unknown[] | null, error: null as { message: string } | null } }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const chain: Record<string, (...args: unknown[]) => unknown> = {}
    for (const name of ['schema', 'from', 'select', 'in', 'eq']) chain[name] = (...args: unknown[]) => { db.calls.push([name, ...args]); return name === 'eq' ? Promise.resolve(db.result) : chain }
    return chain
  },
}))

import { withPostAuthors } from '@/features/community/server/post-authors'

beforeEach(() => { db.calls = []; db.result = { data: [], error: null } })

describe('post authors', () => {
  it('shows the author of a post whatever their profile privacy', async () => {
    db.result.data = [
      { id: 'u-private', username: '비공개 작성자', avatar_url: 'https://x/a.webp', public_profile: false },
      { id: 'u-public', username: '공개 작성자', avatar_url: null, public_profile: true },
    ]
    const rows = await withPostAuthors([
      { id: 'd1', user_id: 'u-private', profiles: null },
      { id: 'd2', user_id: 'u-public', profiles: [{ username: '공개 작성자' }] },
      { id: 'd3', user_id: 'u-private' },
      { id: 'd4', user_id: null, guest_tag: 'ab12', profiles: null },
    ])
    expect(rows.map(row => row.profiles)).toEqual([
      { username: '비공개 작성자', avatar_url: 'https://x/a.webp', public_profile: false },
      { username: '공개 작성자', avatar_url: null, public_profile: true },
      { username: '비공개 작성자', avatar_url: 'https://x/a.webp', public_profile: false },
      null,
    ])
    // One read for the distinct authors, suspended accounts left out.
    expect(db.calls).toContainEqual(['in', 'id', ['u-private', 'u-public']])
    expect(db.calls).toContainEqual(['eq', 'suspended', false])
    expect(db.calls.filter(call => call[0] === 'from')).toEqual([['from', 'profiles']])
  })

  it('leaves a suspended author anonymous and keeps what was read when the lookup fails', async () => {
    // The suspended author is not returned: the post keeps the empty author it had.
    expect((await withPostAuthors([{ id: 'd1', user_id: 'u-banned', profiles: null }]))[0].profiles).toBeNull()
    db.result = { data: null, error: { message: 'down' } }
    const rows = await withPostAuthors([{ id: 'd2', user_id: 'u-public', profiles: [{ username: '공개 작성자', avatar_url: null }] }])
    expect(rows[0].profiles).toEqual({ username: '공개 작성자', avatar_url: null })
  })

  it('reads nothing for guest-only lists', async () => {
    await withPostAuthors([{ id: 'd1', user_id: null }, { id: 'd2' }])
    expect(db.calls).toEqual([])
  })
})
