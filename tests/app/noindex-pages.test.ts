import type { Metadata } from 'next'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
vi.mock('next/cache', async original => ({ ...(await original<typeof import('next/cache')>()), cacheLife: () => {}, cacheTag: () => {} }))
vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({ findOrCreateSupabaseUser: async () => null }))
vi.mock('@/lib/decks/builder-data', () => ({ fetchDeckBuilderData: async () => ({}) }))
vi.mock('@/lib/data/legal', () => ({ getLegalDoc: async () => null }))
vi.mock('@/lib/db/queries', () => ({ getLatestIdentities: async () => [] }))
// Only the metadata is under test: the screens these routes render are left out.
vi.mock('@/app/[lang]/login/LoginClient', () => ({ default: () => null }))
vi.mock('@/app/[lang]/mypage/MypageClient', () => ({ default: () => null, MypageSkeleton: () => null }))
vi.mock('@/app/[lang]/decks/[id]/edit/EditWrapper', () => ({ default: () => null }))
vi.mock('@/app/[lang]/friends/_components/ComposeClient', () => ({ default: () => null }))
vi.mock('@/app/[lang]/collection/_components/CollectionClient', () => ({ default: () => null }))
vi.mock('@/app/[lang]/friends/_components/FriendsClient', () => ({ default: () => null }))
vi.mock('@/app/[lang]/planner/PlannerClient', () => ({ default: () => null }))
vi.mock('@/features/tools/components/RandomClient', () => ({ default: () => null }))
vi.mock('@/features/admin/components/AdminNavigation', () => ({ default: () => null }))
vi.mock('@/components/providers/WithSectionMessages', () => ({ default: () => null }))
vi.mock('@/components/layout/RequestTimeRoute', () => ({ default: () => null }))
vi.mock('@/components/ui/PageError', () => ({ default: () => null }))

type RouteModule = { metadata?: Metadata; generateMetadata?: (props: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }) => Promise<Metadata> }

const metadataOf = async (route: RouteModule) =>
  route.metadata ?? route.generateMetadata?.({ params: Promise.resolve({ lang: 'ko', id: 'd1' }), searchParams: Promise.resolve({}) })

describe('REQ-SHARED-037 screens kept out of the index', () => {
  // robots.txt allows every path, so each of these has to say noindex itself.
  it.each([
    ['login', () => import('@/app/[lang]/login/page')],
    ['my page', () => import('@/app/[lang]/mypage/page')],
    ['maintenance notice', () => import('@/app/[lang]/maintenance/layout')],
    ['offline fallback', () => import('@/app/[lang]/offline/page')],
    ['deck editing', () => import('@/app/[lang]/decks/[id]/edit/page')],
    ['friend code writing', () => import('@/app/[lang]/friends/new/page')],
    ['admin', () => import('@/app/[lang]/admin/layout')],
    ['unknown address', () => import('@/app/[lang]/[...rest]/page')],
    ['404', () => import('@/app/[lang]/not-found')],
    ['collection', () => import('@/app/[lang]/collection/page')],
    ['friend code board', () => import('@/app/[lang]/friends/page')],
    ['planner editor', () => import('@/app/[lang]/planner/page')],
    ['planner run', () => import('@/app/[lang]/planner/run/page')],
    ['random', () => import('@/app/[lang]/random/page')],
  ] as [string, () => Promise<RouteModule>][])('REQ-SHARED-037 %s answers with noindex and its own title', async (_name, load) => {
    const metadata = await metadataOf(await load())
    expect(metadata?.robots).toMatchObject({ index: false })
    expect(metadata?.title).toBeTruthy()
  })
})
