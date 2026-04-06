'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { STORAGE_BASE } from '@/lib/data/sinners'
import { SIN_COLORS } from '@/lib/constants/sin'
import { usePretextTruncate } from '@/lib/hooks/usePretextTruncate'

const SIN_LABELS: Record<string, string> = {
  wrath: '분노', lust: '색욕', sloth: '나태', gluttony: '탐식',
  gloom: '우울', pride: '오만', envy: '질투',
}

interface KeywordCardProps {
  keyword: {
    name: string
    description: string | null
    max_stack: number | null
    icon_slug: string | null
    sin_affinity: string | null
    category: string | null
  }
  identityCount: number
  egoCount: number
  giftCount: number
  animationDelay: number
  onClick: () => void
}

export default function KeywordCard({
  keyword: kw, identityCount, egoCount, giftCount, animationDelay, onClick,
}: KeywordCardProps) {
  const sinColor = kw.sin_affinity
    ? ((SIN_COLORS as Record<string, string>)[kw.sin_affinity] || '#c8900a')
    : null
  const iconUrl = kw.icon_slug
    ? `${STORAGE_BASE}/icons/keywords/${kw.icon_slug}.webp`
    : null

  // Pretext 기반 description truncation (line-clamp-2 대체)
  const descRef = useRef<HTMLParagraphElement>(null)
  const [descWidth, setDescWidth] = useState(0)

  useEffect(() => {
    if (!descRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setDescWidth(entry.contentRect.width)
    })
    ro.observe(descRef.current)
    return () => ro.disconnect()
  }, [])

  const rootFontSize = typeof document !== 'undefined'
    ? (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
    : 16
  // text-[0.6875rem] = 11px at 16px root, leading-relaxed = 1.625
  const descFontSizePx = 0.6875 * rootFontSize
  const descLineHeightPx = descFontSizePx * 1.625

  const { displayText: descDisplayText, isTruncated: descIsTruncated } = usePretextTruncate(
    kw.description ?? '',
    2,
    descWidth,
    `${descFontSizePx}px SCDream, Pretendard, sans-serif`,
    descLineHeightPx,
  )

  return (
    <button
      onClick={onClick}
      className="kw-card group text-left rounded-lg overflow-hidden transition-all duration-200 hover:scale-[1.02]"
      style={{
        animation: `kwCardIn 0.3s ease both`,
        animationDelay: `${animationDelay}s`,
        background: '#1a1510',
        border: '0.0625rem solid rgba(200,144,10,0.08)',
        cursor: 'pointer',
        position: 'relative',
        width: '100%',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = sinColor ? `${sinColor}40` : 'rgba(200,144,10,0.25)'
        el.style.boxShadow = `0 0 1.5rem ${sinColor ? `${sinColor}15` : 'rgba(200,144,10,0.08)'}`
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'rgba(200,144,10,0.08)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* 죄악 색상 좌측 보더 */}
      {sinColor && (
        <div
          className="absolute left-0 top-0 bottom-0 rounded-l-lg"
          style={{ width: '0.125rem', background: `${sinColor}60` }}
        />
      )}

      <div className="p-3 flex items-start gap-2.5">
        {/* 아이콘 */}
        <div
          className="shrink-0 flex items-center justify-center rounded"
          style={{
            width: '2.5rem', height: '2.5rem',
            background: sinColor ? `${sinColor}10` : 'rgba(200,144,10,0.06)',
            border: `0.0625rem solid ${sinColor ? `${sinColor}20` : 'rgba(200,144,10,0.1)'}`,
          }}
        >
          {iconUrl ? (
            <Image src={iconUrl} alt={kw.name} width={22} height={22}
              style={{ width: '1.375rem', height: 'auto' }} />
          ) : (
            <span style={{ color: '#555', fontSize: '0.75rem' }}>?</span>
          )}
        </div>

        {/* 텍스트 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-bold text-[0.8125rem] truncate" style={{ color: '#e8dcc8' }}>
              {kw.name}
            </span>
            {kw.max_stack && (
              <span className="text-[0.625rem] shrink-0" style={{ color: '#7a6845' }}>
                (최대 {kw.max_stack})
              </span>
            )}
          </div>
          {kw.description && (
            <p
              ref={descRef}
              className="text-[0.6875rem] leading-relaxed"
              style={{ color: '#7a6845' }}
              title={descIsTruncated ? kw.description : undefined}
            >
              {descWidth > 0 ? descDisplayText : kw.description}
            </p>
          )}
          {/* 카운트 태그 */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {identityCount > 0 && (
              <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(200,144,10,0.08)', color: '#c8900a' }}>
                인격 {identityCount}
              </span>
            )}
            {egoCount > 0 && (
              <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(180,100,100,0.08)', color: '#b06060' }}>
                EGO {egoCount}
              </span>
            )}
            {giftCount > 0 && (
              <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(100,180,100,0.08)', color: '#6a9a6a' }}>
                기프트 {giftCount}
              </span>
            )}
            {sinColor && (
              <span className="text-[0.5625rem] px-1.5 py-0.5 rounded"
                style={{ background: `${sinColor}10`, color: sinColor }}>
                {SIN_LABELS[kw.sin_affinity!]}
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={14} className="shrink-0 mt-1 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: '#c8900a' }} />
      </div>

      {/* 하단 글로우 */}
      {sinColor && (
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none rounded-b-lg"
          style={{
            height: '1.5rem',
            background: `linear-gradient(transparent, ${sinColor}08)`,
          }}
        />
      )}
    </button>
  )
}
