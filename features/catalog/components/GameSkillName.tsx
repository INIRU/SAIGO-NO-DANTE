'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { getSkillFrameAssetUrl } from '@/lib/utils/images'

const SINS = new Set(['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'])

// The game's skill box name plate (NormalSkillBox > SkillNameBg): a sliced sprite, borders 9 / 99, the name 20 in from the
// left and 100 from the right, 10 up from the bottom, KOTRA_BOLD 45, all in UI units. 1 unit = 1/45 em of the name, so the
// plate scales with `fontSize`.
const unit = (n: number) => `${n / 45}em`

// KOTRA_BOLD SDF Underline: a dark copy pushed right / down 2.41 and grown 0.84 atlas px (font asset size 51)
const SHADOW = (() => {
  const d = 2.41 / 51, spread = 0.84 / 51, color = '#040001'
  const at = (x: number, y: number) => `${x.toFixed(4)}em ${y.toFixed(4)}em 0 ${color}`
  return [at(d, d), ...Array.from({ length: 8 }, (_, a) => at(d + spread * Math.cos(a * Math.PI / 4), d + spread * Math.sin(a * Math.PI / 4)))].join(',')
})()

// GetSkillLevelIconSprite: the sword (_4_25) for an attack and a counter, the shield with the curved arrow (_4_36) for evade
// and guard, the plain shield (_4_23) when the type is none of these
const LEVEL_ICON: Record<string, string> = {
  slash: 'level-attack', pierce: 'level-attack', blunt: 'level-attack', attack: 'level-attack', counter: 'level-attack',
  evade: 'level-counter', defense: 'level-counter', guard: 'level-counter',
}

/** The attack level icon by the skill's defence type. */
export function skillLevelIconUrl(skillType: string): string {
  return getSkillFrameAssetUrl(LEVEL_ICON[skillType] ?? 'level-defense')
}

/** The attack weight icon (shown once per weight). */
export const TARGET_NUM_ICON_URL = getSkillFrameAssetUrl('target-num')

/**
 * The name on its plate, on one line like the game (which never wraps or cuts it). The plate grows with the name; only when
 * the name is wider than the room left in the row (a phone) does the name's own size come down to fit.
 */
export default function GameSkillName({ name, sin, fontSize = '1.25rem' }: { name: string; sin?: string | null; fontSize?: string }) {
  const s = sin && SINS.has(sin) ? sin : 'neutral'
  const plateRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const plate = plateRef.current, text = textRef.current, row = plate?.parentElement
    if (!plate || !text || !row) return
    const fit = () => {
      const current = parseFloat(text.style.fontSize || '1') || 1
      const around = plate.getBoundingClientRect().width - text.getBoundingClientRect().width   // the plate's 20 + 100 around the name
      const room = row.getBoundingClientRect().width - around - 2
      const natural = text.getBoundingClientRect().width / current
      setScale(natural > room && natural > 0 ? Math.max(0.5, room / natural) : 1)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(row)
    document.fonts?.ready.then(fit)
    fit()
    return () => observer.disconnect()
  }, [name])

  return (
    <div
      ref={plateRef}
      className="inline-flex shrink-0 items-center"
      style={{
        fontSize,
        height: unit(69.33),
        boxSizing: 'border-box',
        borderStyle: 'solid',
        borderColor: 'transparent',
        borderWidth: `0 ${unit(99)} 0 ${unit(9)}`,
        borderImage: `url(${getSkillFrameAssetUrl(`${s}-name`)}) 0 99 0 9 fill stretch`,
        // inside the sliced borders: 9 + 11 = 20 on the left, 99 + 1 = 100 on the right
        padding: `0 ${unit(1)} ${unit(10)} ${unit(11)}`,
      }}
    >
      <span
        ref={textRef}
        style={{
          fontSize: `${scale}em`,
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-kotra-bold), var(--font-heading)',
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
          color: 'rgb(235,202,162)',
          textShadow: SHADOW,
        }}
      >
        {name}
      </span>
    </div>
  )
}
