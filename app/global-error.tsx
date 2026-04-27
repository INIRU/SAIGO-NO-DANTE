'use client'

import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          colorScheme: 'dark',
          background: 'var(--bg-deep, #0d0b08)',
          color: 'var(--gold-light, #e8b030)',
          fontFamily:
            'var(--font-heading, Apple SD Gothic Neo, Malgun Gothic, sans-serif)',
        }}
      >
        <main
          style={{
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            minHeight: '100dvh',
            padding: '3.5rem 1rem',
          }}
        >
          <section
            className="global-error-shell"
            aria-labelledby="global-error-title"
            style={{
              boxSizing: 'border-box',
              position: 'relative',
              width: 'min(100%, 64rem)',
              margin: '0 auto',
            }}
          >
            <div className="global-error-route" aria-hidden="true">
              <span className="global-error-marker" />
              <span className="global-error-line" />
              <span className="global-error-code" translate="no">
                500
              </span>
            </div>

            <div className="global-error-content">
              <p className="global-error-label" translate="no">
                route paused
              </p>
              <h1 className="global-error-title" id="global-error-title">
                치명적 오류가 발생했습니다
              </h1>
              <p className="global-error-copy">
                메피스토펠레스가 현재 노선을 잠시 놓쳤습니다. 다시 시도하면 같은 경로에서
                복구를 시작합니다.
              </p>
            </div>

            <div className="global-error-actions">
              <button className="global-error-reset" type="button" onClick={() => reset()}>
                다시 시도
              </button>
              <Link className="global-error-home" href="/">
                컴퍼니로 돌아가기
              </Link>
            </div>
          </section>
        </main>
        <style>{`
          @keyframes global-error-enter {
            from { transform: translate3d(0, 0.75rem, 0); opacity: 0; }
            to { transform: translate3d(0, 0, 0); opacity: 1; }
          }

          @keyframes global-error-line {
            from { transform: scaleX(0); opacity: 0.16; }
            to { transform: scaleX(1); opacity: 1; }
          }

          @keyframes global-error-marker {
            0%, 100% { transform: scale(0.92); opacity: 0.68; }
            50% { transform: scale(1); opacity: 1; }
          }

          .global-error-shell {
            animation: global-error-enter 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
          }

          .global-error-route {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 2.5rem;
          }

          .global-error-marker {
            width: 0.875rem;
            height: 0.875rem;
            border: 0.0625rem solid var(--gold, #c8900a);
            border-radius: 999rem;
            background: var(--bg-deep, #0d0b08);
            animation: global-error-marker 2.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
            flex: 0 0 auto;
          }

          .global-error-line {
            height: 0.0625rem;
            flex: 1 1 auto;
            transform-origin: left;
            background: color-mix(in srgb, var(--gold-dim, #8a6010) 54%, transparent);
            animation: global-error-line 720ms cubic-bezier(0.16, 1, 0.3, 1) 90ms both;
          }

          .global-error-code,
          .global-error-label {
            color: color-mix(in srgb, var(--gold-dim, #8a6010) 82%, transparent);
            font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
            font-size: 0.6875rem;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }

          .global-error-content {
            max-width: 42rem;
          }

          .global-error-label {
            margin: 0 0 1rem;
          }

          .global-error-title {
            margin: 0;
            color: color-mix(in srgb, var(--wrath, #c83030) 78%, var(--gold-light, #e8b030));
            font-family: var(--font-serif, serif);
            font-size: 3rem;
            line-height: 1.18;
            text-wrap: balance;
          }

          .global-error-copy {
            margin: 1.25rem 0 0;
            max-width: 36rem;
            color: color-mix(in srgb, var(--gold-light, #e8b030) 66%, var(--bg-deep, #0d0b08));
            font-size: 0.9375rem;
            line-height: 1.8;
          }

          .global-error-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-top: 2.25rem;
            padding-top: 1.5rem;
            border-top: 0.0625rem solid color-mix(in srgb, var(--gold-dim, #8a6010) 28%, transparent);
          }

          .global-error-home,
          .global-error-reset {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 2.75rem;
            box-sizing: border-box;
            border-radius: 0.25rem;
            font-family: inherit;
            font-size: 0.875rem;
            font-weight: 800;
            text-decoration: none;
            padding: 0.75rem 1.25rem;
            transition:
              background-color 300ms cubic-bezier(0.16, 1, 0.3, 1),
              border-color 300ms cubic-bezier(0.16, 1, 0.3, 1),
              color 300ms cubic-bezier(0.16, 1, 0.3, 1),
              transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
          }

          .global-error-reset {
            border: 0;
            background-color: color-mix(in srgb, var(--gold, #c8900a) 92%, var(--gold-light, #e8b030));
            color: var(--bg-deep, #0d0b08);
            cursor: pointer;
          }

          .global-error-reset:hover {
            background-color: var(--gold-light, #e8b030);
          }

          .global-error-home {
            border: 0.0625rem solid color-mix(in srgb, var(--gold-dim, #8a6010) 70%, transparent);
            background-color: color-mix(in srgb, var(--bg-card, #1a1510) 56%, transparent);
            color: var(--gold, #c8900a);
          }

          .global-error-home:hover {
            border-color: var(--gold, #c8900a);
            background-color: color-mix(in srgb, var(--gold, #c8900a) 8%, var(--bg-card, #1a1510));
          }

          .global-error-reset:active,
          .global-error-home:active {
            transform: translateY(0.125rem);
          }

          .global-error-reset:focus-visible,
          .global-error-home:focus-visible {
            outline: 0.125rem solid var(--gold-light, #e8b030);
            outline-offset: 0.25rem;
          }

          @media (prefers-reduced-motion: reduce) {
            .global-error-shell,
            .global-error-line,
            .global-error-marker,
            .global-error-reset,
            .global-error-home {
              animation: none;
              transition: none;
            }
          }

          @media (max-width: 47.999rem) {
            .global-error-title {
              font-size: 2rem;
            }

            .global-error-actions {
              flex-direction: column;
            }
          }
        `}</style>
      </body>
    </html>
  )
}
