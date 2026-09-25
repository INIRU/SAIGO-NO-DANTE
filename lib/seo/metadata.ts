import type { Metadata } from 'next'
import { routing } from '@/lib/i18n/routing'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://saigo-no-dante.com'
/** Korean players are the primary audience: x-default, crawler redirects and the sitemap use /ko. */
export const PRIMARY_LOCALE = 'ko'

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
