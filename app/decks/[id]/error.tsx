'use client'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 pt-24">
      <div className="text-center max-w-md space-y-4 mb-8">
        <p className="font-serif text-lg" style={{ color: '#c83030' }}>
          &ldquo;이 덱이 말을 안 들어.&rdquo;
        </p>
        <p style={{ color: '#4a3a2a', fontSize: '0.8125rem', fontFamily: 'var(--font-heading)', lineHeight: 1.8 }}>
          &ldquo;엔진이 과열된 것 같아.&rdquo;
        </p>
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
          href="/decks"
          className="px-5 py-2 rounded font-medium text-sm transition-all hover:brightness-110"
          style={{ color: 'var(--gold)', border: '1px solid var(--gold-dim)', fontFamily: 'var(--font-heading)' }}
        >
          덱 목록으로
        </a>
      </div>
    </div>
  )
}
