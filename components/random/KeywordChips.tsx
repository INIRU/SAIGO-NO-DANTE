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
              className={`flex items-center gap-[0.25rem] rounded-full px-[0.625rem] py-[0.1875rem] text-[0.75rem] border transition-colors ${
                active
                  ? 'text-white'
                  : 'text-[#8a8070] border-[#8a6010]/20 bg-transparent hover:bg-[#241c12]'
              }`}
              style={active ? { borderColor: color, backgroundColor: `${color}33` } : undefined}
            >
              {iconUrl && (
                <Image src={iconUrl} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem' }} />
              )}
              {kw}
            </button>
          )
        })}
      </div>

      {keywords.map(({ keyword, minCount }) => {
        const sin: SinType | undefined = sinMap[keyword]
        const color = sin ? SIN_COLORS[sin] : '#c8900a'
        return (
          <div key={keyword} className="flex items-center gap-[0.75rem] text-[0.8125rem]">
            <span className="text-[#8a8070] min-w-[3rem]">{keyword}</span>
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
            <span className="text-white font-mono min-w-[1.5rem] text-right">{minCount}</span>
            <span className="text-[#5a5040] text-[0.75rem]">명</span>
          </div>
        )
      })}
    </div>
  )
}
