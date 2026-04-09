const TIERS = ['S+', 'S', 'A', 'B', 'C', 'F'] as const

const TIER_COLORS: Record<string, string> = {
  'S+': '#ff5050',
  S: '#ff8c50',
  A: '#f0c040',
  B: '#70d070',
  C: '#50b0e0',
  F: '#9090b0',
}

export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 pt-28 pb-16 animate-pulse">

      {/* 헤더 블록 */}
      <div className="mb-8 space-y-2 text-center">
        <div className="mx-auto rounded" style={{ width: '8rem', height: '0.625rem', background: 'rgba(200,144,10,0.12)' }} />
        <div className="mx-auto rounded" style={{ width: '12rem', height: '2rem', background: '#2a2318' }} />
        <div className="mx-auto rounded" style={{ width: '18rem', height: '0.8125rem', background: '#1a1510' }} />
        <div className="mx-auto rounded" style={{ width: '14rem', height: '0.6875rem', background: '#1a1510' }} />
        <div className="mx-auto rounded" style={{ width: '10rem', height: '0.6875rem', background: '#1a1510' }} />
        {/* 범례 */}
        <div className="flex items-center justify-center gap-5 mt-4">
          {[4, 4, 4].map((w, i) => (
            <div key={i} className="rounded" style={{ width: `${w}rem`, height: '0.6875rem', background: '#1a1510' }} />
          ))}
        </div>
        {/* 시즌 필터 칩 */}
        <div className="flex items-center justify-center gap-2 flex-wrap mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-full" style={{ width: '3.5rem', height: '1.5rem', background: '#1a1510' }} />
          ))}
        </div>
      </div>

      {/* 6개 티어 행 */}
      <div className="space-y-2">
        {TIERS.map(tier => (
          <div
            key={tier}
            className="flex items-stretch rounded overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {/* 티어 라벨 */}
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: '3.5rem',
                minHeight: '4rem',
                background: `${TIER_COLORS[tier]}22`,
                borderRight: `2px solid ${TIER_COLORS[tier]}44`,
              }}
            >
              <span style={{ fontFamily: 'var(--font-serif)', color: TIER_COLORS[tier], fontWeight: 900, fontSize: '1.125rem', opacity: 0.5 }}>
                {tier}
              </span>
            </div>
            {/* 인격 카드 슬롯들 */}
            <div className="flex flex-wrap gap-1.5 p-2 flex-1" style={{ background: '#0f0d0a' }}>
              {Array.from({ length: tier === 'S+' ? 3 : tier === 'S' ? 5 : tier === 'A' ? 7 : tier === 'B' ? 6 : tier === 'C' ? 4 : 2 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded overflow-hidden"
                  style={{ width: '3rem', height: '4rem', background: '#1a1510', border: '1px solid rgba(200,144,10,0.06)' }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
