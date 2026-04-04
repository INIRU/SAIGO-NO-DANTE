export default function Loading() {
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 animate-pulse">
      {/* 배경 글로우 placeholder */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* 수감자 정보 카드 */}
        <div className="sinner-info-card flex flex-col sm:flex-row items-start gap-6 mb-8 p-5 rounded-xl"
          style={{ background: '#1a1510', border: '1px solid rgba(200,144,10,0.1)' }}>
          {/* 프로필 이미지 */}
          <div className="shrink-0 rounded-lg" style={{ width: '8rem', height: '10rem', background: '#120e09' }} />
          <div className="flex-1 min-w-0 space-y-3 pt-1">
            {/* 이름 */}
            <div className="rounded" style={{ width: '7rem', height: '1.75rem', background: '#2a2318' }} />
            <div className="rounded" style={{ width: '5rem', height: '0.875rem', background: '#1e1a12' }} />
            {/* 키워드 chips */}
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-full" style={{ width: '4rem', height: '1.5rem', background: '#1e1a12' }} />
              ))}
            </div>
          </div>
        </div>

        {/* 탭 + 콘텐츠 영역 */}
        <div className="sinner-content-area">
          {/* 탭 바 */}
          <div className="flex gap-2 mb-5">
            <div className="rounded-lg" style={{ width: '5rem', height: '2.5rem', background: 'rgba(200,144,10,0.15)', border: '1px solid rgba(200,144,10,0.3)' }} />
            <div className="rounded-lg" style={{ width: '4.5rem', height: '2.5rem', background: '#1a1510', border: '1px solid rgba(255,255,255,0.06)' }} />
          </div>

          {/* 필터 바: 검색 + 등급 + 정렬 */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="rounded-lg flex-1" style={{ minWidth: '10rem', height: '2.5rem', background: '#1a1510', border: '1px solid rgba(255,255,255,0.06)' }} />
            {['1성', '2성', '3성'].map(r => (
              <div key={r} className="rounded" style={{ width: '3.5rem', height: '2.5rem', background: '#1a1510', border: '1px solid rgba(255,255,255,0.06)' }} />
            ))}
            <div className="rounded" style={{ width: '6rem', height: '2.5rem', background: '#1a1510', border: '1px solid rgba(255,255,255,0.06)' }} />
          </div>

          {/* 키워드 칩 행 */}
          <div className="flex flex-wrap gap-2 mb-6">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-full" style={{ width: '4.5rem', height: '1.75rem', background: '#1a1510', border: '1px solid rgba(255,255,255,0.06)' }} />
            ))}
          </div>

          {/* 인격 카드 그리드: 2열 → 3열 sm → 4열 md */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden"
                style={{ aspectRatio: '3/4', background: '#1a1510', border: '1px solid rgba(200,144,10,0.08)' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
