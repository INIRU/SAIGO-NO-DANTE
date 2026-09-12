'use client'

import Image from 'next/image'
import { getGiftKeywordIconUrl } from '@/lib/constants/gift'
import KeywordIcon from '@/components/ui/KeywordIcon'

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
  getKeywordLabel?: (keyword: string) => string
  contributorsByKeyword?: Record<string, KeywordChartContributor[]>
  maxItems?: number
}

export type KeywordChartContributor = {
  id: string
  name: string
  imageUrl: string
}

export default function KeywordChart({
  distribution,
  getKeywordLabel,
  contributorsByKeyword,
  maxItems = 10,
}: Props) {
  const maxCount = Math.max(...distribution.map(d => d.count), 1)

  return (
    <div className="space-y-2">
      {distribution.slice(0, maxItems).map(d => {
        const slug = KEYWORD_SLUG[d.keyword]
        const iconUrl = slug ? getGiftKeywordIconUrl(slug) : null
        const color = KEYWORD_COLOR[d.keyword] ?? '#888'
        const pct = (d.count / maxCount) * 100
        const contributors = contributorsByKeyword?.[d.keyword] ?? []

        return (
          <div key={d.keyword} className="space-y-1.5">
            <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1rem minmax(4rem, 5.5rem) minmax(0, 1fr) 1.75rem' }}>
              {iconUrl ? (
                <KeywordIcon
                  src={iconUrl}
                  alt="" width={16} height={16}
                  style={{ width: '1rem', height: '1rem', objectFit: 'contain' }}
                />
              ) : (
                <span aria-hidden="true" />
              )}
              <span className="min-w-0 truncate" style={{ fontSize: '0.875rem', color: '#b0a898' }}>
                {getKeywordLabel ? getKeywordLabel(d.keyword) : d.keyword}
              </span>
              <div className="min-w-0 rounded-full overflow-hidden" style={{ height: '0.5rem', background: '#222' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: color, minWidth: '0.25rem' }}
                />
              </div>
              <span style={{ textAlign: 'right', fontSize: '0.875rem', color: color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {d.count}
              </span>
            </div>
            {contributors.length > 0 && (
              <div className="flex flex-wrap gap-1 pl-6 sm:pl-[6.5rem]">
                {contributors.map(contributor => (
                  <span
                    key={contributor.id}
                    className="relative block overflow-hidden rounded-sm border border-[#2a2118] bg-[#100d08]"
                    style={{ width: '2rem', aspectRatio: '1 / 1' }}
                    title={contributor.name}
                    aria-label={contributor.name}
                  >
                    <Image
                      src={contributor.imageUrl}
                      alt={contributor.name}
                      fill
                      sizes="2rem"
                      className="object-cover object-top"
                    />
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
