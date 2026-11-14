'use client'

import { memo } from 'react'
import Image from 'next/image'
import * as m from 'motion/react-m'

const MAIN_KEYWORD_SPRING = { type: 'spring', stiffness: 430, damping: 32, mass: 0.5 } as const

// Memoized so a formation click only re-renders chips whose count/state changed.
const MainKeywordChip = memo(function MainKeywordChip({ keyword, iconUrl, label, accessibleName, count, selected, disabled, reduceMotion, onToggle }: {
  keyword: string
  iconUrl: string | null | undefined
  label: string
  accessibleName: string
  /** null = attack-type keyword without a count. */
  count: number | null
  selected: boolean
  disabled: boolean
  reduceMotion: boolean
  onToggle: (keyword: string) => void
}) {
  return (
    <m.button
      type="button"
      className="planner-main-keyword"
      data-selected={selected}
      disabled={disabled}
      onClick={() => onToggle(keyword)}
      aria-pressed={selected}
      aria-label={accessibleName}
      title={accessibleName}
      whileHover={reduceMotion || disabled ? undefined : { y: -1 }}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.985 }}
      transition={MAIN_KEYWORD_SPRING}
    >
      {iconUrl && <Image src={iconUrl} alt="" width={16} height={16} className="planner-main-keyword__icon" />}
      <span className="planner-main-keyword__label">{label}</span>
      {count != null && <span className="planner-main-keyword__count">{count}</span>}
    </m.button>
  )
})

export default MainKeywordChip
