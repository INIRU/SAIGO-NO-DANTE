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

const SIN_FRAME_MAP: Record<string, string> = {
  wrath: 'crimson', lust: 'scarlet', sloth: 'amber', gluttony: 'shamrock',
  gloom: 'azure', pride: 'indigo', envy: 'violet',
}

interface IdentitySkillsTabProps {
  identity: Identity
  filteredSkills: Skill[]
  skillNameColors: Record<string, string>
  skillImgIdxMap: Record<string, number>
  variantMap: Record<string, { baseOrder: number; idx: number; total: number }>
  allowedKeywords?: Set<string>
}

export default function IdentitySkillsTab({
  identity,
  filteredSkills,
  skillNameColors,
  skillImgIdxMap,
  variantMap,
  allowedKeywords,
}: IdentitySkillsTabProps) {

  if (filteredSkills.length === 0) {
    return (
      <div
        className="card p-8 text-center"
        style={{ color: '#999', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
      >
        <p className="font-serif text-lg">스킬 정보는 준비 중입니다.</p>
      </div>
    )
  }

  return (
    <div className="card p-6" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
      <h2 className="font-serif font-light mb-4" style={{ color: 'var(--gold)', fontSize: '1rem' }}>
        스킬
      </h2>

      <div className="space-y-4">
        {filteredSkills.map(skill => {
          const skillSinColor = SIN_COLORS[skill.sin_affinity] || '#cccccc'
          const imgIdx = skillImgIdxMap[skill.id] ?? skill.skill_order
          const skillIconUrl = getSkillIconUrl(identity, imgIdx)
          const v = variantMap[skill.id]
          const baseOrder = v?.baseOrder ?? (skill.skill_order >= 5 ? 3 : skill.skill_order)
          const skillIconFallback = imgIdx >= 5 ? getSkillIconUrl(identity, baseOrder) : undefined
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
                <div className="relative shrink-0 ml-4" style={{ width: '6.5rem', height: '6.5rem' }}>
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
                    size="6.5rem"
                  />
                  {/* 공격 타입 (하단 중앙) */}
                  {isAttackSkill && skill.skill_type && ['slash', 'pierce', 'blunt'].includes(skill.skill_type) && (
                    <div className="absolute z-20 pointer-events-none"
                      style={{ bottom: 0, left: '50%', marginLeft: '-0.875rem', transform: 'translateY(-30%)', width: '1.75rem', height: '1.75rem' }}>
                      <Image src={`${STORAGE_BASE}/icons/skill-frames/extras/${frameSin}_icon_bg.webp`}
                        alt="" width={20} height={20} className="absolute inset-0" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      <Image src={`${STORAGE_BASE}/icons/skill-frames/extras/${frameSin}_icon_overlay.webp`}
                        alt="" width={20} height={20} className="absolute inset-0" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      <Image src={`${STORAGE_BASE}/icons/stats/${skill.skill_type}.webp`}
                        alt="" width={16} height={16} className="absolute inset-0 m-auto z-10" style={{ width: '0.875rem', height: '0.875rem' }} />
                    </div>
                  )}
                  {/* 기본 위력 (좌측) */}
                  <div className="absolute z-20" style={{ left: 0, top: '50%', transform: 'translateX(-40%) translateY(-75%)' }}>
                    <span style={{ fontFamily: "'ExcelsiorSans', sans-serif", fontSize: '2.125rem', lineHeight: 1, color: 'oklch(81.35% .0894 69.33)' }}>
                      {skill.base_power}
                    </span>
                  </div>
                  {/* 코인 위력 (상단) */}
                  <div className="absolute z-20" style={{ top: 0, left: '50%', transform: 'translateX(-56%) translateY(-12.5%)' }}>
                    {skill.coin_power >= 0 ? (
                      <span style={{
                        fontFamily: "'ExcelsiorSans', sans-serif", fontSize: '1.125rem', fontWeight: 700, lineHeight: 1,
                        color: 'oklch(81.35% .0894 69.33)',
                        textShadow: '1px 1px 1px black',
                        WebkitTextStroke: '0.01px black',
                      }}>
                        +{skill.coin_power}
                      </span>
                    ) : (
                      <span style={{
                        fontFamily: "'ExcelsiorSans', sans-serif", fontSize: '1.125rem', fontWeight: 700, lineHeight: 1,
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
                          alt={isUb ? '파괴 불가 코인' : '코인'} width={16} height={16}
                          style={{ width: '1rem', height: '1rem' }}
                        />
                      )
                    })}
                  </div>
                  {/* 스킬명 배너 (사선 꼬리, fit-content) */}
                  <div className="overflow-hidden mb-1" style={{ width: 'fit-content', maxWidth: '100%' }}>
                    <div style={{
                      color: '#e8dcc8',
                      backgroundImage: `linear-gradient(255deg, transparent 1.5em, ${skillSinColor}30 1.5em)`,
                    }}>
                      <div style={{
                        padding: '0.1em 0 0.1em 0.3em',
                        backgroundImage: `linear-gradient(290deg, transparent 2.5em, ${skillSinColor}40 2.5em, ${skillSinColor}40 2.65em, transparent 2.65em, transparent 2.8em, ${skillSinColor}40 2.8em, ${skillSinColor}40 2.95em, transparent 2.95em, transparent 3.1em, ${skillSinColor}40 3.1em, ${skillSinColor}40 3.25em, transparent 3.25em, transparent 3.4em, ${skillSinColor}40 3.4em)`,
                        textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
                      }}>
                        <span className="font-bold whitespace-nowrap" style={{
                          fontSize: '0.875rem', fontFamily: 'var(--font-heading)', fontWeight: 800,
                          paddingRight: '4.5em',
                        }}>
                          {skill.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* 공격 레벨 + 가중치 */}
                  <div className="flex items-center gap-3">
                    {skill.offense_level != null && (
                      <div className="flex items-center gap-1">
                        <Image src={`${STORAGE_BASE}/icons/ui/${isDefense ? 'icon-defense' : 'icon-sword'}.webp`} alt="" width={22} height={22} style={{ width: '1.375rem', height: '1.375rem' }} />
                        <span style={{ fontFamily: "'ExcelsiorSans', sans-serif", color: '#e8dcc8', fontSize: '1.375rem', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: '#e8dcc8' }}>
                          {skill.offense_level}
                        </span>
                        {offCorrStr && <span style={{ fontFamily: "'ExcelsiorSans', sans-serif", color: '#888', fontSize: '1rem' }}>{offCorrStr}</span>}
                      </div>
                    )}
                    {isAttackSkill && (
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontFamily: 'var(--font-heading)', color: '#c8900a', fontSize: '0.8125rem', fontWeight: 700 }}>공격 가중치</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: skill.atk_weight || 1 }).map((_, i) => (
                            <div key={i} style={{ width: '0.75rem', height: '0.75rem', background: '#c8900a', borderRadius: '0.15rem' }} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 스킬 설명 */}
              {skill.description && (
                <SkillDescription
                  description={skill.description}
                  accentColor={skillSinColor}
                  variant="detail"
                  skillNameColors={skillNameColors}
                  allowedKeywords={allowedKeywords}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
