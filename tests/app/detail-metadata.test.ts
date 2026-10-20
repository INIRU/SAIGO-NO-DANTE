import type { Metadata } from 'next'
import { describe, expect, it, vi } from 'vitest'

const ID = '11111111-1111-4111-8111-111111111111'
const sinner = { id: 'faust', name: 'Faust', name_kr: '파우스트', name_jp: 'ファウスト' }
const identity = { id: ID, sinner_id: 'faust', name: 'LCB Sinner', name_kr: 'LCB 수감자', name_en: 'LCB Sinner', name_jp: 'LCB囚人', rarity: 1, keywords: [] }
const ego = { id: ID, sinner_id: 'faust', name: 'Representation Emitter', name_kr: '표상 방출기', name_en: 'Representation Emitter', name_jp: '表象放出器', grade: 'ZAYIN', sin_affinity: 'pride' }
const deck = { title: '화상 덱', description: null, tags: [] }
const plan = { id: ID, title: '거던 플랜', description: null, difficulty: 'hard' }

// One row for every lookup: the deck through supabase-js, the plan through the server client.
const query = (row: unknown): Record<string, unknown> => {
  const chain: Record<string, unknown> = {}
  for (const method of ['schema', 'from', 'select', 'eq']) chain[method] = () => chain
  chain.single = async () => ({ data: row, error: null })
  chain.maybeSingle = async () => ({ data: row, error: null })
  return chain
}
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => query(deck) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => query(plan) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => query(null) }))
vi.mock('@/lib/db/queries', () => ({ getSinnerById: async () => sinner, getIdentityById: async () => identity, getEGOById: async () => ego, isRowId: () => true }))
vi.mock('@/lib/keywords/server-data', () => ({ getKeywordData: async () => ({}) }))
vi.mock('next/server', async original => ({ ...(await original<typeof import('next/server')>()), connection: async () => {} }))
vi.mock('next/cache', async original => ({ ...(await original<typeof import('next/cache')>()), cacheLife: () => {}, cacheTag: () => {} }))
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
// Only generateMetadata is under test: the screens these pages render are left out.
vi.mock('@/app/[lang]/decks/[id]/DeckDetailClient', () => ({ default: () => null }))
vi.mock('@/components/decks/DeckDetailSkeleton', () => ({ default: () => null }))
vi.mock('@/app/[lang]/planner/community/[id]/PlanDetailClient', () => ({ default: () => null }))
vi.mock('@/app/[lang]/planner/community/[id]/PlanDetailSkeleton', () => ({ default: () => null }))
vi.mock('@/components/identity/IdentityRecommendations', () => ({ default: () => null }))

type DetailModule = { generateMetadata: (props: { params: Promise<Record<string, string>> }) => Promise<Metadata> }
const metadataOf = async (load: () => Promise<unknown>, lang: string) =>
  ((await load()) as DetailModule).generateMetadata({ params: Promise.resolve({ lang, slug: 'faust', id: ID, egoId: ID }) })

describe('REQ-SHARED-040 detail pages name the game and what the page is', () => {
  it.each([
    ['identity', () => import('@/app/[lang]/sinners/[slug]/identities/[id]/page'), `/sinners/faust/identities/${ID}`, {
      ko: 'LCB 수감자 파우스트 — 림버스 컴퍼니 인격 스킬·패시브',
      en: 'LCB Sinner Faust — Limbus Company Identity Skills & Passives',
      ja: 'LCB囚人 ファウスト — リンバスカンパニー 人格スキル・パッシブ',
    }],
    ['E.G.O', () => import('@/app/[lang]/sinners/[slug]/ego/[egoId]/page'), `/sinners/faust/ego/${ID}`, {
      ko: '표상 방출기 파우스트 E.G.O — 림버스 컴퍼니 스킬·내성',
      en: 'Representation Emitter Faust E.G.O — Limbus Company Skills & Resistances',
      ja: '表象放出器 ファウスト E.G.O — リンバスカンパニー スキル・耐性',
    }],
    ['deck', () => import('@/app/[lang]/decks/[id]/page'), `/decks/${ID}`, {
      ko: '화상 덱 — 림버스 컴퍼니 덱',
      en: '화상 덱 — Limbus Company Deck',
      ja: '화상 덱 — リンバスカンパニー デッキ',
    }],
    ['plan', () => import('@/app/[lang]/planner/community/[id]/page'), `/planner/community/${ID}`, {
      ko: '거던 플랜 — 림버스 거울 던전 플랜',
      en: '거던 플랜 — Limbus Company Mirror Dungeon Plan',
      ja: '거던 플랜 — リンバスカンパニー ミラーダンジョンプラン',
    }],
  ] as [string, () => Promise<unknown>, string, Record<string, string>][])('REQ-SHARED-040 %s detail', async (_name, load, path, titles) => {
    for (const lang of ['ko', 'en', 'ja']) {
      const metadata = await metadataOf(load, lang)
      const url = `https://saigo-no-dante.com/${lang}${path}`

      expect(metadata.title).toBe(titles[lang])
      expect((metadata.description as string).length).toBeGreaterThan(10)
      expect(metadata.alternates).toMatchObject({ canonical: url })
      // The page's own share image, with the url, site name and locale a page-level openGraph would otherwise drop.
      expect(metadata.openGraph).toMatchObject({ url, siteName: lang === 'ko' ? '최애의 관리자' : 'SAIGO NO DANTE', images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630 }] })
      expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', images: [`${url}/opengraph-image`] })
    }
  })
})
