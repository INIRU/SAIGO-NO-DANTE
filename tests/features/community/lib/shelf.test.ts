import { expect, it } from 'vitest'
import { pickShelf, rankPopular } from '@/features/community/lib/shelf'

const post = (id: string) => ({ id })
const ids = (posts: { id: string }[]) => posts.map(p => p.id)
const visitors = (counts: Record<string, number>) => new Map(Object.entries(counts))

it('REQ-HOME-007 keeps the order the server ranked the popular posts in', () => {
  const shelf = pickShelf({ popular: [post('b'), post('a'), post('c'), post('d')], recent: [post('r')] })
  expect(shelf).toEqual({ popular: true, posts: [post('b'), post('a'), post('c')] })
})

it('falls back to the newest posts when fewer than three were visited', () => {
  expect(pickShelf({ popular: [post('a')], recent: [post('x'), post('y'), post('z'), post('w')] }))
    .toEqual({ popular: false, posts: [post('x'), post('y'), post('z')] })
})

it('REQ-COMMUNITY-033 ranks by visitors, then votes, then newest, then id', () => {
  const posts = [
    { id: 'id-b', vote_count: 1, created_at: '2026-10-01T00:00:00+00:00' },
    { id: 'old', vote_count: 1, created_at: '2026-09-01T00:00:00+00:00' },
    { id: 'voted', vote_count: 5, created_at: '2026-08-01T00:00:00+00:00' },
    { id: 'id-a', vote_count: 1, created_at: '2026-10-01T00:00:00+00:00' },
    { id: 'top', vote_count: 0, created_at: '2026-01-01T00:00:00+00:00' },
  ]
  const ranked = rankPopular(posts, visitors({ top: 9, voted: 3, 'id-a': 3, 'id-b': 3, old: 3 }))
  expect(ids(ranked)).toEqual(['top', 'voted', 'id-a', 'id-b', 'old'])
  // The same posts in another order (PostgREST .in() keeps no order) rank the same.
  expect(ids(rankPopular([...posts].reverse(), visitors({ top: 9, voted: 3, 'id-a': 3, 'id-b': 3, old: 3 })))).toEqual(ids(ranked))
})

it('REQ-COMMUNITY-034 fills six places from the posts that still exist', () => {
  // Twelve ranked ids, four of them deleted (no row came back).
  const counts = visitors(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`p${i + 1}`, 100 - i])))
  const existing = ['p12', 'p2', 'p3', 'p5', 'p6', 'p8', 'p9', 'p11'].map(post)
  expect(ids(rankPopular(existing, counts))).toEqual(['p2', 'p3', 'p5', 'p6', 'p8', 'p9'])
})

it('REQ-COMMUNITY-035 keeps two posts per author and fills the gap from the next ranks', () => {
  const posts = [
    { id: 'a1', user_id: 'A' }, { id: 'a2', user_id: 'A' }, { id: 'a3', user_id: 'A' },
    { id: 'g1', guest_tag: 'ab12' }, { id: 'g2', guest_tag: 'ab12' }, { id: 'g3', guest_tag: 'ab12' },
    { id: 'n1' }, { id: 'n2', user_id: null, guest_tag: null }, { id: 'n3' },
  ]
  const counts = visitors({ a1: 90, a2: 80, a3: 70, g1: 60, g2: 50, g3: 40, n1: 30, n2: 20, n3: 10 })
  // The third post of A and of the guest give way; posts with no known author are never limited.
  expect(ids(rankPopular(posts, counts))).toEqual(['a1', 'a2', 'g1', 'g2', 'n1', 'n2'])
})
