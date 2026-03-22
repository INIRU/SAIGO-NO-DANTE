'use client'

import { useMemo, useState, useCallback } from 'react'
import Image from 'next/image'
import { X, Users, Sparkles, SlidersHorizontal } from 'lucide-react'
import { type PlannerState, type PlannerAction, type IdentityData, type SinnerData, type ThemeData, type GiftData } from '@/lib/planner/types'
import { computeKeywordDistribution } from '@/lib/planner/fusion'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import { STORAGE_BASE, RARITY_COLORS, GRADE_COLORS } from '@/lib/constants/game'
import KeywordChart from './KeywordChart'

type DeckSubTab = 'identity' | 'ego' | 'skillset'

const SUB_TABS: { key: DeckSubTab; label: string; icon: typeof Users }[] = [
  { key: 'identity', label: '인격', icon: Users },
  { key: 'ego', label: 'EGO', icon: Sparkles },
  { key: 'skillset', label: '스킬셋', icon: SlidersHorizontal },
]

const SKILL_PRESETS: [number, number, number][] = [[3, 2, 1], [1, 0, 5], [0, 0, 6]]
const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  identities: IdentityData[]
  sinners: SinnerData[]
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
}

// --- Rarity star images ---
function RarityStars({ rarity, size = 'md' }: { rarity: number; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 28 : size === 'lg' ? 48 : 36
  return (
    <Image
      src={`${STORAGE_BASE}/icons/Rarity/${rarity}star.webp`}
      alt={`${rarity}성`}
      width={s}
      height={s}
      style={{ width: `${s / 16}rem`, height: `${s / 16}rem`, objectFit: 'contain' }}
    />
  )
}

export default function DeckTab({ state, dispatch, identities, sinners }: Props) {
  const [subTab, setSubTab] = useState<DeckSubTab>('identity')
  const [gacksungSlots, setGacksungSlots] = useState<Record<string, boolean>>({})
  const [skillDistribution, setSkillDistribution] = useState<Record<string, [number, number, number]>>({})

  // Modal state
  const [identityModalSinner, setIdentityModalSinner] = useState<string | null>(null)
  const [egoModalSinner, setEgoModalSinner] = useState<string | null>(null)

  // 수감자별 인격 그룹 (rarity 내림차순 정렬)
  const sinnerIdentities = useMemo(() => {
    const map = new Map<string, IdentityData[]>()
    for (const ident of identities) {
      if (!map.has(ident.sinner_id)) map.set(ident.sinner_id, [])
      map.get(ident.sinner_id)!.push(ident)
    }
    for (const [, list] of map) {
      list.sort((a, b) => b.rarity - a.rarity)
    }
    return map
  }, [identities])

  // 선택된 인격들의 키워드 분포
  const keywordDist = useMemo(() => {
    const allKeywords = state.identitySlots.map(s => s.keywords)
    return computeKeywordDistribution(allKeywords)
  }, [state.identitySlots])

  // 현재 수감자에 선택된 인격 찾기
  const getSelectedIdentity = useCallback(
    (sinnerId: string) => state.identitySlots.find(s => s.sinner_id === sinnerId),
    [state.identitySlots],
  )

  // identities map by id for quick lookup
  const identityById = useMemo(() => {
    const map = new Map<string, IdentityData>()
    for (const ident of identities) map.set(ident.id, ident)
    return map
  }, [identities])

  // 인격 이미지 URL (info 이미지)
  const getIdentityInfoImageUrl = useCallback((ident: IdentityData, gacksung: boolean) => {
    if (!ident.game_id || !ident.folder_name) return ''
    const prefix = gacksung ? 'gacksung' : 'normal'
    return getIdentityImageUrl(ident.sinner_id, ident.folder_name, `${ident.game_id}_${prefix}_info`)
  }, [])

  const handleGacksungToggle = (sinnerId: string) => {
    setGacksungSlots(prev => ({ ...prev, [sinnerId]: !prev[sinnerId] }))
  }

  const handleSkillChange = (sinnerId: string, idx: number, delta: number) => {
    const dist = skillDistribution[sinnerId] ?? [3, 2, 1]
    const next: [number, number, number] = [dist[0], dist[1], dist[2]]
    const total = next[0] + next[1] + next[2]
    const newVal = next[idx] + delta
    if (newVal < 0 || total + delta > 6) return
    next[idx] = newVal
    setSkillDistribution(prev => ({ ...prev, [sinnerId]: next }))
  }

  const handleSelectIdentity = (ident: IdentityData) => {
    dispatch({
      type: 'ADD_IDENTITY',
      slot: {
        identity_id: ident.id,
        sinner_id: ident.sinner_id,
        name_kr: ident.name_kr,
        rarity: ident.rarity,
        keywords: ident.keywords ?? [],
        game_id: ident.game_id,
        folder_name: ident.folder_name,
        slot_order: 99, // 기본 벤치, 하단 클릭으로 편성
      },
    })
    setIdentityModalSinner(null)
  }

  const handleDeselectIdentity = (sinnerId: string) => {
    dispatch({ type: 'REMOVE_IDENTITY', sinnerId })
    setIdentityModalSinner(null)
  }

  // --- Modal sinner data ---
  const modalSinner = identityModalSinner ? sinners.find(s => s.id === identityModalSinner) : null
  const modalIdentities = identityModalSinner ? (sinnerIdentities.get(identityModalSinner) ?? []) : []
  const modalSlot = identityModalSinner ? getSelectedIdentity(identityModalSinner) : undefined

  return (
    <div>
      {/* 서브 탭 헤더 */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: '1px solid #1a1510' }}>
        {SUB_TABS.map(tab => {
          const active = subTab === tab.key
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className="flex items-center gap-1.5 transition-all"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: active ? 700 : 400,
                color: active ? '#e8dcc8' : '#555',
                borderBottom: active ? '2px solid #c8900a' : '2px solid transparent',
                background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <Icon style={{ width: '0.875rem', height: '0.875rem' }} />
              {tab.label}
            </button>
          )
        })}
        <div className="ml-auto flex items-center" style={{ fontSize: '0.75rem', color: '#666', paddingRight: '0.5rem' }}>
          {state.identitySlots.length} / 12
        </div>
      </div>

      {/* ── 인격 탭 ── */}
      {subTab === 'identity' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
          {sinners.map(sinner => {
            const slot = getSelectedIdentity(sinner.id)
            const identData = slot ? identityById.get(slot.identity_id) : undefined
            const isGacksung = gacksungSlots[sinner.id] ?? false
            const rarityColor = slot ? (RARITY_COLORS[slot.rarity] ?? RARITY_COLORS[1]) : null

            return (
              <div key={sinner.id} className="relative" style={{ overflow: 'visible' }}>
                <div
                  className="group cursor-pointer relative w-full"
                  style={{
                    aspectRatio: '2/3',
                    background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                    border: `0.09375rem ${slot ? 'solid' : 'dashed'} ${slot ? (rarityColor?.border ?? '#2a2015') : '#2a2015'}`,
                    borderRadius: '0.25rem',
                    overflow: 'hidden',
                    boxShadow: slot ? `0 0 0.5rem ${rarityColor?.glow ?? 'transparent'}` : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {slot && identData ? (
                    <>
                      <Image
                        src={getIdentityInfoImageUrl(identData, isGacksung)}
                        alt={slot.name_kr}
                        fill
                        className="object-cover object-top"
                        sizes="180px"
                      />
                      {/* 등급 별 이미지 */}
                      <div className="absolute top-0 left-0 z-10 flex items-center gap-0.5" style={{ padding: '0.25rem' }}>
                        <RarityStars rarity={slot.rarity} />
                      </div>
                      {/* 이름 오버레이 */}
                      <div
                        className="absolute bottom-0 left-0 right-0 z-10 text-center"
                        style={{
                          background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                          paddingTop: '1.5rem',
                          paddingBottom: '0.375rem',
                        }}
                      >
                        <p className="font-serif" style={{ color: '#e8dcc8', fontSize: '0.8125rem', lineHeight: 1.2 }}>
                          {slot.name_kr}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <Image
                          src={getSinnerLogoUrl(sinner.id)}
                          alt=""
                          width={32}
                          height={32}
                          style={{ width: '2rem', height: '2rem', opacity: 0.35 }}
                        />
                      </div>
                      <div className="absolute" style={{ top: 0, right: 0, width: '36%', opacity: 0.15, pointerEvents: 'none' }}>
                        <Image
                          src={`${STORAGE_BASE}/sinners/${sinner.id}/number.webp`}
                          alt=""
                          width={389}
                          height={1023}
                          className="w-full h-auto"
                        />
                      </div>
                      <div
                        className="absolute bottom-0 left-0 right-0 text-center z-10"
                        style={{
                          background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                          paddingTop: '1.25rem',
                          paddingBottom: '0.375rem',
                        }}
                      >
                        <p className="font-serif font-light" style={{ color: '#3a2a10', fontSize: '0.75rem' }}>
                          {sinner.name_kr}
                        </p>
                      </div>
                    </>
                  )}

                  {/* 편성 순서 오버레이 (편성된 경우 상시 표시, 벤치는 미표시) */}
                  {slot && slot.slot_order < 99 && (() => {
                    const n = slot.slot_order + 1
                    const isFormation = n <= 7
                    return (
                      <div
                        className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none"
                        style={{ opacity: 0.85 }}
                      >
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-body)', color: isFormation ? '#e8b030' : '#5ab0d0', textShadow: `0 0 0.5rem ${isFormation ? 'rgba(200,144,10,0.5)' : 'rgba(90,176,208,0.5)'}, 0 0.125rem 0.375rem rgba(0,0,0,0.9)` }}>
                          {isFormation ? '편성' : '대기'}
                        </span>
                        <span style={{ fontSize: '1.375rem', fontWeight: 800, fontFamily: 'var(--font-body)', lineHeight: 1, color: isFormation ? '#e8b030' : '#5ab0d0', textShadow: `0 0 0.625rem ${isFormation ? 'rgba(200,144,10,0.5)' : 'rgba(90,176,208,0.5)'}, 0 0.125rem 0.375rem rgba(0,0,0,0.9)`, marginLeft: '0.1875rem' }}>
                          {n}
                        </span>
                      </div>
                    )
                  })()}

                  {/* 호버 오버레이 (배경 블러) */}
                  <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col" style={{ backdropFilter: 'blur(0.375rem) brightness(0.4)', WebkitBackdropFilter: 'blur(0.375rem) brightness(0.4)' }}>
                    {slot ? (
                      <>
                        {/* 편성된 경우: 상단 40% 변경, 하단 60% 편성 순서 토글 */}
                        <div
                          onClick={() => setIdentityModalSinner(sinner.id)}
                          className="flex items-center justify-center transition-colors"
                          style={{ height: '40%', background: 'rgba(13,11,8,0.6)', borderBottom: '1px solid rgba(200,144,10,0.2)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.15)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.6)' }}
                        >
                          <span style={{ color: '#e8b030', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-body)', textShadow: '0 0 0.5rem rgba(200,144,10,0.5), 0 0.125rem 0.375rem rgba(0,0,0,0.9)' }}>변경</span>
                        </div>
                        <div
                          onClick={() => {
                            if (slot.slot_order < 99) {
                              // 편성됨 → 벤치로: slot_order = 99, 나머지 순서 재정렬
                              const removed = slot.slot_order
                              const updated = state.identitySlots.map(s => {
                                if (s.sinner_id === sinner.id) return { ...s, slot_order: 99 }
                                if (s.slot_order < 99 && s.slot_order > removed) return { ...s, slot_order: s.slot_order - 1 }
                                return s
                              })
                              dispatch({ type: 'LOAD_PLAN', state: { identitySlots: updated } })
                            } else {
                              // 벤치 → 편성: 다음 번호 부여
                              const nextOrder = state.identitySlots.filter(s => s.slot_order < 99).length
                              dispatch({ type: 'ADD_IDENTITY', slot: { ...slot, slot_order: nextOrder } })
                            }
                          }}
                          className="flex items-center justify-center transition-colors"
                          style={{ height: '60%', background: 'rgba(13,11,8,0.5)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = slot.slot_order < 99 ? 'rgba(90,176,208,0.12)' : 'rgba(200,144,10,0.12)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.5)' }}
                        >
                          <span style={{ color: slot.slot_order < 99 ? '#5ab0d0' : '#e8b030', fontSize: '0.75rem', fontWeight: 600, textShadow: '0 0.125rem 0.375rem rgba(0,0,0,0.9)' }}>
                            {slot.slot_order < 99 ? '편성 해제' : '편성하기'}
                          </span>
                        </div>
                      </>
                    ) : (
                      /* 미편성: 전체 클릭 = 편성 모달 */
                      <div
                        onClick={() => setIdentityModalSinner(sinner.id)}
                        className="flex items-center justify-center transition-colors"
                        style={{ height: '100%', background: 'rgba(13,11,8,0.5)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.12)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.5)' }}
                      >
                        <span style={{ color: '#e8b030', fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-body)', textShadow: '0 0 0.5rem rgba(200,144,10,0.5), 0 0.125rem 0.375rem rgba(0,0,0,0.9)' }}>편성</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 각성 토글 */}
                {slot && (
                  <button
                    onClick={e => { e.stopPropagation(); handleGacksungToggle(sinner.id) }}
                    title={isGacksung ? '각성 일러스트 -- 클릭하여 일반으로' : '일반 일러스트 -- 클릭하여 각성으로'}
                    style={{
                      position: 'absolute',
                      top: '-0.4375rem',
                      right: '-0.4375rem',
                      zIndex: 20,
                      width: '1.375rem',
                      height: '1.375rem',
                      borderRadius: '50%',
                      background: isGacksung ? 'rgba(200,144,10,0.92)' : 'rgba(18,14,9,0.92)',
                      border: `0.09375rem solid ${isGacksung ? '#c8900a' : '#2a2015'}`,
                      color: isGacksung ? '#0d0b08' : '#5a4830',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isGacksung ? '0 0 0.5rem rgba(200,144,10,0.5)' : 'none',
                      transition: 'all 0.2s',
                      lineHeight: 1,
                    }}
                  >
                    &#x21BA;
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 인격 선택 모달 ── */}
      {identityModalSinner && modalSinner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(0.5rem)' }}
          onClick={() => setIdentityModalSinner(null)}
        >
          <div
            className="relative w-full max-w-3xl mx-4"
            style={{
              background: '#1a1510',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 1rem 3rem rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between sticky top-0 z-10" style={{ padding: '1rem 1.25rem', background: '#1a1510', borderBottom: '1px solid #222' }}>
              <div className="flex items-center gap-2">
                <Image
                  src={getSinnerLogoUrl(modalSinner.id)}
                  alt=""
                  width={20}
                  height={20}
                  style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }}
                />
                <span className="font-serif" style={{ color: '#e8dcc8', fontSize: '1rem' }}>
                  {modalSinner.name_kr} - 인격 선택
                </span>
              </div>
              <button
                onClick={() => setIdentityModalSinner(null)}
                style={{ color: '#666', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            {/* 선택 해제 버튼 */}
            {modalSlot && (
              <div style={{ padding: '0.75rem 1.25rem 0' }}>
                <button
                  onClick={() => handleDeselectIdentity(identityModalSinner!)}
                  className="w-full transition-colors hover:bg-[#2a1510]"
                  style={{
                    color: '#c83030',
                    fontSize: '0.8125rem',
                    border: '1px solid #3a1515',
                    borderRadius: '0.25rem',
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    background: 'rgba(200,48,48,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}
                >
                  <X style={{ width: '0.875rem', height: '0.875rem' }} />
                  선택 해제
                </button>
              </div>
            )}

            {/* 인격 그리드 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" style={{ padding: '1rem 1.25rem 1.25rem' }}>
              {modalIdentities.map(ident => {
                const isSelected = modalSlot?.identity_id === ident.id
                const rc = RARITY_COLORS[ident.rarity] ?? RARITY_COLORS[1]
                return (
                  <button
                    key={ident.id}
                    onClick={() => handleSelectIdentity(ident)}
                    className="text-left transition-all"
                    style={{
                      background: isSelected
                        ? 'linear-gradient(160deg, rgba(200,144,10,0.15) 0%, rgba(200,144,10,0.05) 100%)'
                        : 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)',
                      border: `0.09375rem solid ${isSelected ? '#c8900a' : rc.border + '40'}`,
                      borderRadius: '0.375rem',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      boxShadow: isSelected ? `0 0 0.75rem ${rc.glow}` : 'none',
                    }}
                  >
                    {/* 인격 프로필 이미지 */}
                    <div className="relative w-full" style={{ aspectRatio: '2/3', overflow: 'hidden' }}>
                      {ident.game_id && ident.folder_name && (
                        <Image
                          src={getIdentityInfoImageUrl(ident, false)}
                          alt={ident.name_kr}
                          fill
                          className="object-cover object-top"
                          sizes="200px"
                        />
                      )}
                      {/* 등급 별 이미지 오버레이 */}
                      <div className="absolute top-0 left-0 z-10 flex items-center" style={{ padding: '0.25rem' }}>
                        <RarityStars rarity={ident.rarity} />
                      </div>
                      {isSelected && (
                        <div className="absolute inset-0 z-10" style={{ background: 'rgba(200,144,10,0.1)', border: '0.125rem solid #c8900a', borderRadius: '0.25rem' }} />
                      )}
                    </div>
                    {/* 이름 + 키워드 */}
                    <div style={{ padding: '0.375rem 0.5rem 0.5rem' }}>
                      <p className="font-serif truncate" style={{ color: isSelected ? '#e8dcc8' : '#b0a898', fontSize: '0.6875rem', lineHeight: 1.3 }}>
                        {ident.name_kr}
                      </p>
                      {ident.keywords && ident.keywords.length > 0 && (
                        <p className="truncate" style={{ fontSize: '0.5625rem', color: '#555', marginTop: '0.125rem' }}>
                          {ident.keywords.join(' / ')}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── EGO 탭 ── */}
      {subTab === 'ego' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4">
          {sinners.map(sinner => {
            const slot = getSelectedIdentity(sinner.id)
            const sinnerEgos = state.egoSlots.filter(e => e.sinner_id === sinner.id)
            const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
            for (const e of sinnerEgos) egoByGrade[e.grade] = e

            return (
              <div
                key={sinner.id}
                style={{
                  background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                  border: `1px solid ${slot ? '#221a0f' : '#18120a'}`,
                  borderRadius: '0.25rem',
                  overflow: 'hidden',
                  opacity: slot ? 1 : 0.5,
                }}
              >
                {/* 수감자 헤더 */}
                <div className="flex items-center gap-1.5" style={{ padding: '0.375rem 0.5rem', borderBottom: '1px solid #1a1208' }}>
                  <Image
                    src={getSinnerLogoUrl(sinner.id)}
                    alt=""
                    width={14}
                    height={14}
                    style={{ width: '0.875rem', height: '0.875rem', opacity: 0.5 }}
                  />
                  <span className="font-serif font-light truncate" style={{ color: slot ? '#8a7a60' : '#3a2a10', fontSize: '0.5625rem' }}>
                    {sinner.name_kr}
                  </span>
                </div>
                {/* 등급별 EGO 슬롯 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.125rem' }}>
                  {GRADE_ORDER.map(grade => {
                    const ego = egoByGrade[grade]
                    const gc = GRADE_COLORS[grade] ?? '#555'
                    return (
                      <div
                        key={grade}
                        onClick={() => { if (slot) setEgoModalSinner(sinner.id) }}
                        style={{
                          background: ego ? `${gc}1a` : 'rgba(10,8,5,0.7)',
                          border: `1px solid ${ego ? gc + '55' : '#18120a'}`,
                          borderRadius: '0.125rem',
                          padding: '0.25rem 0.3125rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3125rem',
                          minHeight: '1.5rem',
                          cursor: slot ? 'pointer' : 'default',
                        }}
                      >
                        {grade !== 'ALEPH' ? (
                          <Image
                            src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                            alt={grade}
                            width={22}
                            height={11}
                            unoptimized
                            style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}
                          />
                        ) : (
                          <span style={{
                            color: gc,
                            fontSize: '0.375rem',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.08em',
                            opacity: ego ? 0.9 : 0.3,
                            flexShrink: 0,
                          }}>
                            ALEPH
                          </span>
                        )}
                        {ego ? (
                          <span style={{ color: gc, fontSize: '0.5rem', fontWeight: 700, lineHeight: 1.2, flex: 1, textAlign: 'left' }}>
                            {ego.name_kr}
                          </span>
                        ) : (
                          <span style={{ color: '#2a1e10', fontSize: '0.5rem', lineHeight: 1 }}>
                            {slot ? '—' : ''}
                          </span>
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
          {/* EGO 데이터 안내 */}
          <div className="col-span-full mt-4 text-center" style={{ padding: '1rem', background: '#1a1510', borderRadius: '0.25rem', border: '1px solid #222' }}>
            <p style={{ color: '#555', fontSize: '0.75rem' }}>
              EGO 편성 데이터는 page.tsx 쿼리에 추가 필요. 추후 업데이트에서 지원됩니다.
            </p>
          </div>
        </div>
      )}

      {/* ── EGO 선택 모달 (placeholder) ── */}
      {egoModalSinner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(0.5rem)' }}
          onClick={() => setEgoModalSinner(null)}
        >
          <div
            className="relative w-full max-w-2xl mx-4"
            style={{
              background: '#1a1510',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              boxShadow: '0 1rem 3rem rgba(0,0,0,0.8)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #222' }}>
              <span className="font-serif" style={{ color: '#e8dcc8', fontSize: '1rem' }}>
                {sinners.find(s => s.id === egoModalSinner)?.name_kr} - EGO 선택
              </span>
              <button onClick={() => setEgoModalSinner(null)} style={{ color: '#666', cursor: 'pointer', padding: '0.25rem' }}>
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>
            {/* 등급별 섹션 */}
            <div style={{ padding: '1.25rem' }}>
              {GRADE_ORDER.map(grade => {
                const gc = GRADE_COLORS[grade] ?? '#555'
                return (
                  <div key={grade} style={{ marginBottom: '1rem' }}>
                    <div className="flex items-center gap-2 mb-2">
                      {grade !== 'ALEPH' ? (
                        <Image
                          src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                          alt={grade}
                          width={22}
                          height={11}
                          unoptimized
                          style={{ height: '0.75rem', width: 'auto' }}
                        />
                      ) : (
                        <span style={{ color: gc, fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>ALEPH</span>
                      )}
                      <div style={{ flex: 1, height: '1px', background: gc + '30' }} />
                    </div>
                    <div style={{ padding: '0.75rem', background: 'rgba(10,8,5,0.5)', borderRadius: '0.25rem', border: `1px solid ${gc}20` }}>
                      <p style={{ color: '#444', fontSize: '0.75rem', textAlign: 'center' }}>
                        EGO 데이터가 아직 로드되지 않았습니다.
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 스킬셋 탭 ── */}
      {subTab === 'skillset' && (
        <div>
          {state.identitySlots.length === 0 ? (
            <div className="text-center" style={{ padding: '3rem 1rem', color: '#444', fontSize: '0.8125rem' }}>
              인격을 먼저 선택하세요.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {sinners.map(sinner => {
                const slot = getSelectedIdentity(sinner.id)
                if (!slot) return null

                const identData = identityById.get(slot.identity_id)
                const dist = skillDistribution[sinner.id] ?? [3, 2, 1]
                const total = dist[0] + dist[1] + dist[2]
                const isDefault = dist[0] === 3 && dist[1] === 2 && dist[2] === 1
                const isGacksung = gacksungSlots[sinner.id] ?? false

                // Build a fake Identity-like object for getSkillIconUrl
                const identForIcon = identData ? { game_id: identData.game_id, sinner_id: identData.sinner_id } as { game_id: string | null; sinner_id: string } : null

                return (
                  <div key={sinner.id}>
                    {/* 미니 인격 카드 */}
                    <div
                      className="relative w-full"
                      style={{
                        aspectRatio: '2/3',
                        background: 'linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%)',
                        border: `0.09375rem solid ${(RARITY_COLORS[slot.rarity] ?? RARITY_COLORS[1]).border}`,
                        borderRadius: '0.25rem',
                        overflow: 'hidden',
                      }}
                    >
                      {identData && (
                        <Image
                          src={getIdentityInfoImageUrl(identData, isGacksung)}
                          alt={slot.name_kr}
                          fill
                          className="object-cover object-top"
                          sizes="180px"
                        />
                      )}
                      <div
                        className="absolute bottom-0 left-0 right-0 z-10 text-center"
                        style={{
                          background: 'linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%)',
                          paddingTop: '1.25rem',
                          paddingBottom: '0.25rem',
                        }}
                      >
                        <p className="font-serif" style={{ color: '#e8dcc8', fontSize: '0.75rem' }}>{slot.name_kr}</p>
                      </div>
                    </div>

                    {/* 스킬 배분 컨트롤 */}
                    <div style={{
                      marginTop: '0.375rem',
                      background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                      border: `1px solid ${isDefault ? '#221a0f' : 'rgba(200,144,10,0.4)'}`,
                      borderRadius: '0.25rem',
                      padding: '0.375rem',
                    }}>
                      {[0, 1, 2].map(idx => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0' }}>
                          {/* 스킬 아이콘 */}
                          {identForIcon && identForIcon.game_id ? (
                            <Image
                              src={getSkillIconUrl(identForIcon as Parameters<typeof getSkillIconUrl>[0], idx + 1)}
                              alt={`S${idx + 1}`}
                              width={24}
                              height={24}
                              style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.125rem', flexShrink: 0 }}
                            />
                          ) : (
                            <span style={{
                              fontSize: '0.5625rem',
                              color: '#c8900a',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              width: '1.5rem',
                              flexShrink: 0,
                              textAlign: 'center',
                            }}>
                              S{idx + 1}
                            </span>
                          )}
                          <div style={{ flex: 1 }} />
                          <button
                            onClick={() => handleSkillChange(sinner.id, idx, -1)}
                            disabled={dist[idx] <= 0}
                            style={{
                              width: '1.125rem',
                              height: '1.125rem',
                              borderRadius: '0.125rem',
                              background: dist[idx] <= 0 ? 'rgba(10,8,5,0.5)' : 'rgba(200,144,10,0.1)',
                              border: `1px solid ${dist[idx] <= 0 ? '#18120a' : 'rgba(200,144,10,0.3)'}`,
                              color: dist[idx] <= 0 ? '#2a2015' : '#c8900a',
                              fontSize: '0.75rem',
                              cursor: dist[idx] <= 0 ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1,
                              padding: 0,
                            }}
                          >
                            &#x2212;
                          </button>
                          <span style={{
                            width: '1rem',
                            textAlign: 'center',
                            fontSize: '0.8125rem',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color: dist[idx] === 0 ? '#3a2a10' : '#c8900a',
                          }}>
                            {dist[idx]}
                          </span>
                          <button
                            onClick={() => handleSkillChange(sinner.id, idx, 1)}
                            disabled={total >= 6}
                            style={{
                              width: '1.125rem',
                              height: '1.125rem',
                              borderRadius: '0.125rem',
                              background: total >= 6 ? 'rgba(10,8,5,0.5)' : 'rgba(200,144,10,0.1)',
                              border: `1px solid ${total >= 6 ? '#18120a' : 'rgba(200,144,10,0.3)'}`,
                              color: total >= 6 ? '#2a2015' : '#c8900a',
                              fontSize: '0.75rem',
                              cursor: total >= 6 ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1,
                              padding: 0,
                            }}
                          >
                            +
                          </button>
                        </div>
                      ))}
                      {/* 합계 + 프리셋 */}
                      <div style={{
                        borderTop: '1px solid #1a1208',
                        marginTop: '0.25rem',
                        paddingTop: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <span style={{
                          fontSize: '0.5625rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: total === 6 ? '#5a8a40' : '#c83020',
                        }}>
                          {total}/6
                        </span>
                        <div style={{ display: 'flex', gap: '0.125rem' }}>
                          {SKILL_PRESETS.map(preset => {
                            const active = dist[0] === preset[0] && dist[1] === preset[1] && dist[2] === preset[2]
                            return (
                              <button
                                key={preset.join(',')}
                                onClick={() => setSkillDistribution(prev => ({ ...prev, [sinner.id]: preset }))}
                                style={{
                                  fontSize: '0.5rem',
                                  fontFamily: 'var(--font-mono)',
                                  padding: '0.0625rem 0.25rem',
                                  borderRadius: '0.125rem',
                                  background: active ? 'rgba(200,144,10,0.2)' : 'transparent',
                                  border: `1px solid ${active ? 'rgba(200,144,10,0.5)' : '#18120a'}`,
                                  color: active ? '#c8900a' : '#444',
                                  cursor: 'pointer',
                                  lineHeight: 1.4,
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
          )}
        </div>
      )}

      {/* ── 하단: 키워드 차트 + 편성 요약 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8" style={{ borderTop: '1px solid #1a1510', paddingTop: '1.5rem' }}>
        <div>
          <h3 className="font-serif mb-3" style={{ color: '#e8dcc8', fontSize: '1rem' }}>키워드 분포</h3>
          {keywordDist.length > 0 ? (
            <KeywordChart distribution={keywordDist} />
          ) : (
            <p style={{ color: '#444', fontSize: '0.8125rem' }}>인격을 선택하면 키워드 분포가 표시됩니다.</p>
          )}
        </div>
        <div>
          <h3 className="font-serif mb-3" style={{ color: '#e8dcc8', fontSize: '1rem' }}>편성 요약</h3>
          <div className="rounded-lg" style={{ background: '#1a1510', border: '1px solid #222', padding: '1rem' }}>
            <div style={{ color: '#888', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
              선택: {state.identitySlots.length} / 12
            </div>
            {state.identitySlots.length === 0 ? (
              <p style={{ color: '#444', fontSize: '0.75rem' }}>수감자를 클릭하여 인격을 선택하세요.</p>
            ) : (
              <div className="space-y-1">
                {state.identitySlots.map(s => (
                  <div key={s.sinner_id} className="flex items-center justify-between" style={{ fontSize: '0.75rem' }}>
                    <span style={{ color: '#b0a898' }}>{s.name_kr}</span>
                    <RarityStars rarity={s.rarity} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
