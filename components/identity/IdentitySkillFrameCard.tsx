'use client'

import SkillFrameBlock from '@/components/identity/SkillFrameBlock'
import { coinPowerLabels, unbreakableCoinSet } from '@/lib/identity/skill-description'
import { skillLabel, skillSlot } from '@/lib/identity/skill-model'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import type { SinType, SkillCoin } from '@/lib/types'
import { computeSkillImageIndices, getSkillIconUrl } from '@/lib/utils/images'
import { useOwnKeywords } from '@/lib/hooks/useOwnKeywords'
import { descriptionTexts } from '@/lib/keywords/own-keywords'
import { useMemo, type CSSProperties } from 'react'

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
  uptie_level?: number | null
  coin_list?: SkillCoin[] | null
}

type SkillFrameIdentity = {
  sinner_id: string
  game_id?: string | null
  /** The identity's listed keywords: with the skills' texts, the keyword set its older plain-word keywords are found in. */
  keywords?: readonly string[] | null
}

type IdentitySkillFrameCardProps = {
  skill: SkillFrameSkill
  skills: SkillFrameSkill[]
  identity?: SkillFrameIdentity | null
  lang?: string
  size?: string
  /** The identity's own keyword set when the caller has it (with its passives); else built from `identity` and `skills`. */
  allowedKeywords?: ReadonlySet<string>
  className?: string
  style?: CSSProperties
  /** The art in the frame when it is not the skill's sprite (an E.G.O skill). */
  iconUrl?: string
}

const DEFENSE_LABELS: Record<string, { ko: string; en: string; ja: string }> = {
  evade: { ko: '회피', en: 'Evade', ja: '回避' },
  defense: { ko: '방어', en: 'Guard', ja: '防御' },
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

/** The same label as the identity page: S1-S3 (-n for variants) or the defense type, counted among the skills of the same uptie. */
function variantLabel(skill: SkillFrameSkill, skills: SkillFrameSkill[], lang?: string): string {
  const level = skill.uptie_level ?? 3
  const sameLevel = skills.filter(item => (item.uptie_level ?? 3) === level)
  const defense = DEFENSE_LABELS[skill.skill_type]
  const name = defense ? (lang === 'en' || lang === 'ja' ? defense[lang] : defense.ko) : ''
  return skillLabel(skill, sameLevel.some(item => item.id === skill.id) ? sameLevel : [skill], name)
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
  iconUrl,
}: IdentitySkillFrameCardProps) {
  // The card always shows a skill of an identity, so it reads the text like the identity page does wherever it is (the
  // motion page, a skill block of a deck or plan note): the keywords older text writes as plain words, from the
  // identity's own keyword set, and the names of its skills in their sin colour.
  const texts = useMemo(() => descriptionTexts(skills), [skills])
  const ownKeywords = useOwnKeywords(identity?.keywords, texts)
  const skillNameColors = useMemo(() => {
    const colors: Record<string, string> = {}
    for (const s of skills) {
      const sin = normalizeSin(s.sin_affinity)
      for (const name of [s.name, s.name_en, s.name_jp]) if (name) colors[name] = sin === 'neutral' ? '#cccccc' : SIN_COLORS[sin]
    }
    return colors
  }, [skills])
  const sin = normalizeSin(skill.sin_affinity)
  const sinColor = sin === 'neutral' ? '#cccccc' : SIN_COLORS[sin]
  const imageIndex = computeSkillImageIndices(skills.filter(item => (item.uptie_level ?? 3) === (skill.uptie_level ?? 3)))[skill.id] ?? skillSlot(skill)
  const skillIconUrl = iconUrl ?? (identity?.game_id
    ? getSkillIconUrl({ sinner_id: identity.sinner_id, game_id: identity.game_id }, imageIndex, skill)
    : '')
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
        skillSlot={skillSlot(skill)}
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
        unbreakableCoins={unbreakableCoinSet(skill)}
        coinLabels={coinPowerLabels(skill)}
        descVariant="compact"
        allowedKeywords={allowedKeywords ?? ownKeywords}
        matchPlainKeywords
        skillNameColors={skillNameColors}
      />
    </div>
  )
}
