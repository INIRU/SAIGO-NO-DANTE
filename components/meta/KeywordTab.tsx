'use client'

import Image from 'next/image'
import { SIN_COLORS } from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import type { MetaData } from '@/lib/db/meta'
import { THEME_KEYWORDS } from '@/lib/constants/keywords'

const MAIN_KEYWORDS = new Set<string>(THEME_KEYWORDS)

interface KeywordTabProps {
  data: MetaData
}

export default function KeywordTab({ data }: KeywordTabProps) {
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const keywords = data.keywordUsage.filter(kw => MAIN_KEYWORDS.has(kw.keyword)).slice(0, 15)
  const maxCount = keywords[0]?.count || 1

  return (
    <div className="max-w-3xl">
      <h2 className="font-serif text-xl font-semibold mb-2" style={{ color: 'var(--gold-light)' }}>
        키워드 트렌드 TOP 15
      </h2>
      <p className="text-xs mb-6" style={{ color: '#888888' }}>
        각 덱에서 등장한 키워드 수 (덱 내 중복 제거)
      </p>
      <div className="usage-chart space-y-2">
        {keywords.map((kw, i) => {
          const pct = (kw.count / maxCount) * 100
          const sin = kwSinMap[kw.keyword]
          const color = sin ? SIN_COLORS[sin] : '#888888'
          const iconUrl = getIconUrl(kw.keyword)

          return (
            <div
              key={kw.keyword}
              className="rounded-lg p-3 flex items-center gap-3"
              style={{
                background: 'rgba(26,21,16,0.6)',
                border: i < 3 ? `1px solid ${color}30` : '1px solid transparent',
              }}
            >
              {/* 순위 */}
              <span
                className="font-mono text-sm w-6 text-center font-bold"
                style={{
                  color: i === 0 ? '#e8b030' : i === 1 ? '#b0a088' : i === 2 ? '#a07040' : '#555566',
                }}
              >
                {i + 1}
              </span>

              {/* 아이콘 */}
              <div
                className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                style={{ background: `${color}15`, border: `1px solid ${color}30` }}
              >
                {iconUrl ? (
                  <Image src={iconUrl} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
                ) : (
                  <div className="w-5 h-5" />
                )}
              </div>

              {/* 이름 + 바 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: '#e8e4d8' }}>{kw.keyword}</span>
                  <span
                    className="count-up font-mono text-sm font-bold shrink-0"
                    data-target={kw.count}
                    style={{ color }}
                  >
                    {kw.count}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div
                    className="usage-bar h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(to right, ${color}60, ${color})`,
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
        {keywords.length === 0 && (
          <p className="text-center py-12" style={{ color: '#888888' }}>데이터가 없습니다</p>
        )}
      </div>
    </div>
  )
}
