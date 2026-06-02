'use client'

import Image from 'next/image'
import {
  Identity,
  Skill,
  SIN_COLORS,
  STORAGE_BASE,
  SKILL_TYPE_LABELS,
  getSkillIconUrl,
} from '@/lib/data/sinners'
import SkillDescription from '@/components/skill/SkillDescription'
import SkillFrame from '@/components/identity/SkillFrame'
import type { SkillDiff } from '@/lib/utils/uptie-diff'
import { useTranslations, useLocale } from 'next-intl'

/** 스킬명 배너 — SkillFrameBlock와 동일 패턴 (paddingRight + fit-content) */
function SkillNameBanner({ name, sinColor }: { name: string; sinColor: string }) {
  return (
    <div className="overflow-hidden mb-1" style={{ width: 'fit-content', maxWidth: '100%' }}>
      <div style={{
        color: '#e8dcc8',
        backgroundImage: `linear-gradient(255deg, transparent 1.5em, ${sinColor}30 1.5em)`,
      }}>
        <div style={{
          padding: '0.1em 0 0.1em 0.3em',
          backgroundImage: `linear-gradient(290deg, transparent 2em, ${sinColor}40 2em, ${sinColor}40 2.12em, transparent 2.12em, transparent 2.24em, ${sinColor}40 2.24em, ${sinColor}40 2.36em, transparent 2.36em, transparent 2.48em, ${sinColor}40 2.48em, ${sinColor}40 2.6em, transparent 2.6em, transparent 2.72em, ${sinColor}40 2.72em)`,
          textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
        }}>
          <span className="font-bold whitespace-nowrap" style={{
            fontSize: '0.875rem', fontFamily: 'var(--font-heading)', fontWeight: 800,
            paddingRight: '3.5em',
          }}>
            {name}
          </span>
        </div>
      </div>
    </div>
  )
}

const SIN_FRAME_MAP: Record<string, string> = {
  wrath: 'crimson', lust: 'scarlet', sloth: 'amber', gluttony: 'shamrock',
  gloom: 'azure', pride: 'indigo', envy: 'violet',
}

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
  identity: Identity
  filteredSkills: Skill[]
  skillNameColors: Record<string, string>
  skillImgIdxMap: Record<string, number>
  variantMap: Record<string, { baseOrder: number; idx: number; total: number }>
  allowedKeywords?: Set<string>
  skillDiffs?: Map<string, SkillDiff>
  newSkills?: Skill[]
  showDiff?: boolean
  onToggleDiff?: () => void
}

function DiffBadge({ to }: { from: number; to: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 ml-1"
      style={{ color: '#e8b030', fontSize: '0.6875rem', fontWeight: 700 }}
    >
      <span style={{ opacity: 0.5 }}>{'\u2192'}</span>{to}
    </span>
  )
}

