import { beforeEach, describe, expect, it, vi } from 'vitest'

// A read that fails inside 'use cache' must throw, or the empty result is stored for good.
const state = vi.hoisted(() => ({ failTable: '' as string, sinner: { id: 'faust', name: 'Faust' } as unknown }))

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('next/dynamic', () => ({ default: () => function Stub() { return null } }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/db/queries', () => ({ getSinnerById: async () => state.sinner }))
vi.mock('@/lib/db/game-text-refs', () => ({ getGameTextRefNames: async () => ({}) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: (table: string) => {
        const result = table === state.failTable ? { data: null, error: { message: `${table} down` } } : { data: [], error: null }
        const chain: Record<string, unknown> = { then: (resolve: (value: typeof result) => unknown) => resolve(result) }
        for (const method of ['select', 'order', 'range', 'eq']) chain[method] = () => chain
        return chain
      },
    }),
  }),
}))
vi.mock('@/app/[lang]/mirror-dungeon/_components/MirrorDungeonClient', () => ({ default: function MirrorDungeonClient() { return null } }))
vi.mock('@/features/mirror-dungeon/components/MirrorDungeonSkeleton', () => ({ default: function MirrorDungeonSkeleton() { return null } }))
vi.mock('@/components/providers/StaticQueryAdapter', () => ({ default: function StaticQueryAdapter() { return null } }))
vi.mock('@/app/[lang]/keywords/_components/KeywordsClient', () => ({ default: function KeywordsClient() { return null } }))
vi.mock('@/app/[lang]/keywords/loading', () => ({ default: function KeywordsLoading() { return null } }))

beforeEach(() => {
  state.failTable = ''
  state.sinner = { id: 'faust', name: 'Faust' }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sinner page', () => {
  const run = async () => {
    const { default: Page } = await import('@/app/[lang]/sinners/[slug]/page')
    return Page({ params: Promise.resolve({ lang: 'ko', slug: 'faust' }) })
  }

  it.each(['identities', 'ego'])('throws when the %s read fails', async table => {
    state.failTable = table
    await expect(run()).rejects.toThrow(`${table} down`)
  })

  it('still renders when every read works', async () => {
    await expect(run()).resolves.toBeTruthy()
  })
})

describe('mirror dungeon page', () => {
  it.each(['ego_gifts', 'ego_gift_recipes', 'ego_gift_themes', 'md_events', 'md_event_choices'])('throws when the %s read fails', async table => {
    state.failTable = table
    const { default: Page } = await import('@/app/[lang]/mirror-dungeon/page')
    await expect(Page({ params: Promise.resolve({ lang: 'ko' }) })).rejects.toThrow(`${table} down`)
  })
})

describe('keywords page', () => {
  // The page's own try/catch retries once without refs, so a failing table throws out of both attempts.
  it.each(['keyword_meta', 'identities', 'sinners', 'ego_gifts', 'ego'])('throws when the %s read fails', async table => {
    state.failTable = table
    const { default: Page } = await import('@/app/[lang]/keywords/page')
    await expect(Page()).rejects.toThrow(`${table} down`)
  })
})
