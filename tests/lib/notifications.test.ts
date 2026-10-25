import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { freshForToast, newestFirst, toNotification, type Notification, type NotificationRow } from '@/lib/notifications'

const row: NotificationRow = {
  kind: 'comment', target_type: 'deck', target_id: 'deck-1', target_title: '화상 덱', comment_id: 'c-1',
  actor_name: '돈키', actor_avatar: 'https://example.invalid/a.webp', excerpt: '잘 봤어요', created_at: '2026-10-02T12:00:00Z', unread: true,
}

describe('REQ-COMMUNITY-013 a notification row becomes what the list shows', () => {
  it('REQ-COMMUNITY-013 a deck comment links to the deck\'s comments', () => {
    expect(toNotification(row)).toEqual({
      id: 'c-1', kind: 'comment', target: 'deck', href: '/decks/deck-1#deck-comments-title', title: '화상 덱', actor: '돈키',
      avatar: 'https://example.invalid/a.webp', excerpt: '잘 봤어요', at: '2026-10-02T12:00:00Z', unread: true,
    })
  })

  it('REQ-COMMUNITY-013 a plan reply links to the plan\'s comments', () => {
    const item = toNotification({ ...row, kind: 'reply', target_type: 'plan', target_id: 'plan-1' })
    expect(item.kind).toBe('reply')
    expect(item.target).toBe('plan')
    expect(item.href).toBe('/planner/community/plan-1#plan-comments-title')
  })

  it('REQ-COMMUNITY-013 a comment whose author is gone keeps an empty author, and missing text is empty', () => {
    expect(toNotification({ ...row, actor_name: null, actor_avatar: null, excerpt: null, target_title: null, unread: null }))
      .toMatchObject({ actor: null, avatar: null, excerpt: '', title: '', unread: false })
  })
})

describe('REQ-COMMUNITY-017 an inquiry waiting for an answer is a notification for administrators', () => {
  it('REQ-COMMUNITY-017 an inquiry row links to that inquiry in the admin inbox', () => {
    expect(toNotification({ ...row, kind: 'inquiry', target_type: 'inquiry', target_id: 'q-1', target_title: '로그인 오류', comment_id: 'm-1' }))
      .toMatchObject({ id: 'm-1', kind: 'inquiry', target: 'inquiry', href: '/admin/inquiries?id=q-1', title: '로그인 오류', actor: '돈키' })
  })

  it('REQ-COMMUNITY-017 comment and inquiry rows make one list, newest first, undated ones last', () => {
    const item = (id: string, created_at: string | null) => toNotification({ ...row, comment_id: id, created_at })
    expect(newestFirst([item('old', '2026-10-02T12:00:00Z'), item('none', null), item('new', '2026-10-03T09:00:00Z')]).map(entry => entry.id)).toEqual(['new', 'old', 'none'])
  })
})

describe('REQ-COMMUNITY-016 which notifications are announced with a toast', () => {
  const item = (id: string, at: string, unread = true): Notification => ({ ...toNotification(row), id, at, unread })
  // Newest first, as the feed returns them.
  const feed = [item('e', '2026-10-02T12:05:00Z'), item('d', '2026-10-02T12:04:00Z'), item('c', '2026-10-02T12:03:00Z', false), item('b', '2026-10-02T12:02:00Z'), item('a', '2026-10-02T12:01:00Z')]

  it('REQ-COMMUNITY-016 the three newest unread ones on a first visit', () => {
    expect(freshForToast(feed, null).map(entry => entry.id)).toEqual(['e', 'd', 'b'])
  })

  it('REQ-COMMUNITY-016 only those newer than the last announced one afterwards', () => {
    expect(freshForToast(feed, '2026-10-02T12:04:00Z').map(entry => entry.id)).toEqual(['e'])
    expect(freshForToast(feed, '2026-10-02T12:05:00Z')).toEqual([])
  })
})

describe('REQ-COMMUNITY-092 follows bring new followers and new posts into the list', () => {
  it('REQ-COMMUNITY-092 a new follower links to their profile', () => {
    expect(toNotification({ ...row, kind: 'follow', target_type: 'user', target_id: 'u-9', target_title: null, comment_id: 'u-9', excerpt: null }))
      .toMatchObject({ id: 'u-9', kind: 'follow', target: 'user', href: '/users/u-9', title: '', excerpt: '' })
  })

  it('REQ-COMMUNITY-092 a new deck or plan by someone followed links to the post itself', () => {
    expect(toNotification({ ...row, kind: 'post', target_type: 'deck', target_id: 'deck-7', comment_id: 'deck-7', excerpt: null }))
      .toMatchObject({ kind: 'post', target: 'deck', href: '/decks/deck-7', excerpt: '화상 덱' })
    expect(toNotification({ ...row, kind: 'post', target_type: 'plan', target_id: 'plan-7', comment_id: 'plan-7', excerpt: null }).href)
      .toBe('/planner/community/plan-7')
  })
})

describe('REQ-COMMUNITY-093 the feed function follows the notification settings', () => {
  const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261025150000_follow_notifications.sql'), 'utf8')
  it('REQ-COMMUNITY-093 each kind is read only while its switch is on', () => {
    expect(sql).toMatch(/me\.notify_comments/)
    expect(sql).toMatch(/me\.notify_follows/)
    expect(sql).toMatch(/me\.notify_posts/)
  })
  it('REQ-COMMUNITY-092 posts count only after the follow, from public authors that are not suspended', () => {
    expect(sql).toMatch(/created_at > f\.created_at/)
    expect(sql).toMatch(/public_profile and not \w+\.suspended/)
  })
})
