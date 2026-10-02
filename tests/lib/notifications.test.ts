import { describe, expect, it } from 'vitest'
import { freshForToast, toNotification, type Notification, type NotificationRow } from '@/lib/notifications'

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
