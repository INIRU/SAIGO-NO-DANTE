import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

type Post = { id: string; updated_at?: string; created_at?: string }
type Feed = { recent: Post[]; updated: Post[]; popular: Post[]; identities: { id: string }[] }
const state = vi.hoisted(() => ({
  feed: {} as { data?: unknown; error?: Error },
  rising: undefined as unknown,
  options: undefined as unknown,
}))

// One mock for both reads of the shelf: the board feed and the rising feed (told apart by their address).
vi.mock('swr', () => ({
  default: (key: string, _fetcher: unknown, options: unknown) => {
    if (key.startsWith('/api/discovery/rising')) return { data: state.rising }
    state.options = options
    return state.feed
  },
}))
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string, values?: Record<string, string>) => (values ? `${key}:${JSON.stringify(values)}` : key) }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/components/discovery/ForYou', () => ({ default: () => <section data-for-you />, OwnedLink: () => <a data-owned-link /> }))
vi.mock('@/components/board/BoardCard', () => ({
  default: ({ post, lead }: { post: { id: string }; lead?: React.ReactNode }) => <article data-card={post.id}>{lead}</article>,
  RankPlate: ({ rank }: { rank: number }) => <span data-rank={rank} />,
}))
vi.mock('@/components/ui/IdentityFrameCard', () => ({ default: ({ identity }: { identity: { id: string } }) => <div data-identity={identity.id} /> }))
vi.mock('@/components/board/FormationRow', () => ({
  default: ({ post }: { post: { id: string } }) => <div data-row={post.id} />,
  DateLead: () => null,
  RankNumeral: ({ rank }: { rank: number }) => <span data-numeral={rank} />,
}))

import DiscoveryShelf from '@/components/discovery/DiscoveryShelf'

const posts = (...ids: string[]) => ids.map(id => ({ id, updated_at: '2026-10-20T00:00:00Z', created_at: '2026-10-20T00:00:00Z' }))
const render = (data: Feed | undefined, kind: 'deck' | 'planner' = 'deck') => {
  state.feed = { data }
  return renderToStaticMarkup(<DiscoveryShelf kind={kind} onBrowse={() => {}} />)
}
const count = (html: string, needle: string) => html.split(needle).length - 1
/** One shelf's markup: from its opening tag to the next shelf or the end. */
const shelf = (html: string, key: string) => html.split(`data-shelf="${key}"`)[1]?.split('data-shelf="')[0] ?? ''
const full: Feed = { recent: posts('r1', 'r2', 'r3', 'r4'), updated: posts('u1'), popular: posts('p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'), identities: [{ id: 'i1' }, { id: 'i2' }] }
const risingFeed = { posts: [{ post: { id: 'x1' }, rise: 4.4 }, { post: { id: 'x2' }, rise: 2.1 }], identities: [{ identity: { id: 'ri1' }, rise: 3.2 }] }

beforeEach(() => { state.feed = {}; state.rising = undefined; state.options = undefined })

describe('REQ-COMMUNITY-012 shelf order', () => {
  it('REQ-COMMUNITY-012 puts new posts first, then the frequently visited, rising, personal, identity and edited shelves', () => {
    state.rising = risingFeed
    const html = render(full)
    const at = (needle: string) => html.indexOf(needle)
    const order = ['data-owned-link', 'data-shelf="recent"', 'data-shelf="popular"', 'data-shelf="rising"', 'data-for-you', 'data-shelf="identities"', 'data-shelf="updated"']
    expect(order.map(at).every(index => index > -1)).toBe(true)
    expect(order.map(at)).toEqual([...order.map(at)].sort((a, b) => a - b))
  })

  it('REQ-COMMUNITY-012 leaves out the shelves a board has nothing for', () => {
    const html = render({ recent: [], updated: [], popular: posts('p1'), identities: [] })
    expect(html).not.toContain('data-shelf="recent"')
    expect(html).not.toContain('data-shelf="updated"')
    expect(html).not.toContain('data-shelf="identities"')
    expect(html).toContain('data-shelf="popular"')
  })
})

describe('REQ-COMMUNITY-032 period tabs', () => {
  it('REQ-COMMUNITY-032 keeps the previous period on screen while the next one loads', () => {
    const html = render(full)
    expect(state.options).toMatchObject({ keepPreviousData: true })
    expect(html).not.toContain('data-board-skeleton')
  })

  it('REQ-COMMUNITY-032 puts the tabs once, in the head of the frequently visited shelf', () => {
    const html = render(full)
    expect(count(html, 'aria-pressed')).toBe(3)
    expect(count(shelf(html, 'popular'), 'aria-pressed')).toBe(3)
  })

  it('REQ-COMMUNITY-032 keeps the head and its tabs when the period has no popular posts', () => {
    const html = render({ ...full, popular: [], identities: [] })
    expect(count(shelf(html, 'popular'), 'aria-pressed')).toBe(3)
    expect(shelf(html, 'popular')).toContain('popularDecks')
    expect(shelf(html, 'popular')).not.toContain('data-card')
  })

  it('REQ-COMMUNITY-032 shows no tabs on a board without posts', () => {
    const html = render({ recent: [], updated: [], popular: [], identities: [] })
    expect(html).toContain('data-discovery-empty')
    expect(html).not.toContain('aria-pressed')
  })

  it('REQ-COMMUNITY-032 shows the loading shapes only until the first answer', () => {
    const html = render(undefined)
    expect(html).toContain('data-discovery-shelf')
    expect(html).toContain('data-board-skeleton')
  })
})

