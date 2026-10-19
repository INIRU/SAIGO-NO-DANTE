'use client'

import SkillFrameBlock from '@/components/identity/SkillFrameBlock'
import { unbreakableCoinIndices } from '@/lib/identity/skill-description'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'
import { computeSkillImageIndices, getSkillIconUrl } from '@/lib/utils/images'
import type { CSSProperties } from 'react'

type SkillFrameSkill = {
  id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  skill_type: string
  atk_type?: string | null
  atkType?: string | null
  attack_type?: string | null
  sin_affinity?: string | null
  coins: number
  base_power: number
  coin_power: number
  description?: string | null
  description_en?: string | null
  description_jp?: string | null
  skill_order: number
  image_id?: string | null
  atk_weight?: number | null
  offense_level?: number | null
  variant_order?: number | null
}

type SkillFrameIdentity = {
  sinner_id: string
  game_id?: string | null
}

type IdentitySkillFrameCardProps = {
  skill: SkillFrameSkill
  skills: SkillFrameSkill[]
  identity?: SkillFrameIdentity | null
  lang?: string
  size?: string
  allowedKeywords?: ReadonlySet<string>
  /** The card shows a skill of an identity: draw `allowedKeywords` written as plain words. */
  matchPlainKeywords?: boolean
  className?: string
  style?: CSSProperties
}

const DEFENSE_LABELS: Record<string, { ko: string; en: string; ja: string }> = {
  evade: { ko: '회피', en: 'Evade', ja: '回避' },
  defense: { ko: '수비', en: 'Guard', ja: '防御' },
  counter: { ko: '반격', en: 'Counter', ja: '反撃' },
}

const ALL_SINS = new Set<SinType>(['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'])

function normalizeSin(sin?: string | null): SinType | 'neutral' {
  if (!sin) return 'neutral'
  if (ALL_SINS.has(sin as SinType)) return sin as SinType
  return SIN_KR_TO_EN[sin] ?? 'neutral'
}

function localizedText(
  lang: string | undefined,
  fallback: string | null | undefined,
  en?: string | null,
  jp?: string | null,
): string | null | undefined {
  if (lang === 'en') return en || fallback
  if (lang === 'ja') return jp || fallback
  return fallback
}

function variantLabel(skill: SkillFrameSkill, skills: SkillFrameSkill[], lang?: string): string {
  const defense = DEFENSE_LABELS[skill.skill_type]
  if (defense) return lang === 'en' || lang === 'ja' ? defense[lang] : defense.ko

  const sameOrder = skills
    .filter(item => item.skill_order === skill.skill_order)
    .sort((a, b) => (a.variant_order ?? 0) - (b.variant_order ?? 0))

  if (sameOrder.length <= 1) return `S${skill.skill_order}`

  const variantIndex = sameOrder.findIndex(item => item.id === skill.id)
  return `S${skill.skill_order}-${variantIndex >= 0 ? variantIndex + 1 : 1}`
}

export default function IdentitySkillFrameCard({
  skill,
  skills,
  identity,
  lang,
  size = '3.5rem',
  allowedKeywords,
  matchPlainKeywords,
  className = 'p-2.5 rounded',
  style,
}: IdentitySkillFrameCardProps) {
  const sin = normalizeSin(skill.sin_affinity)
  const sinColor = sin === 'neutral' ? '#cccccc' : SIN_COLORS[sin]
  const skillImageIdx = computeSkillImageIndices(skills)
  const imageIndex = skillImageIdx[skill.id] ?? skill.skill_order
  const skillIconUrl = identity?.game_id
    ? getSkillIconUrl({ sinner_id: identity.sinner_id, game_id: identity.game_id }, imageIndex, skill)
    : ''
  const description = localizedText(lang, skill.description, skill.description_en, skill.description_jp)
  const atkType = skill.atk_type ?? skill.atkType ?? skill.attack_type ?? skill.skill_type

  return (
    <div
      className={className}
      style={{
        background: `${sinColor}08`,
        border: `1px solid ${sinColor}25`,
        ...style,
      }}
    >
      <SkillFrameBlock
        skillIconUrl={skillIconUrl}
        sin={sin}
        sinColor={sinColor}
        skillSlot={skill.skill_order <= 3 ? skill.skill_order : 1}
        label={variantLabel(skill, skills, lang)}
        size={size}
        name={localizedText(lang, skill.name, skill.name_en, skill.name_jp) ?? skill.name}
        basePower={skill.base_power}
        coinPower={skill.coin_power}
        coins={skill.coins}
        atkType={atkType}
        offenseLevel={skill.offense_level}
        atkWeight={skill.atk_weight || 1}
        isDefense={Boolean(DEFENSE_LABELS[skill.skill_type])}
        description={description}
        unbreakableCoins={unbreakableCoinIndices(skill.description)}
        descVariant="compact"
        allowedKeywords={allowedKeywords}
        matchPlainKeywords={matchPlainKeywords}
      />
    </div>
  )
}
