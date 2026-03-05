'use client'

import Image from 'next/image'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  getSinnerLogoUrl,
  getSinnerProfileUrl,
  getSkillIconUrl,
  STORAGE_BASE,
  SIN_COLORS,
  SinType,
  GRADE_COLORS,
} from '@/lib/data/sinners'
import IdentityCard from '@/components/sinners/IdentityCard'

/* ── 수감자 빈 카드 (공통) ────────────────────────────── */
function SinnerGhostCard({ sinner, children }: { sinner: Sinner; children?: React.ReactNode }) {
  const profileUrl = getSinnerProfileUrl(sinner.id)
  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: '2/3',
        background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
        border: '1.5px dashed #2a2015',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      {profileUrl && (
        <Image src={profileUrl} alt={sinner.name} fill className="object-cover object-top" style={{ opacity: 0.18 }} />
      )}
      <div className="absolute" style={{ top: 0, right: 0, width: '36%', opacity: 0.2, pointerEvents: 'none' }}>
        <Image src={`${STORAGE_BASE}/sinners/${sinner.id}/number.webp`} alt="" width={389} height={1023} className="w-full h-auto" />
      </div>
      {children}
      <div className="absolute bottom-0 left-0 right-0 text-center pb-1.5 z-10" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)', paddingTop: '20px' }}>
        <p className="font-serif font-bold" style={{ color: '#3a2a10', fontSize: '0.625rem' }}>{sinner.name_kr}</p>
      </div>
    </div>
  )
}

const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
const SKILL_PRESETS: [number, number, number][] = [[3, 2, 1], [1, 0, 5], [0, 0, 6]]

