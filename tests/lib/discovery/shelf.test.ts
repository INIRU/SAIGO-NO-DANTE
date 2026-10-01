import { expect, it } from 'vitest'
import { pickShelf, shelfOrder } from '@/lib/discovery/shelf'

const post = (id: string) => ({ id })

it('orders the week\'s visited posts by visitors', () => {
  const shelf = pickShelf({
    counts: [{ kind: 'deck', entity_id: 'b', visitors: 9 }, { kind: 'deck', entity_id: 'a', visitors: 2 }, { kind: 'planner', entity_id: 'c', visitors: 99 }],
    popular: [post('a'), post('b'), post('c'), post('d')],
    recent: [post('r')],
  }, 'deck')
  expect(shelf).toEqual({ popular: true, posts: [post('b'), post('a'), post('c')] })
})

it('falls back to the newest posts when fewer than three were visited', () => {
  expect(pickShelf({ counts: [], popular: [post('a')], recent: [post('x'), post('y'), post('z'), post('w')] }, 'planner'))
    .toEqual({ popular: false, posts: [post('x'), post('y'), post('z')] })
})

it('REQ-COMMUNITY-012 puts the personal shelf after the new posts, or first when there are none', () => {
  expect(shelfOrder(['recent', 'updated', 'popular'])).toEqual(['recent', 'forYou', 'updated', 'popular'])
  expect(shelfOrder(['updated', 'popular'])).toEqual(['forYou', 'updated', 'popular'])
  expect(shelfOrder([])).toEqual(['forYou'])
})
