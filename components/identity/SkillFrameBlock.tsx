'use client'

import { COIN_IMAGES } from '@/lib/identity/skill-description'

import Image from 'next/image'
import SkillNameBanner from '@/components/skill/SkillNameBanner'
import SkillFrame from './SkillFrame'
import SkillDescription from '@/components/skill/SkillDescription'
import { getDetailStatIconUrl } from '@/lib/utils/images'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { useTranslations } from 'next-intl'
import { offenseLevelDisplay } from '@/lib/identity/level'

const ATTACK_TYPE_MAP: Record<string, 'slash' | 'pierce' | 'blunt'> = {
  slash: 'slash',
  pierce: 'pierce',
  blunt: 'blunt',
  '참격': 'slash',
  '관통': 'pierce',
  '타격': 'blunt',
}

function normalizeAttackType(atkType?: string | null): 'slash' | 'pierce' | 'blunt' | null {
  if (!atkType) return null
  return ATTACK_TYPE_MAP[atkType.trim().toLowerCase()] ?? ATTACK_TYPE_MAP[atkType.trim()] ?? null
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
  /** Stored offense level (level-60 baseline); shown at level 65 with its correction. */
  offenseLevel?: number | null
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
  allowedKeywords?: ReadonlySet<string>
  /** The description is a skill of an identity / E.G.O: draw `allowedKeywords` written as plain words. */
  matchPlainKeywords?: boolean
  /** Names of the identity's skills, coloured by sin inside the description (as on the identity page). */
  skillNameColors?: Record<string, string>
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
  matchPlainKeywords,
  skillNameColors,
  mentalConsume,
}: SkillFrameBlockProps) {
  const t = useTranslations()
  const offense = offenseLevel != null ? offenseLevelDisplay(offenseLevel) : null

  const atkTypeKey = normalizeAttackType(atkType)
  const showAtkWeight = Boolean(atkTypeKey) && atkWeight > 0

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
        <div className="relative isolate shrink-0 ml-2" style={{ width: size, height: size }}>
          {/* Sin color triangle */}
          <div className="absolute flex items-center justify-center pointer-events-none" style={{
            top: '1.5%', left: '50%', transform: 'translateX(-56%)',
            width: frameRem >= 6 ? '1.5rem' : '1rem',
            height: frameRem >= 6 ? '1.25rem' : '1rem',
            zIndex: 1,
          }}>
            <div className="absolute" style={{
              width: frameRem >= 6 ? '2rem' : '1.5rem',
              height: frameRem >= 6 ? '1.25rem' : '1rem',
              backgroundColor: sinColor,
              clipPath: 'polygon(5% 20%, 85% 0%, 100% 100%, 10% 100%)',
            }} />
          </div>

          <SkillFrame
            attackType={atkTypeKey}
            skillIconUrl={skillIconUrl}
            sin={sin}
            skillSlot={isDefense ? 4 : skillSlot}
            sinColor={sinColor}
            label={label}
            size={size}
          />

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
          <div className="absolute z-20" data-coin-power style={{ top: '1.5%', left: '50%', transform: 'translateX(-56%) translateY(-12.5%)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: frameRem >= 6 ? '1.25rem' : '1rem', lineHeight: 1 }}>
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
                  src={isUb ? COIN_IMAGES.unbreakable : COIN_IMAGES.normal}
                  alt={isUb ? t('identity.skills.unbreakableCoin') : t('identity.skills.coin')}
                  width={16} height={16}
                  style={{ width: coinIconSize, height: coinIconSize }}
                />
              )
            })}
          </div>

          <SkillNameBanner name={name} sinColor={sinColor} fontSize={skillNameSize} />

          {/* Offense level + attack weight */}
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            {offense && (
              <div className="flex items-center gap-0.5">
                <Image
                  src={getDetailStatIconUrl(isDefense ? 'defense' : 'offense')}
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
                  {offense.level}
                </span>
                {offense.correction && <span style={{ fontFamily: 'var(--font-excelsior), sans-serif', color: '#888', fontSize: '0.875rem' }}>{offense.correction}</span>}
              </div>
            )}
            {showAtkWeight && (
              <div className="flex items-center gap-1">
                <span style={{ fontFamily: 'var(--font-heading)', color: '#c8900a', fontSize: '0.625rem', fontWeight: 700 }}>
                  {t('identity.skills.atkWeight')}
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
            <div className="mt-2 flex items-center gap-2" aria-label={`${t('identity.sanity.title')} −${mentalConsume}`}>
              <Image src={getGameUiAsset('sanity/9999')} alt="" width={32} height={32} style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain', filter: 'sepia(1) saturate(4) hue-rotate(310deg)' }} />
              <span aria-hidden="true" style={{ fontFamily: 'var(--font-excelsior), sans-serif', color: '#ef7777', fontSize: '1.5rem', lineHeight: 1 }}>
                − {mentalConsume}
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
          matchPlainKeywords={matchPlainKeywords}
          skillNameColors={skillNameColors}
        />
      )}
    </div>
  )
}
