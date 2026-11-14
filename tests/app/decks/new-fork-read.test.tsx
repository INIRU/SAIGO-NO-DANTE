import { isValidElement, type ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DbError } from '../../helpers/fake-db'

const state = vi.hoisted(() => ({ reply: { data: null, error: null } as { data: unknown; error: DbError | null } }))

vi.mock('next-intl/server', () => ({ getTranslations: async () => () => '' }))
vi.mock('@/lib/seo/metadata', () => ({ pageMetadata: () => ({}) }))
vi.mock('@/features/decks/server', () => ({ fetchDeckBuilderData: async () => ({ sinners: [], identities: [], egos: [], skills: [], passives: [], egoGifts: [] }) }))
vi.mock('@/features/decks', () => ({ buildEditMode: () => ({ identitySlotIds: [], gacksungSlots: [], upties: [], skillDistribution: [], formationOrder: [], egoSlotIds: [] }) }))
vi.mock('@/app/[lang]/decks/new/DeckBuilderWrapper', () => ({ default: function DeckBuilderWrapper() { return null } }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: async () => state.reply }) }) }) }),
  }),
}))

import NewDeckPage from '@/app/[lang]/decks/new/page'

const render = (fork?: string) => NewDeckPage({ params: Promise.resolve({ lang: 'ko' }), searchParams: Promise.resolve({ fork }) })
const forkMode = (node: unknown) => isValidElement(node) ? (node as ReactElement<{ forkMode?: unknown }>).props.forkMode : undefined

beforeEach(() => { state.reply = { data: null, error: null } })

describe('new deck page with ?fork=', () => {
  it('opens the builder with the deck to fork', async () => {
    state.reply = { data: { title: 'T', description: null, tags: null, content_type: '없음', deck_identities: [], deck_egos: [] }, error: null }
    expect(forkMode(await render('d1'))).toMatchObject({ forkedFrom: 'd1', title: 'T' })
  })

  it('a deck that is not there opens the empty builder', async () => {
    state.reply = { data: null, error: { code: 'PGRST116', message: 'The result contains 0 rows' } }
    expect(forkMode(await render('d1'))).toBeUndefined()
  })

  it('a fork id that is not a uuid opens the empty builder', async () => {
    state.reply = { data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid' } }
    expect(forkMode(await render('nope'))).toBeUndefined()
  })

  it('a failed read throws instead of quietly opening the empty builder', async () => {
    state.reply = { data: null, error: { code: '57P01', message: 'terminating connection' } }
    await expect(render('d1')).rejects.toMatchObject({ message: 'terminating connection' })
  })
})
