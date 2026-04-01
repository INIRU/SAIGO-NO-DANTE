'use client'

import { useMemo, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { X, Users, Sparkles, SlidersHorizontal } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import IdentityDetailModal from '@/components/ui/IdentityDetailModal'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { IdentityData, SinnerData, SkillSummary, EgoData, PassiveData, GiftData } from '@/lib/planner/types'
import DeckStatsPanel from '@/components/planner/DeckStatsPanel'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl, BLUR_PLACEHOLDER } from '@/lib/utils/images'
import { STORAGE_BASE, RARITY_COLORS, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'

type DeckSubTab = 'identity' | 'ego' | 'skillset'
const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

const SUB_TABS: { key: DeckSubTab; label: string; icon: typeof Users }[] = [
  { key: 'identity', label: '인격', icon: Users },
  { key: 'ego', label: 'EGO', icon: Sparkles },
  { key: 'skillset', label: '스킬셋', icon: SlidersHorizontal },
]

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  identities: IdentityData[]
  sinners: SinnerData[]
  skills: SkillSummary[]
  passives: PassiveData[]
  egos: EgoData[]
  giftMap?: Map<number, GiftData>
}

export default function DeckSection({ state, dispatch, identities, sinners, skills, passives, egos, giftMap }: Props) {
  const [subTab, setSubTab] = useState<DeckSubTab>('identity')
  const [swapSinner, setSwapSinner] = useState<string | null>(null)
  const [egoSinner, setEgoSinner] = useState<string | null>(null)
  const [skillDist, setSkillDist] = useState<Record<string, [number, number, number]>>({})
  const [detailIdentityId, setDetailIdentityId] = useState<string | null>(null)

  // Long press 로직
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [longPressProgress, setLongPressProgress] = useState<string | null>(null)
  const didLongPress = useRef(false)
  const LONG_PRESS_MS = 500

  const handlePointerDown = (sinnerId: string, identityId: string) => {
    didLongPress.current = false
    setLongPressProgress(sinnerId)
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setDetailIdentityId(identityId)
      setLongPressProgress(null)
    }, LONG_PRESS_MS)
  }
  const handlePointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    setLongPressProgress(null)
  }
  // long press 후 click 이벤트 무시
  const handleCardClick = (sinnerId: string, fallback: () => void) => {
    if (didLongPress.current) { didLongPress.current = false; return }
    fallback()
  }

  const handleSkillChange = (sinnerId: string, idx: number, delta: number) => {
    const dist = skillDist[sinnerId] ?? [3, 2, 1]
    const next: [number, number, number] = [dist[0], dist[1], dist[2]]
    const total = next[0] + next[1] + next[2]
    const newVal = next[idx] + delta
    if (newVal < 0 || total + delta > 6) return
    next[idx] = newVal
    setSkillDist(prev => ({ ...prev, [sinnerId]: next }))
  }

  const sinnerIdentities = useMemo(() => {
    const map = new Map<string, IdentityData[]>()
    for (const ident of identities) {
      if (!map.has(ident.sinner_id)) map.set(ident.sinner_id, [])
      map.get(ident.sinner_id)!.push(ident)
    }
    for (const [, list] of map) list.sort((a, b) => b.rarity - a.rarity)
    return map
  }, [identities])

  const identityById = useMemo(() => {
    const map = new Map<string, IdentityData>()
    for (const ident of identities) map.set(ident.id, ident)
    return map
  }, [identities])

  const sinnerEgos = useMemo(() => {
    const map = new Map<string, EgoData[]>()
    for (const ego of egos) {
      if (!map.has(ego.sinner_id)) map.set(ego.sinner_id, [])
      map.get(ego.sinner_id)!.push(ego)
    }
    for (const [, list] of map) list.sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade))
    return map
  }, [egos])

  // 수감자별 스킬 그룹
  const sinnerSkills = useMemo(() => {
    const map = new Map<string, SkillSummary[]>()
    const selectedIds = new Set(state.identitySlots.map(s => s.identity_id))
    for (const skill of skills) {
      if (!selectedIds.has(skill.identity_id)) continue
      const slot = state.identitySlots.find(s => s.identity_id === skill.identity_id)
      if (!slot) continue
      if (!map.has(slot.sinner_id)) map.set(slot.sinner_id, [])
      map.get(slot.sinner_id)!.push(skill)
    }
    return map
  }, [skills, state.identitySlots])

  // 편성 슬롯 → 기프트 이미지 매핑 (플래너 디테일 패턴: 효과 텍스트에서 "[편성 N번 전용 효과]" 파싱)
  const slotGiftImages = useMemo(() => {
    if (!giftMap) return new Map<number, string[]>()
    const map = new Map<number, string[]>()
    const invGifts = state.giftInventory.map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[]
    for (const gift of invGifts) {
      const txt = gift.effect_base ?? ''
      const m = txt.match(/\[편성[^\]]*전용\s*효과\]|\[\d[^\]]*편성\s*전용\s*효과\]/)
      if (!m || !gift.image_url) continue
      const slots = [...m[0].matchAll(/(\d+)/g)].map(r => parseInt(r[1]))
      for (const s of slots) {
        if (!map.has(s)) map.set(s, [])
        map.get(s)!.push(gift.image_url)
      }
    }
    return map
  }, [giftMap, state.giftInventory])

  const getSelected = useCallback(
    (sinnerId: string) => state.identitySlots.find(s => s.sinner_id === sinnerId),
    [state.identitySlots]
  )

  const getInfoImageUrl = useCallback((ident: IdentityData) => {
    if (!ident.game_id || !ident.folder_name) return ''
    return getIdentityImageUrl(ident.sinner_id, ident.folder_name, `${ident.game_id}_normal_info`)
  }, [])

  const handleSelect = (ident: IdentityData) => {
    dispatch({
      type: 'SWAP_IDENTITY', sinnerId: ident.sinner_id,
      newSlot: {
        identity_id: ident.id, sinner_id: ident.sinner_id, name_kr: ident.name_kr,
        rarity: ident.rarity, keywords: ident.keywords ?? [],
        game_id: ident.game_id, folder_name: ident.folder_name,
        slot_order: getSelected(ident.sinner_id)?.slot_order ?? 99,
      },
    })
    setSwapSinner(null)
  }

  const handleToggleFormation = (sinnerId: string) => {
    const slot = getSelected(sinnerId)
    if (!slot) return
    if (slot.slot_order < 99) {
      // 편성→벤치
      dispatch({ type: 'SWAP_IDENTITY', sinnerId, newSlot: { ...slot, slot_order: 99 } })
    } else {
      // 벤치→편성: 다음 순서
      const nextOrder = state.identitySlots.filter(s => s.slot_order < 99).length
      dispatch({ type: 'SWAP_IDENTITY', sinnerId, newSlot: { ...slot, slot_order: nextOrder } })
    }
  }

  const handleSelectEgo = (ego: EgoData) => {
    dispatch({
      type: 'SWAP_EGO', sinnerId: ego.sinner_id,
      newEgo: { ego_id: ego.id, sinner_id: ego.sinner_id, name_kr: ego.name_kr ?? ego.name, grade: ego.grade, sin_affinity: ego.sin_affinity },
    })
    setEgoSinner(null)
  }

  return (
    <div>
      {/* 서브탭 */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid #1a1510', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {SUB_TABS.map(tab => {
          const active = subTab === tab.key
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setSubTab(tab.key)} className="flex items-center gap-1 transition-all shrink-0"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontWeight: active ? 700 : 400, color: active ? '#e8dcc8' : '#555', borderBottom: `2px solid ${active ? '#c8900a' : 'transparent'}`, minHeight: '2.75rem' }}>
              <Icon style={{ width: '0.75rem', height: '0.75rem' }} /> {tab.label}
            </button>
          )
        })}
        <span className="ml-auto shrink-0" style={{ fontSize: '0.6875rem', color: '#555', padding: '0.5rem 0.25rem' }}>
          {state.identitySlots.length}/12
        </span>
      </div>

      {/* ── 인격 탭 ── */}
      {subTab === 'identity' && (<>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-3 gap-y-4" style={{ position: 'relative', zIndex: 0 }}>
          {sinners.map(sinner => {
            const slot = getSelected(sinner.id)
            const identData = slot ? identityById.get(slot.identity_id) : undefined
            const rarityColor = slot ? (RARITY_COLORS[slot.rarity] ?? RARITY_COLORS[1]) : null

            return (
              <div key={sinner.id} className="relative">
                <div
                  className="group cursor-pointer relative w-full"
                  onPointerDown={() => { if (slot) handlePointerDown(sinner.id, slot.identity_id) }}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  style={{
                    aspectRatio: '2/3',
                    background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                    border: `0.09375rem ${slot ? 'solid' : 'dashed'} ${slot ? (rarityColor?.border ?? '#2a2015') : '#2a2015'}`,
                    borderRadius: '0.25rem', overflow: 'hidden',
                    boxShadow: slot ? `0 0 0.5rem ${rarityColor?.glow ?? 'transparent'}` : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Long press 프로그레스 바 */}
                  {longPressProgress === sinner.id && (
                    <div className="absolute bottom-0 left-0 right-0 z-30" style={{ height: '0.1875rem', background: '#2a2015' }}>
                      <div style={{
                        height: '100%', background: '#c8900a', borderRadius: '0.09375rem',
                        animation: `longpress-fill ${LONG_PRESS_MS}ms linear forwards`,
                      }} />
                      <style>{`@keyframes longpress-fill { from { width: 0% } to { width: 100% } }`}</style>
                    </div>
                  )}
                  {slot && identData ? (
                    <>
                      <Image src={getInfoImageUrl(identData)} alt={slot.name_kr} fill className="object-cover object-top" sizes="(max-width:640px) 33vw, 16vw" placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} />
                      <div className="absolute top-0 left-0 z-10" style={{ padding: '0.25rem' }}>
                        <Image src={`${STORAGE_BASE}/icons/Rarity/${slot.rarity}star.webp`} alt="" width={slot.rarity * 24} height={24} style={{ height: '1rem', width: 'auto', objectFit: 'contain' }} />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 z-10 text-center" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)', paddingTop: '1.5rem', paddingBottom: '0.375rem' }}>
                        <p className="font-serif" style={{ color: '#e8dcc8', fontSize: '0.6875rem', lineHeight: 1.2 }}>{slot.name_kr}</p>
                      </div>
                      {/* 편성 순서 + 기프트 아이콘 (한 레이어에서 세로 정렬) */}
                      {slot.slot_order < 99 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-[5] pointer-events-none" style={{ background: 'rgba(13,11,8,0.45)' }}>
                          <div className="flex items-center">
                            <span style={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'var(--font-body)', color: slot.slot_order < 7 ? '#e8b030' : '#5ab0d0', textShadow: `0 0 0.75rem ${slot.slot_order < 7 ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)` }}>
                              {slot.slot_order < 7 ? '편성' : '대기'}
                            </span>
                            <span style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-body)', lineHeight: 1, color: slot.slot_order < 7 ? '#e8b030' : '#5ab0d0', textShadow: `0 0 1rem ${slot.slot_order < 7 ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)`, marginLeft: '0.25rem' }}>
                              {slot.slot_order + 1}
                            </span>
                          </div>
                          {/* 편성 전용 효과 기프트 — 숫자 바로 아래 */}
                          {(() => {
                            const slotNum = (slot.slot_order ?? 99) + 1
                            const images = slotGiftImages.get(slotNum) ?? []
                            if (images.length === 0) return null
                            const MAX = 4
                            const shown = images.slice(0, MAX)
                            const rest = images.length - MAX
                            return (
                              <div className="flex items-center justify-center" style={{ gap: '0.1875rem', marginTop: '0.375rem' }}>
                                {shown.map((url, i) => (
                                  <Image key={i} src={url} alt="" width={20} height={20}
                                    style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain', filter: 'drop-shadow(0 0 0.1875rem rgba(0,0,0,0.9))' }} />
                                ))}
                                {rest > 0 && <span style={{ fontSize: '0.5rem', color: '#c8900a', fontFamily: 'var(--font-mono)', fontWeight: 700, textShadow: '0 0 0.25rem rgba(0,0,0,0.9)' }}>+{rest}</span>}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={32} height={32} style={{ width: '2rem', height: '2rem', opacity: 0.35 }} />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 text-center z-10" style={{ background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)', paddingTop: '1.25rem', paddingBottom: '0.375rem' }}>
                        <p className="font-serif" style={{ color: '#3a2a10', fontSize: '0.625rem' }}>{sinner.name_kr}</p>
                      </div>
                    </>
                  )}

                  {/* 호버: 상단 변경, 하단 편성/해제 (모달 열려있으면 비활성) */}
                  <div className={`absolute inset-0 z-20 transition-opacity flex flex-col ${swapSinner || egoSinner ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`} style={{ backdropFilter: 'blur(0.25rem) brightness(0.4)', WebkitBackdropFilter: 'blur(0.25rem) brightness(0.4)' }}>
                    {slot ? (
                      <>
                        <div onClick={() => handleCardClick(sinner.id, () => setSwapSinner(sinner.id))} className="flex items-center justify-center transition-colors" style={{ height: '40%', borderBottom: '1px solid rgba(200,144,10,0.2)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.15)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                          <span style={{ color: '#e8b030', fontSize: '0.75rem', fontWeight: 700, textShadow: '0 0 0.5rem rgba(200,144,10,0.5)' }}>변경</span>
                        </div>
                        <div onClick={() => handleCardClick(sinner.id, () => handleToggleFormation(sinner.id))} className="flex items-center justify-center transition-colors" style={{ height: '60%' }}
                          onMouseEnter={e => { e.currentTarget.style.background = slot.slot_order < 99 ? 'rgba(90,176,208,0.12)' : 'rgba(200,144,10,0.12)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                          <span style={{ color: slot.slot_order < 99 ? '#5ab0d0' : '#e8b030', fontSize: '0.6875rem', fontWeight: 600, textShadow: '0 0.125rem 0.375rem rgba(0,0,0,0.9)' }}>
                            {slot.slot_order < 99 ? '편성 해제' : '편성하기'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div onClick={() => handleCardClick(sinner.id, () => setSwapSinner(sinner.id))} className="flex items-center justify-center transition-colors" style={{ height: '100%' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.12)' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ color: '#e8b030', fontSize: '0.875rem', fontWeight: 700, textShadow: '0 0 0.5rem rgba(200,144,10,0.5)' }}>편성</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 공격 유형 + 죄악 자원 + 패시브 */}
        {state.identitySlots.length > 0 && (() => {
          const selectedEgoIds = new Set(state.egoSlots.map(e => e.ego_id).filter(Boolean))
          const selectedEgoData = egos.filter(e => selectedEgoIds.has(e.id))
          const selectedEgoCosts = selectedEgoData.map(e => ({ cost: e.cost }))
          const selectedEgoSins = selectedEgoData.map(e => e.sin_affinity).filter(Boolean) as string[]
          return (
            <DeckStatsPanel
              identitySlots={state.identitySlots}
              skills={skills}
              passives={passives}
              sinners={sinners}
              egoCosts={selectedEgoCosts}
              egoSinAffinities={selectedEgoSins}
            />
          )
        })()}
      </>)}

      {/* ── EGO 탭 ── */}
      {subTab === 'ego' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-3" style={{ position: 'relative', zIndex: 0 }}>
          {sinners.map(sinner => {
            const slot = getSelected(sinner.id)
            const selectedEgos = state.egoSlots.filter(e => e.sinner_id === sinner.id)
            const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
            for (const e of selectedEgos) egoByGrade[e.grade] = e

            return (
              <div key={sinner.id}
                onClick={() => { if (slot) setEgoSinner(sinner.id) }}
                style={{
                  background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                  border: `1px solid ${slot ? '#221a0f' : '#18120a'}`,
                  borderRadius: '0.25rem', overflow: 'hidden',
                  opacity: slot ? 1 : 0.4, cursor: slot ? 'pointer' : 'default',
                }}
              >
                <div className="flex items-center gap-1" style={{ padding: '0.375rem 0.5rem', borderBottom: '1px solid #1a1208' }}>
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.5 }} />
                  <span className="font-serif truncate" style={{ color: slot ? '#8a7a60' : '#3a2a10', fontSize: '0.5625rem' }}>{sinner.name_kr}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.125rem' }}>
                  {GRADE_ORDER.map(grade => {
                    const ego = egoByGrade[grade]
                    const gc = GRADE_COLORS[grade] ?? '#555'
                    const sinEn = ego?.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
                    const ec = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                    return (
                      <div key={grade} style={{
                        background: ego ? `${ec}1a` : 'rgba(10,8,5,0.7)',
                        border: `1px solid ${ego ? ec + '55' : '#18120a'}`,
                        borderRadius: '0.125rem', padding: '0.25rem 0.3125rem',
                        display: 'flex', alignItems: 'center', gap: '0.3125rem',
                        minHeight: '1.5rem',
                      }}>
                        {grade !== 'ALEPH' ? (
                          <Image src={`${STORAGE_BASE}/icons/grade/${grade}.webp`} alt={grade} width={22} height={11} unoptimized
                            style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }} />
                        ) : (
                          <span style={{ color: gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                        )}
                        {ego ? (
                          <span style={{ color: gc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, flex: 1, textAlign: 'left' }}>{ego.name_kr ?? ''}</span>
                        ) : (
                          <span style={{ color: '#2a1e10', fontSize: '0.5rem' }}>{slot ? '—' : ''}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 스킬셋 탭 (DeckTab 패턴: 미니 카드 + S1/S2/S3 개수 조절) ── */}
      {subTab === 'skillset' && (
        <div>
          {state.identitySlots.length === 0 ? (
            <div className="text-center" style={{ padding: '3rem 1rem', color: '#444', fontSize: '0.8125rem' }}>
              인격을 먼저 선택하세요.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6" style={{ position: 'relative', zIndex: 0 }}>
              {sinners.map(sinner => {
                const slot = getSelected(sinner.id)
                if (!slot) return null
                const identData = identityById.get(slot.identity_id)
                const dist = skillDist[sinner.id] ?? [3, 2, 1]
                const total = dist[0] + dist[1] + dist[2]
                const isDefault = dist[0] === 3 && dist[1] === 2 && dist[2] === 1
                const identForIcon = identData ? { game_id: identData.game_id, sinner_id: identData.sinner_id } as { game_id: string | null; sinner_id: string } : null

                return (
                  <div key={sinner.id}>
                    {/* 미니 인격 카드 */}
                    <div className="relative w-full" style={{
                      aspectRatio: '2/3',
                      background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                      border: `0.09375rem solid ${(RARITY_COLORS[slot.rarity] ?? RARITY_COLORS[1]).border}`,
                      borderRadius: '0.25rem', overflow: 'hidden',
                    }}>
                      {identData && getInfoImageUrl(identData) && (
                        <Image src={getInfoImageUrl(identData)} alt={slot.name_kr} fill className="object-cover object-top" sizes="(max-width:640px) 33vw, 16vw" placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} />
                      )}
                      <div className="absolute bottom-0 left-0 right-0 z-10 text-center" style={{
                        background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                        paddingTop: '1.25rem', paddingBottom: '0.25rem',
                      }}>
                        <p className="font-serif" style={{ color: '#e8dcc8', fontSize: '0.6875rem' }}>{slot.name_kr}</p>
                      </div>
                    </div>

                    {/* 스킬 배분 컨트롤 (S1/S2/S3 개수 ±) */}
                    <div style={{
                      marginTop: '0.375rem',
                      background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                      border: `1px solid ${isDefault ? '#221a0f' : 'rgba(200,144,10,0.4)'}`,
                      borderRadius: '0.25rem', padding: '0.375rem',
                    }}>
                      {[0, 1, 2].map(idx => {
                        const skillName = skills.find(sk => sk.identity_id === slot.identity_id && sk.skill_order === idx + 1)?.name
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0' }}>
                            {identForIcon?.game_id ? (
                              <Image
                                src={getSkillIconUrl(identForIcon as any, idx + 1)}
                                alt={`S${idx + 1}`} width={24} height={24}
                                style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.125rem', flexShrink: 0 }}
                              />
                            ) : (
                              <span style={{ fontSize: '0.5625rem', color: '#c8900a', fontFamily: 'var(--font-mono)', fontWeight: 700, width: '1.5rem', flexShrink: 0, textAlign: 'center' }}>
                                S{idx + 1}
                              </span>
                            )}
                            <div style={{ flex: 1 }} />
                            <button onClick={() => handleSkillChange(sinner.id, idx, -1)} disabled={dist[idx] <= 0}
                              style={{
                                width: '1.75rem', height: '1.75rem', borderRadius: '0.25rem',
                                background: dist[idx] <= 0 ? 'rgba(10,8,5,0.5)' : 'rgba(200,144,10,0.1)',
                                border: `1px solid ${dist[idx] <= 0 ? '#18120a' : 'rgba(200,144,10,0.3)'}`,
                                color: dist[idx] <= 0 ? '#2a2015' : '#c8900a',
                                fontSize: '0.875rem', cursor: dist[idx] <= 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0,
                              }}>&#x2212;</button>
                            <span style={{
                              width: '1rem', textAlign: 'center', fontSize: '0.8125rem',
                              fontFamily: 'var(--font-mono)', fontWeight: 700,
                              color: dist[idx] === 0 ? '#3a2a10' : '#c8900a',
                            }}>{dist[idx]}</span>
                            <button onClick={() => handleSkillChange(sinner.id, idx, 1)} disabled={total >= 6}
                              style={{
                                width: '1.75rem', height: '1.75rem', borderRadius: '0.25rem',
                                background: total >= 6 ? 'rgba(10,8,5,0.5)' : 'rgba(200,144,10,0.1)',
                                border: `1px solid ${total >= 6 ? '#18120a' : 'rgba(200,144,10,0.3)'}`,
                                color: total >= 6 ? '#2a2015' : '#c8900a',
                                fontSize: '0.875rem', cursor: total >= 6 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0,
                              }}>+</button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              }).filter(Boolean)}
            </div>
          )}
        </div>
      )}

      {/* ── 인격 선택 모달 ── */}
      <BaseModal open={!!swapSinner} onClose={() => setSwapSinner(null)} maxWidth="48rem" padding="env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)">
        {swapSinner && (
          <div className="relative w-full rounded-lg" style={{ background: '#1a1510', border: '1px solid #333', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between sticky top-0 z-10" style={{ padding: '0.75rem 1rem', background: '#1a1510', borderBottom: '1px solid #222' }}>
              <div className="flex items-center gap-2 min-w-0">
                <Image src={getSinnerLogoUrl(swapSinner)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7, flexShrink: 0 }} />
                <span className="font-serif truncate" style={{ fontSize: '1rem', color: '#e8dcc8' }}>
                  {sinners.find(s => s.id === swapSinner)?.name_kr} — 인격 선택
                </span>
              </div>
              <button onClick={() => setSwapSinner(null)} className="shrink-0 flex items-center justify-center" style={{ color: '#666', minWidth: '2.75rem', minHeight: '2.75rem' }}><X style={{ width: '1.25rem', height: '1.25rem' }} /></button>
            </div>
            {getSelected(swapSinner) && (
              <div style={{ padding: '0.75rem 1rem 0' }}>
                <button onClick={() => { dispatch({ type: 'REMOVE_IDENTITY', sinnerId: swapSinner }); setSwapSinner(null) }}
                  className="w-full flex items-center gap-1 rounded" style={{ color: '#c83030', fontSize: '0.8125rem', border: '1px solid #3a1515', padding: '0.5rem 0.75rem', background: 'rgba(200,48,48,0.05)' }}>
                  <X style={{ width: '0.875rem', height: '0.875rem' }} /> 선택 해제
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" style={{ padding: '1rem' }}>
              {(sinnerIdentities.get(swapSinner) ?? []).map(ident => {
                const isSelected = state.identitySlots.some(s => s.identity_id === ident.id)
                const rc = RARITY_COLORS[ident.rarity] ?? RARITY_COLORS[1]
                return (
                  <button key={ident.id} onClick={() => handleSelect(ident)} className="text-left rounded-md overflow-hidden transition-all" style={{
                    background: isSelected ? 'linear-gradient(160deg, rgba(200,144,10,0.15) 0%, rgba(200,144,10,0.05) 100%)' : 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)',
                    border: `0.09375rem solid ${isSelected ? '#c8900a' : rc.border + '40'}`,
                    boxShadow: isSelected ? `0 0 0.75rem ${rc.glow}` : 'none',
                  }}>
                    <div className="relative w-full" style={{ aspectRatio: '2/3', overflow: 'hidden' }}>
                      {ident.game_id && ident.folder_name && <Image src={getInfoImageUrl(ident)} alt={ident.name_kr} fill className="object-cover object-top" sizes="(max-width:640px) 50vw, 25vw" placeholder="blur" blurDataURL={BLUR_PLACEHOLDER} />}
                      <div className="absolute top-0 left-0 z-10" style={{ padding: '0.25rem' }}>
                        <Image src={`${STORAGE_BASE}/icons/Rarity/${ident.rarity}star.webp`} alt="" width={ident.rarity * 18} height={18} style={{ height: '0.75rem', width: 'auto', objectFit: 'contain' }} />
                      </div>
                      {isSelected && <div className="absolute inset-0 z-10" style={{ background: 'rgba(200,144,10,0.1)', border: '0.125rem solid #c8900a', borderRadius: '0.25rem' }} />}
                    </div>
                    <div style={{ padding: '0.375rem 0.5rem 0.5rem' }}>
                      <p className="font-serif truncate" style={{ color: isSelected ? '#e8dcc8' : '#b0a898', fontSize: '0.6875rem' }}>{ident.name_kr}</p>
                      {ident.keywords?.length ? <p className="truncate" style={{ fontSize: '0.5625rem', color: '#555', marginTop: '0.125rem' }}>{ident.keywords.join(' / ')}</p> : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </BaseModal>

      {/* ── EGO 선택 모달 (DeckTab 패턴: 등급별 섹션 + 이미지) ── */}
      {egoSinner && (() => {
        const modalSinnerEgo = sinners.find(s => s.id === egoSinner)
        const availableEgos = sinnerEgos.get(egoSinner) ?? []
        const selectedEgos = state.egoSlots.filter(e => e.sinner_id === egoSinner)
        const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
        for (const e of selectedEgos) egoByGrade[e.grade] = e

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(0.5rem)', padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }} onClick={() => setEgoSinner(null)}>
          <div onClick={e => e.stopPropagation()} className="relative w-full max-w-2xl mx-4" style={{ background: '#1a1510', border: '1px solid #333', borderRadius: '0.5rem', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 1rem 3rem rgba(0,0,0,0.8)' }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between sticky top-0 z-10" style={{ padding: '1rem 1.25rem', background: '#1a1510', borderBottom: '1px solid #222' }}>
              <div className="flex items-center gap-2 min-w-0">
                {modalSinnerEgo && <Image src={getSinnerLogoUrl(modalSinnerEgo.id)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7, flexShrink: 0 }} />}
                <span className="font-serif truncate" style={{ color: '#e8dcc8', fontSize: '1rem' }}>{modalSinnerEgo?.name_kr} — EGO 선택</span>
              </div>
              <button onClick={() => setEgoSinner(null)} className="shrink-0 flex items-center justify-center" style={{ color: '#666', cursor: 'pointer', minWidth: '2.75rem', minHeight: '2.75rem' }}><X style={{ width: '1.25rem', height: '1.25rem' }} /></button>
            </div>

            {/* 등급별 섹션 */}
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {GRADE_ORDER.map(grade => {
                const gc = GRADE_COLORS[grade] ?? '#555'
                const gradeEgos = availableEgos.filter(e => e.grade === grade)
                const selectedForGrade = egoByGrade[grade]

                return (
                  <div key={grade}>
                    {/* 등급 헤더 */}
                    <div className="flex items-center gap-2" style={{ marginBottom: '0.5rem' }}>
                      {grade !== 'ALEPH' ? (
                        <Image src={`${STORAGE_BASE}/icons/grade/${grade}.webp`} alt={grade} width={22} height={11} unoptimized style={{ height: '0.75rem', width: 'auto' }} />
                      ) : (
                        <span style={{ color: gc, fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>ALEPH</span>
                      )}
                      <div style={{ flex: 1, height: '1px', background: gc + '30' }} />
                      {selectedForGrade && (
                        <button onClick={() => dispatch({ type: 'REMOVE_EGO', egoId: selectedForGrade.ego_id })}
                          style={{ color: '#c83040', fontSize: '0.625rem', cursor: 'pointer', padding: '0.125rem 0.375rem', border: '1px solid #3a1515', borderRadius: '0.25rem', background: 'rgba(200,48,64,0.08)' }}>
                          해제
                        </button>
                      )}
                    </div>

                    {gradeEgos.length === 0 ? (
                      <div style={{ padding: '0.625rem', background: 'rgba(10,8,5,0.5)', borderRadius: '0.25rem', border: `1px solid ${gc}15`, textAlign: 'center' }}>
                        <span style={{ color: '#333', fontSize: '0.6875rem' }}>해당 등급 EGO 없음</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4" style={{ gap: '0.5rem' }}>
                        {gradeEgos.map(ego => {
                          const isSelected = selectedForGrade?.ego_id === ego.id
                          const egoSinEn = ego.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
                          const egoSc = egoSinEn ? (SIN_COLORS[egoSinEn as keyof typeof SIN_COLORS] ?? gc) : gc
                          return (
                            <button key={ego.id} onClick={() => handleSelectEgo(ego)} className="text-left transition-all" style={{
                              background: isSelected ? `linear-gradient(160deg, ${egoSc}22 0%, ${egoSc}0d 100%)` : 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)',
                              border: `1px solid ${isSelected ? egoSc + 'aa' : egoSc + '20'}`,
                              borderRadius: '0.375rem', overflow: 'hidden', cursor: 'pointer',
                              boxShadow: isSelected ? `0 0 0.625rem ${egoSc}44` : 'none',
                            }}>
                              {/* EGO 이미지 */}
                              {ego.image_url?.startsWith('http') && (
                                <div className="relative w-full" style={{ aspectRatio: '1/1', overflow: 'hidden', background: '#0d0b08' }}>
                                  <Image src={ego.image_url} alt={ego.name_kr ?? ego.name} fill className="object-contain" sizes="(max-width:640px) 50vw, 25vw" />
                                </div>
                              )}
                              {/* EGO 정보 */}
                              <div style={{ padding: '0.375rem 0.5rem 0.5rem' }}>
                                <p className="font-serif truncate" style={{ color: isSelected ? '#e8dcc8' : '#b0a898', fontSize: '0.625rem', lineHeight: 1.3 }}>
                                  {ego.name_kr ?? ego.name}
                                </p>
                                <div className="flex items-center gap-1" style={{ marginTop: '0.25rem' }}>
                                  {ego.sin_affinity && (
                                    <Image src={`${STORAGE_BASE}/icons/Sins/transparent/${ego.sin_affinity.charAt(0).toUpperCase() + ego.sin_affinity.slice(1)}.webp`}
                                      alt={ego.sin_affinity} width={14} height={14} style={{ width: '0.875rem', height: '0.875rem' }} />
                                  )}
                                  <span style={{ color: gc, fontSize: '0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.05em' }}>{grade}</span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        )
      })()}

      {/* 인격 상세 모달 (꾹 눌러서 열림) */}
      {detailIdentityId && (
        <IdentityDetailModal identityId={detailIdentityId} onClose={() => setDetailIdentityId(null)} />
      )}
    </div>
  )
}
