import type { Metadata } from 'next'
import { routing } from '@/lib/i18n/routing'
import { translations, type TranslationKey } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'
/** Korean players are the primary audience: x-default, crawler redirects and the sitemap use /ko. */
export const PRIMARY_LOCALE = 'ko'
/** The AdSense publisher of public/ads.txt; the account meta tag lets AdSense confirm the site without the ads.txt crawl. */
export const ADSENSE_ACCOUNT = 'ca-pub-4615018820773123'
/** One display ad unit (AdSense > Ads > By ad unit) per ad place, so the report shows what each place earns. */
export const ADSENSE_SLOTS = {
  /** saigo-no-dante: under a list page title */
  top: '2699879515',
  /** saigo-no-dante-2: between a detail page's parts (and the skill motion picker's phone banner) */
  inline: '1649300531',
  /** saigo-no-dante-3: the 160x600 side ads */
  rail: '1316313953',
  /** saigo-no-dante-4: the skill motion player's side panel */
  panel: '6377068943',
} as const
/** Cloudflare Web Analytics site token (public, it is in every page): the self-hosted layout loads the beacon itself because
 * CloudFront in front of the site does not inject it as the Cloudflare proxy did. */
export const CLOUDFLARE_WEB_ANALYTICS_TOKEN = 'ebead1286a1d499d8750afee5d27786f'
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
export function pageMetadata({ lang, path, title, description, ogTitle = title, ogDescription = description, image, type = 'website', noindex = false }: {
  lang: string
  /** Route without the locale, e.g. '/decks'. */
  path: string
  title: string
  description: string
  ogTitle?: string
  ogDescription?: string
  image?: ShareImage
  type?: 'website' | 'article'
  /** Personal or empty-for-crawlers screens: kept out of the index, links on them still followed. */
  noindex?: boolean
}): Metadata {
  const locale = seoLang(lang)
  const images = [image ?? { url: localeUrl(lang, '/opengraph-image'), width: 1200, height: 630 }]
  return {
    title,
    description,
    alternates: localeAlternates(lang, path),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type, locale: OG_LOCALE[locale], siteName: SITE_NAME[locale], url: localeUrl(lang, path), title: ogTitle, description: ogDescription, images },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDescription, images: images.map(shared => shared.url) },
  }
}
