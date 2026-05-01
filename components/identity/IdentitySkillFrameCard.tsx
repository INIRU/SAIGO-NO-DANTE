'use client'

import SkillFrameBlock from '@/components/identity/SkillFrameBlock'
import { STORAGE_BASE } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'
import { computeSkillImageIndices } from '@/lib/utils/images'
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
  allowedKeywords?: Set<string>
  className?: string
  style?: CSSProperties
}

const DEFENSE_LABELS: Record<string, string> = {
  evade: '회피',
  defense: '수비',
  counter: '반격',
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

function variantLabel(skill: SkillFrameSkill, skills: SkillFrameSkill[]): string {
  if (DEFENSE_LABELS[skill.skill_type]) return DEFENSE_LABELS[skill.skill_type]

  const sameOrder = skills
    .filter(item => item.skill_order === skill.skill_order)
    .sort((a, b) => (a.variant_order ?? 0) - (b.variant_order ?? 0))

  if (sameOrder.length <= 1) return `S${skill.skill_order}`

  const variantIndex = sameOrder.findIndex(item => item.id === skill.id)
  return `S${skill.skill_order}-${variantIndex >= 0 ? variantIndex + 1 : 1}`
}

function unbreakableCoinSet(description?: string | null): Set<number> {
  const coins = new Set<number>()
  if (!description) return coins

  const matches = description.matchAll(/\[코인\s?(\d+)\]\s*파괴 불가 코인/g)
  for (const match of matches) {
    const coinIndex = Number(match[1]) - 1
    if (Number.isInteger(coinIndex) && coinIndex >= 0) coins.add(coinIndex)
  }
  return coins
}

export default function IdentitySkillFrameCard({
  skill,
  skills,
  identity,
  lang,
  size = '3.5rem',
  allowedKeywords,
  className = 'p-2.5 rounded',
  style,
}: IdentitySkillFrameCardProps) {
  const sin = normalizeSin(skill.sin_affinity)
  const sinColor = sin === 'neutral' ? '#cccccc' : SIN_COLORS[sin]
  const skillImageIdx = computeSkillImageIndices(skills)
  const imageIndex = skillImageIdx[skill.id] ?? skill.skill_order
  const skillIconUrl = identity?.game_id
    ? `${STORAGE_BASE}/icons/skills/${identity.sinner_id}/${identity.game_id}${String(imageIndex).padStart(2, '0')}.webp`
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
        label={variantLabel(skill, skills)}
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
        unbreakableCoins={unbreakableCoinSet(skill.description)}
        descVariant="compact"
        allowedKeywords={allowedKeywords}
      />
    </div>
  )
}
