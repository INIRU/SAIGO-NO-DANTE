// next/link with explicit /{lang} paths: next-intl's server Link reads the request locale, which the static shell cannot.
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import DanteLogo from '@/components/brand/DanteLogo'
import { NAV_GROUPS } from './nav-shared'

// Every menu group (DB, community, tools, fun). The navbar builds its dropdowns only while one is open, so these are the
// links every page's HTML carries to those pages.

/** Explicit locale: rendered in the static layout shell, where the request locale is unavailable. */
export default async function Footer({ lang }: { lang: string }) {
  const [tCommon, t, tSite] = await Promise.all([
    getTranslations({ locale: lang, namespace: 'common' }),
    getTranslations({ locale: lang }),
    getTranslations({ locale: lang, namespace: 'site' }),
  ])
  const label = (key: string) => t(key as Parameters<typeof t>[0])
  const legal = [
    { href: `/${lang}/about`, text: tCommon('about') },
    { href: `/${lang}/terms`, text: tCommon('terms') },
    { href: `/${lang}/privacy`, text: tCommon('privacy') },
    { href: `/${lang}/licenses`, text: tCommon('licenses') },
  ]
  return (
    // One rule on top, then brand beside the link columns; legal links and the notice share the last row.
    <footer className="site-footer mt-24 border-t border-[var(--border)]">
      <div className="footer-content mx-auto flex max-w-6xl flex-col gap-10 px-6 pt-12 pb-8 sm:px-8">
        <div className="footer-main flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="footer-brand flex shrink-0 items-center gap-2.5">
            <DanteLogo size="1.75rem" style={{ color: 'var(--gold-light)' }} />
            <p className="text-[1rem]" style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)' }}>{tSite('name')}</p>
          </div>

          <nav aria-label={tCommon('footerNav')} className="grid gap-y-5 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8 md:grid-cols-5 lg:gap-x-10">
            {NAV_GROUPS.map(group => (
              <div key={group.labelKey}>
                <p className="mb-2 text-[0.8125rem] lg:mb-3" style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)' }}>{label(group.labelKey)}</p>
                <ul aria-label={label(group.labelKey)} className="flex flex-wrap gap-x-4 gap-y-2 lg:flex-col lg:gap-2.5">
                  {group.items.map(item => (
                    <li key={item.href}>
                      <Link href={`/${lang}${item.href}`} className="hit-target text-[0.8125rem] text-[var(--text-tertiary)] transition-colors duration-150 hover:text-[var(--gold-light)]">
                        {label(item.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="footer-legal flex flex-col gap-3 border-t border-[var(--border)] pt-6 text-[0.75rem] text-[var(--text-muted)] lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          {/* Wraps between the links on a phone, never inside one. */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 whitespace-nowrap">
            {legal.map(link => (
              <Link key={link.href} href={link.href} className="hit-target text-[var(--text-tertiary)] transition-colors duration-150 hover:text-[var(--gold-light)]">{link.text}</Link>
            ))}
            <a href="mailto:sellindev@icloud.com" className="hit-target text-[var(--text-tertiary)] transition-colors duration-150 hover:text-[var(--gold-light)]">
              {tCommon('contact')} sellindev@icloud.com
            </a>
          </div>
          <div className="space-y-1 lg:text-right">
            <p>{tCommon('fanDisclaimer')}</p>
            <p>{tCommon('unaffiliatedDisclaimer')}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
