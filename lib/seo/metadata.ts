import type { Metadata } from 'next'
import { routing } from '@/lib/i18n/routing'
import { translations, type TranslationKey } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'
/** Korean players are the primary audience: x-default, crawler redirects and the sitemap use /ko. */
export const PRIMARY_LOCALE = 'ko'
export const SITE_NAME: Record<SupportedLang, string> = { ko: '최애의 관리자', en: 'SAIGO NO DANTE', ja: 'SAIGO NO DANTE' }
export const OG_LOCALE: Record<SupportedLang, string> = { ko: 'ko_KR', en: 'en_US', ja: 'ja_JP' }

/** The route's language as one the site has copy for; anything else reads as the primary one. */
export function seoLang(lang: string): SupportedLang {
  return lang === 'en' || lang === 'ja' ? lang : PRIMARY_LOCALE
}

/** Search-facing copy kept in translations.ts (page titles and descriptions, breadcrumb names), in the page's language. */
export function metaText(key: TranslationKey, lang: string): string {
  return translations[key][seoLang(lang)]
}

/** Absolute, locale-prefixed URL. Prefix-less URLs redirect by Accept-Language, so never point SEO signals at them. */
export function localeUrl(lang: string, path = '/'): string {
  return `${SITE_URL}/${lang}${path === '/' ? '' : path}`
}

export function localeLanguages(path = '/'): Record<string, string> {
  return {
    ...Object.fromEntries(routing.locales.map(locale => [locale, localeUrl(locale, path)])),
    'x-default': localeUrl(PRIMARY_LOCALE, path),
  }
}

/** Self canonical plus hreflang for ko/en/ja and x-default. `path` is the route without the locale, e.g. '/sinners/faust'. */
export function localeAlternates(lang: string, path = '/'): NonNullable<Metadata['alternates']> {
  return { canonical: localeUrl(lang, path), languages: localeLanguages(path) }
}

type ShareImage = { url: string; width?: number; height?: number; alt?: string }

/**
 * Everything an indexable page says about itself: title, description, canonical with hreflang, Open Graph and Twitter.
 * A page's own `openGraph` replaces the layout's whole object (Next merges metadata shallowly), so url, type, site name,
 * locale and image are written out here; without them a page either shares as the home page or loses its image.
 * `title` is the bare page title (the layout template appends the site name). The share title, description and image
 * default to the page's own and the site-wide image.
 */
export function pageMetadata({ lang, path, title, description, ogTitle = title, ogDescription = description, image, type = 'website' }: {
  lang: string
  /** Route without the locale, e.g. '/decks'. */
  path: string
  title: string
  description: string
  ogTitle?: string
  ogDescription?: string
  image?: ShareImage
  type?: 'website' | 'article'
}): Metadata {
  const locale = seoLang(lang)
  const images = [image ?? { url: localeUrl(lang, '/opengraph-image'), width: 1200, height: 630 }]
  return {
    title,
    description,
    alternates: localeAlternates(lang, path),
    openGraph: { type, locale: OG_LOCALE[locale], siteName: SITE_NAME[locale], url: localeUrl(lang, path), title: ogTitle, description: ogDescription, images },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDescription, images: images.map(shared => shared.url) },
  }
}
