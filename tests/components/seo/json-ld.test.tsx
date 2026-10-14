import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { websiteJsonLd } from '@/components/seo/JsonLd'
import { translations } from '@/lib/i18n/translations'

const ID = '11111111-1111-4111-8111-111111111111'
vi.mock('next/cache', async original => ({ ...(await original<typeof import('next/cache')>()), cacheLife: () => {}, cacheTag: () => {} }))
vi.mock('@/lib/db/queries', () => ({
  getSinnerById: async () => ({ id: 'faust', name: 'Faust', name_kr: '파우스트', name_jp: 'ファウスト' }),
  getEGOById: async () => ({ id: ID, sinner_id: 'faust', name: 'Representation Emitter', name_kr: '표상 방출기', name_en: 'Representation Emitter', name_jp: '表象放出器', grade: 'ZAYIN' }),
}))
// The detail screen is loaded with next/dynamic; only the structured data around it is under test.
vi.mock('next/dynamic', () => ({ default: () => () => null }))

describe('REQ-SHARED-042 site name and breadcrumbs in structured data', () => {
  it('REQ-SHARED-042 WebSite carries one short name, the alternate names and a description in the page language', () => {
    for (const lang of ['ko', 'en', 'ja'] as const) {
      expect(websiteJsonLd(lang)).toMatchObject({
        '@type': 'WebSite',
        name: '최애의 관리자',
        alternateName: ['SAIGO NO DANTE', 'saigo-no-dante.com'],
        url: `https://saigo-no-dante.com/${lang}`,
        description: translations['home.meta.description'][lang],
        inLanguage: lang,
      })
    }
    expect(websiteJsonLd('en').description).not.toMatch(/[가-힣]/)
  })

  it('REQ-SHARED-042 an E.G.O detail page lists the way from home as a BreadcrumbList', async () => {
    const { default: EGODetailPage } = await import('@/app/[lang]/sinners/[slug]/ego/[egoId]/page')
    const html = renderToStaticMarkup(await EGODetailPage({ params: Promise.resolve({ lang: 'ja', slug: 'faust', egoId: ID }) }))
    const data = JSON.parse(html.match(/<script[^>]*application\/ld\+json[^>]*>(.*?)<\/script>/)![1])

    expect(data['@type']).toBe('BreadcrumbList')
    expect(data.itemListElement.map((item: { name: string; item: string }) => [item.name, item.item])).toEqual([
      ['ホーム', 'https://saigo-no-dante.com/ja'],
      ['囚人', 'https://saigo-no-dante.com/ja/sinners'],
      ['ファウスト', 'https://saigo-no-dante.com/ja/sinners/faust'],
      ['表象放出器', `https://saigo-no-dante.com/ja/sinners/faust/ego/${ID}`],
    ])
  })
})
