export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16 animate-pulse" style={{ background: '#0d0b08' }}>
      <div className="max-w-6xl mx-auto px-3 sm:px-6">

        {/* 헤더: 뒤로가기 링크 + 타이틀 + 액션 버튼들 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="space-y-2">
            <div className="rounded" style={{ width: '4rem', height: '0.75rem', background: '#1e1a12' }} />
            <div className="rounded" style={{ width: '9rem', height: '1.5rem', background: '#2a2318' }} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[4.5, 5, 4].map((w, i) => (
              <div key={i} className="rounded-lg" style={{ width: `${w}rem`, height: '2rem', background: i === 0 ? 'rgba(200,144,10,0.2)' : '#1a1510', border: i === 0 ? 'none' : '1px solid rgba(200,144,10,0.2)' }} />
            ))}
          </div>
        </div>

        {/* 난이도 선택 버튼들 */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[5.5, 5, 6, 4.5].map((w, i) => (
            <div key={i} className="rounded-lg flex-shrink-0" style={{ width: `${w}rem`, height: '2.25rem', background: i === 0 ? 'rgba(200,144,10,0.12)' : '#1a1510', border: `1px solid ${i === 0 ? 'rgba(200,144,10,0.3)' : '#222'}` }} />
          ))}
        </div>

        {/* 탭 바 */}
        <div className="flex mb-6 overflow-x-auto" style={{ borderBottom: '1px solid #222' }}>
          {[4.5, 4, 5, 5.5, 4].map((w, i) => (
            <div
              key={i}
              className="flex-shrink-0"
              style={{
                width: `${w}rem`,
                height: '2.5rem',
                background: i === 0 ? 'rgba(200,144,10,0.07)' : 'transparent',
                borderBottom: i === 0 ? '2px solid #c8900a' : '2px solid transparent',
              }}
            />
          ))}
        </div>

        {/* 탭 콘텐츠: 인격 12개 카드 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg overflow-hidden"
              style={{ aspectRatio: '3/4', background: '#1a1510', border: '1px solid rgba(200,144,10,0.08)' }}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
