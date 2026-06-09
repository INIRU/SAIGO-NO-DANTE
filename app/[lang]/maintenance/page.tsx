'use client'

import { Link } from '@/lib/i18n/navigation'
import { ArrowRight, Construction } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo } from 'react'

function formatEndTime(iso: string, locale: string) {
  const date = new Date(iso)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function MaintenanceContent() {
  const t = useTranslations('maintenance')
  const locale = useLocale()
  const searchParams = useSearchParams()

  const from = searchParams?.get('from') ?? null
  const message = searchParams?.get('message') ?? null
  const reason = searchParams?.get('reason') ?? null
  const endsAt = searchParams?.get('ends_at') ?? null

  const terminalLine = t('terminalLine')
  const operatorMessage = message ?? t('defaultMessage')

  const endTime = useMemo(() => {
    if (!endsAt) return null
    return formatEndTime(endsAt, locale)
  }, [endsAt, locale])

  const metadataRows = [
    { label: t('labels.reason'), value: reason ?? t('unknownReason') },
    { label: t('labels.endsAt'), value: endTime ?? t('unknownEnd') },
    { label: t('labels.route'), value: from ?? t('currentRoute'), code: Boolean(from) },
  ] as Array<{ label: string; value: string; code?: boolean }>

  return (
    <main className="maintenance-shell">
      <style>{`
        @keyframes panel-enter {
          from { opacity: 0; transform: translateY(0.875rem); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes rail-scan {
          from { transform: translateY(-100%); opacity: 0; }
          18%, 78% { opacity: 0.72; }
          to { transform: translateY(100%); opacity: 0; }
        }

        .maintenance-shell {
          position: relative;
          display: grid;
          min-height: 100dvh;
          place-items: center;
          overflow-x: hidden;
          background:
            linear-gradient(180deg, rgba(13, 11, 8, 0.92), rgba(13, 11, 8, 1)),
            repeating-linear-gradient(90deg, rgba(200, 144, 10, 0.035) 0 0.0625rem, transparent 0.0625rem 5rem),
            repeating-linear-gradient(0deg, rgba(232, 176, 48, 0.026) 0 0.0625rem, transparent 0.0625rem 4.5rem),
            #0d0b08;
          padding: 5.25rem 1rem 2.25rem;
          color: #dcc99a;
          isolation: isolate;
        }

        .maintenance-shell::before {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          content: '';
          background:
            linear-gradient(90deg, rgba(13, 11, 8, 0.94), transparent 18%, transparent 82%, rgba(13, 11, 8, 0.94)),
            radial-gradient(circle at 22% 28%, rgba(200, 144, 10, 0.08), transparent 18rem),
            radial-gradient(circle at 78% 70%, rgba(138, 96, 16, 0.08), transparent 16rem);
          opacity: 0.95;
        }

        .status-board {
          position: relative;
          z-index: 3;
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(20rem, 2fr);
          width: min(100%, 68rem);
          min-height: 28rem;
          border: 0.0625rem solid rgba(200, 144, 10, 0.3);
          border-radius: 0.25rem;
          background:
            linear-gradient(90deg, rgba(232, 176, 48, 0.045) 0 0.0625rem, transparent 0.0625rem),
            linear-gradient(180deg, rgba(26, 21, 16, 0.96), rgba(14, 12, 9, 0.98)),
            #1a1510;
          box-shadow:
            0 1.5rem 3rem rgba(0, 0, 0, 0.46),
            inset 0 0 0 0.0625rem rgba(232, 176, 48, 0.07);
          animation: panel-enter 520ms ease-out both;
        }

        .status-board::before,
        .status-board::after {
          position: absolute;
          width: 1.15rem;
          height: 1.15rem;
          border-color: rgba(232, 176, 48, 0.45);
          content: '';
          pointer-events: none;
        }

        .status-board::before {
          top: 0.75rem;
          left: 0.75rem;
          border-top: 0.0625rem solid;
          border-left: 0.0625rem solid;
        }

        .status-board::after {
          right: 0.75rem;
          bottom: 0.75rem;
          border-right: 0.0625rem solid;
          border-bottom: 0.0625rem solid;
        }

        .status-main {
          position: relative;
          display: grid;
          grid-template-columns: 0.25rem minmax(0, 1fr);
          gap: 1.5rem;
          padding: 3rem 2.5rem 2.35rem;
        }

        .status-rail {
          position: relative;
          overflow: hidden;
          border: 0.0625rem solid rgba(232, 176, 48, 0.2);
          background: linear-gradient(180deg, rgba(232, 176, 48, 0.78), rgba(138, 96, 16, 0.3));
        }

        .status-rail::after {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent, rgba(255, 232, 174, 0.75), transparent);
          animation: rail-scan 2.8s cubic-bezier(0.32, 0.72, 0, 1) infinite;
          content: '';
        }

        .status-copy {
          min-width: 0;
        }

        .status-label {
          display: inline-flex;
          align-items: center;
          min-height: 2rem;
          margin: 0 0 1.15rem;
          border-block: 0.0625rem solid rgba(200, 144, 10, 0.18);
          color: #9f8758;
          font-family: var(--font-mono);
          font-size: 0.875rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .status-stamp {
          position: relative;
          display: inline-flex;
          align-items: center;
          margin-left: 0.75rem;
          border: 0.0625rem solid rgba(138, 96, 16, 0.45);
          padding: 0.28rem 0.5rem;
          color: #6f6042;
          font-size: 0.75rem;
          letter-spacing: 0.11em;
        }

        .maintenance-title {
          margin: 0;
          color: #e8b030;
          font-size: clamp(2.25rem, 5vw, 4rem);
          line-height: 1.02;
          letter-spacing: 0;
          text-wrap: balance;
        }

        .maintenance-description {
          max-width: 38rem;
          margin: 1.15rem 0 0;
          color: #cdb989;
          font-size: 1rem;
          line-height: 1.8;
          text-wrap: pretty;
        }

        .terminal-strip {
          display: flex;
          min-height: 3rem;
          align-items: center;
          gap: 0.75rem;
          margin: 1.65rem 0 0;
          border-block: 0.0625rem solid rgba(200, 144, 10, 0.16);
          background:
            linear-gradient(90deg, rgba(200, 144, 10, 0.075), transparent 55%),
            rgba(13, 11, 8, 0.52);
          padding: 0.7rem 0.85rem;
          color: #b69b60;
          font-family: var(--font-mono);
          font-size: 0.9375rem;
          line-height: 1.55;
        }

        .terminal-caret {
          width: 0.5rem;
          height: 1.15rem;
          flex: 0 0 auto;
          background: rgba(232, 176, 48, 0.62);
        }

        .home-link {
          display: inline-flex;
          min-height: 2.75rem;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          margin-top: 1.65rem;
          border: 0.0625rem solid rgba(200, 144, 10, 0.42);
          border-radius: 0.25rem;
          background: rgba(200, 144, 10, 0.12);
          padding: 0.75rem 1.15rem;
          color: #f1c765;
          font-size: 0.9375rem;
          font-weight: 700;
          text-decoration: none;
          transition:
            border-color 180ms cubic-bezier(0.32, 0.72, 0, 1),
            background 180ms cubic-bezier(0.32, 0.72, 0, 1),
            color 180ms cubic-bezier(0.32, 0.72, 0, 1),
            transform 180ms cubic-bezier(0.32, 0.72, 0, 1);
        }

        .home-link:hover,
        .home-link:focus-visible {
          border-color: rgba(232, 176, 48, 0.72);
          background: rgba(200, 144, 10, 0.18);
          color: #ffe4a0;
          outline: none;
          transform: translateY(-0.0625rem);
        }

        .home-link:active {
          transform: translateY(0);
        }

        .home-link:focus-visible {
          box-shadow: 0 0 0 0.1875rem rgba(232, 176, 48, 0.22);
        }

        .detail-panel {
          position: relative;
          display: flex;
          min-width: 0;
          flex-direction: column;
          border-left: 0.0625rem solid rgba(200, 144, 10, 0.22);
          background:
            linear-gradient(180deg, rgba(13, 11, 8, 0.42), rgba(13, 11, 8, 0.72)),
            rgba(13, 11, 8, 0.36);
          padding: 2rem 1.5rem 1.5rem;
        }

        .detail-panel::before {
          position: absolute;
          top: 0;
          right: 1rem;
          left: 1rem;
          height: 0.0625rem;
          background: linear-gradient(90deg, transparent, rgba(232, 176, 48, 0.36), transparent);
          content: '';
        }

        .detail-heading {
          margin: 0;
          color: #e5d4a5;
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.45;
        }

        .detail-caption {
          margin: 0.35rem 0 1.05rem;
          color: #796947;
          font-family: var(--font-mono);
          font-size: 0.875rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .operator-message {
          margin: 0;
          border-block: 0.0625rem solid rgba(200, 144, 10, 0.16);
          padding: 1rem 0;
          color: #cdb989;
          font-size: 1rem;
          line-height: 1.7;
          text-wrap: pretty;
        }

        .metadata-list {
          display: grid;
          margin: 1rem 0 0;
        }

        .metadata-row {
          display: grid;
          grid-template-columns: minmax(7.2rem, 0.72fr) minmax(0, 1fr);
          gap: 1rem;
          border-top: 0.0625rem solid rgba(200, 144, 10, 0.14);
          padding: 0.85rem 0;
        }

        .metadata-label {
          color: #7c6a46;
          font-family: var(--font-mono);
          font-size: 0.875rem;
          font-weight: 600;
          letter-spacing: 0.05em;
        }

        .metadata-value {
          min-width: 0;
          overflow-wrap: anywhere;
          color: #c5ad78;
          font-size: 1rem;
          line-height: 1.55;
        }

        .metadata-value code {
          color: #d6c18d;
          font-family: var(--font-mono);
          font-size: 0.875rem;
        }

        @media (max-width: 50rem) {
          .maintenance-shell {
            align-items: start;
            padding: 4.75rem 0.875rem 1.25rem;
          }

          .status-board {
            grid-template-columns: 1fr;
            min-height: 0;
          }

          .status-main {
            grid-template-columns: 0.2rem minmax(0, 1fr);
            gap: 1rem;
            padding: 1.6rem 1rem 1.2rem;
          }

          .status-label {
            margin-bottom: 0.85rem;
            letter-spacing: 0.09em;
          }

          .status-stamp {
            display: none;
          }

          .maintenance-description {
            margin-top: 0.8rem;
            line-height: 1.65;
          }

          .maintenance-title {
            font-size: 2rem;
            line-height: 1.08;
            overflow-wrap: anywhere;
          }

          .terminal-strip {
            margin-top: 1rem;
          }

          .home-link {
            width: 100%;
            margin-top: 1rem;
          }

          .detail-panel {
            border-top: 0.0625rem solid rgba(200, 144, 10, 0.2);
            border-left: 0;
            padding: 1.2rem 1rem 1rem;
          }

          .metadata-row {
            grid-template-columns: 1fr;
            gap: 0.25rem;
            padding: 0.75rem 0;
          }

          .operator-message {
            padding: 0.85rem 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .status-board,
          .status-rail::after {
            animation: none;
          }

          .home-link {
            transition: none;
          }
        }
      `}</style>

      <section className="status-board" aria-labelledby="maintenance-title">
        <div className="status-main">
          <div className="status-rail" aria-hidden="true" />
          <div className="status-copy">
            <p className="status-label">
              {t('eyebrow')}
              <span className="status-stamp">{t('statusLabel')}</span>
            </p>
            <h1 id="maintenance-title" className="maintenance-title font-serif">
              {t('title')}
            </h1>
            <p className="maintenance-description">{t('description')}</p>

            <div className="terminal-strip" aria-live="polite">
              <span className="terminal-caret" aria-hidden="true" />
              <span>{terminalLine}</span>
            </div>

            <Link href="/" className="home-link">
              {t('home')}
              <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <aside className="detail-panel" aria-labelledby="maintenance-detail-title">
          <h2 id="maintenance-detail-title" className="detail-heading">
            {t('detailTitle')}
          </h2>
          <p className="detail-caption">{t('detailCaption')}</p>
          <p className="operator-message">{operatorMessage}</p>

          <dl className="metadata-list">
            {metadataRows.map((row) => (
              <div key={row.label} className="metadata-row">
                <dt className="metadata-label">{row.label}</dt>
                <dd className="metadata-value">
                  {row.code ? <code>{row.value}</code> : row.value}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>
    </main>
  )
}

export default function MaintenancePage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center bg-[#0d0b08] text-[#c8900a]">
          <Construction size={32} strokeWidth={1.8} aria-hidden="true" />
        </main>
      }
    >
      <MaintenanceContent />
    </Suspense>
  )
}