/* ── 탭 1: 인격 편성 ─────────────────────────────────── */
export function IdentityTab({
  sinners, deckSlots, onCardClick, gacksungSlots, onGacksungToggle,
}: {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  onCardClick: (sinnerId: string) => void
  gacksungSlots: Record<string, boolean>
  onGacksungToggle: (sinnerId: string) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-8">
      {sinners.map(sinner => {
        const identity = deckSlots[sinner.id]
        const isGacksung = gacksungSlots[sinner.id] ?? false
        return (
          <div key={sinner.id} className="relative cursor-pointer" style={{ overflow: 'visible' }} onClick={() => onCardClick(sinner.id)}>
            {identity ? (
              <>
                <IdentityCard identity={identity} compact gacksung={isGacksung} />
                <button
                  onClick={e => { e.stopPropagation(); onGacksungToggle(sinner.id) }}
                  title={isGacksung ? '각성 일러스트 — 클릭하여 일반으로' : '일반 일러스트 — 클릭하여 각성으로'}
                  style={{
                    position: 'absolute', top: '-7px', right: '-7px', zIndex: 20,
                    width: 22, height: 22, borderRadius: '50%',
                    background: isGacksung ? 'rgba(200,144,10,0.92)' : 'rgba(18,14,9,0.92)',
                    border: `1.5px solid ${isGacksung ? '#c8900a' : '#2a2015'}`,
                    color: isGacksung ? '#0d0b08' : '#5a4830',
                    fontSize: '0.8125rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isGacksung ? '0 0 8px rgba(200,144,10,0.5)' : 'none',
                    transition: 'all 0.2s',
                    lineHeight: 1,
                  }}
                >
                  ↺
                </button>
              </>
            ) : (
              <SinnerGhostCard sinner={sinner}>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} style={{ opacity: 0.35 }} />
                </div>
              </SinnerGhostCard>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── 탭 2: 에고 편성 ─────────────────────────────────── */
export function EgoTab({
  sinners, egoSlots, onGradeClick,
}: {
  sinners: Sinner[]
  egoSlots: Record<string, Record<string, EGO>>
  onGradeClick: (sinnerId: string, grade: string) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4">
      {sinners.map(sinner => {
        const sinnerEgos = egoSlots[sinner.id] ?? {}
        return (
          <div key={sinner.id} style={{
            background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
            border: '1px solid #221a0f',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            {/* 수감자 헤더 */}
            <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: '1px solid #1a1208' }}>
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} style={{ opacity: 0.5 }} />
              <span className="font-serif font-bold truncate" style={{ color: '#4a3520', fontSize: '0.5625rem' }}>{sinner.name_kr}</span>
            </div>
            {/* 등급 세로 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '2px' }}>
              {GRADE_ORDER.map(grade => {
                const ego = sinnerEgos[grade]
                const gc = GRADE_COLORS[grade]
                const sc = ego?.sin_affinity ? (SIN_COLORS[ego.sin_affinity as SinType] ?? gc) : gc
                return (
                  <button
                    key={grade}
                    onClick={() => onGradeClick(sinner.id, grade)}
                    style={{
                      background: ego ? `${sc}1a` : 'rgba(10,8,5,0.7)',
                      border: `1px solid ${ego ? sc + '55' : '#18120a'}`,
                      borderRadius: '2px',
                      padding: '4px 5px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s',
                      minHeight: '24px',
                    }}
                  >
                    {/* 등급 아이콘 */}
                    {grade !== 'ALEPH' ? (
                      <Image
                        src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                        alt={grade}
                        width={22}
                        height={11}
                        unoptimized
                        style={{ height: '11px', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}
                      />
                    ) : (
                      <span style={{ color: ego ? sc : gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                    )}
                    {ego
                      ? <span style={{ color: sc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, wordBreak: 'keep-all', flex: 1, textAlign: 'left' }}>{ego.name_kr || ego.name}</span>
                      : <span style={{ color: '#2a1e10', fontSize: '0.75rem', lineHeight: 1 }}>+</span>
                    }
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 탭 3: 편성 순서 ─────────────────────────────────── */
export function OrderTab({
  sinners, deckSlots, formationOrder, onToggle,
}: {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  formationOrder: string[]
  onToggle: (sinnerId: string) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-8">
      {sinners.map(sinner => {
        const idx = formationOrder.indexOf(sinner.id)
        const position = idx === -1 ? 0 : idx + 1
        const isAssigned = position > 0
        const isBattle = position <= 7
        const color = isBattle ? '#c83020' : '#3870b0'
        const identity = deckSlots[sinner.id]

        return (
          <div
            key={sinner.id}
            onClick={() => onToggle(sinner.id)}
            className="relative cursor-pointer"
            style={{ overflow: 'visible' }}
          >
            {identity ? (
              <IdentityCard identity={identity} compact />
            ) : (
              <SinnerGhostCard sinner={sinner}>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} style={{ opacity: 0.35 }} />
                </div>
              </SinnerGhostCard>
            )}

            <div
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                zIndex: 20,
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: isAssigned ? color : 'rgba(20,16,10,0.9)',
                border: isAssigned ? `2px solid ${color}` : '1.5px dashed rgba(200,144,10,0.3)',
                boxShadow: isAssigned ? `0 0 10px ${color}88` : 'none',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            >
              {isAssigned ? (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.375rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>
                    {isBattle ? 'B' : 'S'}
                  </span>
                  <span style={{ color: '#fff', fontSize: '0.8125rem', fontFamily: 'var(--font-title)', fontWeight: 700, lineHeight: 1 }}>
                    {position}
                  </span>
                </>
              ) : (
                <span style={{ color: 'rgba(200,144,10,0.4)', fontSize: '1rem', lineHeight: 1 }}>+</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 탭 4: 스킬 배분 ─────────────────────────────────── */
export function SkillsetTab({
  sinners, deckSlots, skillsByIdentityId, skillDistribution, onDistributionChange,
}: {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  skillsByIdentityId: Record<string, Skill[]>
  skillDistribution: Record<string, [number, number, number]>
  onDistributionChange: (sinnerId: string, dist: [number, number, number]) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-8">
      {sinners.map(sinner => {
        const identity = deckSlots[sinner.id]
        if (!identity) {
          return (
            <div key={sinner.id}>
              <SinnerGhostCard sinner={sinner}>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} style={{ opacity: 0.35 }} />
                </div>
              </SinnerGhostCard>
            </div>
          )
        }

        const dist = skillDistribution[sinner.id] ?? [3, 2, 1]
        const total = dist[0] + dist[1] + dist[2]
        const isDefault = dist[0] === 3 && dist[1] === 2 && dist[2] === 1
        const skills = (skillsByIdentityId[identity.id] ?? [])
          .filter(s => s.skill_order >= 1 && s.skill_order <= 3)
          .sort((a, b) => a.skill_order - b.skill_order)
          .filter((s, i, arr) => arr.findIndex(x => x.skill_order === s.skill_order) === i)

        const handleChange = (idx: number, delta: number) => {
          const next: [number, number, number] = [dist[0], dist[1], dist[2]]
          const newVal = next[idx] + delta
          if (newVal < 0 || total + delta > 6) return
          next[idx] = newVal
          onDistributionChange(sinner.id, next)
        }

        return (
          <div key={sinner.id}>
            <IdentityCard identity={identity} compact />
            <div style={{
              marginTop: '6px',
              background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
              border: `1px solid ${isDefault ? '#221a0f' : 'rgba(200,144,10,0.4)'}`,
              borderRadius: '4px',
              padding: '6px',
            }}>
              {[0, 1, 2].map(idx => {
                const skill = skills[idx]
                const sinColor = skill ? (SIN_COLORS[skill.sin_affinity] ?? '#888') : '#555'
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0' }}>
                    {skill && identity.game_id ? (
                      <Image
                        src={getSkillIconUrl(identity, skill.skill_order)}
                        alt={skill.name}
                        width={16}
                        height={16}
                        style={{ borderRadius: '2px', flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: '16px', height: '16px', borderRadius: '2px', background: '#1a1510', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '0.5625rem', color: sinColor, fontFamily: 'var(--font-mono)', fontWeight: 700, width: '18px', flexShrink: 0 }}>
                      S{idx + 1}
                    </span>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => handleChange(idx, -1)}
                      disabled={dist[idx] <= 0}
                      style={{
                        width: '18px', height: '18px', borderRadius: '2px',
                        background: dist[idx] <= 0 ? 'rgba(10,8,5,0.5)' : 'rgba(200,144,10,0.1)',
                        border: `1px solid ${dist[idx] <= 0 ? '#18120a' : 'rgba(200,144,10,0.3)'}`,
                        color: dist[idx] <= 0 ? '#2a2015' : '#c8900a',
                        fontSize: '0.75rem', cursor: dist[idx] <= 0 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, padding: 0,
                      }}
                    >
                      −
                    </button>
                    <span style={{
                      width: '16px', textAlign: 'center', fontSize: '0.8125rem',
                      fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: dist[idx] === 0 ? '#3a2a10' : sinColor,
                    }}>
                      {dist[idx]}
                    </span>
                    <button
                      onClick={() => handleChange(idx, 1)}
                      disabled={total >= 6}
                      style={{
                        width: '18px', height: '18px', borderRadius: '2px',
                        background: total >= 6 ? 'rgba(10,8,5,0.5)' : 'rgba(200,144,10,0.1)',
                        border: `1px solid ${total >= 6 ? '#18120a' : 'rgba(200,144,10,0.3)'}`,
                        color: total >= 6 ? '#2a2015' : '#c8900a',
                        fontSize: '0.75rem', cursor: total >= 6 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1, padding: 0,
                      }}
                    >
                      +
                    </button>
                  </div>
                )
              })}
              {/* 합계 + 프리셋 */}
              <div style={{
                borderTop: '1px solid #1a1208', marginTop: '4px', paddingTop: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: total === 6 ? '#5a8a40' : '#c83020',
                }}>
                  {total}/6
                </span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {SKILL_PRESETS.map(preset => {
                    const active = dist[0] === preset[0] && dist[1] === preset[1] && dist[2] === preset[2]
                    return (
                      <button
                        key={preset.join(',')}
                        onClick={() => onDistributionChange(sinner.id, preset)}
                        style={{
                          fontSize: '0.5rem', fontFamily: 'var(--font-mono)',
                          padding: '1px 4px', borderRadius: '2px',
                          background: active ? 'rgba(200,144,10,0.2)' : 'transparent',
                          border: `1px solid ${active ? 'rgba(200,144,10,0.5)' : '#18120a'}`,
                          color: active ? '#c8900a' : '#444',
                          cursor: 'pointer', lineHeight: 1.4,
                        }}
                      >
                        {preset.join('/')}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
