'use client'

import DanteLogo from '@/components/brand/DanteLogo'
import { useTranslations } from 'next-intl'
import BackLink from '@/components/navigation/BackLink'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import { Link } from '@/lib/i18n/navigation'

const button = 'inline-flex min-h-11 items-center justify-center rounded-md px-6 font-heading text-[0.9375rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold-light)]'
const primary = `${button} bg-[var(--gold)] text-[var(--bg-deep)] hover:bg-[var(--gold-light)]`
const secondary = `${button} border border-[color-mix(in_srgb,var(--gold)_45%,transparent)] text-[var(--gold-light)] hover:border-[var(--gold)] hover:bg-[color-mix(in_srgb,var(--gold)_8%,transparent)]`

/** Shared 404 / 500 view: fills the viewport under the fixed navbar, no page scroll, footer hidden (workspaces.css). */
export default function PageError({ code, reset }: { code: '404' | '500'; reset?: () => void }) {
  const t = useTranslations('errorPage')
  useHtmlFlag('with-page-error')
  const kind = code === '404' ? 'notFound' : 'error'

  return (
    <section data-page-error aria-labelledby="page-error-title" className="page-error relative flex h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 pt-16 text-center">
      <div aria-hidden="true" className="page-error-glow pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      <DanteLogo size="3.25rem" className="page-error-logo relative mb-4 text-[var(--gold-light)]" />
      <p aria-hidden="true" translate="no" className="relative flex font-heading text-[clamp(5.5rem,20vw,9.5rem)] leading-[0.95] tracking-[-0.02em] text-[var(--gold-light)]">
        {code.split('').map((digit, index) => <span key={index} className="page-error-digit inline-block" style={{ animationDelay: `${index * 90}ms` }}>{digit}</span>)}
      </p>
      <span aria-hidden="true" className="page-error-line relative mt-5 block h-px w-40 bg-[linear-gradient(90deg,transparent,var(--gold),transparent)]" />
      <h1 id="page-error-title" className="relative mt-6 break-keep font-heading text-[1.375rem] text-[var(--text-primary)] sm:text-[1.75rem]">{t(`${kind}Title`)}</h1>
      <p className="relative mt-3 max-w-[28rem] break-keep text-[0.9375rem] leading-7 text-[var(--text-secondary)]">{t(`${kind}Hint`)}</p>
      <div className="relative mt-9 flex flex-wrap justify-center gap-3">
        {reset
          ? <button type="button" onClick={() => reset()} className={primary}>{t('retry')}</button>
          : <Link href="/" className={primary}>{t('home')}</Link>}
        <BackLink href="/" className={secondary}>{t('back')}</BackLink>
      </div>
      <style>{`
        .page-error-glow { background: radial-gradient(closest-side, color-mix(in srgb, var(--gold) 13%, transparent), transparent); }
        .page-error-digit { text-shadow: 0 0 2.5rem color-mix(in srgb, var(--gold) 35%, transparent); }
        @media (prefers-reduced-motion: no-preference) {
          .page-error-logo { animation: page-error-fade 700ms ease-out both; }
          .page-error-digit { animation: page-error-drop 800ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .page-error-line { animation: page-error-draw 900ms 250ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          .page-error-glow { animation: page-error-breathe 5s ease-in-out infinite; }
        }
        @keyframes page-error-fade { from { opacity: 0; } }
        @keyframes page-error-drop { from { opacity: 0; transform: translateY(-1.25rem); filter: blur(6px); } }
        @keyframes page-error-draw { from { transform: scaleX(0); opacity: 0; } }
        @keyframes page-error-breathe { 50% { opacity: 0.55; scale: 0.92; } }
      `}</style>
    </section>
  )
}
