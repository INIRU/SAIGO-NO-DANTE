'use client'

import DanteLogo from '@/components/brand/DanteLogo'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import { Link } from '@/lib/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

const button = 'inline-flex min-h-11 items-center justify-center rounded-md px-6 font-heading text-[0.9375rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold-light)]'
const primary = `${button} bg-[var(--gold)] text-[var(--bg-deep)] hover:bg-[var(--gold-light)]`
const secondary = `${button} border border-[color-mix(in_srgb,var(--gold)_45%,transparent)] text-[var(--gold-light)] hover:border-[var(--gold)] hover:bg-[color-mix(in_srgb,var(--gold)_8%,transparent)]`

function parseTime(value: string | null) {
  const time = value ? Date.parse(value) : NaN
  return Number.isNaN(time) ? null : time
}

/** Remaining time as HH:MM:SS; hours keep counting past 24 so the digits never change shape. */
function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`
}

function MaintenanceContent() {
  const t = useTranslations('maintenance')
  const locale = useLocale()
  const params = useSearchParams()
  useHtmlFlag('with-page-error')
  const from = params?.get('from') || '/'
  const reason = params?.get('reason')
  const message = params?.get('message')
  const startsAt = parseTime(params?.get('starts_at') ?? null)
  const endsAt = parseTime(params?.get('ends_at') ?? null)
  // Time is read after mount so the server and client render the same placeholder.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    if (!endsAt) return
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [endsAt])

  const ended = endsAt !== null && now !== null && now >= endsAt
  const progress = startsAt !== null && endsAt !== null && now !== null && endsAt > startsAt
    ? Math.min(1, Math.max(0, (now - startsAt) / (endsAt - startsAt)))
    : null
  const resumeTime = endsAt
    ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(endsAt)
    : null

  return (
    <section aria-labelledby="maintenance-title" className="maintenance relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 pb-10 pt-20 text-center">
      <div aria-hidden="true" className="maintenance-glow pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      <DanteLogo size="3.25rem" className="maintenance-logo relative mb-5 text-[var(--gold-light)]" />
      <h1 id="maintenance-title" className="relative break-keep font-heading text-[1.75rem] text-[var(--text-primary)] sm:text-[2rem]">
        {ended ? t('ended') : t('title')}
      </h1>
      {reason && <p className="relative mt-2 break-keep font-heading text-[1rem] text-[var(--gold-light)]">{reason}</p>}

      {endsAt !== null && (
        <div className="relative mt-8 flex flex-col items-center">
          <span className="text-[0.8125rem] text-[var(--text-muted)]">{t('remaining')}</span>
          <p aria-hidden={now === null} translate="no" className="maintenance-clock mt-1 font-[family-name:var(--font-title)] text-[clamp(3.5rem,14vw,6.5rem)] leading-none tracking-[0.02em] text-[var(--gold-light)] tabular-nums">
            {now === null ? '--:--:--' : clock(endsAt - now)}
          </p>
          <span aria-hidden="true" className="mt-4 block h-[0.1875rem] w-[min(18rem,70vw)] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--gold)_16%,transparent)]">
            <span className="maintenance-progress block h-full origin-left bg-[var(--gold)]" style={{ transform: `scaleX(${progress ?? 0})` }} />
          </span>
          <p className="mt-3 text-[0.9375rem] text-[var(--text-secondary)]">{t('resumesAt', { time: resumeTime ?? '' })}</p>
        </div>
      )}

      <p className="relative mt-7 max-w-[30rem] whitespace-pre-line break-keep text-[0.9375rem] leading-7 text-[var(--text-secondary)]">
        {message || t('defaultMessage')}
      </p>
      {endsAt === null && <p className="relative mt-2 text-[0.875rem] text-[var(--text-muted)]">{t('unknownEnd')}</p>}

      <div className="relative mt-9 flex flex-wrap justify-center gap-3">
        {/* A full navigation re-runs the proxy, which lets the visitor in once the window has closed. */}
        <a href={from} className={ended ? primary : secondary}>{t('retry')}</a>
        {from !== '/' && !ended && <Link href="/" className={primary}>{t('home')}</Link>}
      </div>
      <style>{`
        .maintenance-glow { background: radial-gradient(closest-side, color-mix(in srgb, var(--gold) 13%, transparent), transparent); }
        .maintenance-clock { text-shadow: 0 0 2.5rem color-mix(in srgb, var(--gold) 35%, transparent); }
        .maintenance-progress { transition: transform 1s linear; }
        @media (prefers-reduced-motion: no-preference) {
          .maintenance-logo { animation: maintenance-fade 700ms ease-out both; }
          .maintenance-glow { animation: maintenance-breathe 5s ease-in-out infinite; }
        }
        @keyframes maintenance-fade { from { opacity: 0; } }
        @keyframes maintenance-breathe { 50% { opacity: 0.55; scale: 0.92; } }
      `}</style>
    </section>
  )
}

export default function MaintenancePage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <MaintenanceContent />
    </Suspense>
  )
}
