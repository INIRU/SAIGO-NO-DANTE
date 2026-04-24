'use client'

import { useKeywordData } from '@/components/providers/KeywordProvider'
import { SIN_COLORS } from '@/lib/constants/sin'
import type { KeywordCondition } from '@/lib/random/engine'
import type { SinType } from '@/lib/types'
import Image from 'next/image'

const MAIN_KEYWORDS = ['출혈', '파열', '침잠', '화상', '진동', '충전', '호흡']

type Props = {
  keywords: KeywordCondition[]
  onChange: (keywords: KeywordCondition[]) => void
  onMaxExceeded: () => void
}

export default function KeywordChips({ keywords, onChange, onMaxExceeded }: Props) {
  const { sinMap, getIconUrl } = useKeywordData()

  function toggleKeyword(kw: string) {
    const existing = keywords.find(k => k.keyword === kw)
    if (existing) {
      onChange(keywords.filter(k => k.keyword !== kw))
    } else {
      if (keywords.length >= 2) {
        onMaxExceeded()
        return
      }
      onChange([...keywords, { keyword: kw, minCount: 5 }])
    }
  }

  function updateMinCount(kw: string, count: number) {
    onChange(keywords.map(k => k.keyword === kw ? { ...k, minCount: count } : k))
  }

  return (
    <div className="space-y-[0.5rem]">
      {/* Label */}
      <span className="text-[0.6875rem] text-[#5a4830]" style={{ letterSpacing: '0.06em' }}>키워드 필터</span>

      <div className="flex flex-wrap gap-[0.375rem]">
        {MAIN_KEYWORDS.map(kw => {
          const sin: SinType | undefined = sinMap[kw]
          const active = keywords.some(k => k.keyword === kw)
          const color = sin ? SIN_COLORS[sin] : '#8a6010'
          const iconUrl = getIconUrl(kw)

          return (
            <button
              key={kw}
              onClick={() => toggleKeyword(kw)}
              className="flex min-h-[2.75rem] items-center justify-center gap-[0.25rem] rounded-full px-[0.875rem] py-[0.5rem] text-[0.75rem] transition-all duration-200 sm:min-h-0 sm:px-[0.625rem] sm:py-[0.1875rem]"
              style={active ? {
                border: `1px solid ${color}88`,
                backgroundColor: `${color}25`,
                color: '#fff',
                boxShadow: `0 0 0.5rem ${color}20`,
              } : {
                border: '1px solid rgba(138,96,16,0.15)',
                backgroundColor: 'rgba(20,16,10,0.5)',
                color: '#8a8070',
              }}
            >
              {iconUrl && (
                <Image
                  src={iconUrl}
                  alt=""
                  width={14}
                  height={14}
                  style={{ width: '0.875rem', height: '0.875rem', opacity: active ? 1 : 0.5, transition: 'opacity 0.2s' }}
                />
              )}
              {kw}
            </button>
          )
        })}
      </div>

      {/* Sliders */}
      {keywords.map(({ keyword, minCount }) => {
        const sin: SinType | undefined = sinMap[keyword]
        const color = sin ? SIN_COLORS[sin] : '#c8900a'
        return (
          <div
            key={keyword}
            className="flex items-center gap-[0.75rem] text-[0.8125rem] px-[0.5rem] py-[0.375rem] rounded-[0.25rem]"
            style={{ background: `${color}0a`, border: `1px solid ${color}15` }}
          >
            <span style={{ color, minWidth: '3rem', fontWeight: 600 }}>{keyword}</span>
            <span className="text-[#5a5040] text-[0.75rem]">최소</span>
            <input
              type="range"
              min={1}
              max={12}
              value={minCount}
              onChange={e => updateMinCount(keyword, Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: color }}
            />
            <span className="font-mono min-w-[1.5rem] text-right" style={{ color, fontWeight: 700 }}>{minCount}</span>
            <span className="text-[#5a5040] text-[0.75rem]">명</span>
          </div>
        )
      })}
    </div>
  )
}
