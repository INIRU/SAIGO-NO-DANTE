'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import IdentityDetailModal from '@/components/ui/IdentityDetailModal'
import EgoDetailModal from '@/components/ui/EgoDetailModal'
import DeckStatsPanel from '@/components/planner/DeckStatsPanel'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import { STORAGE_BASE, RARITY_COLORS, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'

const S = STORAGE_BASE
const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

type IdentitySlot = {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
  rarity?: number
  keywords?: string[]
  game_id?: string | null
  folder_name?: string | null
  slot_order?: number
}

type EgoSlot = {
  ego_id?: string
  sinner_id?: string
  name_kr?: string
  grade?: string
}

type IdentityData = {
  id: string
  sinner_id: string
  name_kr: string
  rarity: number
  keywords: string[] | null
  game_id: string | null
  folder_name: string | null
}

type SinnerData = {
  id: string
  name_kr: string
  order_num: number
}

type EgoData = {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  grade: string
  sin_affinity: string | null
  image_url: string | null
  cost: number[] | null
}

type SkillSummary = {
  identity_id: string
  name: string
  sin_affinity: string
  skill_type: string
  skill_order: number
  uptie_level: number | null
}

type PassiveSummary = {
  identity_id: string
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  active_cond: string | null
  description: string | null
  uptie_level: number | null
}

interface Props {
  deck: IdentitySlot[]
  egoSlots: EgoSlot[]
  identities: IdentityData[]
  sinners: SinnerData[]
  egos: EgoData[]
  skills: SkillSummary[]
  passives: PassiveSummary[]
  /** Map of formation slot number → gift image URLs (from formation slot effects) */
  slotGiftMap: Map<number, string[]>
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      background: '#1a1510', border: '1px solid #1a1510', borderRadius: '0.5rem',
      padding: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#333',
    }}>{text}</div>
  )
}

