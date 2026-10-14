// next/link with explicit /{lang} paths: next-intl's server Link reads the request locale, which the static shell cannot.
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import DanteLogo from '@/components/brand/DanteLogo'

const NAV_LINKS = [
  { href: '/sinners', labelKey: 'sinners' },
  { href: '/decks', labelKey: 'decks' },
  { href: '/meta', labelKey: 'tools.meta' },
] as const

/** Explicit locale: rendered in the static layout shell, where the request locale is unavailable. */
export default async function Footer({ lang }: { lang: string }) {
  const [tCommon, tNav, tSite] = await Promise.all([
    getTranslations({ locale: lang, namespace: 'common' }),
    getTranslations({ locale: lang, namespace: 'nav' }),
    getTranslations({ locale: lang, namespace: 'site' }),
  ])
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
        <nav aria-label={tCommon('footerNav')} className="flex items-center gap-6">
          {NAV_LINKS.map(({ href, labelKey }) => (
            <Link
              key={href}
              href={`/${lang}${href}`}
              className="hit-target text-xs tracking-widest transition-colors duration-200 hover:text-[var(--gold-dim)]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {tNav(labelKey as Parameters<typeof tNav>[0])}
            </Link>
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
        <div className="flex items-center gap-4">
          <Link href={`/${lang}/terms`}
            className="hit-target transition-colors hover:text-yellow-300"
            style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
            {tCommon('terms')}
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <Link href={`/${lang}/privacy`}
            className="hit-target transition-colors hover:text-yellow-300"
            style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
            {tCommon('privacy')}
          </Link>
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
