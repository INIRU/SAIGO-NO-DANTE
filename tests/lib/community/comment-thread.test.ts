import { expect, it } from 'vitest'
import { commentThreads, descendantIds } from '@/lib/community/comment-thread'

const c = (id: string, parent_id: string | null, minute: number) => ({ id, parent_id, created_at: `2026-10-20T10:${String(minute).padStart(2, '0')}:00Z` })
// a ← b ← d ← e, a ← c (later than b), f alone; g answers a comment that is gone.
const all = [c('a', null, 0), c('b', 'a', 1), c('c', 'a', 2), c('d', 'b', 3), c('e', 'd', 4), c('f', null, 5), c('g', 'x', 6)]

it('lists every reply under its root, each right after the one it answers, with its depth and the comment it answers', () => {
  const threads = commentThreads(all)
  expect(threads.map(t => t.root.id)).toEqual(['a', 'f', 'g'])
  expect(threads[0].replies.map(r => [r.comment.id, r.depth, r.parent?.id])).toEqual([['b', 1, 'a'], ['d', 2, 'b'], ['e', 3, 'd'], ['c', 1, 'a']])
  expect(threads[1].replies).toEqual([])
})

it('counts a comment\'s whole subtree, so deleting it removes and uncounts every reply below', () => {
  expect([...descendantIds(all, 'a')].sort()).toEqual(['b', 'c', 'd', 'e'])
  expect([...descendantIds(all, 'd')]).toEqual(['e'])
  expect(descendantIds(all, 'f').size).toBe(0)
})
