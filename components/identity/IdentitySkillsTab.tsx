'use client'

import { unbreakableCoinIndices, COIN_IMAGES } from '@/lib/identity/skill-description'

import Image from 'next/image'
import { groupIdentitySkills } from '@/lib/identity/skill-model'
import {
  Identity,
  Skill,
  SIN_COLORS,
  SKILL_TYPE_LABELS,
  getSkillIconUrl,
} from '@/lib/data/sinners'
import SkillDescription from '@/components/skill/SkillDescription'
import SkillNameBanner from '@/components/skill/SkillNameBanner'
import SkillFrame from '@/components/identity/SkillFrame'
import { UptieChangePanel, type StatChange } from '@/components/identity/UptieChanges'
import { getDetailStatIconUrl } from '@/lib/utils/images'
import { diffDescriptionLines, type SkillDiff } from '@/lib/utils/uptie-diff'
import { useTranslations, useLocale } from 'next-intl'
import { IDENTITY_STAT_BASE_LEVEL, offenseLevelDisplay } from '@/lib/identity/level'

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
  allowedKeywords?: Set<string>
  skillDiffs?: Map<string, SkillDiff>
  newSkills?: Skill[]
  /** Next uptie level with data; diffs above compare against it. */
  nextLevel?: number | null
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

      <div className="space-y-3">
        {groupIdentitySkills(filteredSkills).map(group => (
          <div key={group[0].id} className="rounded border border-[#2e2417] bg-[#17120c] px-4 sm:px-6">
          {group.map(skill => {
          const skillSinColor = SIN_COLORS[skill.sin_affinity] || '#cccccc'
          const imgIdx = skillImgIdxMap[skill.id] ?? skill.skill_order
          const skillIconUrl = getSkillIconUrl(identity, imgIdx, skill)
          const v = variantMap[skill.id]
          const baseOrder = v?.baseOrder ?? (skill.skill_order >= 5 ? 3 : skill.skill_order)
          const diff = skillDiffs?.get(skill.id)
          const offCorrStr = skill.offense_level != null ? offenseLevelDisplay(skill.offense_level - level + IDENTITY_STAT_BASE_LEVEL).correction : ''
          const isAttackSkill = baseOrder !== 4
          const isDefense = baseOrder === 4
          const skillLabel = isDefense
            ? (v && v.total > 1
              ? `${SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type}-${v.idx}`
              : SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type)
            : (v && v.total > 1 ? `S${baseOrder}-${v.idx}` : `S${baseOrder}`)
          const atkTypeKey = skillAttackType(skill)
          const skillDescription = localSkillDesc(skill)
          const skillFlavor = localSkillFlavor(skill, locale)

          const unbreakableCoins = unbreakableCoinIndices(skillDescription)

          return (
            <div
              key={skill.id}
              className="grid min-w-0 gap-3 py-4 sm:py-5 lg:grid-cols-[27rem_minmax(0,1fr)] lg:gap-8 [&+div]:border-t [&+div]:border-[#2e2417]"
            >
              {/* 스킬 프레임 + 정보 영역 */}
              <div className="flex items-center gap-1 sm:gap-2 self-start">
                {/* 프레임 + 오버레이 */}
                <div className="relative shrink-0 ml-1 sm:ml-4 w-[6.5rem] h-[6.5rem] sm:w-[8rem] sm:h-[8rem]">
                  {/* 죄악 색 삼각형 */}
                  <div className="absolute flex items-center justify-center pointer-events-none" style={{
                    top: '1.5%', left: '50%', transform: 'translateX(-56%)',
                    width: '1.5rem', height: '1.5rem', zIndex: 0,
                  }}>
                    <div className="absolute" style={{
                      width: '2.25rem', height: '1.5rem',
                      backgroundColor: skillSinColor,
                      clipPath: 'polygon(5% 20%, 85% 0%, 100% 100%, 10% 100%)',
                    }} />
                  </div>
                  <SkillFrame
                    attackType={atkTypeKey}
                    skillIconUrl={skillIconUrl}
                    sin={skill.sin_affinity || 'neutral'}
                    skillSlot={isDefense ? 4 : baseOrder <= 3 ? baseOrder : 1}
                    sinColor={skillSinColor}
                    label={skillLabel}
                    size="100%"
                    eager
                  />
                  {/* 기본 위력 (좌측) */}
                  <div className="absolute z-20" style={{ left: 0, top: '50%', transform: 'translateX(-40%) translateY(-75%)' }}>
                    <span style={{ fontFamily: "var(--font-excelsior), sans-serif", fontSize: 'clamp(1.375rem, 4vw, 2.125rem)', lineHeight: 1, color: 'oklch(81.35% .0894 69.33)' }}>
                      {skill.base_power}
                    </span>
                  </div>
                  {/* 코인 위력 (상단) */}
                  <div className="absolute z-20" style={{ top: 0, left: '50%', transform: 'translateX(-56%) translateY(-12.5%)' }}>
                    {skill.coin_power >= 0 ? (
                      <span style={{
                        fontFamily: "var(--font-excelsior), sans-serif", fontSize: '1.125rem', fontWeight: 700, lineHeight: 1,
                        color: 'oklch(81.35% .0894 69.33)',
                        textShadow: '1px 1px 1px black',
                        WebkitTextStroke: '0.01px black',
                      }}>
                        +{skill.coin_power}
                      </span>
                    ) : (
                      <span style={{
                        fontFamily: "var(--font-excelsior), sans-serif", fontSize: '1.125rem', fontWeight: 700, lineHeight: 1,
                        color: '#ff8866',
                        textShadow: '1px 1px 1px black',
                        WebkitTextStroke: '0.01px black',
                      }}>
                        <span style={{ fontSize: '1.5rem' }}>-</span>{Math.abs(skill.coin_power)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 스킬 정보 (오른쪽) */}
                <div className="flex-1 min-w-0 overflow-hidden pt-1">
                  {/* 코인 시각화 */}
                  <div className="flex items-center gap-0.5 mb-0.5">
                    {Array.from({ length: skill.coins }).map((_, ci) => {
                      const isUb = unbreakableCoins.has(ci)
                      return (
                        <Image key={ci}
                          src={isUb ? COIN_IMAGES.unbreakable : COIN_IMAGES.normal}
                          alt={isUb ? t('identity.skills.unbreakableCoin') : t('identity.skills.coin')} width={16} height={16}
                          className="w-3 h-3 sm:w-4 sm:h-4"
                        />
                      )
                    })}
                  </div>
                  {/* 스킬명 배너 (사선 꼬리, pretext 기반 동적 너비) */}
                  <SkillNameBanner name={localSkillName(skill)} sinColor={skillSinColor} fontSize="clamp(1rem, 1.6vw, 1.25rem)" />
                  {/* 공격 레벨 + 가중치 */}
                  <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
                    {skill.offense_level != null && (
                      <div className="flex items-center gap-1">
                        <Image src={getDetailStatIconUrl(isDefense ? 'defense' : 'offense')} alt="" width={22} height={22} className="w-4 h-4 sm:w-[1.375rem] sm:h-[1.375rem]" />
                        <span style={{ fontFamily: "var(--font-excelsior), sans-serif", color: '#e8dcc8', fontSize: 'clamp(1rem, 3vw, 1.375rem)', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: '#e8dcc8' }}>
                          {skill.offense_level}
                        </span>
                        {offCorrStr && <span style={{ fontFamily: "var(--font-excelsior), sans-serif", color: '#888', fontSize: '1rem' }}>{offCorrStr}</span>}
                      </div>
                    )}
                    {atkTypeKey && (skill.atk_weight || 1) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontFamily: 'var(--font-heading)', color: '#c8900a', fontSize: '0.6875rem', fontWeight: 700 }}>{t('identity.skills.atkWeight')}</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: skill.atk_weight || 1 }).map((_, i) => (
                            <div key={i} style={{ width: '0.5rem', height: '0.5rem', background: '#c8900a', borderRadius: '0.1rem' }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 스킬 설명 */}
              {(skillDescription || skillFlavor || diff) && (
                <div className="min-w-0 max-w-[75ch] lg:pt-3 [&>div]:text-[.875rem]! [&>div]:text-[#c9c3b8]!">
                <SkillDescription
                  description={skillDescription}
                  accentColor="#c2b79f"
                  variant="detail"
                  skillNameColors={skillNameColors}
                  allowedKeywords={allowedKeywords}
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
        />
      ))}
    </div>
  )
}
