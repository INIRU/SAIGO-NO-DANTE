'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#0d0b08' }}
    >
      {/* 500 숫자 */}
      <div
        className="relative mb-6 select-none"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(80px, 20vw, 160px)',
          fontWeight: 900,
          color: 'transparent',
          WebkitTextStroke: '2px rgba(200,48,48,0.3)',
          lineHeight: 1,
          letterSpacing: '0.05em',
        }}
      >
        500
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(80px, 20vw, 160px)',
            fontWeight: 900,
            color: '#c83030',
            opacity: 0.08,
            WebkitTextStroke: 'none',
          }}
        >
          500
        </span>
      </div>

      {/* 카론 대사 */}
      <div className="max-w-md text-center space-y-4 mb-10">
        <p
          className="font-serif text-xl md:text-2xl font-bold"
          style={{ color: '#c83030' }}
        >
          &ldquo;카론, 빙글빙글.&rdquo;
        </p>
        <p
          style={{
            color: '#6a5a4a',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-heading)',
            lineHeight: 1.8,
          }}
        >
          &ldquo;뭔가 고장났어. 멀미 봉투는 좌석 밑에 있어. 메피한테 토하지 마.&rdquo;
        </p>
        <p
          style={{
            color: '#4a3a2a',
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-heading)',
            lineHeight: 1.8,
          }}
        >
          &ldquo;카론, 기다리는 거 못해. 100초만 기다려 줄게.&rdquo;
        </p>
      </div>

      {/* 다시 시도 버튼 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded font-medium text-sm transition-all duration-300 hover:brightness-110"
          style={{
            background: '#c83030',
            color: '#fff',
            fontFamily: 'var(--font-heading)',
            cursor: 'pointer',
          }}
        >
          째깍째깍 다시 해보기
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded font-medium text-sm transition-all duration-300 hover:brightness-110"
          style={{
            background: 'transparent',
            color: 'var(--gold)',
            border: '1px solid var(--gold-dim)',
            fontFamily: 'var(--font-heading)',
          }}
        >
          컴퍼니로 돌아가기
        </a>
      </div>

      {/* 하단 장식 */}
      <p
        className="mt-16"
        style={{
          color: '#2a2015',
          fontSize: '0.625rem',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.2em',
        }}
      >
        INTERNAL SERVER ERROR
      </p>
    </div>
  )
}
