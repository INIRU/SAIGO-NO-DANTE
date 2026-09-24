import { expect, it } from 'vitest'
import { isUnread, sortInbox, statusAfterMessage, statusOnReopen } from '@/lib/support'
it('waits on the admin after a user message and on the user after an answer', () => {
  expect(statusAfterMessage('user')).toBe('open')
  expect(statusAfterMessage('admin')).toBe('answered')
})
it('reopens to whoever owes the next reply', () => {
  const at = '2026-09-24T01:00:00.000Z'
  expect(statusOnReopen({ last_message_at: at, last_admin_message_at: at })).toBe('answered')
  expect(statusOnReopen({ last_message_at: '2026-09-24T02:00:00Z', last_admin_message_at: at })).toBe('open')
  expect(statusOnReopen({ last_message_at: at, last_admin_message_at: null })).toBe('open')
})
it('flags an answer the user has not opened, regardless of timestamp precision', () => {
  expect(isUnread({ last_admin_message_at: null, user_last_read_at: null })).toBe(false)
  expect(isUnread({ last_admin_message_at: '2026-09-24T01:00:00+00:00', user_last_read_at: null })).toBe(true)
  expect(
    isUnread({ last_admin_message_at: '2026-09-24T01:00:00.5+00:00', user_last_read_at: '2026-09-24T01:00:00.123456+00:00' }),
  ).toBe(true)
  expect(
    isUnread({ last_admin_message_at: '2026-09-24T01:00:00.1+00:00', user_last_read_at: '2026-09-24T01:00:00.123456+00:00' }),
  ).toBe(false)
})
it('puts unanswered threads first, newest activity next', () => {
  const row = (id: string, status: 'open' | 'answered' | 'closed', last: string) => ({
    id,
    status,
    last_message_at: last,
    created_at: '2026-09-01T00:00:00Z',
  })
  const sorted = sortInbox([
    row('old-answered', 'answered', '2026-09-20T00:00:00Z'),
    row('new-closed', 'closed', '2026-09-23T00:00:00Z'),
    row('old-open', 'open', '2026-09-10T00:00:00Z'),
    row('new-open', 'open', '2026-09-22T00:00:00Z'),
  ])
  expect(sorted.map((r) => r.id)).toEqual(['new-open', 'old-open', 'new-closed', 'old-answered'])
})
