'use client'

import { coinPowerLabels, unbreakableCoinSet } from '@/lib/identity/skill-description'

import { groupIdentitySkills, skillLabel, skillSlot } from '@/lib/identity/skill-model'
import {
  Identity,
  Skill,
  SIN_COLORS,
  SKILL_TYPE_LABELS,
  getSkillIconUrl,
} from '@/lib/data/sinners'
import SkillDescription from '@/features/catalog/components/SkillDescription'
import GameSkillBox from '@/features/catalog/components/GameSkillBox'
import { UptieChangePanel, type StatChange } from '@/features/catalog/components/UptieChanges'
import { diffDescriptionLines, type SkillDiff } from '@/lib/utils/uptie-diff'
import { useTranslations, useLocale } from 'next-intl'
import { IDENTITY_STAT_BASE_LEVEL, offenseLevelDisplay } from '@/features/catalog/lib/identity-level'

const ATTACK_TYPE_MAP: Record<string, 'slash' | 'pierce' | 'blunt'> = {
  slash: 'slash',
  pierce: 'pierce',
  blunt: 'blunt',
  '참격': 'slash',
  '관통': 'pierce',
  '타격': 'blunt',
}

type SkillWithFlavor = Skill & {
  flavor?: string | null
  flavor_en?: string | null
  flavor_jp?: string | null
}

function normalizeAttackType(atkType?: string | null): 'slash' | 'pierce' | 'blunt' | null {
  if (!atkType) return null
  return ATTACK_TYPE_MAP[atkType.trim().toLowerCase()] ?? ATTACK_TYPE_MAP[atkType.trim()] ?? null
}

function skillAttackType(skill: Skill): 'slash' | 'pierce' | 'blunt' | null {
  const attackSkill = skill as Skill & {
    atk_type?: string | null
    atkType?: string | null
    attack_type?: string | null
  }
  return normalizeAttackType(attackSkill.atk_type ?? attackSkill.atkType ?? attackSkill.attack_type ?? skill.skill_type)
}

function localSkillFlavor(skill: Skill, locale: string): string | null | undefined {
  const s = skill as SkillWithFlavor
  if (locale === 'en') return s.flavor_en || s.flavor
  if (locale === 'ja') return s.flavor_jp || s.flavor
  return s.flavor
}

interface IdentitySkillsTabProps {
  level: number
  identity: Identity
  filteredSkills: Skill[]
  skillNameColors: Record<string, string>
  skillImgIdxMap: Record<string, number>
  variantMap: Record<string, { baseOrder: number; idx: number; total: number }>
  allowedKeywords?: ReadonlySet<string>
  skillDiffs?: Map<string, SkillDiff>
  newSkills?: Skill[]
  /** Next uptie level with data; diffs above compare against it. */
  nextLevel?: number | null
  /** Inside the identity modal: smaller skill boxes and a rule between skills instead of a card */
  compact?: boolean
}

