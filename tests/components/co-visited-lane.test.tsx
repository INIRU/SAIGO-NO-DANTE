import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const state = vi.hoisted(() => ({ posts: [] as { id: string }[], fail: false }))

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => [namespace, key].filter(Boolean).join('.'),
  useLocale: () => 'ko',
}))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => `server.${key}` }))
vi.mock('@/features/community/server/co-visited', () => ({
  getCoVisited: async () => { if (state.fail) throw new Error('missing'); return state.posts },
}))
vi.mock('@/components/decks/DeckCard', () => ({ default: ({ deck }: { deck: { id: string } }) => <span data-deck>{deck.id}</span> }))
vi.mock('@/components/planner/PlanCard', () => ({ default: ({ plan }: { plan: { id: string } }) => <span data-plan>{plan.id}</span> }))

import CoVisitedLane from '@/features/community/components/CoVisitedLane'

const render = async (kind: 'deck' | 'planner') => {
  const element = await CoVisitedLane({ kind, id: 'me', lang: 'ko', exclude: [] })
  return element ? renderToStaticMarkup(element) : ''
}

beforeEach(() => { state.posts = [{ id: 'a' }, { id: 'b' }]; state.fail = false })

describe('CoVisitedLane', () => {
  it('REQ-COMMUNITY-069 shows the title alone above deck cards on a deck page', async () => {
    const html = await render('deck')
    expect(html).toContain('server.coVisited')
    expect(html).toContain('<span data-deck="true">a</span>')
    expect(html).not.toContain('data-plan')
    expect(html).not.toContain('<p')
  })

  it('REQ-COMMUNITY-069 shows plan cards on a plan page', async () => {
    expect(await render('planner')).toContain('<span data-plan="true">b</span>')
  })

  it('REQ-COMMUNITY-071 draws nothing when there is nothing to show or the read fails', async () => {
    state.posts = []
    expect(await render('deck')).toBe('')
    state.posts = [{ id: 'a' }]
    state.fail = true
    expect(await render('deck')).toBe('')
  })
})
