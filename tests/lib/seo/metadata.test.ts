import { describe, expect, it } from 'vitest'
import { localeAlternates, pageMetadata } from '@/lib/seo/metadata'

describe('REQ-SHARED-039 pageMetadata', () => {
  it('REQ-SHARED-039 fills title, description, alternates, Open Graph and Twitter for the page itself', () => {
    expect(pageMetadata({ lang: 'ko', path: '/decks', title: '림버스 덱 게시판', description: '덱을 공유합니다.' })).toEqual({
      title: '림버스 덱 게시판',
      description: '덱을 공유합니다.',
      alternates: localeAlternates('ko', '/decks'),
      openGraph: {
        type: 'website',
        locale: 'ko_KR',
        siteName: '최애의 관리자',
        url: 'https://saigo-no-dante.com/ko/decks',
        title: '림버스 덱 게시판',
        description: '덱을 공유합니다.',
        images: [{ url: 'https://saigo-no-dante.com/ko/opengraph-image', width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: '림버스 덱 게시판',
        description: '덱을 공유합니다.',
        images: ['https://saigo-no-dante.com/ko/opengraph-image'],
      },
    })
  })

  it('REQ-SHARED-039 uses the locale of the page for the site name, og:locale and the shared image', () => {
    const { openGraph, twitter } = pageMetadata({ lang: 'ja', path: '/keywords', title: 'キーワード図鑑', description: '説明' })
    expect(openGraph).toMatchObject({ locale: 'ja_JP', siteName: 'SAIGO NO DANTE', url: 'https://saigo-no-dante.com/ja/keywords' })
    expect(twitter?.images).toEqual(['https://saigo-no-dante.com/ja/opengraph-image'])
  })

  it('REQ-SHARED-039 takes a share title, share description, image and type when the page has its own', () => {
    const image = { url: 'https://saigo-no-dante.com/en/decks/d1/opengraph-image', width: 1200, height: 630, alt: 'Burn deck' }
    const { title, description, openGraph, twitter } = pageMetadata({
      lang: 'en', path: '/decks/d1', title: 'Burn deck — Limbus Company Deck', description: 'Notes',
      ogTitle: 'Burn deck | Deck Board', ogDescription: 'Share text', image, type: 'article',
    })
    expect([title, description]).toEqual(['Burn deck — Limbus Company Deck', 'Notes'])
    expect(openGraph).toMatchObject({ type: 'article', title: 'Burn deck | Deck Board', description: 'Share text', images: [image] })
    expect(twitter).toMatchObject({ title: 'Burn deck | Deck Board', description: 'Share text', images: [image.url] })
  })
})

describe('localeAlternates', () => {
  it('uses the locale-prefixed self URL as canonical, with ko/en/ja and x-default -> /ko', () => {
    expect(localeAlternates('ja', '/sinners/faust')).toEqual({
      canonical: 'https://saigo-no-dante.com/ja/sinners/faust',
      languages: {
        ko: 'https://saigo-no-dante.com/ko/sinners/faust',
        en: 'https://saigo-no-dante.com/en/sinners/faust',
        ja: 'https://saigo-no-dante.com/ja/sinners/faust',
        'x-default': 'https://saigo-no-dante.com/ko/sinners/faust',
      },
    })
  })

  it('maps the home page to /{lang} without a trailing slash', () => {
    const { canonical, languages } = localeAlternates('ko', '/')
    expect(canonical).toBe('https://saigo-no-dante.com/ko')
    expect(languages).toMatchObject({ en: 'https://saigo-no-dante.com/en', 'x-default': 'https://saigo-no-dante.com/ko' })
  })
})
