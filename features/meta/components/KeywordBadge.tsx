'use client'

import Image from 'next/image'
import { SIN_COLORS } from '@/lib/data/sinners'
import { useLocale } from 'next-intl'
import { useKeywordData, useKeywords } from '@/components/providers/KeywordProvider'
import { localizeDeckKeyword } from '@/features/decks'

interface KeywordBadgeProps {
  keyword: string
}

export default function KeywordBadge({ keyword }: KeywordBadgeProps) {
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const sin = kwSinMap[keyword]
  const color = sin ? SIN_COLORS[sin] : '#888'
  const iconUrl = getIconUrl(keyword)
  const label = localizeDeckKeyword(keyword, useKeywords()[keyword], useLocale())

  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}35`,
        borderRadius: '3px',
        fontSize: '0.625rem',
        padding: '1px 5px',
        lineHeight: '16px',
      }}
    >
      {iconUrl && (
        <Image src={iconUrl} alt="" width={12} height={12} style={{ display: 'inline-block' }} />
      )}
      {label}
    </span>
  )
}