describe('REQ-COMMUNITY-033 popular order', () => {
  it('REQ-COMMUNITY-033 shows the popular posts in the order the server sent, with their rank plates, six at most', () => {
    const html = shelf(render({ ...full, popular: posts('p2', 'p1', 'p3', 'p4', 'p5', 'p6', 'p7') }), 'popular')
    expect(html.indexOf('data-card="p2"')).toBeGreaterThan(-1)
    expect(html.indexOf('data-card="p2"')).toBeLessThan(html.indexOf('data-card="p1"'))
    expect(count(html, 'data-rank=')).toBe(6)
    expect(html).not.toContain('data-card="p7"')
  })
})

describe('REQ-COMMUNITY-080 shelf shapes', () => {
  it('REQ-COMMUNITY-080 lays each card shelf out as a phone rail and a wide grid with three new posts', () => {
    const html = render(full)
    const recent = shelf(html, 'recent')
    expect(count(recent, 'data-card=')).toBe(3)
    expect(recent).toContain('snap-x')
    expect(recent).toContain('md:grid-cols-2')
    expect(recent).toContain('xl:grid-cols-3')
    expect(shelf(html, 'popular')).toContain('snap-x')
  })

  it('REQ-COMMUNITY-080 shows the identities in one row of frame cards with their visit rank beneath', () => {
    const html = shelf(render(full), 'identities')
    expect(count(html, 'data-identity=')).toBe(2)
    expect(html).toContain('data-numeral="1"')
    expect(html).toContain('md:flex-1')
  })

  it('REQ-COMMUNITY-080 shows the recently edited posts as three rows and opens six on request', () => {
    const html = shelf(render({ ...full, updated: posts('u1', 'u2', 'u3', 'u4', 'u5') }), 'updated')
    expect(count(html, 'data-row=')).toBe(3)
    expect(html).toContain('more')
  })

  it('REQ-COMMUNITY-080 opens the full list from the new posts shelf', () => {
    expect(shelf(render(full), 'recent')).toContain('viewAll')
  })
})

describe('REQ-COMMUNITY-074 rising shelf', () => {
  it('REQ-COMMUNITY-074 shows rising posts as cards and rising identities as frame cards with their multiplier', () => {
    state.rising = risingFeed
    const html = shelf(render(full), 'rising')
    expect(html).toContain('data-card="x1"')
    expect(html).toContain('data-identity="ri1"')
    expect(html).toContain('×4.4')
    expect(html).toContain('×3.2')
  })

  it('REQ-COMMUNITY-085 holds the rising shelf with its loading shape until the feed answers, then swaps it for the shelf', () => {
    const loading = render(full)
    expect(loading).toContain('data-shelf-skeleton="rising"')
    expect(loading).toContain('data-identity-row-skeleton')
    expect(loading).not.toContain('data-shelf="rising"')
    state.rising = risingFeed
    const arrived = render(full)
    expect(arrived).not.toContain('data-shelf-skeleton="rising"')
    expect(arrived).toContain('data-shelf="rising"')
  })

  it('REQ-COMMUNITY-085 lets the loading shape go without a header when nothing is rising', () => {
    state.rising = { posts: [], identities: [] }
    const html = render(full)
    expect(html).not.toContain('data-shelf-skeleton="rising"')
    expect(html).not.toContain('data-shelf="rising"')
    expect(html).not.toContain('>rising</h2>')
  })

  it('REQ-COMMUNITY-074 draws nothing while loading, on a failed read, or with fewer than two rising', () => {
    expect(render(full)).not.toContain('data-shelf="rising"')
    state.rising = { posts: [{ post: { id: 'x1' }, rise: 2 }], identities: [] }
    expect(render(full)).not.toContain('data-shelf="rising"')
    state.rising = { posts: [], identities: [] }
    expect(render(full)).not.toContain('data-shelf="rising"')
  })
})

describe('REQ-COMMUNITY-036 shelf titles', () => {
  it('REQ-COMMUNITY-036 reads every shelf title from the messages', () => {
    state.rising = risingFeed
    const decks = render(full)
    for (const key of ['recentDecks', 'updatedDecks', 'popularDecks', 'popularIdentities', 'rising']) expect(decks).toContain(`>${key}</h2>`)
    const plans = render(full, 'planner')
    for (const key of ['recentPlans', 'updatedPlans', 'popularPlans', 'popularIdentities', 'rising']) expect(plans).toContain(`>${key}</h2>`)
  })

  it('REQ-COMMUNITY-036 draws the shelf titles in gold', () => {
    expect(render(full)).toContain('text-[var(--gold)]')
  })

  it('REQ-COMMUNITY-036 keeps the Korean wording and one tone across the three frequently visited shelves', () => {
    type Titles = Record<'recentDecks' | 'recentPlans' | 'updatedDecks' | 'updatedPlans' | 'popularDecks' | 'popularPlans' | 'popularIdentities' | 'rising', string>
    const titles = (messages: unknown) => (messages as { discoveryShelf: Titles }).discoveryShelf
    expect(titles(ko)).toMatchObject({
      recentDecks: '새로 올라온 덱', recentPlans: '새로 올라온 플랜',
      updatedDecks: '최근 수정된 덱', updatedPlans: '최근 수정된 플랜',
      popularDecks: '관리자분들이 자주 찾는 덱', popularPlans: '관리자분들이 자주 찾는 플랜', popularIdentities: '관리자분들이 자주 찾는 인격',
      rising: '지금 뜨는',
    })
    const popular = (t: Titles) => [t.popularDecks, t.popularPlans, t.popularIdentities]
    // The short, subjectless form the deck and plan shelves already used: the longer one wraps on a 390px phone.
    expect(popular(titles(ja))).toEqual(['よく読まれているデッキ', 'よく読まれているプラン', 'よく見られている人格'])
    expect(popular(titles(en))).toEqual(['Frequently visited decks', 'Frequently visited plans', 'Frequently visited identities'])
  })
})