export default function IdentitySkillsTab({
  identity,
  filteredSkills,
  skillNameColors,
  skillImgIdxMap,
  variantMap,
  allowedKeywords,
  skillDiffs,
  newSkills,
  showDiff,
  onToggleDiff,
}: IdentitySkillsTabProps) {
  const t = useTranslations()
  const locale = useLocale()
  const localSkillName = (s: Skill) =>
    locale === 'en' && s.name_en ? s.name_en : locale === 'ja' && s.name_jp ? s.name_jp : s.name
  const localSkillDesc = (s: Skill) =>
    locale === 'en' && s.description_en ? s.description_en : locale === 'ja' && s.description_jp ? s.description_jp : s.description

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
    <div className="card p-6" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif font-light" style={{ color: 'var(--gold)', fontSize: '1rem' }}>
          {t('identity.skills.title')}
        </h2>
        {onToggleDiff && (
          <button
            onClick={onToggleDiff}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all"
            style={{
              background: showDiff ? '#c8900a15' : 'transparent',
              border: `1px solid ${showDiff ? '#c8900a40' : '#333'}`,
              color: showDiff ? '#e8b030' : '#555',
            }}
          >
            <Image
              src={`${STORAGE_BASE}/icons/ui/lock.webp`}
              alt=""
              width={118}
              height={157}
              style={{ width: '0.5625rem', height: 'auto', opacity: showDiff ? 0.9 : 0.4 }}
            />
            {t('identity.skills.uptie4Diff')}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {filteredSkills.map(skill => {
          const skillSinColor = SIN_COLORS[skill.sin_affinity] || '#cccccc'
          const imgIdx = skillImgIdxMap[skill.id] ?? skill.skill_order
          const skillIconUrl = getSkillIconUrl(identity, imgIdx)
          const v = variantMap[skill.id]
          const baseOrder = v?.baseOrder ?? (skill.skill_order >= 5 ? 3 : skill.skill_order)
          const skillIconFallback = imgIdx >= 5 ? getSkillIconUrl(identity, baseOrder) : undefined
          const diff = skillDiffs?.get(skill.id)
          const offCorr = skill.offense_level != null ? skill.offense_level - 60 : null
          const offCorrStr = offCorr === null ? '' : offCorr === 0 ? '' : offCorr > 0 ? `(+${offCorr})` : `(${offCorr})`
          const isAttackSkill = baseOrder !== 4
          const isDefense = baseOrder === 4
          const skillLabel = isDefense
            ? (v && v.total > 1
              ? `${SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type}-${v.idx}`
              : SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type)
            : (v && v.total > 1 ? `S${baseOrder}-${v.idx}` : `S${baseOrder}`)
          const frameSin = SIN_FRAME_MAP[skill.sin_affinity] || 'crimson'
          const atkTypeKey = skillAttackType(skill)
          const skillDescription = localSkillDesc(skill)
          const skillFlavor = localSkillFlavor(skill, locale)

          // 파괴 불가 코인 감지
          const unbreakableCoins = new Set<number>()
          if (skill.description) {
            const ubMatches = skill.description.matchAll(/\[코인\s?(\d+)\]\s*파괴 불가 코인/g)
            for (const m of ubMatches) unbreakableCoins.add(parseInt(m[1]))
          }

          return (
            <div
              key={skill.id}
              className="p-4 rounded"
              style={{ background: `${skillSinColor}08`, border: `1px solid ${skillSinColor}30` }}
            >
              {/* 스킬 프레임 + 정보 영역 */}
              <div className="flex items-start gap-1 mb-2">
                {/* 프레임 + 오버레이 */}
                <div className="relative shrink-0 ml-1 sm:ml-4 w-[5rem] h-[5rem] sm:w-[6.5rem] sm:h-[6.5rem]">
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
                    skillIconUrl={skillIconUrl}
                    skillIconFallback={skillIconFallback}
                    sin={skill.sin_affinity || 'neutral'}
                    skillSlot={baseOrder <= 3 ? baseOrder : 1}
                    sinColor={skillSinColor}
                    label={skillLabel}
                    size="100%"
                  />
                  {/* 공격 타입 (하단 중앙) */}
                  {atkTypeKey && (
                    <div className="absolute z-20 pointer-events-none"
                      style={{ bottom: 0, left: '50%', marginLeft: '-0.875rem', transform: 'translateY(-30%)', width: '1.75rem', height: '1.75rem' }}>
                      <Image src={`${STORAGE_BASE}/icons/skill-frames/extras/${frameSin}_icon_bg.webp`}
                        alt="" width={20} height={20} className="absolute inset-0" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      <Image src={`${STORAGE_BASE}/icons/skill-frames/extras/${frameSin}_icon_overlay.webp`}
                        alt="" width={20} height={20} className="absolute inset-0" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      <Image src={`${STORAGE_BASE}/icons/stats/${atkTypeKey}.webp`}
                        alt="" width={16} height={16} className="absolute inset-0 m-auto z-10" style={{ width: '0.875rem', height: '0.875rem' }} />
                    </div>
                  )}
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
                      const isUb = unbreakableCoins.has(ci + 1)
                      return (
                        <Image key={ci}
                          src={`${STORAGE_BASE}/icons/stats/${isUb ? 'unbreakable_coin' : 'coin'}.webp`}
                          alt={isUb ? t('identity.skills.unbreakableCoin') : t('identity.skills.coin')} width={16} height={16}
                          className="w-3 h-3 sm:w-4 sm:h-4"
                        />
                      )
                    })}
                  </div>
                  {/* 스킬명 배너 (사선 꼬리, pretext 기반 동적 너비) */}
                  <SkillNameBanner name={localSkillName(skill)} sinColor={skillSinColor} />
                  {/* 공격 레벨 + 가중치 */}
                  <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
                    {skill.offense_level != null && (
                      <div className="flex items-center gap-1">
                        <Image src={`${STORAGE_BASE}/icons/ui/${isDefense ? 'icon-defense' : 'icon-sword'}.webp`} alt="" width={22} height={22} className="w-4 h-4 sm:w-[1.375rem] sm:h-[1.375rem]" />
                        <span style={{ fontFamily: "var(--font-excelsior), sans-serif", color: '#e8dcc8', fontSize: 'clamp(1rem, 3vw, 1.375rem)', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: '#e8dcc8' }}>
                          {skill.offense_level}
                          {diff?.offense_level && <DiffBadge from={diff.offense_level.from} to={diff.offense_level.to} />}
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
              {(skillDescription || skillFlavor) && (
                <SkillDescription
                  description={skillDescription}
                  accentColor={skillSinColor}
                  variant="detail"
                  skillNameColors={skillNameColors}
                  allowedKeywords={allowedKeywords}
                  flavorText={skillFlavor}
                  level4Desc={diff?.hasDescDiff ? (
                    locale === 'en' && diff.level4Desc_en ? diff.level4Desc_en
                    : locale === 'ja' && diff.level4Desc_jp ? diff.level4Desc_jp
                    : diff.level4Desc
                  ) : undefined}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* 4동기화 전용 스킬 (dimmed + lock) */}
      {newSkills && newSkills.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {newSkills.map(skill => {
            const skillSinColor = SIN_COLORS[skill.sin_affinity] || '#888'
            const skillDescription = localSkillDesc(skill)
            const skillFlavor = localSkillFlavor(skill, locale)
            return (
              <div
                key={skill.id}
                className="relative card p-3"
                style={{ opacity: 0.35, pointerEvents: 'none' }}
              >
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1" style={{ opacity: 1 }}>
                  <Image
                    src={`${STORAGE_BASE}/icons/ui/lock.webp`}
                    alt=""
                    width={118}
                    height={157}
                    style={{ width: '0.75rem', height: 'auto', filter: 'brightness(0.7)' }}
                  />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold" style={{ color: skillSinColor }}>{localSkillName(skill)}</span>
                  <span className="text-xs" style={{ color: '#555' }}>{SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type}</span>
                </div>
                {(skillDescription || skillFlavor) && (
                  <SkillDescription
                    description={skillDescription}
                    accentColor={skillSinColor}
                    variant="detail"
                    skillNameColors={skillNameColors}
                    allowedKeywords={allowedKeywords}
                    flavorText={skillFlavor}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
