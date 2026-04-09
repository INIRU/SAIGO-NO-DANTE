export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse" style={{ background: '#0d0b08' }}>
      {/* 다크 그라디언트 히어로 (360px) */}
      <div style={{ height: '22.5rem', background: 'linear-gradient(to bottom, #080604, #0d0b08)' }} />

      {/* 사이드바 + 콘텐츠 레이아웃 */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6 flex gap-5">
        {/* 사이드바 (데스크톱만) */}
        <div className="hidden lg:block flex-shrink-0" style={{ width: '15.75rem' }}>
          <div className="rounded-lg mb-3" style={{ height: '9rem', background: '#120e09' }} />
          <div className="rounded-lg" style={{ height: '12rem', background: '#120e09', opacity: 0.6 }} />
        </div>

        {/* 메인 콘텐츠: 인격 카드 섹션 + 댓글 */}
        <div className="flex-1 flex flex-col gap-3">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="rounded-lg"
              style={{ height: '8rem', background: '#120e09', opacity: 0.2 + i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
