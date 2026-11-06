import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const state = vi.hoisted(() => ({ status: 'authenticated' as 'authenticated' | 'unauthenticated', data: undefined as unknown }))
vi.mock('next-intl', () => ({ useLocale: () => 'ko' }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: state.status }) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }))
vi.mock('swr', () => ({ default: (key: string | null) => ({ data: key ? state.data : undefined }), useSWRConfig: () => ({ mutate: vi.fn() }) }))

import FollowAuthorButton from '@/features/community/components/FollowAuthorButton'
import { communityCopy } from '@/features/community/lib/copy'

const follows = (extra: Record<string, unknown>) => ({ owner: false, is_following: false, public_following: true, public_followers: true, following_count: 1, follower_count: 2, can_view: true, items: [], ...extra })
const ko = communityCopy.ko
const source = (path: string) => readFileSync(resolve(__dirname, '../../../..', path), 'utf8')

describe('follow button next to a post author', () => {
  beforeEach(() => { state.status = 'authenticated'; state.data = undefined })

  it('REQ-COMMUNITY-091 offers to follow, and shows following once followed', () => {
    state.data = follows({})
    const html = renderToStaticMarkup(<FollowAuthorButton userId="u1" />)
    expect(html).toContain(`>${ko.follow}<`)
    expect(html).toContain('aria-pressed="false"')
    state.data = follows({ is_following: true })
    const followed = renderToStaticMarkup(<FollowAuthorButton userId="u1" />)
    expect(followed).toContain(`>${ko.following}<`)
    expect(followed).toContain('aria-pressed="true"')
  })

  it('REQ-COMMUNITY-091 is absent on one\'s own post', () => {
    state.data = follows({ owner: true })
    expect(renderToStaticMarkup(<FollowAuthorButton userId="u1" />)).toBe('')
  })

  it('REQ-COMMUNITY-091 still offers to follow when signed out (the press leads to sign-in) without asking the server', () => {
    state.status = 'unauthenticated'
    state.data = follows({ is_following: true })
    expect(renderToStaticMarkup(<FollowAuthorButton userId="u1" />)).toContain(`>${ko.follow}<`)
  })

  it('REQ-COMMUNITY-091 deck and plan pages show it only for a signed-up author with a public profile', () => {
    for (const path of ['app/[lang]/decks/[id]/DeckDetailClient.tsx', 'app/[lang]/planner/community/[id]/PlanDetailClient.tsx']) {
      const page = source(path)
      expect(page, path).toMatch(/profiles\?\.username && \w+\.profiles\.public_profile !== false && <FollowAuthorButton userId=\{\w+\.user_id\}/)
    }
  })
})
