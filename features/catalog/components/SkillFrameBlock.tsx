'use client'

import Image from 'next/image'
import GameSkillBox from '@/features/catalog/components/GameSkillBox'
import SkillDescription from '@/features/catalog/components/SkillDescription'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { useTranslations } from 'next-intl'
import { offenseLevelDisplay } from '@/features/catalog/lib/identity-level'

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
  /** Per-coin power from the game's coin data ("+7", "-12"), shown as each coin's tooltip */
  coinLabels?: string[]
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
  coinLabels,
  descVariant = 'compact',
  allowedKeywords,
  matchPlainKeywords,
  skillNameColors,
  mentalConsume,
}: SkillFrameBlockProps) {
  const t = useTranslations()
  const offense = offenseLevel != null ? offenseLevelDisplay(offenseLevel) : null

  const atkTypeKey = normalizeAttackType(atkType)


  return (
    <div>
      {/* the game's skill box; the old frame size sets how large it may grow (the frame is 210 of its units) */}
      <GameSkillBox
        iconUrl={skillIconUrl}
        sin={sin}
        tier={isDefense ? 1 : skillSlot}
        attackType={atkTypeKey}
        basePower={basePower}
        coinPower={coinPower}
        name={name}
        skillType={isDefense ? (atkTypeKey ? 'counter' : 'defense') : 'attack'}
        level={offense?.level}
        levelTitle={offense?.correction || undefined}
        weight={atkWeight}
        weightLabel={t('identity.skills.atkWeight')}
        coins={Array.from({ length: coins }, (_, i) => ({ unbreakable: unbreakableCoins.has(i), label: coinLabels?.[i] }))}
        coinLabel={t('identity.skills.coin')}
        unbreakableLabel={t('identity.skills.unbreakableCoin')}
        maxUnit={(parseFloat(size) * 16) / 210}
      />

      {/* Mental consume (optional) */}
      {mentalConsume != null && mentalConsume !== 0 && (
        <div className="mb-2 flex items-center gap-2" aria-label={`${t('identity.sanity.title')} −${mentalConsume}`}>
          <Image src={getGameUiAsset('sanity/9999')} alt="" width={32} height={32} style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain', filter: 'sepia(1) saturate(4) hue-rotate(310deg)' }} />
          <span aria-hidden="true" style={{ fontFamily: 'var(--font-excelsior), sans-serif', color: '#ef7777', fontSize: '1.5rem', lineHeight: 1 }}>
            − {mentalConsume}
          </span>
        </div>
      )}

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
