'use client'

import { COIN_BADGE_STYLES } from './tokens'

interface CoinBadgeProps {
  number: number
  accentColor: string
  isUnbreakable?: boolean
}

export default function CoinBadge({ number, accentColor, isUnbreakable = false }: CoinBadgeProps) {
  const style = isUnbreakable ? COIN_BADGE_STYLES.unbreakable : COIN_BADGE_STYLES.normal
  return (
    <div
      style={{
        flexShrink: 0,
        width: '1rem',
        height: '1rem',
        borderRadius: '50%',
        background: `${accentColor}${style.bg}`,
        border: `1px solid ${accentColor}${style.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: accentColor,
        fontFamily: 'monospace',
        fontSize: '0.5625rem',
        fontWeight: 'bold',
      }}
    >
      {number}
    </div>
  )
}
