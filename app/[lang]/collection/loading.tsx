export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-6 animate-pulse" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="max-w-5xl mx-auto">

        {/* 헤더: 타이틀 + 서브텍스트 + 진행률 */}
        <div className="mb-6 space-y-2">
          <div className="rounded" style={{ width: '7rem', height: '2.25rem', background: '#2a2318' }} />
          <div className="flex gap-3">
            <div className="rounded" style={{ width: '5rem', height: '0.6875rem', background: '#1e1a12' }} />
            <div className="rounded" style={{ width: '5rem', height: '0.6875rem', background: '#1e1a12' }} />
          </div>
        </div>

        {/* 수감자 탭 + 인격/EGO 토글 */}
        <div className="rounded overflow-hidden mb-4" style={{ background: '#1a1510', border: '1px solid rgba(200,144,10,0.08)' }}>
          {/* 인격/EGO 탭 토글 */}
          <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex-1 rounded-none" style={{ height: '2.5rem', background: 'rgba(200,144,10,0.12)' }} />
            <div className="flex-1" style={{ height: '2.5rem', background: 'transparent' }} />
          </div>

          {/* 수감자 탭 (12개) */}
          <div className="flex gap-1 p-3 overflow-x-auto">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded flex-shrink-0"
                style={{ width: '2.75rem', height: '2.75rem', background: i === 0 ? '#2a2318' : '#120e09' }}
              />
            ))}
          </div>

          {/* 인격 카드 그리드 */}
          <div className="p-4">
            {/* compact 토글 */}
            <div className="flex justify-end mb-3">
              <div className="rounded-lg" style={{ width: '5rem', height: '1.75rem', background: '#1e1a12' }} />
            </div>
            {/* 등급 그룹 */}
            {[3, 2].map(grade => (
              <div key={grade} className="mb-5">
                <div className="rounded mb-3" style={{ width: '3rem', height: '0.875rem', background: '#2a2318' }} />
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {Array.from({ length: grade === 3 ? 8 : 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded overflow-hidden"
                      style={{ aspectRatio: '3/4', background: '#120e09', border: '1px solid rgba(58,42,21,0.3)' }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
