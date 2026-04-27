'use client'

import { Home, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SUPPORTED_LOCALES = new Set(['ko', 'en', 'ja'])

interface PageErrorProps {
  /** Charon-style quote line 1 */
  quote: string
  /** Charon-style quote line 2 (optional) */
  subQuote?: string
  reset?: () => void
  /** Recovery link href (default: '/') */
  homeHref?: string
  /** Recovery link label (default: '메인으로') */
  homeLabel?: string
  /** Error status code or route marker shown in the page state */
  statusCode?: string
  /** Small status label above the main quote */
  eyebrow?: string
  /** Reset button label */
  retryLabel?: string
  /** Visual severity tone */
  variant?: 'warning' | 'critical'
}

export default function PageError({
  quote,
  subQuote,
  reset,
  homeHref = '/',
  homeLabel = '메인으로',
  statusCode = 'ERR',
  eyebrow = 'route paused',
  retryLabel = '다시 해보기',
  variant = 'critical',
}: PageErrorProps) {
  const isCritical = variant === 'critical'
  const pathname = usePathname()
  const resolvedHomeHref = resolveRecoveryHref(homeHref, pathname)
  const titleTone = isCritical
    ? 'color-mix(in srgb, var(--wrath) 72%, var(--gold-light))'
    : 'var(--gold)'

  return (
    <section
      aria-labelledby="page-error-title"
      className="relative isolate flex min-h-[60vh] items-center overflow-hidden px-4 py-14 sm:px-6 md:py-20"
    >
      <section
        className="error-page-enter mx-auto w-full max-w-5xl"
        aria-label={`오류 상태 ${statusCode}`}
      >
        <div className="relative">
          <div className="mb-8 flex items-center gap-4 sm:mb-10">
            <span
              aria-hidden="true"
              className="error-page-marker inline-flex h-[0.875rem] w-[0.875rem] shrink-0 rounded-[999rem] border border-[var(--gold)] bg-[var(--bg-deep)]"
            />
            <div
              aria-hidden="true"
              className="error-page-line h-[0.0625rem] flex-1 origin-left bg-[color-mix(in_srgb,var(--gold-dim)_54%,transparent)]"
            />
            <span
              translate="no"
              className="font-game-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--gold-dim)_82%,transparent)]"
            >
              {statusCode}
            </span>
          </div>

          <div className="grid gap-8 md:grid-cols-[minmax(0,0.76fr)_minmax(12rem,0.24fr)] md:items-end">
            <div className="min-w-0">
              <p
                translate="no"
                className="mb-4 font-game-mono text-[0.6875rem] uppercase tracking-[0.18em] text-[var(--gold-dim)]"
              >
                {eyebrow}
              </p>
              <h1
                id="page-error-title"
                className="max-w-[42rem] break-words font-serif text-[2rem] font-bold leading-[1.18] text-pretty sm:text-[2.625rem] md:text-[3rem]"
                style={{ color: titleTone }}
              >
                &ldquo;{quote}&rdquo;
              </h1>
              {subQuote && (
                <p className="mt-5 max-w-[36rem] break-words font-heading text-[0.9375rem] leading-8 text-[color-mix(in_srgb,var(--gold-light)_66%,var(--bg-deep))] sm:text-base">
                  &ldquo;{subQuote}&rdquo;
                </p>
              )}
            </div>

            <p className="max-w-[16rem] border-t border-[color-mix(in_srgb,var(--gold-dim)_30%,transparent)] pt-4 font-heading text-[0.8125rem] leading-7 text-[color-mix(in_srgb,var(--gold-dim)_82%,var(--bg-deep))] md:justify-self-end">
              메피스토펠레스의 노선이 잠시 끊겼습니다. 이전 길로 돌아가거나 컴퍼니
              로비에서 다시 출발하세요.
            </p>
          </div>

          <div className="mt-9 flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--gold-dim)_28%,transparent)] pt-6 sm:flex-row sm:items-center">
            {reset ? (
              <button
                type="button"
                onClick={() => reset()}
                className="group inline-flex min-h-11 items-center justify-center gap-3 rounded-sm bg-[color-mix(in_srgb,var(--gold)_92%,var(--gold-light))] px-5 py-3 font-heading text-sm font-bold text-[var(--bg-deep)] transition-[background-color,color,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[var(--gold-light)] active:translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold-light)]"
              >
                <RotateCcw
                  aria-hidden="true"
                  size="1rem"
                  strokeWidth={1.75}
                  className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-45"
                />
                {retryLabel}
              </button>
            ) : null}
            <Link
              href={resolvedHomeHref}
              className="group inline-flex min-h-11 items-center justify-center gap-3 rounded-sm border border-[color-mix(in_srgb,var(--gold-dim)_70%,transparent)] bg-[color-mix(in_srgb,var(--bg-card)_56%,transparent)] px-5 py-3 font-heading text-sm font-bold text-[var(--gold)] transition-[background-color,color,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[var(--gold)] hover:bg-[color-mix(in_srgb,var(--gold)_8%,var(--bg-card))] active:translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
            >
              <Home
                aria-hidden="true"
                size="1rem"
                strokeWidth={1.75}
                className="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5"
              />
              {homeLabel}
            </Link>
          </div>
        </div>
      </section>
      <style>{`
        @keyframes error-page-enter {
          from { transform: translate3d(0, 0.75rem, 0); opacity: 0; }
          to { transform: translate3d(0, 0, 0); opacity: 1; }
        }

        @keyframes error-page-line {
          from { transform: scaleX(0); opacity: 0.16; }
          to { transform: scaleX(1); opacity: 1; }
        }

        @keyframes error-page-marker {
          0%, 100% { transform: scale(0.92); opacity: 0.68; }
          50% { transform: scale(1); opacity: 1; }
        }

        .error-page-enter {
          animation: error-page-enter 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .error-page-line {
          animation: error-page-line 720ms cubic-bezier(0.16, 1, 0.3, 1) 90ms both;
        }

        .error-page-marker {
          animation: error-page-marker 2.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .error-page-enter,
          .error-page-line,
          .error-page-marker {
            animation: none;
          }
        }
      `}</style>
    </section>
  )
}

function resolveRecoveryHref(homeHref: string, pathname: string | null) {
  if (!homeHref.startsWith('/') || homeHref.startsWith('//') || !pathname) {
    return homeHref
  }

  const locale = pathname.split('/')[1]
  if (!SUPPORTED_LOCALES.has(locale)) {
    return homeHref
  }

  if (homeHref === '/') {
    return `/${locale}`
  }

  if (homeHref === `/${locale}` || homeHref.startsWith(`/${locale}/`)) {
    return homeHref
  }

  return `/${locale}${homeHref}`
}
