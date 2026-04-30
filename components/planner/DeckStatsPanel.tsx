'use client'

import Image from 'next/image'
import { STORAGE_BASE } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN, SIN_ORDER, getSinIconUrl } from '@/lib/constants/sin'
import PlannerPassivePanel from '@/components/planner/PlannerPassivePanel'

const S = STORAGE_BASE

// ── Types ───────────────────────────────────────────────────────────────────

interface IdentitySlotLike {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
}

interface SkillLike {
  identity_id: string
  sin_affinity: string
  skill_type: string
  skill_order: number
}

interface PassiveLike {
  identity_id: string
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
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

export default function DeckStatsPanel({ identitySlots, skills, passives, sinners, egoCosts, egoSinAffinities }: DeckStatsPanelProps) {
  if (identitySlots.length === 0) return null

  const slotIds = new Set(identitySlots.map(s => s.identity_id).filter(Boolean))

  // ── 공격 유형 집계 ──
  const atkCount: Record<string, number> = { slash: 0, pierce: 0, blunt: 0 }
  const defCount: Record<string, number> = { evade: 0, defense: 0, counter: 0 }
  for (const sk of skills) {
    if (!slotIds.has(sk.identity_id)) continue
    if (sk.skill_order <= 3 && sk.skill_type in atkCount) atkCount[sk.skill_type]++
    if (sk.skill_order === 4 && sk.skill_type in defCount) defCount[sk.skill_type]++
  }
  const atkTotal = Object.values(atkCount).reduce((a, b) => a + b, 0) || 1

  const ATK_LABELS: Record<string, string> = { slash: '참격', pierce: '관통', blunt: '타격' }
  const ATK_CLR: Record<string, string> = { slash: '#cc4444', pierce: '#dd8833', blunt: '#cc8822' }
  const DEF_LABELS: Record<string, string> = { evade: '회피', defense: '수비', counter: '반격' }

  // ── 죄악 자원 집계 (모든 스킬 + EGO 스킬 죄악) ──
  const deckSinCounts: Record<string, number> = {}
  for (const sk of skills) {
    if (!slotIds.has(sk.identity_id)) continue
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
    <div className="flex flex-col md:flex-row gap-4 mt-4">
      {/* 공격 유형 + 죄악 자원 */}
      <div style={{ flex: '0 0 auto', width: '14rem', background: '#120e09', border: '1px solid #221a0f', borderRadius: '0.375rem', padding: '0.75rem' }}>
        <p style={{ color: '#c8900a', fontSize: '0.75rem', fontFamily: 'var(--font-serif)', marginBottom: '0.5rem' }}>공격 유형 분포</p>
        <div className="flex flex-col gap-1.5">
          {Object.entries(atkCount).map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <Image src={`${S}/icons/stats/${type}.webp`} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.8 }} />
              <span style={{ color: ATK_CLR[type], fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', width: '2rem' }}>{ATK_LABELS[type]}</span>
              <div style={{ flex: 1, height: '0.375rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.1875rem', overflow: 'hidden' }}>
                <div style={{ width: `${(count / atkTotal) * 100}%`, height: '100%', background: ATK_CLR[type], borderRadius: '0.1875rem' }} />
              </div>
              <span style={{ color: ATK_CLR[type], fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, width: '1.5rem', textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {Object.entries(defCount).filter(([, c]) => c > 0).map(([type, count]) => (
            <span key={type} style={{ color: '#888', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
              {DEF_LABELS[type]} <strong style={{ color: '#aaa' }}>{count}</strong>
            </span>
          ))}
        </div>

        {/* 죄악 자원 */}
        <p style={{ color: '#c8900a', fontSize: '0.75rem', fontFamily: 'var(--font-serif)', marginTop: '0.75rem', marginBottom: '0.375rem' }}>
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
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: sufficient ? '#40a060' : '#cc4444' }}>
                    {have}<span style={{ color: '#555', fontWeight: 400 }}>/</span>{need}
                  </span>
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: sc }}>{have}</span>
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
      />
    </div>
  )
}
