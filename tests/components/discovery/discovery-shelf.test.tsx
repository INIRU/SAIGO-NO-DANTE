import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ko from '@/messages/ko.json'
import en from '@/messages/en.json'
import ja from '@/messages/ja.json'

type Feed = { recent: { id: string }[]; updated: { id: string }[]; popular: { id: string }[]; identities: { id: string }[]; counts?: unknown[] }
const state = vi.hoisted(() => ({ swr: {} as { data?: unknown; error?: Error }, options: undefined as unknown }))

vi.mock('swr', () => ({ default: (_key: string, _fetcher: unknown, options: unknown) => { state.options = options; return state.swr } }))
vi.mock('next-intl', () => ({ useLocale: () => 'ko', useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/components/discovery/RisingShelf', () => ({ default: () => null }))
vi.mock('@/components/discovery/ForYou', () => ({ default: () => <section data-for-you />, OwnedLink: () => null }))
vi.mock('@/components/decks/DeckCard', () => ({ default: ({ deck }: { deck: { id: string } }) => <div data-card={deck.id} /> }))
vi.mock('@/components/planner/PlanCard', () => ({ default: ({ plan }: { plan: { id: string } }) => <div data-card={plan.id} /> }))
vi.mock('@/components/sinners/IdentityCard', () => ({ default: () => <div data-identity /> }))

import DiscoveryShelf from '@/components/discovery/DiscoveryShelf'

const posts = (...ids: string[]) => ids.map(id => ({ id }))
const render = (data: Feed, kind: 'deck' | 'planner' = 'deck') => {
  state.swr = { data }
  return renderToStaticMarkup(<DiscoveryShelf kind={kind} onBrowse={() => {}} />)
}
const count = (html: string, needle: string) => html.split(needle).length - 1
/** One shelf's markup: from its opening tag to the next shelf or the end. */
const shelf = (html: string, key: string) => html.split(`data-shelf="${key}"`)[1]?.split('data-shelf="')[0] ?? ''
const full: Feed = { recent: posts('r1'), updated: posts('u1'), popular: posts('p1'), identities: posts('i1') }

beforeEach(() => { state.swr = {}; state.options = undefined })

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
  })

  it('REQ-COMMUNITY-032 shows no tabs on a board without posts', () => {
    const html = render({ recent: [], updated: [], popular: [], identities: [] })
    expect(html).toContain('data-discovery-empty')
    expect(html).not.toContain('aria-pressed')
  })
})

it('REQ-COMMUNITY-033 shows the popular posts in the order the server sent', () => {
  const counts = [{ kind: 'deck', entity_id: 'p2', visitors: 9 }, { kind: 'deck', entity_id: 'p1', visitors: 1 }]
  const html = shelf(render({ ...full, popular: posts('p1', 'p2'), counts }), 'popular')
  expect(html.indexOf('data-card="p1"')).toBeGreaterThan(-1)
  expect(html.indexOf('data-card="p1"')).toBeLessThan(html.indexOf('data-card="p2"'))
})

describe('REQ-COMMUNITY-036 shelf titles', () => {
  it('REQ-COMMUNITY-036 reads every shelf title from the messages', () => {
    const decks = render(full)
    for (const key of ['recentDecks', 'updatedDecks', 'popularDecks', 'popularIdentities']) expect(decks).toContain(`>${key}</h2>`)
    const plans = render(full, 'planner')
    for (const key of ['recentPlans', 'updatedPlans', 'popularPlans', 'popularIdentities']) expect(plans).toContain(`>${key}</h2>`)
  })

  it('REQ-COMMUNITY-036 keeps the Korean wording and one tone across the three frequently visited shelves', () => {
    type Titles = Record<'recentDecks' | 'recentPlans' | 'updatedDecks' | 'updatedPlans' | 'popularDecks' | 'popularPlans' | 'popularIdentities' | 'rising', string>
    const titles = (messages: unknown) => (messages as { discoveryShelf: Titles }).discoveryShelf
    expect(titles(ko)).toEqual({
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
