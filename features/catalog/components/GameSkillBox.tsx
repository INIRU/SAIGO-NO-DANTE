'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'
import GameSkillIcon, { type GameSkillIconProps } from '@/features/catalog/components/GameSkillIcon'
import GameSkillName, { skillLevelIconUrl, TARGET_NUM_ICON_URL } from '@/features/catalog/components/GameSkillName'
import { getSkillFrameAssetUrl } from '@/lib/utils/images'
import { COIN_IMAGES } from '@/lib/identity/skill-description'

// The game's skill box (NormalSkillBox, 동기화 강화·인격 획득 화면): the icon on the left and, 10 units under its edge, a
// column of the coin row (30 high), the name plate (70) and the attack level row (67), from the skill frame guide.
// 1 unit = --u, the game's UI pixel scaled to the card (at most 0.62px, smaller on a narrow card).
const u = (n: number) => `calc(var(--u) * ${n})`

// IntColorPairs_SkillLevelTextByCompareValue: raised, unchanged, lowered
const LEVEL_COLOR = { 1: 'rgb(248,194,0)', 0: 'rgb(235,202,162)', [-1]: 'rgb(153,0,0)' } as const
// ExcelsiorSans SDF Underline: a dark copy pushed right / down 2.23 atlas px (font asset size 64)
const NUMBER_SHADOW = `${(2.23 / 64).toFixed(4)}em ${(2.23 / 64).toFixed(4)}em 0 #040001`
const COIN_URL: Record<string, string> = {
  GREY: getSkillFrameAssetUrl('coin-grey'), GREEN: getSkillFrameAssetUrl('coin-green'), PURPLE: getSkillFrameAssetUrl('coin-purple'),
}

export interface GameSkillBoxCoin {
  unbreakable?: boolean
  /** The game's coin colour (GREY, GREEN, PURPLE); gold otherwise */
  color?: string | null
  /** This coin's own power (shown on hover) */
  label?: string
}

export interface GameSkillBoxProps extends Omit<GameSkillIconProps, 'size' | 'className'> {
  name: string
  /** slash / pierce / blunt / evade / defense / counter: picks the level icon */
  skillType: string
  /** Attack level shown (identity level + the skill's correction) */
  level?: number | null
  /** Sign of a level change from an effect (a buff in battle): raised 1, none 0, lowered -1. The skill's own correction is not one. */
  levelChange?: -1 | 0 | 1
  /** Text for the level's tooltip (the correction) */
  levelTitle?: string
  weight: number
  weightLabel: string
  coins: GameSkillBoxCoin[]
  unbreakableLabel?: string
  coinLabel?: string
  /** "SKILL 1"-"SKILL 3" under the icon (UnitInfoSkillSlot > SkillTier), for a base skill only */
  tierLabel?: string
  /** Largest size of one game UI unit in px (0.62 on the identity page; smaller where the box is a small card) */
  maxUnit?: number
}

export default function GameSkillBox({
  name, skillType, level, levelChange = 0, levelTitle, weight, weightLabel, coins, unbreakableLabel, coinLabel, tierLabel, maxUnit = 0.62, ...icon
}: GameSkillBoxProps) {
  const levelColor = LEVEL_COLOR[levelChange]
  return (
    <div style={{ containerType: 'inline-size', width: '100%' }}>
      <div style={{ ['--u' as string]: `min(${maxUnit}px, calc(100cqw / 700))`, display: 'flex', alignItems: 'flex-start' } as CSSProperties}>
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
          <GameSkillIcon {...icon} size={u(266)} />
          {tierLabel && (
            // SkillTier: BebasKai 45, (161, 106, 59), centred under the frame (its centre is 141 units in)
            <span style={{ width: u(200), marginLeft: u(41), marginTop: u(-4), textAlign: 'center', fontFamily: 'var(--font-bebas-kai), sans-serif', fontSize: u(45), lineHeight: 1, color: 'rgb(161,106,59)', whiteSpace: 'nowrap' }}>
              {tierLabel}
            </span>
          )}
        </div>
        <div style={{ marginLeft: u(-10), minWidth: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', paddingTop: u(14) }}>
          {/* coin row: 40-unit coins every 34, lifted 6 (only the coins, not the row) */}
          <div style={{ height: u(30), paddingLeft: u(10), display: 'flex', alignItems: 'flex-start' }}>
            {coins.map((coin, i) => (
              <Image
                key={i}
                src={coin.unbreakable ? COIN_IMAGES.unbreakable : COIN_URL[coin.color ?? ''] ?? getSkillFrameAssetUrl('coin-gold')}
                alt={coin.unbreakable ? (unbreakableLabel ?? '') : (coinLabel ?? '')}
                title={coin.label}
                width={48}
                height={48}
                unoptimized
                style={{ width: u(40), height: u(40), maxWidth: 'none', flex: '0 0 auto', marginTop: u(-6), marginLeft: i ? u(-6) : 0, objectFit: 'contain' }}
              />
            ))}
          </div>
          {/* name plate, 70 high, the whole name on one line */}
          <div style={{ height: u(70), display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <GameSkillName name={name} sin={icon.sin} fontSize={u(45)} />
          </div>
          {/* attack level (icon by defence type, number coloured by the correction, underline) and attack weight */}
          <div style={{ height: u(67), display: 'flex', alignItems: 'flex-start' }}>
            {level != null && (
              <div style={{ height: u(67), display: 'flex', alignItems: 'center', gap: u(10), flex: '0 0 auto' }} title={levelTitle}>
                <Image src={skillLevelIconUrl(skillType)} alt="" width={64} height={64} unoptimized style={{ width: u(67), height: u(67), maxWidth: 'none' }} />
                {/* the number's box is 36.37 high with the glyphs centred in it; the 5-high underline is centred 15 under the box */}
                <span style={{ position: 'relative', height: u(36.37), display: 'inline-flex', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-excelsior), sans-serif', fontSize: u(70), lineHeight: 1, letterSpacing: '-0.02em', color: levelColor, textShadow: NUMBER_SHADOW, whiteSpace: 'nowrap' }}>
                    {level}
                  </span>
                  <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: u(36.37 + 15 - 2.5), height: u(5), background: levelColor }} />
                </span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: u(15), paddingLeft: u(20), gap: u(10), flex: '0 0 auto' }}>
              <span style={{ fontFamily: 'var(--font-scdream), var(--font-heading)', fontSize: u(30), lineHeight: 1, letterSpacing: '-0.02em', color: 'rgb(248,194,0)', whiteSpace: 'nowrap' }}>{weightLabel}</span>
              <span style={{ display: 'flex', alignItems: 'center', alignSelf: 'center' }}>
                {Array.from({ length: Math.max(1, weight) }, (_, i) => (
                  <Image key={i} src={TARGET_NUM_ICON_URL} alt="" width={32} height={32} unoptimized style={{ width: u(27.5), height: u(27.5), maxWidth: 'none', marginLeft: i ? u(-4) : 0 }} />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
