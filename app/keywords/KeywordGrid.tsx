'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import KeywordCard from './KeywordCard'

interface Keyword {
  name: string
  description: string | null
  max_stack: number | null
  icon_slug: string | null
  sin_affinity: string | null
}

interface KeywordGridProps {
  keywords: Keyword[]
  countMaps: {
    identity: Record<string, number>
    ego: Record<string, number>
    gift: Record<string, number>
  }
  onSelect: (kw: Keyword) => void
}

const PAGE_SIZE = 60

export default function KeywordGrid({ keywords, countMaps, onSelect }: KeywordGridProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  // filtered 변경 시 리셋
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [keywords])

  const visible = useMemo(() => keywords.slice(0, visibleCount), [keywords, visibleCount])

  // 무한 스크롤
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingRef.current) {
        loadingRef.current = true
        setVisibleCount(prev => {
          const next = Math.min(prev + PAGE_SIZE, keywords.length)
          setTimeout(() => { loadingRef.current = false }, 300)
          return next
        })
      }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [keywords.length])

  if (keywords.length === 0) {
    return (
      <div className="text-center py-20" style={{ color: '#555' }}>
        <p className="text-lg mb-2">결과 없음</p>
        <p className="text-sm">검색어를 변경해 보세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}>
        {visible.map((kw, i) => (
          <KeywordCard
            key={kw.name}
            keyword={kw}
            identityCount={countMaps.identity[kw.name] || 0}
            egoCount={countMaps.ego[kw.name] || 0}
            giftCount={countMaps.gift[kw.name] || 0}
            animationDelay={(i % PAGE_SIZE) * 0.015}
            onClick={() => onSelect(kw)}
          />
        ))}
      </div>

      {visibleCount < keywords.length && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          <span style={{ color: '#555', fontSize: '0.75rem' }}>불러오는 중...</span>
        </div>
      )}
    </>
  )
}
