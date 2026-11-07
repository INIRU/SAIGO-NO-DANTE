'use client'

import { earlyErrors } from '@/lib/sentry/early'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// Rendered without the root layout, so no providers or next-intl: copy mirrors messages/*.json "errorPage".
const COPY = {
  ko: { title: '페이지를 불러오지 못했습니다.', hint: '잠시 후 다시 시도해 주세요.', retry: '다시 시도', home: '홈으로' },
  en: { title: "This page couldn't be loaded.", hint: 'Please try again in a moment.', retry: 'Try again', home: 'Home' },
  ja: { title: 'ページを読み込めませんでした。', hint: 'しばらくしてからもう一度お試しください。', retry: '再試行', home: 'ホームへ' },
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // sent once the browser Sentry has started (it loads after the page)
    earlyErrors.report(error)
  }, [error])

  const segment = usePathname()?.split('/')[1]
  const lang = segment === 'en' || segment === 'ja' ? segment : 'ko'
  const t = COPY[lang]

  return (
    <html lang={lang}>
      <body style={{ margin: 0, background: 'var(--bg-deep)', color: 'var(--text-primary)', colorScheme: 'dark', fontFamily: 'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif' }}>
        <main style={{ boxSizing: 'border-box', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 1.5rem', textAlign: 'center' }}>
          <p className="ge-code" aria-hidden="true" translate="no">500</p>
          <h1 style={{ margin: '1.5rem 0 0', fontSize: '1.375rem', fontWeight: 700 }}>{t.title}</h1>
          <p style={{ margin: '0.75rem 0 0', color: '#9c8b73', fontSize: '0.9375rem', lineHeight: 1.6 }}>{t.hint}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '2.5rem' }}>
            <button type="button" className="ge-btn ge-primary" onClick={() => reset()}>{t.retry}</button>
            <a className="ge-btn" href={`/${lang}`}>{t.home}</a>
          </div>
        </main>
        <style>{`
          @font-face { font-family: 'Bebas Kai'; src: url(/fonts/BebasKai.woff2) format('woff2'); font-display: swap; }
          .ge-code { margin: 0; font-family: 'Bebas Kai', Impact, sans-serif; font-size: clamp(6rem, 24vw, 11rem); line-height: 1; color: #c8900a; }
          .ge-btn { display: inline-flex; align-items: center; min-height: 2.75rem; box-sizing: border-box; padding: 0 1.25rem; border: 1px solid rgba(200, 144, 10, 0.45); border-radius: 0.125rem; background: none; color: #c8900a; font: inherit; font-size: 0.875rem; text-decoration: none; cursor: pointer; }
          .ge-btn:hover { border-color: #c8900a; }
          .ge-primary { border-color: #c8900a; background: #c8900a; color: #0d0b08; }
          .ge-primary:hover { background: #e8b030; }
          .ge-btn:focus-visible { outline: 2px solid #e8b030; outline-offset: 4px; }
          @media (prefers-reduced-motion: no-preference) {
            .ge-code { animation: ge-settle 900ms cubic-bezier(0.16, 1, 0.3, 1) both; }
          }
          @keyframes ge-settle {
            from { opacity: 0; transform: translateY(-0.75rem); letter-spacing: 0.08em; }
            to { opacity: 1; transform: none; letter-spacing: 0; }
          }
        `}</style>
      </body>
    </html>
  )
}
