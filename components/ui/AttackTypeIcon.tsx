import type { CSSProperties } from 'react'
import { ATK_TYPE_ICON_MAP } from '@/lib/constants/game'

export type AttackTypeKey = 'slash' | 'pierce' | 'blunt'

/**
 * Attack type mark (slash / pierce / blunt) as the game's stage info draws it: a tan fill with a fine dot screen and a
 * dark red rim. The white icon from Storage is the mask, so every place that shows attack types gets it from one spot.
 * The rim is a drop-shadow on a wrapper: a filter on the masked element itself would be cut away by its own mask.
 */
export default function AttackTypeIcon({ type, label, className = 'h-4 w-4', style }: {
  type: AttackTypeKey
  /** Spoken name; without it the mark is decoration next to its own text */
  label?: string
  className?: string
  style?: CSSProperties
}) {
  const mask = `url(${ATK_TYPE_ICON_MAP[type]})`
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
      className={`inline-block shrink-0 [filter:drop-shadow(0_0_0.5px_#7a1008)_drop-shadow(0_0_0.5px_#7a1008)] ${className}`}
      style={style}
    >
      <span
        className="block h-full w-full bg-[radial-gradient(circle,rgba(70,24,8,0.28)_0.45px,transparent_0.7px),linear-gradient(160deg,#d8ab7c,#b8834f_50%,#94603a)] [background-size:2.5px_2.5px,100%_100%]"
        style={{
          maskImage: mask, WebkitMaskImage: mask,
          maskSize: 'contain', WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center', WebkitMaskPosition: 'center',
        }}
      />
    </span>
  )
}
