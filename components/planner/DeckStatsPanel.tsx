'use client'

import { memo } from 'react'
import Image from 'next/image'
import { STORAGE_BASE } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN, SIN_ORDER, getSinIconUrl } from '@/lib/constants/sin'
import { computeAttackTypeCounts } from '@/lib/decks/deck-analysis'
import PlannerPassivePanel from '@/components/passive/PassivePanel'

const S = STORAGE_BASE

// ── Types ───────────────────────────────────────────────────────────────────

interface IdentitySlotLike {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
  keywords?: readonly string[] | null
}

interface SkillLike {
  identity_id: string
  sin_affinity: string
  skill_type: string
  skill_order: number
  atk_type?: string | null
  uptie_level?: number | null
  variant_order?: number | null
}

interface PassiveLike {
  identity_id: string
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  sin_requirements?: { sin: string; count: number }[] | null
  active_cond: string | null
  description: string | null
}

interface SinnerLike {
  id: string
  name_kr: string
}

interface EgoCostEntry {
  cost: number[] | null  // SIN_ORDER 순서 (wrath, lust, sloth, gluttony, gloom, pride, envy)
}

export interface DeckStatsPanelProps {
  identitySlots: IdentitySlotLike[]
  skills: SkillLike[]
  passives: PassiveLike[]
  sinners: SinnerLike[]
  egoCosts?: EgoCostEntry[]  // 선택된 EGO들의 코스트 배열
  egoSinAffinities?: string[]  // 선택된 EGO들의 죄악 속성 (sin resource 생성에 포함)
}

// ── Component ───────────────────────────────────────────────────────────────

