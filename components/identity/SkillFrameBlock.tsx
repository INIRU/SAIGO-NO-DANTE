'use client'

import Image from 'next/image'
import SkillFrame from './SkillFrame'
import SkillDescription from '@/components/skill/SkillDescription'
import { STORAGE_BASE } from '@/lib/constants/game'

const SIN_FRAME_MAP: Record<string, string> = {
  wrath: 'crimson', lust: 'scarlet', sloth: 'amber', gluttony: 'shamrock',
  gloom: 'azure', pride: 'indigo', envy: 'violet',
}

export interface SkillFrameBlockProps {
  /** Skill icon URL */
  skillIconUrl: string
  /** Sin type for frame (English: wrath, lust, etc.) */
  sin: string
  /** Sin color hex */
  sinColor: string
  /** Skill slot number (1-3 for identity, 3 for EGO) */
  skillSlot: number
  /** Label shown in frame fallback */
  label: string
  /** Frame size (default '4.5rem') */
  size?: string
  /** Skill name */
  name: string
  /** Base power */
  basePower: number
  /** Coin power */
  coinPower: number
  /** Number of coins */
  coins: number
  /** Attack type: 'slash' | 'pierce' | 'blunt' | null */
  atkType?: string | null
  /** Offense level (raw value, displayed as-is) */
  offenseLevel?: number | string | null
  /** Attack weight (default 1) */
  atkWeight?: number
  /** Whether this is a defense skill */
  isDefense?: boolean
  /** Description text */
  description?: string | null
  /** Unbreakable coin indices (0-based) */
  unbreakableCoins?: Set<number>
  /** SkillDescription variant */
  descVariant?: 'compact' | 'detail'
  /** Allowed keywords for SkillDescription */
  allowedKeywords?: Set<string>
  /** Mental consume (shown only when non-zero) */
  mentalConsume?: number
}

