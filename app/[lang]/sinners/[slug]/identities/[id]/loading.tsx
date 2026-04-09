export default function Loading() {
  return (
    <div className="min-h-screen pt-24 pb-16 animate-pulse" style={{ background: '#0d0b08' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* 왼쪽: 초상화 + 이름 헤더 */}
          <div className="space-y-4">
            {/* 이름 헤더: 프레임 아이콘 + 이름/영문명 */}
            <div className="flex items-center gap-2">
              <div className="shrink-0 rounded" style={{ width: '2.5rem', height: '2.5rem', background: '#2a2318' }} />
              <div className="flex-1 space-y-1.5">
                <div className="rounded" style={{ width: '8rem', height: '1.25rem', background: '#2a2318' }} />
                <div className="rounded" style={{ width: '5rem', height: '0.6875rem', background: '#1e1a12' }} />
              </div>
            </div>
            {/* 인격 정보 이미지 */}
            <div className="rounded-lg overflow-hidden" style={{ aspectRatio: '3/2', background: '#120e09', border: '1px solid rgba(200,144,10,0.08)' }} />
          </div>

          {/* 오른쪽: 탭 + 콘텐츠 */}
          <div className="lg:col-span-2 space-y-4">
            {/* 탭 바 */}
            <div className="flex gap-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0' }}>
              {[5, 4.5, 4].map((w, i) => (
                <div
                  key={i}
                  className="rounded-t"
                  style={{
                    width: `${w}rem`,
                    height: '2.5rem',
                    background: i === 0 ? 'rgba(200,144,10,0.12)' : '#1a1510',
                    borderBottom: i === 0 ? '2px solid #c8900a' : '2px solid transparent',
                  }}
                />
              ))}
            </div>

            {/* 스킬 카드 3개 */}
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-lg p-4 space-y-3" style={{ background: '#1a1510', border: '1px solid rgba(200,144,10,0.08)' }}>
                <div className="flex items-center gap-3">
                  <div className="rounded shrink-0" style={{ width: '2.5rem', height: '2.5rem', background: '#2a2318' }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="rounded" style={{ width: '6rem', height: '1rem', background: '#2a2318' }} />
                    <div className="flex gap-1.5">
                      <div className="rounded" style={{ width: '3rem', height: '0.75rem', background: '#1e1a12' }} />
                      <div className="rounded" style={{ width: '3rem', height: '0.75rem', background: '#1e1a12' }} />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="rounded" style={{ width: '100%', height: '0.75rem', background: '#1e1a12' }} />
                  <div className="rounded" style={{ width: '75%', height: '0.75rem', background: '#1e1a12' }} />
                </div>
              </div>
            ))}

            {/* 패시브 섹션 */}
            <div className="rounded-lg p-4 space-y-2" style={{ background: '#1a1510', border: '1px solid rgba(200,144,10,0.08)' }}>
              <div className="rounded" style={{ width: '4rem', height: '1rem', background: '#2a2318' }} />
              <div className="rounded" style={{ width: '100%', height: '0.75rem', background: '#1e1a12' }} />
              <div className="rounded" style={{ width: '60%', height: '0.75rem', background: '#1e1a12' }} />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
