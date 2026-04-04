export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto animate-pulse">
      {/* 헤더 + 탭 */}
      <div className="flex items-end justify-between mb-10">
        <div>
          {/* 장식 라인 */}
          <div className="mb-4" style={{ width: '4rem', height: '0.0625rem', background: 'rgba(200,144,10,0.3)' }} />
          {/* 태그 */}
          <div className="rounded mb-1.5" style={{ width: '8rem', height: '0.625rem', background: 'rgba(200,144,10,0.12)' }} />
          {/* 타이틀 */}
          <div className="rounded mb-2" style={{ width: '7rem', height: '2.25rem', background: '#2a2318' }} />
          {/* 서브텍스트 */}
          <div className="rounded" style={{ width: '14rem', height: '0.8125rem', background: '#1a1510' }} />
        </div>
        {/* 탭 버튼들 (데스크톱) */}
        <div className="hidden md:flex gap-1 rounded-lg p-0.5" style={{ background: 'rgba(10,8,5,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[3.5, 3.5, 3.5].map((w, i) => (
            <div key={i} className="rounded" style={{ width: `${w}rem`, height: '2rem', background: i === 0 ? 'rgba(200,144,10,0.15)' : 'transparent' }} />
          ))}
        </div>
      </div>

      {/* 검색 + 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* 검색 입력 */}
        <div className="rounded-lg flex-1" style={{ minWidth: '12rem', height: '2.5rem', background: '#1a1510', border: '1px solid rgba(255,255,255,0.06)' }} />
        {/* 등급 드롭다운 */}
        <div className="rounded-lg" style={{ width: '6rem', height: '2.5rem', background: '#1a1510', border: '1px solid rgba(255,255,255,0.06)' }} />
        {/* 정렬 드롭다운 */}
        <div className="rounded-lg" style={{ width: '6rem', height: '2.5rem', background: '#1a1510', border: '1px solid rgba(255,255,255,0.06)' }} />
      </div>

      {/* 키워드 필터 칩 12개 */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-full" style={{ width: '3.5rem', height: '1.75rem', background: '#1a1510', border: '1px solid rgba(255,255,255,0.06)' }} />
        ))}
      </div>

      {/* 기프트 카드 그리드 (auto-fill minmax) */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(3.75rem, 1fr))' }}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="rounded"
            style={{ aspectRatio: '1', background: '#1a1510', border: '1px solid rgba(200,144,10,0.06)' }}
          />
        ))}
      </div>
    </div>
  )
}
