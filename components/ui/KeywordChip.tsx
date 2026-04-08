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
  xs: { fontSize: '0.5rem', padding: '0.125rem 0.375rem', gap: '0.1875rem', iconSize: 10, clip: 4 },
  sm: { fontSize: '0.625rem', padding: '0.1875rem 0.5rem', gap: '0.25rem', iconSize: 13, clip: 5 },
  md: { fontSize: '0.75rem', padding: '0.25rem 0.625rem', gap: '0.3125rem', iconSize: 15, clip: 6 },
} as const

export default function KeywordChip({ keyword, size = 'sm', showIcon = true, color, className }: KeywordChipProps) {
  const kwColor = color ?? getGiftKeywordColor(keyword)
  const slug = getGiftKeywordSlug(keyword)
  const iconUrl = slug ? getGiftKeywordIconUrl(slug) : null
  const s = SIZE_STYLES[size]
  const c = s.clip

  return (
    <span
      className={`inline-flex items-center font-bold ${className ?? ''}`}
      style={{
        fontSize: s.fontSize,
        padding: s.padding,
        gap: s.gap,
        background: `linear-gradient(135deg, ${kwColor}28 0%, ${kwColor}10 100%)`,
        color: kwColor,
        fontFamily: 'var(--font-heading)',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        clipPath: `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`,
        filter: `drop-shadow(0 0 2px ${kwColor}40)`,
      }}
    >
      {showIcon && iconUrl && (
        <Image src={iconUrl} alt="" width={s.iconSize} height={s.iconSize} style={{ objectFit: 'contain', width: `${s.iconSize}px`, height: `${s.iconSize}px` }} />
      )}
      {keyword}
    </span>
  )
}
