import { describe, expect, it } from 'vitest'
import { localeAlternates } from '@/lib/seo/metadata'

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
