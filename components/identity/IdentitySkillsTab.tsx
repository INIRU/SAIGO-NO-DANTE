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
import SkillIcon from '@/components/identity/SkillIcon'

interface IdentitySkillsTabProps {
  identity: Identity
  filteredSkills: Skill[]
  skillNameColors: Record<string, string>
  skillImgIdxMap: Record<string, number>
  variantMap: Record<string, { baseOrder: number; idx: number; total: number }>
}

export default function IdentitySkillsTab({
  identity,
  filteredSkills,
  skillNameColors,
  skillImgIdxMap,
  variantMap,
}: IdentitySkillsTabProps) {

  if (filteredSkills.length === 0) {
    return (
      <div
        className="card p-8 text-center"
        style={{ color: '#999', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}
      >
        <p className="font-serif text-lg italic">
          스킬 정보는 준비 중입니다.
        </p>
      </div>
    )
  }

  return (
    <div className="card p-6" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
      <h2
        className="font-serif font-bold mb-4"
        style={{ color: 'var(--gold)', fontSize: '1rem' }}
      >
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

          // 파괴 불가 코인 감지
          const unbreakableCoins = new Set<number>()
          if (skill.description) {
            const ubMatches = skill.description.matchAll(/\[코인\s?(\d+)\]\s*파괴 불가 코인/g)
            for (const m of ubMatches) unbreakableCoins.add(parseInt(m[1]))
          }

          // 변형 스킬 라벨
          const isDefense = baseOrder === 4
          const skillLabel = isDefense
            ? (v && v.total > 1
              ? `${SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type}-${v.idx}`
              : SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type)
            : (v && v.total > 1 ? `S${baseOrder}-${v.idx}` : `S${baseOrder}`)

          return (
            <div
              key={skill.id}
              className="p-4 rounded"
              style={{
                background: `${skillSinColor}08`,
                border: `1px solid ${skillSinColor}30`,
              }}
            >
              <div className="flex flex-col gap-1.5 mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* 스킬 아이콘 */}
                    <SkillIcon
                      url={skillIconUrl}
                      fallbackUrl={skillIconFallback}
                      sinColor={skillSinColor}
                      label={skillLabel}
                    />
                    <span
                      className="font-mono text-xs px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: `${skillSinColor}20`,
                        color: skillSinColor,
                        border: `1px solid ${skillSinColor}40`,
                      }}
                    >
                      {skillLabel}
                    </span>
                    <span className="font-semibold truncate" style={{ color: skillSinColor, fontSize: '0.8125rem' }}>
                      {skill.name}
                    </span>
                  </div>
                  {/* 스킬 타입 (우측) */}
                  {isAttackSkill && skill.skill_type && (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {['slash', 'pierce', 'blunt'].includes(skill.skill_type) && (
                        <Image
                          src={`${STORAGE_BASE}/icons/stats/${skill.skill_type}.webp`}
                          alt=""
                          width={14}
                          height={14}
                          style={{ width: '0.875rem', height: '0.875rem' }}
                        />
                      )}
                      <span style={{ color: '#999', fontSize: '0.8125rem' }}>
                        {SKILL_TYPE_LABELS[skill.skill_type] || skill.skill_type}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 pl-0.5">
                  {/* 가중치 */}
                  {isAttackSkill && (
                    <div className="flex items-center gap-1">
                      <span style={{ color: '#999', fontSize: '0.75rem' }}>가중치</span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: skill.atk_weight || 1 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{
                              background: `${skillSinColor}50`,
                              border: `1.5px solid ${skillSinColor}`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 공격/방어 레벨 */}
                  {skill.offense_level != null && (
                    <div className="flex items-center gap-1">
                      <span style={{ color: '#999', fontSize: '0.75rem' }}>
                        {isAttackSkill ? '공격 레벨' : '방어 레벨'}
                      </span>
                      <span className="font-mono text-xs font-bold" style={{ color: '#aaa' }}>
                        {skill.offense_level}{offCorrStr}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 코인 정보 */}
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-1">
                  <span style={{ color: '#aaa', fontSize: '0.8125rem' }}>위력</span>
                  <span className="font-mono font-bold" style={{ color: skillSinColor, fontSize: '0.8125rem' }}>
                    {skill.base_power}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span style={{ color: '#aaa', fontSize: '0.8125rem' }}>코인</span>
                  <span className="font-mono font-bold" style={{ color: 'var(--gold)', fontSize: '0.8125rem' }}>
                    {skill.coins}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span style={{ color: '#aaa', fontSize: '0.8125rem' }}>코인 위력</span>
                  <span className="font-mono font-bold" style={{ color: skillSinColor, fontSize: '0.8125rem' }}>
                    +{skill.coin_power}
                  </span>
                </div>
                {/* 최종 위력 */}
                <div className="flex items-center gap-1 ml-auto">
                  <span style={{ color: '#aaa', fontSize: '0.8125rem' }}>최대</span>
                  <span className="font-mono font-bold" style={{ color: '#e8dcc8', fontSize: '0.8125rem' }}>
                    {skill.base_power + skill.coins * skill.coin_power}
                  </span>
                </div>
              </div>

              {/* 코인 시각화 */}
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: skill.coins }).map((_, i) => {
                  const isUnbreakable = unbreakableCoins.has(i + 1)
                  return (
                    <Image
                      key={i}
                      src={`${STORAGE_BASE}/icons/stats/${isUnbreakable ? 'unbreakable_coin' : 'coin'}.webp`}
                      alt={isUnbreakable ? '파괴 불가 코인' : '코인'}
                      width={14}
                      height={14}
                      style={{ width: 14, height: 14, filter: `drop-shadow(0 0 2px ${skillSinColor}60)` }}
                    />
                  )
                })}
              </div>

              {skill.description && (
                <SkillDescription
                  description={skill.description}
                  accentColor={skillSinColor}
                  variant="detail"
                  skillNameColors={skillNameColors}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
