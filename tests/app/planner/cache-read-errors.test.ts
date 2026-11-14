import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ failTable: null as string | null, sentry: vi.fn() }))

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.sentry }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))
vi.mock('@/lib/i18n/navigation', () => ({ Link: () => null, useRouter: () => ({}), usePathname: () => '/' }))
vi.mock('@/features/community/server', () => ({ withPostAuthors: async (rows: unknown[]) => rows, loadSeriesOfPost: async () => null }))
vi.mock('@/app/[lang]/planner/PlannerClient', () => ({ default: () => null }))
vi.mock('@/app/[lang]/planner/run/RunWrapper', () => ({ default: () => null }))
vi.mock('@/app/[lang]/planner/community/[id]/PlanDetailClient', () => ({ default: () => null }))
vi.mock('@/components/providers/StaticQueryAdapter', () => ({ default: () => null }))

/** Every table answers with an empty list, except mocks.failTable, which answers with a DB error. */
function fakeClient() {
  return {
    schema: () => ({
      from: (table: string) => {
        const failed = table === mocks.failTable
        const result = failed ? { data: null, error: { message: 'db down' } } : { data: table === 'md_plans' ? { id: 'p', floor_plan: [], deck: [] } : [], error: null }
        const chain: Record<string, unknown> = { then: (resolve: (value: typeof result) => unknown) => resolve(result) }
        for (const method of ['select', 'order', 'range', 'eq', 'in', 'gte', 'overlaps', 'limit']) chain[method] = () => chain
        chain.maybeSingle = () => Promise.resolve(failed ? result : { data: table === 'md_plans' ? result.data : null, error: null })
        return chain
      },
    }),
  }
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: fakeClient }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeClient() }))

import PlannerPage from '@/app/[lang]/planner/page'
import RunPage from '@/app/[lang]/planner/run/page'
import PlanDetailPage, { generateMetadata } from '@/app/[lang]/planner/community/[id]/page'

const params = Promise.resolve({ lang: 'ko' })
const planParams = Promise.resolve({ lang: 'ko', id: 'p' })

describe('planner cache reads', () => {
  beforeEach(() => {
    mocks.failTable = null
    mocks.sentry.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('planner page throws instead of caching an empty result, and still reports to Sentry', async () => {
    mocks.failTable = 'ego_gifts'
    await expect(PlannerPage({ params })).rejects.toThrow()
    expect(mocks.sentry).toHaveBeenCalled()
  })

  it('planner page throws when the paged passives read fails', async () => {
    mocks.failTable = 'passives'
    await expect(PlannerPage({ params })).rejects.toThrow()
  })

  it('run page throws instead of caching an empty result', async () => {
    mocks.failTable = 'md_events'
    await expect(RunPage({ params })).rejects.toThrow()
  })

  it('plan detail game data throws instead of caching an empty result', async () => {
    mocks.failTable = 'ego_gift_themes'
    await expect(PlanDetailPage({ params: planParams })).rejects.toThrow('db down')
  })

  it('a plan read error throws and is not a not-found', async () => {
    mocks.failTable = 'md_plans'
    await expect(generateMetadata({ params: planParams })).rejects.toThrow('db down')
    await expect(PlanDetailPage({ params: planParams })).rejects.toThrow('db down')
  })
})