function DeckStatsPanel({
  identitySlots,
  skills,
  passives,
  sinners,
  egoCosts,
  egoSinAffinities,
}: DeckStatsPanelProps) {
  if (identitySlots.length === 0) return null

  const slotIds = new Set(identitySlots.map(s => s.identity_id).filter(Boolean))
  const selectedSkills = skills.filter(sk => slotIds.has(sk.identity_id))

  // ── 공격 유형 집계: 덱 분석과 같은 기준(스킬마다 한 번, 동기화 1~4단계 행을 따로 세지 않음) ──
  const { attack: atkCount, defense: defCount } = computeAttackTypeCounts(identitySlots.map(slot => selectedSkills.filter(skill => skill.identity_id === slot.identity_id)))
  const atkTotal = Object.values(atkCount).reduce((a, b) => a + b, 0) || 1

  const ATK_LABELS: Record<string, string> = { slash: '참격', pierce: '관통', blunt: '타격' }
  const ATK_CLR: Record<string, string> = { slash: '#cc4444', pierce: '#dd8833', blunt: '#cc8822' }
  const DEF_LABELS: Record<string, string> = { evade: '회피', defense: '수비', counter: '반격' }

  // ── 죄악 자원 집계 (모든 스킬 + EGO 스킬 죄악) ──
  const deckSinCounts: Record<string, number> = {}
  for (const sk of selectedSkills) {
    const en = SIN_KR_TO_EN[sk.sin_affinity] ?? sk.sin_affinity
    if (en) deckSinCounts[en] = (deckSinCounts[en] ?? 0) + 1
  }
  if (egoSinAffinities) {
    for (const sin of egoSinAffinities) {
      const en = SIN_KR_TO_EN[sin] ?? sin
      if (en) deckSinCounts[en] = (deckSinCounts[en] ?? 0) + 1
    }
  }

  // ── EGO 코스트 합산 (= 필요량) ──
  const egoCostTotal: Record<string, number> = {}
  if (egoCosts) {
    for (const ego of egoCosts) {
      if (!ego.cost) continue
      SIN_ORDER.forEach((sin, i) => {
        const c = ego.cost![i] ?? 0
        if (c > 0) egoCostTotal[sin] = (egoCostTotal[sin] ?? 0) + c
      })
    }
  }
  const hasEgoCosts = Object.values(egoCostTotal).some(v => v > 0)

  return (
    <div className="deck-stats-panel flex flex-col gap-3 md:flex-row md:gap-4 mt-4">
      <style>{`
        .deck-stats-summary-card{flex:0 0 auto;width:14rem;background:#120e09;border:1px solid #221a0f;border-radius:0.375rem;padding:0.75rem}
        .deck-stats-section-title{color:#c8900a;font-size:0.875rem;font-family:var(--font-kotra-bold),var(--font-heading),serif;font-weight:400;-webkit-text-stroke:0 transparent}
        .deck-stats-attack-label{font-size:0.875rem}
        .deck-stats-attack-count{font-size:0.875rem}
        .deck-stats-defense-label{font-size:0.875rem}
        .deck-stats-sin-value{font-size:0.875rem}
        .deck-stats-passives{display:flex;min-width:0;flex-direction:column}
        .deck-stats-passives__list{max-height:20rem;overscroll-behavior:contain}
        @media (min-width:48rem){
          .deck-stats-passives{min-height:16rem}
          .deck-stats-passives__list{flex:1 1 0;min-height:0;max-height:none;contain:size}
        }
        @media (max-width:47.9375rem){
          .deck-stats-panel{margin-top:0.75rem}
          .deck-stats-summary-card{width:100%;border-color:rgba(200,144,10,0.12);background:rgba(18,14,9,0.52);padding:0.625rem}
          .deck-stats-summary-card__attacks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.375rem}
          .deck-stats-attack-row{min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:0.375rem}
          .deck-stats-attack-label{width:auto!important;min-width:1.8rem;font-size:0.875rem}
          .deck-stats-attack-count{width:auto!important;font-size:0.875rem}
          .deck-stats-defense-row{margin-top:0.5rem;padding-top:0.5rem}
        }
        @media (max-width:22.5rem){
          .deck-stats-summary-card__attacks{grid-template-columns:1fr}
        }
      `}</style>
      {/* 공격 유형 + 죄악 자원 */}
      <div className="deck-stats-summary-card">
        <p className="deck-stats-section-title" style={{ marginBottom: '0.5rem' }}>공격 유형 분포</p>
        <div className="deck-stats-summary-card__attacks flex flex-col gap-1.5">
          {Object.entries(atkCount).map(([type, count]) => (
            <div key={type} className="deck-stats-attack-row flex items-center gap-2">
              <Image src={`${S}/icons/stats/${type}.webp`} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.8 }} />
              <span className="deck-stats-attack-label" style={{ color: ATK_CLR[type], fontFamily: 'var(--font-mono)', width: '2rem' }}>{ATK_LABELS[type]}</span>
              <div style={{ flex: 1, height: '0.375rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.1875rem', overflow: 'hidden' }}>
                <div style={{ width: `${(count / atkTotal) * 100}%`, height: '100%', background: ATK_CLR[type], borderRadius: '0.1875rem' }} />
              </div>
              <span className="deck-stats-attack-count" style={{ color: ATK_CLR[type], fontFamily: 'var(--font-mono)', fontWeight: 700, width: '1.5rem', textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>
        <div className="deck-stats-defense-row flex items-center gap-3 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {Object.entries(defCount).filter(([, c]) => c > 0).map(([type, count]) => (
            <span key={type} className="deck-stats-defense-label" style={{ color: '#888', fontFamily: 'var(--font-mono)' }}>
              {DEF_LABELS[type]} <strong style={{ color: '#aaa' }}>{count}</strong>
            </span>
          ))}
        </div>

        {/* 죄악 자원 */}
        <p className="deck-stats-section-title" style={{ marginTop: '0.75rem', marginBottom: '0.375rem' }}>
          죄악 자원{hasEgoCosts ? ' (생성 / EGO 코스트)' : ''}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy'] as const).map(sin => {
            const have = deckSinCounts[sin] ?? 0
            const need = egoCostTotal[sin] ?? 0
            if (have === 0 && need === 0) return null
            const sc = SIN_COLORS[sin]
            const sufficient = have >= need
            return (
              <span key={sin} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: `${sc}15`, border: `1px solid ${sc}30` }}>
                <Image src={getSinIconUrl(sin)} alt="" width={12} height={12} style={{ width: '0.75rem', height: '0.75rem' }} />
                {hasEgoCosts && need > 0 ? (
                  <span className="deck-stats-sin-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: sufficient ? '#40a060' : '#cc4444' }}>
                    {have}<span style={{ color: '#555', fontWeight: 400 }}>/</span>{need}
                  </span>
                ) : (
                  <span className="deck-stats-sin-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: sc }}>{have}</span>
                )}
              </span>
            )
          })}
        </div>
      </div>

      {/* 패시브 — 배틀/서포트 탭 */}
      <PlannerPassivePanel
        identitySlots={identitySlots}
        passives={passives}
        sinners={sinners}
        deckSinCounts={deckSinCounts}
        className="deck-stats-passives"
        listClassName="deck-stats-passives__list"
      />
    </div>
  )
}

export default memo(DeckStatsPanel)
