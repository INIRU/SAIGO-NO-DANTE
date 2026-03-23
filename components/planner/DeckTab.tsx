'use client'

import { useMemo, useState, useCallback } from 'react'
import Image from 'next/image'
import { X, Users, Sparkles, SlidersHorizontal } from 'lucide-react'
import { type PlannerState, type PlannerAction, type IdentityData, type SinnerData, type ThemeData, type GiftData, type PassiveData, type SkillSummary, type EgoData } from '@/lib/planner/types'
import { computeKeywordDistribution } from '@/lib/planner/fusion'
import { getIdentityImageUrl, getSinnerLogoUrl, getSkillIconUrl } from '@/lib/utils/images'
import { STORAGE_BASE, RARITY_COLORS, GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS } from '@/lib/constants/sin'
import KeywordChart from './KeywordChart'
import SkillDescription from '@/components/skill/SkillDescription'

type DeckSubTab = 'identity' | 'ego' | 'skillset'

const SUB_TABS: { key: DeckSubTab; label: string; icon: typeof Users }[] = [
  { key: 'identity', label: '인격', icon: Users },
  { key: 'ego', label: 'EGO', icon: Sparkles },
  { key: 'skillset', label: '스킬셋', icon: SlidersHorizontal },
]

const SKILL_PRESETS: [number, number, number][] = [[3, 2, 1], [1, 0, 5], [0, 0, 6]]
const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

const DEFAULT_EGO_NAMES: Record<string, string> = {
  '이상': '오감도',
  '파우스트': '표사 방출기',
  '돈키호테': '라 상그레 산초',
  '료슈': '삼라영삼',
  '뫼르소': '타인의 사슬',
  '홍루': '허환경',
  '이스마엘': '작살박이',
  '오티스': '토 파토스 마토스',
  '그레고르': '어느날 갑자기',
}

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  identities: IdentityData[]
  sinners: SinnerData[]
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  passives: PassiveData[]
  skills: SkillSummary[]
  egos: EgoData[]
}

