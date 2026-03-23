'use client'

import Link from 'next/link'

export default function PlannerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center" style={{ background: '#0d0b08' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 className="font-serif" style={{ fontSize: '1.5rem', color: '#e8dcc8', marginBottom: '0.75rem' }}>
          오류가 발생했습니다
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          플래너 데이터를 불러오는 중 문제가 발생했습니다.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1.25rem', background: 'rgba(200,144,10,0.12)',
              border: '1px solid rgba(200,144,10,0.4)', borderRadius: '0.5rem',
              color: '#e8b030', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
          <Link
            href="/mirror-dungeon"
            style={{
              padding: '0.5rem 1.25rem', background: '#1a1510',
              border: '1px solid #333', borderRadius: '0.5rem',
              color: '#9ca3af', fontSize: '0.875rem',
            }}
          >
            거울 던전으로
          </Link>
        </div>
      </div>
    </div>
  )
}
