'use client'

import Image from 'next/image'

const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

// 키워드 → slug 매핑 (주요 키워드)
const KEYWORD_SLUG: Record<string, string> = {
  '출혈': 'bleed', '화상': 'burn', '진동': 'tremor', '파열': 'rupture',
  '침잠': 'sinking', '호흡': 'breath', '충전': 'charge',
  '참격': 'slash', '관통': 'pierce', '타격': 'blunt', '공통': 'general',
  '마비': 'paralysis', '속박': 'bind', '방어 레벨 감소': 'def-level-down',
}

// 죄악 색상 (키워드 기반 - 대략적)
const KEYWORD_COLOR: Record<string, string> = {
  '출혈': '#c83030', '화상': '#d06030', '진동': '#d4b830', '파열': '#88b028',
  '침잠': '#4898b0', '호흡': '#3870b0', '충전': '#8058a8',
  '참격': '#c8900a', '관통': '#c8900a', '타격': '#c8900a', '공통': '#888',
}

interface Props {
  distribution: { keyword: string; count: number }[]
}

export default function KeywordChart({ distribution }: Props) {
  const maxCount = Math.max(...distribution.map(d => d.count), 1)

  return (
    <div className="space-y-2">
      {distribution.slice(0, 10).map(d => {
        const slug = KEYWORD_SLUG[d.keyword]
        const color = KEYWORD_COLOR[d.keyword] ?? '#888'
        const pct = (d.count / maxCount) * 100

        return (
          <div key={d.keyword} className="flex items-center gap-2">
            {slug && (
              <Image
                src={`${STORAGE_BASE}/icons/keywords/${slug}.webp`}
                alt="" width={16} height={16}
                style={{ width: '1rem', height: '1rem', objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            <span style={{ width: '4rem', flexShrink: 0, fontSize: '0.75rem', color: '#b0a898' }}>
              {d.keyword}
            </span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: '0.5rem', background: '#222' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: color, minWidth: '0.25rem' }}
              />
            </div>
            <span style={{ width: '1.5rem', textAlign: 'right', fontSize: '0.6875rem', color: color, fontWeight: 600 }}>
              {d.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}
