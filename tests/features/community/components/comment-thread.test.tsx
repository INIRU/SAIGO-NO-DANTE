import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({ default: () => <span data-avatar /> }))
vi.mock('@/components/ui/RelativeTime', () => ({ default: () => <time /> }))

import CommentThread, { type ThreadItem } from '@/features/community/components/CommentThread'

const item = (id: string, parent_id: string | null, minute: number, name: string): ThreadItem =>
  ({ id, parent_id, created_at: `2026-10-20T10:0${minute}:00Z`, content: `text-${id}`, name, avatar: null })
const items = [item('a', null, 0, '루트'), item('b', 'a', 1, '하나'), item('c', 'b', 2, '둘'), item('d', 'c', 3, '셋')]
const render = (replyingTo: string | null = null) => renderToStaticMarkup(
  <CommentThread items={items} canReply replyingTo={replyingTo} onReply={() => {}} replyForm={<form data-reply-form />} />,
)

it('shows a reply to a reply under it, one step in at most, with the name it answers', () => {
  const html = render()
  expect(html.indexOf('text-b')).toBeLessThan(html.indexOf('text-c'))
  expect(html.indexOf('text-c')).toBeLessThan(html.indexOf('text-d'))
  expect(html.split('data-depth="1"').length - 1).toBe(1)
  // c and d (depth 2 and 3) share the same step, so a long chain does not keep moving right.
  expect(html.split('data-depth="2"').length - 1).toBe(2)
  expect(html).toContain('@하나')
  expect(html).toContain('@둘')
  expect(html).not.toContain('@루트')
})

it('every comment can be answered, and the reply box opens right under the one being answered', () => {
  const html = render('c')
  expect(html.split('>reply<').length - 1).toBe(4)
  const form = html.indexOf('data-reply-form')
  expect(form).toBeGreaterThan(html.indexOf('text-c'))
  expect(form).toBeLessThan(html.indexOf('text-d'))
})