export default function IdentitySkillsTab({
  level,
  identity,
  filteredSkills,
  skillNameColors,
  skillImgIdxMap,
  variantMap,
  allowedKeywords,
  skillDiffs,
  newSkills,
  nextLevel,
  compact = false,
}: IdentitySkillsTabProps) {
  const t = useTranslations()
  const locale = useLocale()
  const localSkillName = (s: Skill) =>
    locale === 'en' && s.name_en ? s.name_en : locale === 'ja' && s.name_jp ? s.name_jp : s.name
  const localSkillDesc = (s: Skill) =>
    locale === 'en' && s.description_en ? s.description_en : locale === 'ja' && s.description_jp ? s.description_jp : s.description
  const statChanges = (diff: SkillDiff): StatChange[] => ([
    { label: t('identity.uptie.basePower'), diff: diff.base_power },
    { label: t('identity.uptie.coinPower'), diff: diff.coin_power, signed: true },
    { label: t('identity.uptie.coins'), diff: diff.coins },
    { label: t('identity.uptie.offenseLevel'), diff: diff.offense_level },
    { label: t('identity.skills.atkWeight'), diff: diff.atk_weight },
  ] as const).filter((row): row is StatChange => !!row.diff)

  if (filteredSkills.length === 0) {
    return (
      <div
        className="card p-8 text-center"
        style={{ color: '#999', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
      >
        <p className="font-serif text-lg">{t('identity.skills.preparing')}</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="sr-only">{t('identity.skills.title')}</h2>

      <div className={compact ? 'divide-y divide-[#2e2417]' : 'space-y-3'}>
        {groupIdentitySkills(filteredSkills).map(group => (
          <div key={group[0].id} className={compact ? '' : 'rounded border border-[#2e2417] bg-[#17120c] px-4 sm:px-6'}>
          {group.map(skill => {
          const imgIdx = skillImgIdxMap[skill.id] ?? skill.skill_order
          const skillIconUrl = getSkillIconUrl(identity, imgIdx, skill)
          const v = variantMap[skill.id]
          const baseOrder = v?.baseOrder ?? skillSlot(skill)
          const diff = skillDiffs?.get(skill.id)
          const offCorrStr = skill.offense_level != null ? offenseLevelDisplay(skill.offense_level - level + IDENTITY_STAT_BASE_LEVEL).correction : ''
          const isDefense = baseOrder === 4
          const label = skillLabel(skill, filteredSkills, SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type)
          const atkTypeKey = skillAttackType(skill)
          const skillDescription = localSkillDesc(skill)
          const skillFlavor = localSkillFlavor(skill, locale)

          const unbreakableCoins = unbreakableCoinSet(skill)
          // The game lists every coin's own value; when they differ (or an operator is not ADD), each coin shows its own.
          const coinLabels = coinPowerLabels(skill)
          const coinsDiffer = new Set(coinLabels).size > 1

          return (
            <div
              key={skill.id}
              className="grid min-w-0 gap-3 py-4 sm:py-5 [&+div]:border-t [&+div]:border-[#2e2417]"
            >
              {/* 게임 스킬 박스 그대로: 아이콘, 코인 줄, 한 줄 이름 판, 공격 레벨·가중치 */}
              <GameSkillBox
                iconUrl={skillIconUrl}
                sin={skill.sin_affinity}
                tier={skill.skill_tier ?? (isDefense ? 1 : baseOrder)}
                attackType={atkTypeKey}
                basePower={skill.base_power}
                coinPower={skill.coin_power}
                name={localSkillName(skill)}
                skillType={skill.skill_type}
                level={skill.offense_level}
                levelTitle={offCorrStr || undefined}
                weight={skill.atk_weight || 1}
                weightLabel={t('identity.skills.atkWeight')}
                coins={Array.from({ length: skill.coins }, (_, ci) => ({
                  unbreakable: unbreakableCoins.has(ci),
                  color: skill.coin_list?.[ci]?.color ?? null,
                  label: coinsDiffer ? coinLabels[ci] : undefined,
                }))}
                coinLabel={t('identity.skills.coin')}
                unbreakableLabel={t('identity.skills.unbreakableCoin')}
                maxUnit={compact ? 0.44 : undefined}
                // the base skill of slot 1-3 (the first of its slot); its variants carry no tier
                tierLabel={!isDefense && baseOrder <= 3 && (v?.idx ?? 1) === 1 ? `SKILL ${baseOrder}` : undefined}
              />

              {/* 스킬 설명 */}
              {(skillDescription || skillFlavor || diff) && (
                <div className={`min-w-0 max-w-[80ch] ${compact ? 'sm:pl-[7.25rem]' : 'sm:pl-[10.25rem]'} [&>div]:text-[.875rem]! [&>div]:text-[#c9c3b8]!`}>
                <SkillDescription
                  description={skillDescription}
                  accentColor="#c2b79f"
                  variant="detail"
                  skillNameColors={skillNameColors}
                  allowedKeywords={allowedKeywords}
                  matchPlainKeywords
                  flavorText={skillFlavor}
                />
                {diff && nextLevel != null && (
                  <UptieChangePanel
                    level={nextLevel}
                    stats={statChanges(diff)}
                    lines={diffDescriptionLines(skillDescription || '', localSkillDesc(diff.next) || '')}
                    accentColor="#c2b79f"
                    skillNameColors={skillNameColors}
                    allowedKeywords={allowedKeywords}
                    matchPlainKeywords
                  />
                )}
                </div>
              )}
            </div>
          )
        })}
          </div>
        ))}
      </div>

      {/* 다음 동기화에서 새로 생기는 스킬 */}
      {nextLevel != null && newSkills?.map(skill => (
        <UptieChangePanel
          key={skill.id}
          level={nextLevel}
          title={<>
            <span style={{ color: SIN_COLORS[skill.sin_affinity] || '#c2b79f' }}>{localSkillName(skill)}</span>
            <span className="text-[var(--text-muted)]">{t('identity.uptie.newSkill')}</span>
          </>}
          lines={diffDescriptionLines('', localSkillDesc(skill) || '')}
          accentColor="#c2b79f"
          skillNameColors={skillNameColors}
          allowedKeywords={allowedKeywords}
          matchPlainKeywords
        />
      ))}
    </div>
  )
}
