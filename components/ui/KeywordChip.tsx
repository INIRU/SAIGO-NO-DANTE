'use client'

import Image from 'next/image'
import { getGiftKeywordColor, getGiftKeywordSlug, getGiftKeywordIconUrl } from '@/lib/constants/gift'

interface KeywordChipProps {
  keyword: string
  /** Size variant (default: 'sm') */
  size?: 'xs' | 'sm' | 'md'
  /** Show keyword icon (default: true) */
  showIcon?: boolean
  /** Override color */
  color?: string
  /** Additional className */
  className?: string
}

const SIZE_STYLES = {
  xs: { fontSize: '0.5rem', padding: '0.0625rem 0.25rem', gap: '0.125rem', iconSize: 8 },
  sm: { fontSize: '0.625rem', padding: '0.125rem 0.375rem', gap: '0.25rem', iconSize: 12 },
  md: { fontSize: '0.75rem', padding: '0.1875rem 0.5rem', gap: '0.25rem', iconSize: 14 },
} as const

export default function KeywordChip({ keyword, size = 'sm', showIcon = true, color, className }: KeywordChipProps) {
  const kwColor = color ?? getGiftKeywordColor(keyword)
  const slug = getGiftKeywordSlug(keyword)
  const iconUrl = slug ? getGiftKeywordIconUrl(slug) : null
  const s = SIZE_STYLES[size]

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${className ?? ''}`}
      style={{
        fontSize: s.fontSize,
        padding: s.padding,
        gap: s.gap,
        background: `${kwColor}18`,
        color: kwColor,
        border: `1px solid ${kwColor}30`,
        fontFamily: 'var(--font-heading)',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      {showIcon && iconUrl && (
        <Image src={iconUrl} alt="" width={s.iconSize} height={s.iconSize} style={{ objectFit: 'contain' }} />
      )}
      {keyword}
    </span>
  )
}
