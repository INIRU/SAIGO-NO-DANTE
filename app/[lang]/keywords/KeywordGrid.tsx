'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import KeywordIcon from '@/components/ui/KeywordIcon'
import { SIN_COLORS } from '@/lib/constants/sin'
import { translations } from '@/lib/i18n/translations'
import { getLocalizedKeywordName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { resolveKeywordIconUrl } from '@/components/providers/KeywordProvider'
import KeywordCard from './KeywordCard'

interface Keyword {
  name: string
  description: string | null
  max_stack: number | null
  icon_slug: string | null
  sin_affinity: string | null
  category: string | null
  name_en?: string | null
  name_jp?: string | null
  description_en?: string | null
  description_jp?: string | null
}

interface KeywordGridProps {
  keywords: Keyword[]
  countMaps: {
    identity: Record<string, number>
    ego: Record<string, number>
    gift: Record<string, number>
  }
  onSelect: (kw: Keyword) => void
  viewMode: 'detail' | 'compact'
  lang: SupportedLang
}

const PAGE_SIZE = 60
const COMPACT_PAGE_SIZE = 120

export default function KeywordGrid({ keywords, countMaps, onSelect, viewMode, lang }: KeywordGridProps) {
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang] ?? entry['ko'] ?? key
  }

  const pageSize = viewMode === 'compact' ? COMPACT_PAGE_SIZE : PAGE_SIZE
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  // filtered/viewMode 변경 시 리셋
  useEffect(() => { setVisibleCount(pageSize) }, [keywords, pageSize])

  const visible = useMemo(() => keywords.slice(0, visibleCount), [keywords, visibleCount])

  // 무한 스크롤
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadingRef.current) {
        loadingRef.current = true
        setVisibleCount(prev => {
          const next = Math.min(prev + pageSize, keywords.length)
          setTimeout(() => { loadingRef.current = false }, 300)
          return next
        })
      }
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [keywords.length, pageSize])

  if (keywords.length === 0) {
    return (
      <div className="text-center py-20" style={{ color: '#555' }}>
        <p className="text-lg mb-2">{t('keyword.noResults.title')}</p>
        <p className="text-sm">{t('keyword.noResults.subtitle')}</p>
      </div>
    )
  }

  /* ── 컴팩트 뷰: 아이콘 + 이름만 ── */
  if (viewMode === 'compact') {
    return (
      <>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))' }}>
          {visible.map((kw, i) => {
            const sinColor = kw.sin_affinity
              ? ((SIN_COLORS as Record<string, string>)[kw.sin_affinity] || '#c8900a')
              : null
            const iconUrl = resolveKeywordIconUrl(kw.name, kw.icon_slug)
            const displayName = getLocalizedKeywordName(kw.name, {
              nameEn: kw.name_en, nameJp: kw.name_jp, descEn: null, descJp: null,
            }, lang)
            return (
              <button
                key={kw.name}
                onClick={() => onSelect(kw)}
                className="cv-card-sm flex flex-col items-center gap-1.5 p-2.5 rounded-lg transition-all duration-200 hover:scale-[1.04]"
                style={{
                  animation: `kwCardIn 0.25s ease both`,
                  animationDelay: `${(i % COMPACT_PAGE_SIZE) * 0.008}s`,
                  background: '#1a1510',
                  border: `1px solid ${sinColor ? sinColor + '20' : 'rgba(200,144,10,0.08)'}`,
                  cursor: 'pointer',
                }}
              >
                <div
                  className="flex items-center justify-center rounded"
                  style={{
                    width: '2.25rem', height: '2.25rem',
                    background: sinColor ? `${sinColor}10` : 'rgba(200,144,10,0.06)',
                    border: `1px solid ${sinColor ? `${sinColor}20` : 'rgba(200,144,10,0.1)'}`,
                  }}
                >
                  {iconUrl ? (
                    <KeywordIcon src={iconUrl} alt={displayName} width={20} height={20}
                      style={{ width: '1.25rem', height: 'auto' }} unoptimized />
                  ) : (
                    <span style={{ color: '#555', fontSize: '0.625rem' }}>?</span>
                  )}
                </div>
                <span className="text-[0.625rem] text-center leading-tight truncate w-full"
                  style={{ color: '#e8dcc8' }}>
                  {displayName}
                </span>
              </button>
            )
          })}
        </div>

        {visibleCount < keywords.length && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            <span style={{ color: '#555', fontSize: '0.75rem' }}>{t('keyword.loading')}</span>
          </div>
        )}
      </>
    )
  }

  /* ── 디테일 뷰: 기존 카드 ── */
  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}>
        {visible.map((kw, i) => (
          <div key={kw.name} className="cv-card-md h-full">
            <KeywordCard
              keyword={kw}
              identityCount={countMaps.identity[kw.name] || 0}
              egoCount={countMaps.ego[kw.name] || 0}
              giftCount={countMaps.gift[kw.name] || 0}
              animationDelay={(i % PAGE_SIZE) * 0.015}
              onClick={() => onSelect(kw)}
              lang={lang}
            />
          </div>
        ))}
      </div>

      {visibleCount < keywords.length && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          <span style={{ color: '#555', fontSize: '0.75rem' }}>{t('keyword.loading')}</span>
        </div>
      )}
    </>
  )
}
