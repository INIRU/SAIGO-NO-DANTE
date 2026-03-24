export default function KeywordsLoading() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto">
      {/* 헤더 스켈레톤 */}
      <div className="text-center mb-10">
        <div className="h-3 w-24 mx-auto mb-3 rounded animate-pulse" style={{ background: 'rgba(200,144,10,0.1)' }} />
        <div className="h-8 w-40 mx-auto mb-2 rounded animate-pulse" style={{ background: 'rgba(200,144,10,0.08)' }} />
        <div className="h-4 w-56 mx-auto rounded animate-pulse" style={{ background: 'rgba(200,144,10,0.05)' }} />
      </div>

      {/* 검색바 스켈레톤 */}
      <div className="mb-8 max-w-md mx-auto">
        <div className="h-10 rounded-lg animate-pulse" style={{ background: '#1a1510', border: '0.0625rem solid rgba(200,144,10,0.08)' }} />
      </div>

      {/* 카드 그리드 스켈레톤 */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}>
        {Array.from({ length: 18 }, (_, i) => (
          <div
            key={i}
            className="rounded-lg overflow-hidden animate-pulse"
            style={{
              background: '#1a1510',
              border: '0.0625rem solid rgba(200,144,10,0.06)',
              animationDelay: `${i * 0.05}s`,
            }}
          >
            <div className="p-3 flex items-start gap-2.5">
              <div className="shrink-0 rounded" style={{ width: '2.5rem', height: '2.5rem', background: 'rgba(200,144,10,0.06)' }} />
              <div className="flex-1 min-w-0">
                <div className="h-3.5 w-20 rounded mb-2" style={{ background: 'rgba(200,144,10,0.08)' }} />
                <div className="h-2.5 w-full rounded mb-1" style={{ background: 'rgba(200,144,10,0.04)' }} />
                <div className="h-2.5 w-3/4 rounded mb-2" style={{ background: 'rgba(200,144,10,0.04)' }} />
                <div className="flex gap-1">
                  <div className="h-4 w-12 rounded" style={{ background: 'rgba(200,144,10,0.06)' }} />
                  <div className="h-4 w-10 rounded" style={{ background: 'rgba(180,100,100,0.06)' }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
