'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { STORAGE_BASE } from '@/lib/constants/game'
import { SIN_COLORS } from '@/lib/constants/sin'
import SkillDescription from '@/components/skill/SkillDescription'
import type { Passive, Skill, Identity, Sinner } from '@/lib/types'

/**
 * 패시브 자동 계산 패널 — 플래너 DeckTab 패시브 섹션과 동일한 UI.
 * 플래너 DeckTab.tsx 1028~1177 라인을 그대로 추출한 공용 컴포넌트.
 */

interface PassivePanelProps {
  deckSlots: Record<string, Identity | undefined>
  sinners: Sinner[]
  passivesByIdentityId: Record<string, Passive[]>
  skillsByIdentityId: Record<string, Skill[]>
  deckSinCounts: Record<string, number>
}

export default function PassivePanel({
  deckSlots,
  sinners,
  passivesByIdentityId,
  skillsByIdentityId,
  deckSinCounts,
}: PassivePanelProps) {
  const [subTab, setSubTab] = useState<'battle' | 'support'>('battle')

  const selectedIdentities = useMemo(
    () => Object.values(deckSlots).filter(Boolean) as Identity[],
    [deckSlots],
  )

  const allPassives = useMemo(() => {
    return selectedIdentities.flatMap(identity => {
      const ps = passivesByIdentityId[identity.id] ?? []
      return ps.map(p => ({ p, identity }))
    })
  }, [selectedIdentities, passivesByIdentityId])

  const battleCount = allPassives.filter(({ p }) => p.passive_type === 'battle').length
  const supportCount = allPassives.filter(({ p }) => p.passive_type === 'support').length
  const filtered = allPassives
    .filter(({ p }) => p.passive_type === subTab)
    .sort((a, b) => {
      const aHas = (a.p.sin_affinity && (a.p.sin_count ?? 0) > 0) ? 0 : 1
      const bHas = (b.p.sin_affinity && (b.p.sin_count ?? 0) > 0) ? 0 : 1
      return aHas - bHas
    })

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* 헤더 + 탭 — 플래너와 동일 */}
      <div className="flex items-center justify-between" style={{ marginBottom: '0.75rem' }}>
        <h3 className="font-serif" style={{ color: '#e8dcc8', fontSize: '1rem' }}>패시브</h3>
        <div className="flex gap-1">
          {(['battle', 'support'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              style={{
                padding: '0.1875rem 0.625rem',
                fontSize: '0.75rem',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                fontWeight: subTab === tab ? 700 : 400,
                background: subTab === tab ? 'rgba(200,144,10,0.15)' : 'transparent',
                border: `1px solid ${subTab === tab ? '#c8900a' : '#333'}`,
                color: subTab === tab ? '#e8b030' : '#666',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'battle' ? '배틀' : '서포트'} ({tab === 'battle' ? battleCount : supportCount})
            </button>
          ))}
        </div>
      </div>

      {/* 패시브 목록 — 플래너 DeckTab 1052~1173 그대로 */}
      <div className="rounded-lg" style={{ background: '#1a1510', border: '1px solid #222', padding: '1rem', maxHeight: '20rem', overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <p style={{ color: '#444', fontSize: '0.75rem' }}>
            {selectedIdentities.length === 0 ? '인격을 선택하면 패시브가 표시됩니다.' : '해당 패시브가 없습니다.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map(({ p, identity }) => {
              const slot = identity
              const sinTypes = p.sin_affinity ? p.sin_affinity.split(',').map(s => s.trim()) : []
              const current = sinTypes.reduce((sum, st) => sum + (deckSinCounts[st] ?? 0), 0)
              const required = p.sin_count ?? 0
              const hasCondition = sinTypes.length > 0 && required > 0
              const isMet = !hasCondition || current >= required
              const isResonance = p.active_cond === 'resonance'
              const primarySin = sinTypes[0] ?? null
              const sinCap = primarySin ? primarySin.charAt(0).toUpperCase() + primarySin.slice(1) : null
              const pc = primarySin ? (SIN_COLORS[primarySin as keyof typeof SIN_COLORS] ?? '#888') : '#888'

              // S1~S3 스킬 죄악 속성
              const identSkills = (skillsByIdentityId[identity.id] ?? [])
                .filter(sk => sk.skill_order <= 3 && sk.skill_order >= 1)
                .sort((a, b) => a.skill_order - b.skill_order)
              const s1 = identSkills.filter(sk => sk.skill_order === 1).sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
              const s2 = identSkills.filter(sk => sk.skill_order === 2).sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
              const s3 = identSkills.filter(sk => sk.skill_order === 3).sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
              const skillDots = [s1, s2, s3].filter(Boolean)

              return (
                <div
                  key={`${identity.id}-${p.id}`}
                  style={{
                    borderBottom: '1px solid #222',
                    paddingBottom: '0.5rem',
                    opacity: hasCondition && !isMet ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {/* 수감자명 + S1/S2/S3 죄악 속성 점 */}
                  <div className="flex items-center gap-1" style={{ marginBottom: '0.125rem' }}>
                    <span style={{ color: '#888', fontSize: '0.6875rem' }}>
                      {slot?.name_kr ?? ''}
                    </span>
                    {skillDots.map((sk, i) => {
                      const dotColor = SIN_COLORS[sk!.sin_affinity as keyof typeof SIN_COLORS] ?? '#555'
                      const sinCapDot = sk!.sin_affinity.charAt(0).toUpperCase() + sk!.sin_affinity.slice(1)
                      return (
                        <Image
                          key={i}
                          src={`${STORAGE_BASE}/icons/Sins/transparent/${sinCapDot}.webp`}
                          alt={sk!.sin_affinity}
                          width={10}
                          height={10}
                          title={`S${sk!.skill_order}: ${sk!.sin_affinity}`}
                          style={{ width: '0.625rem', height: '0.625rem', opacity: 0.7, filter: `drop-shadow(0 0 0.125rem ${dotColor}88)` }}
                        />
                      )
                    })}
                  </div>
                  {/* 패시브명 + 조건 배지 + 죄악 아이콘 + current/required */}
                  <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: '0.25rem' }}>
                    {/* 조건 충족 도트 */}
                    {hasCondition && (
                      <span style={{
                        width: '0.5rem', height: '0.5rem', borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                        background: isMet ? '#5a8a40' : '#c83030',
                        boxShadow: isMet ? '0 0 0.375rem rgba(90,138,64,0.5)' : 'none',
                      }} />
                    )}
                    <span style={{ color: '#e8dcc8', fontSize: '0.8125rem', fontWeight: 700 }}>
                      {p.name}
                    </span>
                    {hasCondition && (
                      <span style={{
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        padding: '0.0625rem 0.375rem',
                        borderRadius: '0.25rem',
                        background: isResonance ? 'rgba(200,144,10,0.15)' : 'rgba(90,176,208,0.15)',
                        border: `1px solid ${isResonance ? 'rgba(200,144,10,0.4)' : 'rgba(90,176,208,0.4)'}`,
                        color: isResonance ? '#c8900a' : '#5ab0d0',
                        flexShrink: 0,
                      }}>
                        {isResonance ? '공명' : '보유'}
                      </span>
                    )}
                    {hasCondition && sinCap && (
                      <div className="flex items-center gap-0.5" style={{ flexShrink: 0 }}>
                        <Image
                          src={`${STORAGE_BASE}/icons/Sins/transparent/${sinCap}.webp`}
                          alt={sinCap}
                          width={16}
                          height={16}
                          style={{ width: '1rem', height: '1rem' }}
                        />
                        <span style={{
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          color: isMet ? '#5a8a40' : '#c83030',
                          fontWeight: 700,
                        }}>
                          {current}/{required}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* 설명 (키워드 툴팁 포함 — 플래너와 동일) */}
                  {p.description && (
                    <SkillDescription description={p.description} accentColor={pc} variant="detail" showCoinBadges={false} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
