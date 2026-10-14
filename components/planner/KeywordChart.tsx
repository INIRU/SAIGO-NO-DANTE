'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import { DEPLOYED_SLOT_COUNT, SINNER_SLUGS } from '@/lib/constants/game'

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

const KEYWORD_COLOR = GIFT_KEYWORD_COLORS

interface Props {
  /**
   * `deployed`: of `count`, the identities in SELECTED slots (computeKeywordDistribution with flags).
   * A row that is not a keyword (an attack type, a sin) brings its own `iconUrl` and `color`; `extra` is drawn at the
   * end of the row.
   */
  distribution: { keyword: string; count: number; deployed?: number; iconUrl?: string | null; color?: string; extra?: ReactNode }[]
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
  const t = useTranslations('planner.deckTab.stats')
  const maxCount = Math.max(...distribution.map(d => d.count), 1)
  // With deployment flags each bar has two layers: all 12 identities (dark, behind) and the deployed ones (bright).
  const layered = distribution.some(d => d.deployed !== undefined)
  const hasExtra = distribution.some(d => d.extra !== undefined)

  return (
    <div className="space-y-2">
      {layered && (
        <div className="flex justify-end gap-3 text-[0.75rem] text-[var(--text-secondary)]" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-[#c8b898]" />{t('keywordDeployed', { count: DEPLOYED_SLOT_COUNT })}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-[#c8b898]/35" />{t('keywordAll', { count: SINNER_SLUGS.length })}</span>
        </div>
      )}
      {distribution.slice(0, maxItems).map(d => {
        const slug = KEYWORD_SLUG[d.keyword]
        const iconUrl = d.iconUrl !== undefined ? d.iconUrl : slug ? getGiftKeywordIconUrl(slug) : null
        const color = d.color ?? KEYWORD_COLOR[d.keyword] ?? '#888'
        const pct = (d.count / maxCount) * 100
        const deployedPct = ((d.deployed ?? d.count) / maxCount) * 100
        const contributors = contributorsByKeyword?.[d.keyword] ?? []

        return (
          <div key={d.keyword} className="space-y-1.5">
            <div className="grid items-center gap-2" style={{ gridTemplateColumns: `1rem minmax(4rem, 5.5rem) minmax(0, 1fr) ${layered ? '2.75rem' : '1.75rem'}${hasExtra ? (layered ? ' 2.75rem' : ' 1.75rem') : ''}` }}>
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
              <div className="relative min-w-0 rounded-full overflow-hidden" style={{ height: '0.5rem', background: '#222' }}>
                {layered && (
                  <div className="absolute inset-y-0 left-0 rounded-full transition-[width]" style={{ width: `${pct}%`, background: color, opacity: 0.32, minWidth: '0.25rem' }} />
                )}
                {(!layered || (d.deployed ?? 0) > 0) && (
                  <div
                    className="relative h-full rounded-full transition-[width]"
                    style={{ width: `${layered ? deployedPct : pct}%`, background: color, minWidth: '0.25rem' }}
                  />
                )}
              </div>
              <span style={{ textAlign: 'right', fontSize: '0.875rem', color: color, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {layered ? <>{d.deployed ?? 0}<span style={{ opacity: 0.5, fontWeight: 400 }}>/{d.count}</span></> : d.count}
              </span>
              {hasExtra && <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{d.extra}</span>}
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
