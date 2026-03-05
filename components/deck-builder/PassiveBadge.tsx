'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { useFormatSkillDesc } from '@/components/sinners/KeywordTooltip'
import {
  SIN_COLORS,
  SIN_ICON_MAP,
  type SinType,
} from '@/lib/data/sinners'
import type { Passive } from '@/lib/data/sinners'

// 한국어 죄악명 → SinType
const SIN_KR_TO_TYPE: Record<string, SinType> = {
  '분노': 'wrath', '색욕': 'lust', '나태': 'sloth', '탐식': 'gluttony',
  '우울': 'gloom', '오만': 'pride', '질투': 'envy',
}

export default function PassiveBadge({ p, deckSinCounts }: {
  p: Passive
  deckSinCounts: Record<string, number>
}) {
  const formatSkillDesc = useFormatSkillDesc()
  const ref = useRef<HTMLDivElement>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null)

  // 복수 죄악 지원 (예: "나태, 오만")
  const sinNames = p.sin_affinity ? p.sin_affinity.split(',').map(s => s.trim()) : []
  const sinTypeList = sinNames.map(s => SIN_KR_TO_TYPE[s]).filter(Boolean) as SinType[]
  const sinType = sinTypeList[0] ?? null
  const sinColor = sinType ? SIN_COLORS[sinType] : '#667788'
  const currentCount = sinTypeList.reduce((sum, st) => sum + (deckSinCounts[st] ?? 0), 0)
  const requiredCount = p.sin_count ?? 1

  const handleMouseEnter = () => {
    if (!ref.current || !p.description) return
    const rect = ref.current.getBoundingClientRect()
    const above = rect.top > 160
    setTooltipStyle(
      above
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }
    )
  }

  return (
    <div
      ref={ref}
      className="relative flex items-center gap-1.5 px-2 py-1 rounded"
      style={{ background: `${sinColor}12`, border: `1px solid ${sinColor}30`, flexShrink: 0, cursor: 'default' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTooltipStyle(null)}
    >
      {/* 죄악 조건 */}
      {sinTypeList.length > 0 ? (
        <div className="flex items-center gap-0.5">
          {sinTypeList.map((st, i) => (
            <Image key={i} src={SIN_ICON_MAP[st]} alt="" width={16} height={16} />
          ))}
          <span style={{ color: sinColor, fontSize: '0.625rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {currentCount}/{requiredCount}
          </span>
          <span style={{ color: sinColor, fontSize: '0.625rem', fontFamily: 'var(--font-mono)', marginLeft: '1px', opacity: 0.8 }}>
            {p.active_cond}
          </span>
        </div>
      ) : (
        <span style={{ color: '#445566', fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>{p.active_cond ?? '-'}</span>
      )}
      <span style={{ color: sinColor, fontSize: '0.6875rem', fontWeight: 600 }}>{p.name}</span>

      {/* 호버 툴팁 — fixed로 overflow 탈출 */}
      {tooltipStyle && p.description && (
        <div
          className="z-[200] px-3 py-2.5 rounded shadow-lg pointer-events-none"
          style={{
            position: 'fixed',
            left: ref.current ? Math.min(ref.current.getBoundingClientRect().left, window.innerWidth - 330) : 0,
            ...tooltipStyle,
            background: '#1a1510',
            border: '1px solid #3a3020',
            minWidth: '220px',
            maxWidth: '320px',
            whiteSpace: 'normal',
          }}
        >
          <div style={{ color: sinColor, fontSize: '0.6875rem', fontWeight: 700, marginBottom: '4px' }}>{p.name}</div>
          <div style={{ color: '#999', fontSize: '0.6875rem', lineHeight: 1.5 }}>
            {formatSkillDesc(p.description, sinColor)}
          </div>
        </div>
      )}
    </div>
  )
}
