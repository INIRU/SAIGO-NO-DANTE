'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { STORAGE_BASE, SIN_COLORS, SIN_KR_TO_EN, type SinType } from '@/lib/data/sinners'
import SkillDescription from '@/components/skill/SkillDescription'

export type PassiveDetail = {
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string
  passive_order: number
  uptie_level?: number | null
}

function sinIconUrl(sin: string): string {
  const cap = sin.charAt(0).toUpperCase() + sin.slice(1)
  return `${STORAGE_BASE}/icons/Sins/transparent/${cap}.webp`
}

export default function PassiveBadgeDetail({
  p,
  deckSinCounts,
}: {
  p: PassiveDetail
  deckSinCounts: Record<string, number>
}) {
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [tipPos, setTipPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null)

  const sinNames = p.sin_affinity ? p.sin_affinity.split(',').map(s => s.trim()) : []
  const sinTypeList = sinNames.map(s => SIN_KR_TO_EN[s]).filter(Boolean) as SinType[]
  const pc = sinTypeList[0] ? (SIN_COLORS[sinTypeList[0]] ?? '#cccccc') : '#cccccc'
  const current = sinTypeList.reduce((sum, st) => sum + (deckSinCounts[st] ?? 0), 0)
  const required = p.sin_count ?? 1

  const onEnter = () => {
    if (!ref.current || !p.description) return
    setHover(true)
    const rect = ref.current.getBoundingClientRect()
    const above = rect.top > 180
    setTipPos({
      left: Math.min(rect.left, window.innerWidth - 330),
      ...(above ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    })
  }

  return (
    <div
      ref={ref}
      className="relative flex items-center gap-1.5 px-2 py-1 rounded"
      style={{ background: `${pc}12`, border: `1px solid ${pc}30`, cursor: 'default' }}
      onMouseEnter={onEnter}
      onMouseLeave={() => { setHover(false); setTipPos(null) }}
    >
      {sinTypeList.length > 0 && (
        <div className="flex items-center gap-0.5" style={{ flexShrink: 0 }}>
          {sinTypeList.map((st, i) => (
            <Image key={i} src={sinIconUrl(st)} alt="" width={16} height={16} />
          ))}
          <span style={{ color: pc, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{current}/{required}</span>
        </div>
      )}
      {p.active_cond && <span style={{ color: pc, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', opacity: 0.8, flexShrink: 0 }}>{p.active_cond}</span>}
      <span style={{ color: pc, fontSize: '0.6875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.name}</span>

      {hover && tipPos && p.description && (
        <div
          className="z-[200] px-3 py-2.5 rounded shadow-lg pointer-events-none"
          style={{
            position: 'fixed',
            left: tipPos.left,
            top: tipPos.top,
            bottom: tipPos.bottom,
            background: '#1a1510',
            border: '1px solid #3a3020',
            minWidth: '220px',
            maxWidth: '320px',
            whiteSpace: 'normal',
          }}
        >
          <div style={{ color: pc, fontSize: '0.6875rem', fontWeight: 700, marginBottom: '4px' }}>{p.name}</div>
          <SkillDescription description={p.description} accentColor={pc} variant="tooltip" showCoinBadges={false} />
        </div>
      )}
    </div>
  )
}
