'use client'

import Image from 'next/image'
import { SinType, SIN_COLORS, SIN_LABELS_KR, getSinIconUrl } from '@/lib/data/sinners'

interface SinBadgeProps {
  sin: SinType | null | undefined
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export default function SinBadge({ sin, size = 'md', showLabel = true }: SinBadgeProps) {
  if (!sin) return null
  const color = SIN_COLORS[sin]
  const label = SIN_LABELS_KR[sin]

  const iconSize = size === 'sm' ? 14 : size === 'md' ? 18 : 22
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-medium border ${sizeClasses[size]}`}
      style={{
        color,
        borderColor: `${color}60`,
        backgroundColor: `${color}15`,
      }}
    >
      <Image
        src={getSinIconUrl(sin)}
        alt={label}
        width={iconSize}
        height={iconSize}
        unoptimized
        className="inline-block"
        style={{ filter: `drop-shadow(0 0 3px ${color}80)` }}
      />
      {showLabel && <span>{label}</span>}
    </span>
  )
}
