import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next-intl', () => ({ useLocale: () => 'ko' }))
vi.mock('server-only', () => ({}))

import ProfileSettings from '@/components/community/ProfileSettings'
import { loadCommunityProfile } from '@/lib/community/server'
import { communityCopy } from '@/lib/community/copy'
import type { CommunitySettings } from '@/lib/community/rules'

const settings = (extra: Partial<CommunitySettings> = {}): CommunitySettings => ({
  public_profile: true, public_following: false, public_followers: true,
  notify_comments: true, notify_follows: false, notify_posts: true, ...extra,
})

describe('profile settings rows', () => {
  it('REQ-COMMUNITY-090 shows visibility and notification settings as named switches without a paragraph', () => {
    const html = renderToStaticMarkup(<ProfileSettings initial={settings()} onSaved={async () => {}} />)
    const ko = communityCopy.ko
    for (const label of [ko.visibility, ko.publicFollowing, ko.publicFollowers, ko.notifyComments, ko.notifyFollows, ko.notifyPosts]) expect(html).toContain(label)
    expect(html.match(/role="switch"/g)).toHaveLength(6)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(4)
    expect(html).not.toContain(ko.visibilityHint)
    expect(html).not.toContain('<p')
  })

  it('REQ-COMMUNITY-090 locks the list switches while the profile is private', () => {
    const html = renderToStaticMarkup(<ProfileSettings initial={settings({ public_profile: false })} onSaved={async () => {}} />)
    expect(html.match(/role="switch"[^>]*disabled=""|disabled=""[^>]*role="switch"/g)).toHaveLength(2)
  })
})

// A database stand-in: every query builder call returns itself and resolves to the table's rows.
const row = {
  id: 'u1', username: '관리자', bio: null, avatar_url: null, created_at: '2026-10-01T00:00:00Z', public_profile: true, suspended: false,
  public_following: false, public_followers: true, notify_comments: true, notify_follows: false, notify_posts: true,
}
function query(result: unknown): unknown {
  const self: unknown = new Proxy(() => {}, {
    get: (_, key) => key === 'then' ? (resolve: (value: unknown) => void) => resolve(result) : key === 'maybeSingle' ? () => Promise.resolve(result) : () => self,
  })
  return self
}
const db = {
  schema: () => ({
    from: (table: string) => query(table === 'profiles' ? { data: row, error: null } : { data: [], error: null }),
    rpc: () => Promise.resolve({ data: { deck: 0, plan: 0, like: 0, contribution: 0, points: 0 }, error: null }),
  }),
} as unknown as Parameters<typeof loadCommunityProfile>[0]

describe('community profile settings', () => {
  it('REQ-COMMUNITY-089 returns the settings to the owner only', async () => {
    expect((await loadCommunityProfile(db, 'u1', true))?.settings).toEqual(settings())
    expect((await loadCommunityProfile(db, 'u1', false))?.settings).toBeUndefined()
  })
})
