import type { Metadata } from 'next'
import { describe, expect, it, vi } from 'vitest'
import type { MotionSinner } from '@/lib/motion/catalog'

vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl')
  const catalogs: Record<string, unknown> = {
    ko: (await import('@/messages/ko.json')).default,
    en: (await import('@/messages/en.json')).default,
    ja: (await import('@/messages/ja.json')).default,
  }
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace?: string }) =>
      createTranslator({ locale, messages: catalogs[locale] as never, namespace: namespace as never }),
  }
})
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/components/motion/MotionWatch', () => ({ default: () => null }))
vi.mock('@/components/motion/SkillMotionSkeleton', () => ({ default: () => null }))
function RequestTimeMarker() { return null }
vi.mock('@/components/layout/RequestTimeRoute', () => ({ default: RequestTimeMarker }))

const state = (id: string, label: string) => ({ state: id, label, name: '', video: `v/${id}.mp4`, meta: '', bytes: 1 })
const catalog = (lang: string): MotionSinner[] => [{
  id: 'yi-sang',
  identities: [
    { slug: 'id10199', label: lang === 'ko' ? '새 인격' : 'New Identity', identityId: null, gameId: '10199', rarity: 3, folderName: null, portrait: null, released: null, skills: [], pending: true },
    {
      slug: 'id10116', label: lang === 'ko' ? 'LCE E.G.O::차원찢개' : 'LCE E.G.O::Dimension Shredder', identityId: 'a', gameId: '10116', rarity: 3, folderName: null,
      portrait: 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets/p.webp', released: '2026-09-01',
      skills: [{ key: 'id10116|1011601', skillId: 1011601, title: lang === 'ko' ? '차원 베기' : 'Dimension Slash', form: null, states: [state('v:base', lang === 'ko' ? '기본' : 'Base'), state('v:best', lang === 'ko' ? '최고 상태' : 'Best')] }],
    },
  ],
  egos: [],
}]
const load = vi.fn(async (lang: string) => catalog(lang))
vi.mock('@/lib/motion/feed', () => ({ loadMotionCatalog: (lang: string) => load(lang) }))

type Page = { generateMetadata: (props: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<Metadata> }
const metadataOf = async (lang: string, query: Record<string, string>) =>
  ((await import('@/app/[lang]/motion/skills/watch/page')) as unknown as Page).generateMetadata({ params: Promise.resolve({ lang }), searchParams: Promise.resolve(query) })

describe('REQ-MOTION-022 each skill motion has its own address for search', () => {
  it('REQ-MOTION-022 names the sinner, the identity and the skill, with the skill address as canonical', async () => {
    const metadata = await metadataOf('ko', { skill: 'id10116~1011601', state: 'v:base' })
    const url = 'https://saigo-no-dante.com/ko/motion/skills/watch?skill=id10116~1011601'
    expect(metadata.title).toBe('이상 LCE E.G.O::차원찢개 차원 베기 스킬 모션')
    expect(metadata.description).toContain('차원 베기')
    expect(metadata.description).toContain('기본·최고 상태')
    expect(metadata.alternates).toMatchObject({ canonical: url, languages: { en: 'https://saigo-no-dante.com/en/motion/skills/watch?skill=id10116~1011601' } })
    expect(metadata.openGraph).toMatchObject({ url, images: [{ url: catalog('ko')[0].identities[1].portrait }] })
  })

  it('REQ-MOTION-022 writes the skill page in English and Japanese without Korean', async () => {
    for (const lang of ['en', 'ja']) {
      const metadata = await metadataOf(lang, { skill: 'id10116~1011601' })
      expect(`${metadata.title} ${metadata.description}`).toContain('Dimension Slash')
      expect(`${metadata.title} ${metadata.description}`).not.toMatch(/[가-힣]/)
    }
  })

  it('REQ-MOTION-022 keeps the list page for no skill, an unknown or pending one, or a list that cannot be read', async () => {
    for (const query of [{}, { skill: 'id1~1' }, { skill: 'id10199' }] as Record<string, string>[]) {
      const metadata = await metadataOf('ko', query)
      expect(metadata.alternates).toMatchObject({ canonical: 'https://saigo-no-dante.com/ko/motion/skills' })
      expect(metadata.title).toBe('림버스 컴퍼니 스킬 모션')
    }
    load.mockRejectedValueOnce(new Error('R2 down'))
    expect((await metadataOf('ko', { skill: 'id10116~1011601' })).alternates).toMatchObject({ canonical: 'https://saigo-no-dante.com/ko/motion/skills' })
  })
  it('REQ-MOTION-022 renders at request time, as its metadata reads the address (Next blocks the metadata otherwise)', async () => {
    const page = (await import('@/app/[lang]/motion/skills/watch/page')).default as unknown as () => { props: { children: { type: unknown }[] } }
    expect(page().props.children.map(child => child.type)).toContain(RequestTimeMarker)
  })
})
