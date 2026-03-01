import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: '#0d0b08' }}
    >
      {/* 404 숫자 */}
      <div
        className="relative mb-6 select-none"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'clamp(80px, 20vw, 160px)',
          fontWeight: 900,
          color: 'transparent',
          WebkitTextStroke: '2px rgba(200,144,10,0.3)',
          lineHeight: 1,
          letterSpacing: '0.05em',
        }}
      >
        404
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
            color: 'var(--gold)',
            opacity: 0.08,
            WebkitTextStroke: 'none',
          }}
        >
          404
        </span>
      </div>

      {/* 카론 대사 */}
      <div className="max-w-md text-center space-y-4 mb-10">
        <p
          className="font-serif text-xl md:text-2xl font-bold"
          style={{ color: 'var(--gold)' }}
        >
          &ldquo;승객이 길을 잃었어.&rdquo;
        </p>
        <p
          style={{
            color: '#6a5a4a',
            fontSize: '14px',
            fontFamily: 'var(--font-heading)',
            lineHeight: 1.8,
          }}
        >
          &ldquo;여긴 아무것도 없어. 카론도 잘 모르는 곳이야.&rdquo;
        </p>
        <p
          style={{
            color: '#4a3a2a',
            fontSize: '13px',
            fontFamily: 'var(--font-heading)',
            lineHeight: 1.8,
          }}
        >
          &ldquo;돌아가자. 늦으면 메피랑 먼저 갈 거야.&rdquo;
        </p>
      </div>

      {/* 돌아가기 버튼 */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded font-medium text-sm transition-all duration-300 hover:brightness-110"
        style={{
          background: 'var(--gold)',
          color: '#0d0b08',
          fontFamily: 'var(--font-heading)',
        }}
      >
        컴퍼니로 돌아가기
      </Link>

      {/* 하단 장식 */}
      <p
        className="mt-16"
        style={{
          color: '#2a2015',
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.2em',
        }}
      >
        PAGE NOT FOUND
      </p>
    </div>
  )
}
