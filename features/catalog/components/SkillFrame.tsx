'use client'

import { useState } from 'react'
import GameSkillIcon from '@/features/catalog/components/GameSkillIcon'

interface SkillFrameProps {
  skillIconUrl: string
  skillIconFallback?: string
  sin: string
  /** 1 | 2 | 3 | 4 (defense) */
  skillSlot: number
  sinColor: string
  label: string
  /** rem 단위 전체 크기 (기본 3.5rem) */
  attackType?: 'slash' | 'pierce' | 'blunt' | null
  /** Load the art at once (a skill list in view, e.g. an identity modal); lists of many frames keep lazy loading. */
  eager?: boolean
  size?: string
}

export default function SkillFrame({
  skillIconUrl,
  skillIconFallback,
  sin,
  skillSlot,
  size = '3.5rem',
  attackType,
  eager = false,
}: SkillFrameProps) {
  const [iconSrc, setIconSrc] = useState(skillIconUrl)

  // url 변경 추적
  const [prevUrl, setPrevUrl] = useState(skillIconUrl)
  if (prevUrl !== skillIconUrl) {
    setPrevUrl(skillIconUrl)
    setIconSrc(skillIconUrl)
  }

  // The game's frame without the power numbers; a defence skill (slot 4) takes the tier 1 frame.
  return (
    <GameSkillIcon
      iconUrl={iconSrc}
      sin={sin}
      tier={skillSlot >= 4 ? 1 : skillSlot}
      attackType={attackType}
      size={size}
      eager={eager}
      onIconError={() => { if (skillIconFallback && iconSrc !== skillIconFallback) setIconSrc(skillIconFallback) }}
    />
  )
}
