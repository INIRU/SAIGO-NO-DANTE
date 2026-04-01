'use client'

interface PageErrorProps {
  /** Charon-style quote line 1 */
  quote: string
  /** Charon-style quote line 2 (optional) */
  subQuote?: string
  reset: () => void
  /** Recovery link href (default: '/') */
  homeHref?: string
  /** Recovery link label (default: '메인으로') */
  homeLabel?: string
}

export default function PageError({ quote, subQuote, reset, homeHref = '/', homeLabel = '메인으로' }: PageErrorProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 pt-24">
      <div className="text-center max-w-md space-y-4 mb-8">
        <p className="font-serif text-lg" style={{ color: '#c83030' }}>
          &ldquo;{quote}&rdquo;
        </p>
        {subQuote && (
          <p style={{ color: '#4a3a2a', fontSize: '0.8125rem', fontFamily: 'var(--font-heading)', lineHeight: 1.8 }}>
            &ldquo;{subQuote}&rdquo;
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="px-5 py-2 rounded font-medium text-sm transition-all hover:brightness-110"
          style={{ background: '#c83030', color: '#fff', fontFamily: 'var(--font-heading)', cursor: 'pointer' }}
        >
          다시 해보기
        </button>
        <a
          href={homeHref}
          className="px-5 py-2 rounded font-medium text-sm transition-all hover:brightness-110"
          style={{ color: 'var(--gold)', border: '1px solid var(--gold-dim)', fontFamily: 'var(--font-heading)' }}
        >
          {homeLabel}
        </a>
      </div>
    </div>
  )
}