export default function SkillFrameBlock({
  skillIconUrl,
  sin,
  sinColor,
  skillSlot,
  label,
  size = '4.5rem',
  name,
  basePower,
  coinPower,
  coins,
  atkType,
  offenseLevel,
  atkWeight = 1,
  isDefense = false,
  description,
  unbreakableCoins = new Set(),
  descVariant = 'compact',
  allowedKeywords,
  mentalConsume,
}: SkillFrameBlockProps) {
  const isAttackSkill = !isDefense
  const frameSin = SIN_FRAME_MAP[sin] ?? 'crimson'

  // Normalize attack type key (handles KR strings passed in)
  const atkTypeKey = ({ '참격': 'slash', '관통': 'pierce', '타격': 'blunt' } as Record<string, string>)[atkType ?? ''] ?? atkType

  const showAtkTypeIcon = isAttackSkill && atkTypeKey && ['slash', 'pierce', 'blunt'].includes(atkTypeKey)

  // Base power font size scales with frame size — use 1.5rem for 4.5rem frame, 2rem for 6.5rem frame
  const frameRem = parseFloat(size)
  const basePowerSize = frameRem >= 6 ? '2rem' : '1.5rem'
  const coinPowerSize = frameRem >= 6 ? '1.125rem' : '0.8125rem'
  const coinIconSize = frameRem >= 6 ? '1.125rem' : '0.875rem'
  const skillNameSize = frameRem >= 6 ? '1rem' : '0.75rem'
  const offenseLevelSize = frameRem >= 6 ? '1.25rem' : '1rem'
  const offenseIconSize = frameRem >= 6 ? '1.5rem' : '1rem'
  const atkWeightSquare = frameRem >= 6 ? '0.625rem' : '0.5625rem'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.25rem', marginBottom: '0.5rem' }}>
        {/* Frame area */}
        <div className="relative shrink-0 ml-2" style={{ width: size, height: size }}>
          {/* Sin color triangle */}
          <div className="absolute flex items-center justify-center pointer-events-none" style={{
            top: '1.5%', left: '50%', transform: 'translateX(-56%)',
            width: frameRem >= 6 ? '1.5rem' : '1rem',
            height: frameRem >= 6 ? '1.25rem' : '1rem',
            zIndex: 0,
          }}>
            <div className="absolute" style={{
              width: frameRem >= 6 ? '2rem' : '1.5rem',
              height: frameRem >= 6 ? '1.25rem' : '1rem',
              backgroundColor: sinColor,
              clipPath: 'polygon(5% 20%, 85% 0%, 100% 100%, 10% 100%)',
            }} />
          </div>

          <SkillFrame
            skillIconUrl={skillIconUrl}
            sin={sin}
            skillSlot={skillSlot}
            sinColor={sinColor}
            label={label}
            size={size}
          />

          {/* Attack type icon badge (bottom center) */}
          {showAtkTypeIcon && (
            <div className="absolute z-20 pointer-events-none"
              style={{ bottom: 0, left: '50%', marginLeft: '-0.625rem', transform: 'translateY(-30%)', width: '1.25rem', height: '1.25rem' }}>
              <Image
                src={`${STORAGE_BASE}/icons/skill-frames/extras/${frameSin}_icon_bg.webp`}
                alt="" width={20} height={20} className="absolute inset-0"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <Image
                src={`${STORAGE_BASE}/icons/skill-frames/extras/${frameSin}_icon_overlay.webp`}
                alt="" width={20} height={20} className="absolute inset-0"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              <Image
                src={`${STORAGE_BASE}/icons/stats/${atkTypeKey}.webp`}
                alt="" width={16} height={16} className="absolute inset-0 m-auto z-10"
                style={{ width: '0.625rem', height: '0.625rem' }}
              />
            </div>
          )}

          {/* Base power (left of frame) */}
          <div className="absolute z-20" style={{ left: 0, top: '50%', transform: 'translateX(-40%) translateY(-75%)' }}>
            <span style={{
              fontFamily: 'var(--font-excelsior), sans-serif',
              fontSize: basePowerSize,
              lineHeight: 1,
              color: 'oklch(81.35% .0894 69.33)',
            }}>
              {basePower}
            </span>
          </div>

          {/* Coin power (above frame) */}
          <div className="absolute z-20" style={{ top: 0, left: '50%', transform: 'translateX(-56%) translateY(-12.5%)' }}>
            <span style={{
              fontFamily: 'var(--font-excelsior), sans-serif',
              fontSize: coinPowerSize,
              fontWeight: 700,
              lineHeight: 1,
              color: coinPower >= 0 ? 'oklch(81.35% .0894 69.33)' : '#ff8866',
              textShadow: '1px 1px 1px black',
              WebkitTextStroke: '0.01px black',
            }}>
              {coinPower >= 0
                ? `+${coinPower}`
                : frameRem >= 6
                  ? `-${Math.abs(coinPower)}`
                  : <><span style={{ fontSize: '1rem' }}>-</span>{Math.abs(coinPower)}</>
              }
            </span>
          </div>
        </div>

        {/* Skill info (right of frame) */}
        <div className="flex-1 min-w-0 overflow-hidden pt-0.5">
          {/* Coin icons row */}
          <div className="flex items-center gap-0.5 mb-0.5">
            {Array.from({ length: coins }).map((_, i) => {
              const isUb = unbreakableCoins.has(i)
              return (
                <Image
                  key={i}
                  src={`${STORAGE_BASE}/icons/stats/${isUb ? 'unbreakable_coin' : 'coin'}.webp`}
                  alt={isUb ? '파괴 불가 코인' : '코인'}
                  width={16} height={16}
                  style={{ width: coinIconSize, height: coinIconSize }}
                />
              )
            })}
          </div>

          {/* Diagonal gradient skill name banner */}
          <div className="overflow-hidden mb-1" style={{ width: 'fit-content', maxWidth: '100%' }}>
            <div style={{
              color: '#e8dcc8',
              backgroundImage: `linear-gradient(255deg, transparent 1.2em, ${sinColor}30 1.2em)`,
            }}>
              <div style={{
                padding: '0.1em 0 0.1em 0.3em',
                backgroundImage: `linear-gradient(290deg, transparent 2em, ${sinColor}40 2em, ${sinColor}40 2.12em, transparent 2.12em, transparent 2.24em, ${sinColor}40 2.24em, ${sinColor}40 2.36em, transparent 2.36em, transparent 2.48em, ${sinColor}40 2.48em, ${sinColor}40 2.6em, transparent 2.6em, transparent 2.72em, ${sinColor}40 2.72em)`,
                textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
              }}>
                <span className="font-bold whitespace-nowrap" style={{
                  fontSize: skillNameSize,
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  paddingRight: '3.5em',
                  color: '#e8dcc8',
                }}>
                  {name}
                </span>
              </div>
            </div>
          </div>

          {/* Offense level + attack weight */}
          <div className="flex items-center gap-3">
            {offenseLevel != null && (
              <div className="flex items-center gap-0.5">
                <Image
                  src={`${STORAGE_BASE}/icons/ui/${isDefense ? 'icon-defense' : 'icon-sword'}.webp`}
                  alt="" width={22} height={22}
                  style={{ width: offenseIconSize, height: offenseIconSize }}
                />
                <span style={{
                  fontFamily: 'var(--font-excelsior), sans-serif',
                  color: '#e8dcc8',
                  fontSize: offenseLevelSize,
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  textDecorationColor: '#e8dcc8',
                }}>
                  {offenseLevel}
                </span>
              </div>
            )}
            {isAttackSkill && atkWeight > 0 && (
              <div className="flex items-center gap-1">
                <span style={{ fontFamily: 'var(--font-heading)', color: '#c8900a', fontSize: '0.625rem', fontWeight: 700 }}>
                  공격 가중치
                </span>
                <div className="flex gap-0.5">
                  {Array.from({ length: atkWeight }).map((_, i) => (
                    <div key={i} style={{ width: atkWeightSquare, height: atkWeightSquare, background: '#c8900a', borderRadius: '0.1rem' }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mental consume (optional) */}
          {mentalConsume != null && mentalConsume !== 0 && (
            <div className="mt-0.5">
              <span className="font-mono" style={{ color: '#cc6666', fontSize: '0.625rem' }}>
                정신력 -{mentalConsume}
              </span>
            </div>
          )}
        </div>
      </div>

      {description && (
        <SkillDescription
          description={description}
          accentColor={sinColor}
          variant={descVariant}
          allowedKeywords={allowedKeywords}
        />
      )}
    </div>
  )
}
