import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ status: 'authenticated', swr: {} as { data?: { items: { id: string }[] }; error?: Error } }))

vi.mock('swr', () => ({ default: (key: string | null) => (key ? state.swr : {}) }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: state.status }) }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('@/features/catalog/hooks/useOwnedIdentities', () => ({ useOwnedIdentities: () => null }))
vi.mock('@/features/decks/components/DeckCard', () => ({ default: ({ deck }: { deck: { id: string } }) => <div data-card>{deck.id}</div> }))
vi.mock('@/features/planner/components/PlanCard', () => ({ default: ({ plan }: { plan: { id: string } }) => <div data-card>{plan.id}</div> }))

import ForYou from '@/features/community/components/ForYou'

const render = () => renderToStaticMarkup(<ForYou kind="planner" personal />)
const count = (html: string, needle: string) => html.split(needle).length - 1

beforeEach(() => { state.status = 'authenticated'; state.swr = {} })

describe('REQ-COMMUNITY-012 personal shelf', () => {
  it('REQ-COMMUNITY-012 holds the place with the title and three card skeletons while choosing', () => {
    const html = render()
    expect(html).toContain('data-phase="choosing"')
    expect(html).toContain('aria-busy="true"')
    // The real title is there from the start; the hint keeps its box but is hidden under a bone.
    expect(html).toContain('plansTitle')
    expect(html).toMatch(/<span data-hint="true" class="invisible" aria-hidden="true">hint<\/span>/)
    expect(count(html, 'data-card-skeleton')).toBe(3)
    expect(count(html, 'data-card="true"')).toBe(0)
  })

  it('REQ-COMMUNITY-012 the placeholder puts no block element inside a paragraph (browsers close such a <p>, which breaks hydration)', () => {
    const html = render()
    expect(html).toContain('data-skeleton')
    expect(html).not.toMatch(/<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<div\b/)
  })

  it('REQ-COMMUNITY-012 shows cached picks at once without the reveal', () => {
    state.swr = { data: { items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] } }
    const html = render()
    expect(html).toContain('data-phase="ready"')
    expect(html).toContain('data-reveal="instant"')
    expect(html).toMatch(/<span data-hint="true" class="" aria-hidden="false">hint<\/span>/)
    expect(count(html, 'data-card="true"')).toBe(3)
    expect(html).not.toContain('data-card-skeleton')
  })

  it('REQ-COMMUNITY-012 draws nothing for a logged-out visitor', () => {
    state.status = 'unauthenticated'
    expect(render()).toBe('')
  })

  it('REQ-COMMUNITY-012 draws nothing when the cached answer has no picks (no skeleton was shown, nothing to fold)', () => {
    state.swr = { data: { items: [] } }
    expect(render()).toBe('')
  })
})
