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
  return (
    <footer className="site-footer mt-24">
      {/* 장식선 */}
      <div className="footer-decoration flex items-center gap-4 px-8 pt-10 max-w-6xl mx-auto">
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border))' }} />
        <span className="text-xs tracking-[0.3em]" style={{ color: 'rgba(200,144,10,0.5)' }}>◆</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, var(--border))' }} />
      </div>

      <div className="footer-content max-w-6xl mx-auto px-8 py-8 flex flex-col items-center gap-6">

        {/* 로고 + 사이트명 */}
        <div className="footer-brand flex flex-col items-center gap-2">
          <DanteLogo size="2rem" style={{ color: 'var(--gold-light)' }} />
          <p className="font-serif tracking-widest" style={{ color: 'var(--gold)', fontSize: 'var(--text-sm)' }}>
            {tSite('name')}
          </p>
        </div>

        {/* 네비게이션 */}
        {/* One row per group: the group name in its own column, so the rows line up and long rows wrap under their links. */}
        <nav aria-label={tCommon('footerNav')} className="grid max-w-full grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-xs tracking-widest">
          {NAV_GROUPS.map(group => (
            <div key={group.labelKey} className="contents">
              <p className="text-right" style={{ color: 'var(--gold-dim)' }}>{label(group.labelKey)}</p>
              <ul aria-label={label(group.labelKey)} className="flex flex-wrap gap-x-5 gap-y-3">
                {group.items.map(item => (
                  <li key={item.href}>
                    <Link
                      href={`/${lang}${item.href}`}
                      className="hit-target transition-colors duration-200 hover:text-[var(--gold-dim)]"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {label(item.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* 구분 점 */}
        <div className="footer-decoration flex items-center gap-2">
          {[0, 1, 2].map(i => (
            <span key={i} className="inline-block rounded-full" style={{
              width: '3px', height: '3px',
              background: i === 1 ? 'rgba(200,144,10,0.4)' : 'rgba(200,144,10,0.15)',
            }} />
          ))}
        </div>

        {/* 약관 링크 */}
        {/* Wraps between the links on a phone, never inside one. */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 whitespace-nowrap">
          <Link href={`/${lang}/terms`}
            className="hit-target transition-colors hover:text-yellow-300"
            style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
            {tCommon('terms')}
          </Link>
          <span aria-hidden className="max-sm:hidden" style={{ color: 'var(--text-muted)' }}>·</span>
          <Link href={`/${lang}/privacy`}
            className="hit-target transition-colors hover:text-yellow-300"
            style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
            {tCommon('privacy')}
          </Link>
          <span aria-hidden className="max-sm:hidden" style={{ color: 'var(--text-muted)' }}>·</span>
          <Link href={`/${lang}/licenses`}
            className="hit-target transition-colors hover:text-yellow-300"
            style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
            {tCommon('licenses')}
          </Link>
          <span aria-hidden className="max-sm:hidden" style={{ color: 'var(--text-muted)' }}>·</span>
          <a href="mailto:sellindev@icloud.com"
            className="hit-target transition-colors hover:text-yellow-300"
            style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
            {tCommon('contact')} sellindev@icloud.com
          </a>
        </div>

        {/* 디스클레이머 */}
        <div className="text-center space-y-1">
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', letterSpacing: '0.05em' }}>
            {tCommon('fanDisclaimer')}
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
            {tCommon('unaffiliatedDisclaimer')}
          </p>
        </div>

      </div>
    </footer>
  )
}