// --- Rarity star images ---
function RarityStars({ rarity, size = 'md' }: { rarity: number; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 18 : size === 'lg' ? 32 : 24
  return (
    <Image
      src={`${STORAGE_BASE}/icons/Rarity/${rarity}star.webp`}
      alt={`${rarity}성`}
      width={h * rarity}
      height={h}
      style={{ height: `${h / 16}rem`, width: 'auto', objectFit: 'contain' }}
    />
  )
}

export default function DeckTab({ state, dispatch, identities, sinners, passives, skills, egos }: Props) {
  const [subTab, setSubTab] = useState<DeckSubTab>('identity')
  const [gacksungSlots, setGacksungSlots] = useState<Record<string, boolean>>({})
  const [skillDistribution, setSkillDistribution] = useState<Record<string, [number, number, number]>>({})
  const [passiveSubTab, setPassiveSubTab] = useState<'battle' | 'support'>('battle')

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

  // EGO grouped by sinner (grade order within each group)
  const sinnerEgosMap = useMemo(() => {
    const map = new Map<string, EgoData[]>()
    for (const ego of egos) {
      if (!map.has(ego.sinner_id)) map.set(ego.sinner_id, [])
      map.get(ego.sinner_id)!.push(ego)
    }
    for (const [, list] of map) {
      list.sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade))
    }
    return map
  }, [egos])

  // 선택된 인격들의 스킬 죄악 카운트 (공명/보유 조건 계산용)
  const deckSinCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const selectedIds = new Set(state.identitySlots.map(s => s.identity_id))
    for (const skill of skills) {
      if (!selectedIds.has(skill.identity_id)) continue
      if (skill.skill_order > 3) continue // 수비/변형 제외, S1~S3만
      counts[skill.sin_affinity] = (counts[skill.sin_affinity] ?? 0) + 1
    }
    return counts
  }, [state.identitySlots, skills])

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
    // 기본 ZAYIN EGO 자동 선택 (이미 있으면 스킵)
    const hasZayin = state.egoSlots.some(e => e.sinner_id === ident.sinner_id && e.grade === 'ZAYIN')
    if (!hasZayin) {
      const sinnerName = sinners.find(s => s.id === ident.sinner_id)?.name_kr
      const defaultName = sinnerName ? DEFAULT_EGO_NAMES[sinnerName] : undefined
      const defaultEgo = defaultName
        ? egos.find(e => e.sinner_id === ident.sinner_id && (e.name_kr === defaultName || e.name === defaultName))
          ?? egos.find(e => e.sinner_id === ident.sinner_id && e.grade === 'ZAYIN')
        : egos.find(e => e.sinner_id === ident.sinner_id && e.grade === 'ZAYIN')
      if (defaultEgo) {
        dispatch({
          type: 'ADD_EGO',
          slot: { ego_id: defaultEgo.id, sinner_id: ident.sinner_id, name_kr: defaultEgo.name_kr ?? defaultEgo.name, grade: defaultEgo.grade },
        })
      }
    }
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
                        style={{ background: 'rgba(13,11,8,0.5)' }}
                      >
                        <span style={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: 'var(--font-body)', color: isFormation ? '#e8b030' : '#5ab0d0', textShadow: `0 0 0.75rem ${isFormation ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)` }}>
                          {isFormation ? '편성' : '대기'}
                        </span>
                        <span style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-body)', lineHeight: 1, color: isFormation ? '#e8b030' : '#5ab0d0', textShadow: `0 0 1rem ${isFormation ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)`, marginLeft: '0.25rem' }}>
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
            const selectedEgos = state.egoSlots.filter(e => e.sinner_id === sinner.id)
            const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
            for (const e of selectedEgos) egoByGrade[e.grade] = e

            return (
              <div
                key={sinner.id}
                onClick={() => { if (slot) setEgoModalSinner(sinner.id) }}
                style={{
                  background: 'linear-gradient(160deg, #1a1510 0%, #100d08 100%)',
                  border: `1px solid ${slot ? '#221a0f' : '#18120a'}`,
                  borderRadius: '0.25rem',
                  overflow: 'hidden',
                  opacity: slot ? 1 : 0.5,
                  cursor: slot ? 'pointer' : 'default',
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
                        style={{
                          background: ego ? `${gc}1a` : 'rgba(10,8,5,0.7)',
                          border: `1px solid ${ego ? gc + '55' : '#18120a'}`,
                          borderRadius: '0.125rem',
                          padding: '0.25rem 0.3125rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3125rem',
                          minHeight: '1.5rem',
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
        </div>
      )}

      {/* ── EGO 선택 모달 ── */}
      {egoModalSinner && (() => {
        const modalSinnerEgo = sinners.find(s => s.id === egoModalSinner)
        const availableEgos = sinnerEgosMap.get(egoModalSinner) ?? []
        const selectedEgos = state.egoSlots.filter(e => e.sinner_id === egoModalSinner)
        const egoByGrade: Record<string, typeof state.egoSlots[0]> = {}
        for (const e of selectedEgos) egoByGrade[e.grade] = e

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(0.5rem)' }}
            onClick={() => setEgoModalSinner(null)}
          >
            <div
              className="relative w-full max-w-2xl mx-4"
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
                  {modalSinnerEgo && (
                    <Image
                      src={getSinnerLogoUrl(modalSinnerEgo.id)}
                      alt=""
                      width={20}
                      height={20}
                      style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }}
                    />
                  )}
                  <span className="font-serif" style={{ color: '#e8dcc8', fontSize: '1rem' }}>
                    {modalSinnerEgo?.name_kr} - EGO 선택
                  </span>
                </div>
                <button onClick={() => setEgoModalSinner(null)} style={{ color: '#666', cursor: 'pointer', padding: '0.25rem' }}>
                  <X style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
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
                        {selectedForGrade && (
                          <button
                            onClick={() => dispatch({ type: 'REMOVE_EGO', egoId: selectedForGrade.ego_id })}
                            style={{ color: '#c83040', fontSize: '0.625rem', cursor: 'pointer', padding: '0.125rem 0.375rem', border: '1px solid #3a1515', borderRadius: '0.25rem', background: 'rgba(200,48,64,0.08)' }}
                          >
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
                            return (
                              <button
                                key={ego.id}
                                onClick={() => {
                                  dispatch({
                                    type: 'ADD_EGO',
                                    slot: {
                                      ego_id: ego.id,
                                      sinner_id: ego.sinner_id,
                                      name_kr: ego.name_kr ?? ego.name,
                                      grade: ego.grade,
                                    },
                                  })
                                }}
                                className="text-left transition-all"
                                style={{
                                  background: isSelected
                                    ? `linear-gradient(160deg, ${gc}22 0%, ${gc}0d 100%)`
                                    : 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)',
                                  border: `1px solid ${isSelected ? gc + 'aa' : gc + '20'}`,
                                  borderRadius: '0.375rem',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  boxShadow: isSelected ? `0 0 0.625rem ${gc}44` : 'none',
                                }}
                              >
                                {/* EGO 이미지 */}
                                {ego.image_url?.startsWith('http') && (
                                  <div className="relative w-full" style={{ aspectRatio: '1/1', overflow: 'hidden', background: '#0d0b08' }}>
                                    <Image
                                      src={ego.image_url}
                                      alt={ego.name_kr ?? ego.name}
                                      fill
                                      className="object-contain"
                                      sizes="160px"
                                    />
                                  </div>
                                )}
                                {/* EGO 정보 */}
                                <div style={{ padding: '0.375rem 0.5rem 0.5rem' }}>
                                  <p className="font-serif truncate" style={{ color: isSelected ? '#e8dcc8' : '#b0a898', fontSize: '0.625rem', lineHeight: 1.3 }}>
                                    {ego.name_kr ?? ego.name}
                                  </p>
                                  <div className="flex items-center gap-1" style={{ marginTop: '0.25rem' }}>
                                    {ego.sin_affinity && (
                                      <Image
                                        src={`${STORAGE_BASE}/icons/Sins/transparent/${ego.sin_affinity.charAt(0).toUpperCase() + ego.sin_affinity.slice(1)}.webp`}
                                        alt={ego.sin_affinity}
                                        width={14}
                                        height={14}
                                        style={{ width: '0.875rem', height: '0.875rem' }}
                                      />
                                    )}
                                    <span style={{ color: gc, fontSize: '0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.05em' }}>
                                      {grade}
                                    </span>
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
                      {[0, 1, 2].map(idx => {
                        const skillName = skills.find(sk => sk.identity_id === slot.identity_id && sk.skill_order === idx + 1)?.name
                        return (
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
                          {skillName && (
                            <span style={{
                              fontSize: '0.5rem', color: '#8a7a60', flex: 1, minWidth: 0,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {skillName}
                            </span>
                          )}
                          {!skillName && <div style={{ flex: 1 }} />}
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
                        )
                      })}
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

      {/* ── 하단: 키워드 차트 + 패시브 ── */}
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif" style={{ color: '#e8dcc8', fontSize: '1rem' }}>패시브</h3>
            <div className="flex gap-1">
              {(['battle', 'support'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPassiveSubTab(tab)}
                  style={{
                    padding: '0.1875rem 0.625rem',
                    fontSize: '0.75rem',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontWeight: passiveSubTab === tab ? 700 : 400,
                    background: passiveSubTab === tab ? 'rgba(200,144,10,0.15)' : 'transparent',
                    border: `1px solid ${passiveSubTab === tab ? '#c8900a' : '#333'}`,
                    color: passiveSubTab === tab ? '#e8b030' : '#666',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'battle' ? '배틀' : '서포트'}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg" style={{ background: '#1a1510', border: '1px solid #222', padding: '1rem', maxHeight: '20rem', overflowY: 'auto' }}>
            {(() => {
              const selectedIds = new Set(state.identitySlots.map(s => s.identity_id))
              const filtered = passives.filter(
                p => selectedIds.has(p.identity_id) && p.passive_type === passiveSubTab
              )
              if (filtered.length === 0) {
                return (
                  <p style={{ color: '#444', fontSize: '0.75rem' }}>
                    {state.identitySlots.length === 0 ? '인격을 선택하면 패시브가 표시됩니다.' : '해당 패시브가 없습니다.'}
                  </p>
                )
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {filtered.map(p => {
                    const slot = state.identitySlots.find(s => s.identity_id === p.identity_id)
                    const sinTypes = p.sin_affinity ? p.sin_affinity.split(',').map(s => s.trim()) : []
                    const current = sinTypes.reduce((sum, st) => sum + (deckSinCounts[st] ?? 0), 0)
                    const required = p.sin_count ?? 1
                    const isMet = current >= required
                    const isResonance = p.active_cond === 'resonance'
                    const primarySin = sinTypes[0] ?? null
                    const sinCap = primarySin ? primarySin.charAt(0).toUpperCase() + primarySin.slice(1) : null
                    const pc = primarySin ? (SIN_COLORS[primarySin as keyof typeof SIN_COLORS] ?? '#888') : '#888'

                    // S1~S3 스킬 죄악 속성 (해당 인격)
                    const identSkills = skills
                      .filter(sk => sk.identity_id === p.identity_id && sk.skill_order <= 3 && sk.skill_order >= 1)
                      .sort((a, b) => a.skill_order - b.skill_order)
                    // uptie_level 4 우선, 없으면 3
                    const s1 = identSkills.filter(sk => sk.skill_order === 1).sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
                    const s2 = identSkills.filter(sk => sk.skill_order === 2).sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
                    const s3 = identSkills.filter(sk => sk.skill_order === 3).sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0]
                    const skillDots = [s1, s2, s3].filter(Boolean)

                    return (
                      <div
                        key={p.id}
                        style={{
                          borderBottom: '1px solid #222',
                          paddingBottom: '0.5rem',
                          opacity: p.active_cond && !isMet ? 0.6 : 1,
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
                          <span style={{ color: '#e8dcc8', fontSize: '0.8125rem', fontWeight: 700 }}>
                            {p.name}
                          </span>
                          {p.active_cond && (
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
                          {sinCap && (
                            <div className="flex items-center gap-0.5" style={{ flexShrink: 0 }}>
                              <Image
                                src={`${STORAGE_BASE}/icons/Sins/transparent/${sinCap}.webp`}
                                alt={sinCap}
                                width={16}
                                height={16}
                                style={{ width: '1rem', height: '1rem' }}
                              />
                              {p.active_cond && p.sin_count != null ? (
                                <span style={{
                                  fontSize: '0.6875rem',
                                  fontFamily: 'var(--font-mono)',
                                  color: isMet ? '#5a8a40' : '#c83030',
                                  fontWeight: 700,
                                }}>
                                  {current}/{required}
                                </span>
                              ) : p.sin_count != null ? (
                                <span style={{ color: '#888', fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                                  {p.sin_count}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                        {/* 설명 (키워드 툴팁 포함) */}
                        {p.description && (
                          <SkillDescription description={p.description} accentColor={pc} variant="detail" showCoinBadges={false} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
