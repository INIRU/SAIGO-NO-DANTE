export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-20 px-6 max-w-7xl mx-auto animate-pulse">

      {/* 헤더: 장식 라인 + 태그 + 타이틀 + 서브텍스트 + 새 덱 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div className="space-y-2">
          <div style={{ width: '4rem', height: '0.0625rem', background: 'rgba(200,144,10,0.3)' }} />
          <div className="rounded" style={{ width: '8rem', height: '0.625rem', background: 'rgba(200,144,10,0.12)' }} />
          <div className="rounded" style={{ width: '6rem', height: '3rem', background: '#2a2318' }} />
          <div className="rounded" style={{ width: '12rem', height: '0.8125rem', background: '#1a1510' }} />
        </div>
        <div className="rounded-lg" style={{ width: '7rem', height: '2.5rem', background: 'rgba(200,144,10,0.1)', border: '1px solid rgba(200,144,10,0.2)' }} />
      </div>

      {/* 필터 패널 */}
      <div className="rounded-lg mb-6" style={{ background: '#1a1510', border: '1px solid rgba(255,255,255,0.05)' }}>
        {/* 검색 + 정렬 */}
        <div className="flex flex-col sm:flex-row gap-3 px-4 py-3">
          <div className="rounded-lg flex-1" style={{ height: '2.5rem', background: '#120e09', border: '1px solid rgba(255,255,255,0.06)' }} />
          <div className="flex gap-1.5 flex-shrink-0">
            {[3.5, 3.5, 3.5].map((w, i) => (
              <div key={i} className="rounded" style={{ width: `${w}rem`, height: '2.5rem', background: '#120e09' }} />
            ))}
          </div>
        </div>
        {/* 태그 필터 */}
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded" style={{ width: `${3 + (i % 3)}rem`, height: '1.75rem', background: '#120e09' }} />
          ))}
        </div>
      </div>

      {/* 덱 카드 목록 */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg"
            style={{ height: '8rem', background: '#1a1510', border: '1px solid rgba(200,144,10,0.06)' }}
          />
        ))}
      </div>

    </div>
  )
}
