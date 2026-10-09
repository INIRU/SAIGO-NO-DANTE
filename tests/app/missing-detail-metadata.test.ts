import { describe, expect, it, vi } from 'vitest'

// Every lookup finds nothing: the deck or plan was deleted, or the id never existed.
const missing = { data: null, error: null }
const query = (): Record<string, unknown> => {
  const chain: Record<string, unknown> = {}
  for (const method of ['schema', 'from', 'select', 'eq']) chain[method] = () => chain
  chain.single = async () => missing
  chain.maybeSingle = async () => missing
  return chain
}
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: query }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => query() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: query }))
vi.mock('next/server', async original => ({ ...(await original<typeof import('next/server')>()), connection: async () => {} }))
vi.mock('next/cache', async original => ({ ...(await original<typeof import('next/cache')>()), cacheLife: () => {}, cacheTag: () => {} }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
// Only generateMetadata is under test: the screens these pages render are left out.
vi.mock('@/lib/i18n/navigation', () => ({ Link: () => null }))
vi.mock('@/app/[lang]/decks/[id]/DeckDetailClient', () => ({ default: () => null }))
vi.mock('@/components/decks/DeckDetailSkeleton', () => ({ default: () => null }))
vi.mock('@/app/[lang]/planner/community/[id]/PlanDetailClient', () => ({ default: () => null }))
vi.mock('@/app/[lang]/planner/community/[id]/PlanDetailSkeleton', () => ({ default: () => null }))

const params = Promise.resolve({ lang: 'ko', id: '00000000-0000-0000-0000-000000000000' })

describe('REQ-SHARED-035 a missing post is not indexed', () => {
  it('REQ-SHARED-035 a missing deck answers with noindex', async () => {
    const { generateMetadata } = await import('@/app/[lang]/decks/[id]/page')
    expect(await generateMetadata({ params })).toMatchObject({ title: '덱을 찾을 수 없습니다', robots: { index: false } })
  })

  it('REQ-SHARED-035 a missing plan answers with noindex', async () => {
    const { generateMetadata } = await import('@/app/[lang]/planner/community/[id]/page')
    expect(await generateMetadata({ params })).toMatchObject({ title: 'notFoundTitle', robots: { index: false } })
  })
})
