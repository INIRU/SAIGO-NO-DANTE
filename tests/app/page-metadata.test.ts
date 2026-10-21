import type { Metadata } from 'next'
import { describe, expect, it, vi } from 'vitest'
import { translations } from '@/lib/i18n/translations'

// The real catalog answers, so the copy each language gets is what is under test.
vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl')
  const catalogs: Record<string, unknown> = {
    ko: (await import('@/messages/ko.json')).default,
    en: (await import('@/messages/en.json')).default,
    ja: (await import('@/messages/ja.json')).default,
  }
  return {
    setRequestLocale: () => {},
    getTranslations: async ({ locale, namespace }: { locale: string; namespace?: string }) =>
      createTranslator({ locale, messages: catalogs[locale] as never, namespace: namespace as never }),
  }
})
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('next/cache', async original => ({ ...(await original<typeof import('next/cache')>()), cacheLife: () => {}, cacheTag: () => {} }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
// Only generateMetadata is under test: the screens and the data they read are left out.
for (const screen of [
  '@/app/[lang]/decks/DecksClient', '@/app/[lang]/decks/new/DeckBuilderWrapper', '@/app/[lang]/planner/PlannerClient',
  '@/app/[lang]/planner/community/CommunityClient', '@/app/[lang]/planner/run/RunWrapper', '@/app/[lang]/mirror-dungeon/MirrorDungeonClient',
  '@/app/[lang]/keywords/KeywordsClient', '@/app/[lang]/keywords/loading', '@/app/[lang]/sinners/SinnersInteractive',
  '@/app/[lang]/sinners/identities/IdentityBrowserClient', '@/app/[lang]/sinners/ego/EGOBrowserClient', '@/app/[lang]/random/RandomClient',
  '@/app/[lang]/collection/CollectionClient', '@/app/[lang]/friends/FriendsClient', '@/app/[lang]/announcements/AnnouncementsClient',
  '@/app/[lang]/developers/DeveloperConsole', '@/components/tools/ExperienceCalculator', '@/components/tools/LunacyCalendar',
  '@/components/tools/DamageCalculator', '@/components/motion/SkillMotionViewer', '@/components/news/NewsCalendar', '@/components/support/SupportDesk', '@/components/support/SupportSkeleton',
  '@/components/friends/FriendsSkeleton', '@/components/planner/PlannerSkeleton', '@/components/mirror-dungeon/MirrorDungeonSkeleton',
  '@/components/sinners/BrowserSkeleton', '@/components/sinners/SinnerCard', '@/components/discovery/BoardHeader', '@/components/discovery/BoardSkeleton',
  '@/components/providers/StaticQueryAdapter', '@/components/layout/RequestTimeRoute', '@/components/legal/LegalDocument', '@/components/ui/PageHeader',
  '@/lib/db/queries', '@/lib/db/collection', '@/lib/db/announcements', '@/lib/db/game-text-refs', '@/lib/decks/builder-data', '@/lib/data/legal', '@/lib/news/data',
]) vi.doMock(screen, () => ({ default: () => null, PageHeaderSkeleton: () => null, BoardShelfSkeleton: () => null, FriendsSkeleton: () => null }))

type PageModule = { generateMetadata: (props: { params: Promise<{ lang: string }> }) => Promise<Metadata> }

/** Every indexable page with a fixed address, except the home page (whose metadata is the layout's) and /meta. */
const PAGES: [string, () => Promise<unknown>][] = [
  ['/sinners', () => import('@/app/[lang]/sinners/page')],
  ['/sinners/identities', () => import('@/app/[lang]/sinners/identities/page')],
  ['/sinners/ego', () => import('@/app/[lang]/sinners/ego/page')],
  ['/decks', () => import('@/app/[lang]/decks/page')],
  ['/decks/new', () => import('@/app/[lang]/decks/new/page')],
  ['/planner', () => import('@/app/[lang]/planner/page')],
  ['/planner/community', () => import('@/app/[lang]/planner/community/page')],
  ['/planner/run', () => import('@/app/[lang]/planner/run/page')],
  ['/mirror-dungeon', () => import('@/app/[lang]/mirror-dungeon/page')],
  ['/keywords', () => import('@/app/[lang]/keywords/page')],
  ['/tools/experience', () => import('@/app/[lang]/tools/experience/page')],
  ['/tools/lunacy', () => import('@/app/[lang]/tools/lunacy/page')],
  ['/tools/damage', () => import('@/app/[lang]/tools/damage/page')],
  ['/motion/skills', () => import('@/app/[lang]/motion/skills/page')],
  ['/random', () => import('@/app/[lang]/random/page')],
  ['/collection', () => import('@/app/[lang]/collection/page')],
  ['/calendar', () => import('@/app/[lang]/calendar/page')],
  ['/friends', () => import('@/app/[lang]/friends/page')],
  ['/announcements', () => import('@/app/[lang]/announcements/page')],
  ['/support', () => import('@/app/[lang]/support/page')],
  ['/developers', () => import('@/app/[lang]/developers/page')],
  ['/privacy', () => import('@/app/[lang]/privacy/page')],
  ['/terms', () => import('@/app/[lang]/terms/page')],
]
const LANGS = ['ko', 'en', 'ja'] as const
const metadataOf = async (load: () => Promise<unknown>, lang: string) => ((await load()) as PageModule).generateMetadata({ params: Promise.resolve({ lang }) })

describe('REQ-SHARED-040 every indexable page describes itself', () => {
  it.each(PAGES)('REQ-SHARED-040 %s has its own title, description, canonical and share data in ko, en and ja', async (path, load) => {
    for (const lang of LANGS) {
      const metadata = await metadataOf(load, lang)
      const url = `https://saigo-no-dante.com/${lang}${path}`
      const { title, description } = metadata as { title: string; description: string }

      // The layout appends " | site name": a title that already has a pipe reads "A | B | site".
      expect(title).toEqual(expect.any(String))
      expect(title).not.toContain('|')
      expect(description.length).toBeGreaterThan(15)
      expect(description).not.toBe(translations['home.meta.description'][lang])
      // Counts that drift from the data (408 gifts, 200+ identities) stay out of the copy.
      expect(`${title} ${description}`).not.toMatch(/\d{3}/)
      if (lang !== 'ko') expect(`${title} ${description}`).not.toMatch(/[가-힣]/)

      expect(metadata.alternates).toMatchObject({ canonical: url, languages: { 'x-default': `https://saigo-no-dante.com/ko${path}` } })
      expect(metadata.openGraph).toMatchObject({ type: 'website', url, siteName: lang === 'ko' ? '최애의 관리자' : 'SAIGO NO DANTE' })
      const openGraph = metadata.openGraph as { title: string; description: string; images: { url: string }[] }
      expect(openGraph.description.length).toBeGreaterThan(15)
      expect(`${openGraph.title} ${openGraph.description}`).not.toMatch(/\d{3}/)
      expect(openGraph.images).toHaveLength(1)
      expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', title: openGraph.title, description: openGraph.description, images: [openGraph.images[0].url] })
    }
  })

  it('REQ-SHARED-040 no two pages share a title or a description', async () => {
    for (const lang of LANGS) {
      const all = await Promise.all(PAGES.map(([, load]) => metadataOf(load, lang)))
      for (const field of ['title', 'description'] as const) {
        const values = all.map(metadata => metadata[field])
        expect(new Set(values).size).toBe(values.length)
      }
    }
  })

  it('REQ-SHARED-040 the planner, the deck board and the friend code board carry the search terms players use', async () => {
    const title = async (path: string, lang: string) => (await metadataOf(PAGES.find(([page]) => page === path)![1], lang)).title
    expect(await title('/planner', 'ko')).toBe('림버스 거울 던전 플래너 — 거던 플랜 짜기')
    expect(await title('/planner', 'en')).toBe('Limbus Company Mirror Dungeon Planner — Floor Plans & Gifts')
    expect(await title('/decks', 'ko')).toBe('림버스 덱 추천·편성 공유 게시판')
    expect(await title('/friends', 'ja')).toBe('リンバスカンパニー フレンドコード掲示板')
    expect(await title('/mirror-dungeon', 'ko')).toBe('림버스 거울 던전 E.G.O 기프트 도감 — 조합식·테마팩')
  })
})