export default function PlanDeckTabs({
  deck,
  egoSlots,
  identities,
  sinners,
  egos,
  skills,
  passives,
  slotGiftMap,
}: Props) {
  const [deckSubTab, setDeckSubTab] = useState<'identity' | 'ego' | 'skillset'>('identity')
  const [identityModalId, setIdentityModalId] = useState<string | null>(null)
  const [egoModalId, setEgoModalId] = useState<string | null>(null)

  const identityMap = useMemo(() => new Map(identities.map(i => [i.id, i])), [identities])

  const slotBySinner = useMemo(() => {
    const map: Record<string, IdentitySlot> = {}
    for (const s of deck) {
      if (s.sinner_id) map[s.sinner_id] = s
    }
    return map
  }, [deck])

  const egoByGradeMap = useMemo(() => {
    const map: Record<string, Record<string, EgoSlot>> = {}
    for (const e of egoSlots) {
      if (!e.sinner_id || !e.grade) continue
      if (!map[e.sinner_id]) map[e.sinner_id] = {}
      map[e.sinner_id][e.grade] = e
    }
    return map
  }, [egoSlots])

  const tabs = [
    { key: 'identity' as const, label: `인격 (${deck.length}/12)`, hint: '클릭하여 상세 보기' },
    { key: 'ego' as const, label: `EGO (${egoSlots.length})` },
    { key: 'skillset' as const, label: '스킬셋' },
  ]

  return (
    <>
      {/* 서브탭 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid #222', marginBottom: '0.75rem',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {tabs.map(tab => {
          const active = deckSubTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setDeckSubTab(tab.key)}
              style={{
                padding: '0.5rem 0.625rem', fontSize: '0.8125rem',
                fontWeight: active ? 700 : 400, whiteSpace: 'nowrap',
                color: active ? '#e8dcc8' : '#555', cursor: 'pointer',
                background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? '#c8900a' : 'transparent'}`,
                marginBottom: '-1px',
              }}
            >
              {tab.label}
              {'hint' in tab && active && (
                <span style={{ fontSize: '0.5625rem', color: '#5a5065', marginLeft: '0.375rem', fontWeight: 400 }}>
                  {tab.hint}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 인격 그리드 */}
      {deckSubTab === 'identity' && (
        <div className="grid grid-cols-6 gap-x-1.5 sm:gap-x-3 gap-y-3 sm:gap-y-4">
          {sinners.map(sinner => {
            const slot = slotBySinner[sinner.id]
            const identData = slot?.identity_id ? identityMap.get(slot.identity_id) : undefined
            const rc = slot ? (RARITY_COLORS[slot.rarity ?? 1] ?? RARITY_COLORS[1]) : null
            const n = slot && (slot.slot_order ?? 99) < 99 ? (slot.slot_order ?? 0) + 1 : null
            return (
              <div
                key={sinner.id}
                onClick={() => slot?.identity_id && setIdentityModalId(slot.identity_id)}
                style={{ cursor: slot?.identity_id ? 'pointer' : 'default' }}
              >
                <div style={{
                  position: 'relative', width: '100%', aspectRatio: '2/3',
                  background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                  border: `0.09375rem ${slot ? 'solid' : 'dashed'} ${slot ? (rc?.border ?? '#2a2015') : '#2a2015'}`,
                  borderRadius: '0.25rem', overflow: 'hidden',
                  boxShadow: slot ? `0 0 0.5rem ${rc?.glow ?? 'transparent'}` : 'none',
                }}>
                  {slot && identData ? (
                    <>
                      <Image
                        src={getIdentityImageUrl(identData.sinner_id, identData.folder_name ?? '', `${identData.game_id}_normal_info`)}
                        alt={slot.name_kr ?? ''} fill className="object-cover object-top" sizes="120px"
                      />
                      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, padding: '0.1875rem' }}>
                        <Image
                          src={`${S}/icons/Rarity/${slot.rarity ?? 1}star.webp`}
                          alt={`${slot.rarity ?? 1}성`}
                          width={(slot.rarity ?? 1) * 14} height={14}
                          style={{ height: '0.875rem', width: 'auto', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, textAlign: 'center',
                        background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                        paddingTop: '1.25rem', paddingBottom: '0.25rem',
                      }}>
                        <p
                          className="font-serif text-[0.5rem] sm:text-[0.6875rem]"
                          style={{ color: '#e8dcc8', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}
                        >
                          {slot.name_kr}
                        </p>
                      </div>
                      {n != null && (
                        <div style={{
                          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          zIndex: 15, background: 'rgba(13,11,8,0.45)', pointerEvents: 'none',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span
                              className="text-[0.625rem] sm:text-base"
                              style={{
                                fontWeight: 700,
                                color: n <= 7 ? '#e8b030' : '#5ab0d0',
                                textShadow: `0 0 0.5rem ${n <= 7 ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)`,
                              }}
                            >
                              {n <= 7 ? '편성' : '대기'}
                            </span>
                            <span
                              className="text-sm sm:text-2xl"
                              style={{
                                fontWeight: 800,
                                color: n <= 7 ? '#e8b030' : '#5ab0d0',
                                marginLeft: '0.1875rem',
                                textShadow: `0 0 1rem ${n <= 7 ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)`,
                              }}
                            >
                              {n}
                            </span>
                          </div>
                          {(slotGiftMap.get(n)?.length ?? 0) > 0 && (() => {
                            const urls = slotGiftMap.get(n)!
                            const MAX = 3
                            const shown = urls.slice(0, MAX)
                            const rest = urls.length - MAX
                            return (
                              <div style={{ display: 'flex', gap: '0.125rem', marginTop: '0.1875rem', alignItems: 'center', justifyContent: 'center' }}>
                                {shown.map((url, gi) => (
                                  <Image key={gi} src={url} alt="" width={28} height={28}
                                    className="w-[0.875rem] h-[0.875rem] sm:w-[1.25rem] sm:h-[1.25rem]"
                                    style={{ objectFit: 'contain', filter: 'drop-shadow(0 0 0.125rem rgba(0,0,0,0.8))' }}
                                  />
                                ))}
                                {rest > 0 && (
                                  <span style={{ fontSize: '0.5rem', color: '#9ca3af', fontWeight: 600, marginLeft: '0.0625rem', textShadow: '0 0.0625rem 0.25rem rgba(0,0,0,1)' }}>
                                    ...+{rest}
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={32} height={32}
                          style={{ width: '2rem', height: '2rem', opacity: 0.35 }} />
                      </div>
                      <div style={{ position: 'absolute', top: 0, right: 0, width: '36%', opacity: 0.15, pointerEvents: 'none' }}>
                        <Image src={`${S}/sinners/${sinner.id}/number.webp`} alt="" width={389} height={1023} className="w-full h-auto" />
                      </div>
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', zIndex: 10,
                        background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                        paddingTop: '1.25rem', paddingBottom: '0.375rem',
                      }}>
                        <p className="font-serif font-light text-[0.5rem] sm:text-[0.75rem]" style={{ color: '#3a2a10' }}>{sinner.name_kr}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 공격 유형 + 죄악 자원 + 패시브 */}
      {deckSubTab === 'identity' && deck.length > 0 && (() => {
        const selectedEgoIds = new Set(egoSlots.map(e => e.ego_id).filter(Boolean))
        const selectedEgoData = egos.filter(e => selectedEgoIds.has(e.id))
        const selectedEgoCosts = selectedEgoData.map(e => ({ cost: e.cost }))
        const selectedEgoSins = selectedEgoData.map(e => e.sin_affinity).filter(Boolean) as string[]
        return (
          <DeckStatsPanel
            identitySlots={deck}
            skills={skills}
            passives={passives}
            sinners={sinners}
            egoCosts={selectedEgoCosts}
            egoSinAffinities={selectedEgoSins}
          />
        )
      })()}

      {/* EGO 그리드 */}
      {deckSubTab === 'ego' && (
        deck.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4">
            {sinners.map(sinner => {
              const slot = slotBySinner[sinner.id]
              const egoByGrade = egoByGradeMap[sinner.id] ?? {}
              return (
                <div key={sinner.id} style={{
                  background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                  border: `1px solid ${slot ? '#221a0f' : '#18120a'}`,
                  borderRadius: '0.25rem', overflow: 'hidden',
                  opacity: slot ? 1 : 0.5,
                }}>
                  <div className="flex items-center gap-1.5" style={{ padding: '0.375rem 0.5rem', borderBottom: '1px solid #1a1208' }}>
                    <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14}
                      style={{ width: '0.875rem', height: '0.875rem', opacity: 0.5 }} />
                    <span className="font-serif font-light truncate" style={{ color: slot ? '#8a7a60' : '#3a2a10', fontSize: '0.5625rem' }}>
                      {sinner.name_kr}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.125rem' }}>
                    {GRADE_ORDER.map(grade => {
                      const ego = egoByGrade[grade]
                      const gc = GRADE_COLORS[grade] ?? '#555'
                      const egoFull = ego ? egos.find(e => e.id === ego.ego_id) : null
                      const sinEn = egoFull?.sin_affinity ? (SIN_KR_TO_EN[egoFull.sin_affinity] ?? egoFull.sin_affinity) : null
                      const ec = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                      return (
                        <div
                          key={grade}
                          onClick={() => ego?.ego_id && setEgoModalId(ego.ego_id)}
                          style={{
                            background: ego ? `${ec}1a` : 'rgba(10,8,5,0.7)',
                            border: `1px solid ${ego ? ec + '55' : '#18120a'}`,
                            borderRadius: '0.125rem', padding: '0.25rem 0.3125rem',
                            display: 'flex', alignItems: 'center', gap: '0.3125rem',
                            minHeight: '1.5rem',
                            cursor: ego?.ego_id ? 'pointer' : 'default',
                          }}
                        >
                          {grade !== 'ALEPH' ? (
                            <Image
                              src={`${S}/icons/grade/${grade}.webp`} alt={grade} width={22} height={11} unoptimized
                              style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}
                            />
                          ) : (
                            <span style={{ color: gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                          )}
                          {ego ? (
                            <span style={{ color: gc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, flex: 1, textAlign: 'left' }}>{ego.name_kr}</span>
                          ) : (
                            <span style={{ color: '#2a1e10', fontSize: '0.5rem', lineHeight: 1 }}>{slot ? '—' : ''}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {!slot && (
                    <div style={{ padding: '0.25rem 0.5rem 0.375rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.5rem', color: '#333' }}>인격 미선택</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState text="인격이 편성되지 않았습니다" />
        )
      )}

      {/* 스킬셋 */}
      {deckSubTab === 'skillset' && (
        deck.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
            {sinners.map(sinner => {
              const slot = slotBySinner[sinner.id]
              if (!slot) return null
              const identData = slot.identity_id ? identityMap.get(slot.identity_id) : undefined
              const dist = [3, 2, 1]
              const identForIcon = identData ? { game_id: identData.game_id, sinner_id: identData.sinner_id } : null

              return (
                <div
                  key={sinner.id}
                  onClick={() => slot.identity_id && setIdentityModalId(slot.identity_id)}
                  style={{ cursor: slot.identity_id ? 'pointer' : 'default' }}
                >
                  <div style={{
                    position: 'relative', width: '100%', aspectRatio: '2/3',
                    background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                    border: `0.09375rem solid ${(RARITY_COLORS[slot.rarity ?? 1] ?? RARITY_COLORS[1]).border}`,
                    borderRadius: '0.25rem', overflow: 'hidden',
                  }}>
                    {identData && (
                      <Image
                        src={getIdentityImageUrl(identData.sinner_id, identData.folder_name ?? '', `${identData.game_id}_normal_info`)}
                        alt={slot.name_kr ?? ''} fill className="object-cover object-top" sizes="120px"
                      />
                    )}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, textAlign: 'center',
                      background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                      paddingTop: '1.25rem', paddingBottom: '0.25rem',
                    }}>
                      <p className="font-serif" style={{ color: '#e8dcc8', fontSize: '0.6875rem', lineHeight: 1.2 }}>{slot.name_kr}</p>
                    </div>
                  </div>
                  <div style={{
                    marginTop: '0.375rem',
                    background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                    border: '1px solid #221a0f', borderRadius: '0.25rem', padding: '0.375rem',
                  }}>
                    {[0, 1, 2].map(idx => {
                      const skillName = skills.find(sk => sk.identity_id === slot.identity_id && sk.skill_order === idx + 1)?.name
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0' }}>
                          {identForIcon?.game_id ? (
                            <Image
                              src={getSkillIconUrl(identForIcon as Parameters<typeof getSkillIconUrl>[0], idx + 1)}
                              alt={`S${idx + 1}`} width={24} height={24}
                              style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.125rem', flexShrink: 0 }}
                            />
                          ) : (
                            <span style={{ fontSize: '0.5625rem', color: '#c8900a', fontFamily: 'var(--font-mono)', fontWeight: 700, width: '1.5rem', flexShrink: 0, textAlign: 'center' }}>
                              S{idx + 1}
                            </span>
                          )}
                          {skillName ? (
                            <span style={{ fontSize: '0.5rem', color: '#8a7a60', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {skillName}
                            </span>
                          ) : (
                            <div style={{ flex: 1 }} />
                          )}
                          <span style={{
                            width: '1rem', textAlign: 'center', fontSize: '0.8125rem',
                            fontFamily: 'var(--font-mono)', fontWeight: 700,
                            color: dist[idx] === 0 ? '#3a2a10' : '#c8900a',
                          }}>
                            {dist[idx]}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState text="인격이 편성되지 않았습니다" />
        )
      )}

      {/* 모달 */}
      {identityModalId && (
        <IdentityDetailModal identityId={identityModalId} onClose={() => setIdentityModalId(null)} />
      )}
      {egoModalId && (
        <EgoDetailModal egoId={egoModalId} onClose={() => setEgoModalId(null)} />
      )}
    </>
  )
}
