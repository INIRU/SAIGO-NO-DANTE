export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-6 max-w-7xl mx-auto animate-pulse">
      {/* 헤더 */}
      <div className="mb-12 text-center">
        {/* 상단 장식 라인 */}
        <div className="mx-auto mb-5" style={{ width: '6rem', height: '0.0625rem', background: 'rgba(200,144,10,0.15)' }} />
        {/* 태그 */}
        <div className="mx-auto mb-3 rounded" style={{ width: '10rem', height: '0.625rem', background: 'rgba(200,144,10,0.12)' }} />
        {/* 타이틀 */}
        <div className="mx-auto mb-3 rounded" style={{ width: '9rem', height: '2.75rem', background: '#2a2318' }} />
        {/* 서브텍스트 */}
        <div className="mx-auto rounded" style={{ width: '11rem', height: '0.875rem', background: '#1a1510' }} />
        {/* 하단 장식 라인 */}
        <div className="mx-auto mt-6" style={{ width: '12rem', height: '0.0625rem', background: 'rgba(200,144,10,0.12)' }} />
        {/* 버튼 2개 */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <div className="rounded-lg" style={{ width: '8rem', height: '2.5rem', background: 'rgba(200,144,10,0.06)', border: '1px solid rgba(200,144,10,0.15)' }} />
          <div className="rounded-lg" style={{ width: '8.5rem', height: '2.5rem', background: 'rgba(200,144,10,0.06)', border: '1px solid rgba(200,144,10,0.15)' }} />
        </div>
      </div>

      {/* 12-card grid: 2 cols mobile → 3 sm → 4 md → 6 lg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg overflow-hidden"
            style={{ aspectRatio: '2/3', background: '#1a1510', border: '1px solid rgba(200,144,10,0.08)' }}
          />
        ))}
      </div>

      {/* 하단 장식 */}
      <div className="mt-16 flex items-center justify-center gap-4">
        <div style={{ width: '4rem', height: '0.0625rem', background: 'rgba(200,144,10,0.1)' }} />
        <div className="rounded" style={{ width: '1.5rem', height: '0.5rem', background: 'rgba(200,144,10,0.08)' }} />
        <div style={{ width: '4rem', height: '0.0625rem', background: 'rgba(200,144,10,0.1)' }} />
      </div>
    </div>
  )
}
