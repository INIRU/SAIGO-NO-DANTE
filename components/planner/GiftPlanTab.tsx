'use client'

import { MAX_OBSERVED_GIFTS, OBSERVATION_GIFT_IDS, observationCost } from '@/lib/planner/observation'
import GiftGrade from '@/components/ui/GiftGrade'

import { GIFT_BG_URL } from '@/lib/constants/gift'

import { getGameUiAsset } from '@/lib/utils/game-ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import type { PlannerState, PlannerAction, GiftData, RecipeData } from '@/lib/planner/types'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import {
  getFinalGiftVariantIds,
  parseFinalGiftIds,
} from '@/lib/planner/fusion'
import { deriveFinalGifts, finalEnhanceEdit } from '@/lib/planner/final-gifts'
import {
  GRADE_ROMAN,
  GRADE_COLORS,
  GRADE_ORDER,
  KEYWORD_FILTERS,
  OCTAGON_CLIP,
  getKeywordIconUrl,
  getKeywordSlug,
} from './gift-plan/constants'
import type { GiftSubTab } from './gift-plan/constants'
import GiftCard, { GiftEnhancePicker } from '@/components/ui/GiftCard'
import GiftGridPanel from './gift-plan/GiftGridPanel'
import SelectedPanel from './gift-plan/SelectedPanel'

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  recipes: RecipeData[]
}

// ── Main component ───────────────────────────────────────────────────────────
export default function GiftPlanTab({ state, dispatch, gifts, giftMap, recipes }: Props) {
  const locale = useLocale()
  const t = useTranslations('planner.giftTab')
  const [subTab, setSubTab] = useState<GiftSubTab>('observe')
  const [finalDragOver, setFinalDragOver] = useState(false)
  const [finalSearch, setFinalSearch] = useState('')
  const [finalFilterKeyword, setFinalFilterKeyword] = useState<string | null>(null)
  const [finalFilterGrade, setFinalFilterGrade] = useState<string | null>(null)
  const getGiftDisplayName = (gift: GiftData) => locale === 'en'
    ? gift.name_en || gift.name
    : locale === 'ja'
      ? gift.name_jp || gift.name
      : gift.name

  const conditionCounts = useMemo(
    () => getGiftConditionCountsForSlots(state.identitySlots),
    [state.identitySlots],
  )

  // 조건 체크: null=충족, {level:'warn',text} = 대기 포함 시 충족, {level:'unmet',text} = 불충족
  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    return getGiftActivationConditionStatus({
      gift,
      ...conditionCounts,
      formatKeywordLabel: keyword => {
        const normalized = normalizeThemeKeyword(keyword)
        const slug = getKeywordSlug(normalized)
        return slug ? keywordLabel(slug) : normalized
      },
    })
  }

  // Parse selected IDs by prefix. 관찰 목록은 observe_ 항목이 바뀔 때만 새로 만든다(최종 기프트를 눌러도 관찰 격자를 다시 그리지 않게)
  const observeKey = state.giftInventory.filter(id => id.startsWith('observe_')).join()
  const observeIds = useMemo(
    () => new Set(observeKey ? observeKey.split(',').map(id => parseInt(id.replace('observe_', ''))) : []),
    [observeKey]
  )
  const toggleObserve = useCallback((gift: GiftData) => {
    const key = `observe_${gift.game_id}`
    if (observeIds.has(gift.game_id)) {
      dispatch({ type: 'REMOVE_GIFT', giftId: key })
    } else if (observeIds.size < MAX_OBSERVED_GIFTS) {
      dispatch({ type: 'ADD_GIFT', giftId: key })
    }
  }, [dispatch, observeIds])
  const startIds = useMemo(
    () => new Set(
      state.giftInventory
        .filter(id => id.startsWith('start_'))
        .map(id => parseInt(id.replace('start_', '')))
    ),
    [state.giftInventory]
  )
  // Stored picks versus the derived final set: picks plus start/observed gifts, minus what a fusion result consumed.
  const storedFinalIds = useMemo(() => parseFinalGiftIds(state.giftInventory), [state.giftInventory])
  const { gifts: finalEntries, consumed: blockedFinalMaterialIds } = useMemo(
    () => deriveFinalGifts(state.giftInventory, recipes, giftMap),
    [giftMap, recipes, state.giftInventory],
  )
  const finalIds = useMemo(() => new Set(finalEntries.map(entry => entry.id)), [finalEntries])
  const finalVisibleIds = finalIds

  const removeFinalGiftVariants = useCallback((giftGameId: number) => {
    for (const giftId of getFinalGiftVariantIds(giftGameId)) {
      dispatch({ type: 'REMOVE_GIFT', giftId })
    }
  }, [dispatch])

  const addFinalGift = useCallback((gift: GiftData) => {
    if (finalIds.has(gift.game_id)) return
    if (blockedFinalMaterialIds.has(gift.game_id)) return
    dispatch({ type: 'ADD_GIFT', giftId: `final_${gift.game_id}` })
  }, [blockedFinalMaterialIds, dispatch, finalIds])

  useEffect(() => {
    if (blockedFinalMaterialIds.size === 0) return

    for (const blockedId of blockedFinalMaterialIds) {
      if (!storedFinalIds.has(blockedId)) continue
      for (const giftId of getFinalGiftVariantIds(blockedId)) {
        dispatch({ type: 'REMOVE_GIFT', giftId })
      }
    }
  }, [blockedFinalMaterialIds, dispatch, storedFinalIds])

  function getGiftsByIds(ids: Set<number>): GiftData[] {
    return Array.from(ids)
      .map(id => giftMap.get(id))
      .filter(Boolean) as GiftData[]
  }

  // Observe: grade 1-3, exclude 잔영
  const filteredFinalSourceGifts = useMemo(() => {
    return gifts.filter(g => {
      if (blockedFinalMaterialIds.has(g.game_id)) return false
      if (finalFilterGrade && g.grade !== finalFilterGrade) return false
      if (finalFilterKeyword) {
        const slug = getKeywordSlug(g.keyword ?? null)
        if (slug !== finalFilterKeyword) return false
      }
      if (finalSearch.trim()) {
        const query = finalSearch.trim().toLocaleLowerCase()
        const displayName = getGiftDisplayName(g).toLocaleLowerCase()
        const koreanName = g.name.toLocaleLowerCase()
        if (!displayName.includes(query) && !koreanName.includes(query)) return false
      }
      return true
    })
  }, [blockedFinalMaterialIds, gifts, finalFilterGrade, finalFilterKeyword, finalSearch, locale])

  const finalGradeGroups = useMemo(() => {
    const groups: Record<string, GiftData[]> = {}
    for (const g of filteredFinalSourceGifts) {
      const grade = g.grade ?? '1'
      if (!groups[grade]) groups[grade] = []
      groups[grade].push(g)
    }
    return groups
  }, [filteredFinalSourceGifts])

  const observeGifts = useMemo(
    // Only what the start observation can actually offer, per the game's observation list.
    () => gifts.filter(g => OBSERVATION_GIFT_IDS.has(g.game_id)),
    [gifts]
  )

  const subTabs: { key: GiftSubTab; label: string; count: number }[] = [
    { key: 'observe', label: t('tabs.observe'), count: observeIds.size },
    { key: 'start', label: t('tabs.start'), count: startIds.size },
    { key: 'final', label: t('tabs.final'), count: finalVisibleIds.size },
  ]
  const keywordLabel = (slug: string | null) => t(`keywords.${slug ?? 'all'}`)

  return (
    <div className="planner-gift-tab" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── Sub-tab bar ─────────────────────────────────────────────────── */}
      <div className="planner-gift-subtabs" style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid #1f1a14',
      }}>
        {subTabs.map(tab => {
          const isActive = subTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className="planner-gift-subtab"
              style={{
                padding: '0.5rem 1.25rem',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? '#c8900a' : 'transparent'}`,
                cursor: 'pointer',
                color: isActive ? '#e8b030' : '#555',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 700 : 400,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                marginBottom: '-1px',
                letterSpacing: '0.02em',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  fontSize: '0.5625rem',
                  background: isActive ? 'rgba(200,144,10,0.2)' : '#1a1510',
                  color: isActive ? '#c8900a' : '#444',
                  border: `1px solid ${isActive ? '#c8900a40' : '#222'}`,
                  borderRadius: '0.75rem',
                  padding: '0 0.375rem',
                  lineHeight: 1.6,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Observe tab ─────────────────────────────────────────────────── */}
      {subTab === 'observe' && (
        <div className="planner-gift-observe" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {/* Info bar */}
          <div className="planner-gift-info-bar" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            padding: '0.5rem 0.625rem',
            background: 'rgba(26,21,16,0.5)',
            borderRadius: '0.375rem',
            border: '1px solid #1f1a14',
          }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {t('observe.cost')}
              <Image
                src={getGameUiAsset('start-buffs/starlight')}
                alt={t('observe.starlightAlt')}
                width={16}
                height={16}
                style={{ width: '1rem', height: '1rem', verticalAlign: 'middle' }}
              />
              <span style={{ color: '#e8b030', fontWeight: 700 }}>{observationCost(observeIds.size)}</span>
            </span>
            <span style={{
              fontSize: '0.6875rem',
              color: observeIds.size >= 3 ? '#dc2626' : '#c8900a',
              background: observeIds.size >= 3 ? 'rgba(220,38,38,0.1)' : 'rgba(200,144,10,0.1)',
              padding: '0.125rem 0.5rem',
              borderRadius: '0.25rem',
              border: `1px solid ${observeIds.size >= 3 ? 'rgba(220,38,38,0.25)' : 'rgba(200,144,10,0.25)'}`,
              fontWeight: 600,
            }}>
              {t('observe.selected', { count: observeIds.size })}
            </span>
            <span style={{ fontSize: '0.625rem', color: '#444' }}>
              {t('observe.gradeRange', { from: GRADE_ROMAN['1'], to: GRADE_ROMAN['3'] })}
            </span>
          </div>

          {/* 3-column layout: sidebar + grid + selected */}
          <div className="planner-gift-observe-layout" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <GiftGridPanel
              gifts={observeGifts}
              selectedIds={observeIds}
              maxSelect={3}
              gradeOrder={GRADE_ORDER}
              onToggle={toggleObserve}
            />
            <SelectedPanel
              title={t('observe.selectedTitle')}
              selectedGifts={getGiftsByIds(observeIds)}
              onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `observe_${gift.game_id}` })}
              badge={
                <span style={{
                  fontSize: '0.5625rem',
                  color: '#c8900a',
                  background: 'rgba(200,144,10,0.12)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  border: '1px solid rgba(200,144,10,0.2)',
                }}>
                  {observeIds.size}/3
                </span>
              }
              footer={
                observeIds.size > 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    paddingTop: '0.375rem',
                    borderTop: '1px solid #1f1a14',
                    fontSize: '0.6875rem',
                    color: '#8a6010',
                  }}>
                    <Image
                      src={getGameUiAsset('start-buffs/starlight')}
                      alt={t('observe.starlightAlt')}
                      width={14}
                      height={14}
                      style={{ width: '0.875rem', height: '0.875rem' }}
                    />
                    {t('observe.starlightCost', { count: observationCost(observeIds.size) })}
                  </div>
                ) : undefined
              }
            />
          </div>
        </div>
      )}

      {/* ── Start tab ───────────────────────────────────────────────────── */}
      {subTab === 'start' && (() => {
        // 시작 기프트 풀 (game_id 기준)
        const START_GIFT_IDS = new Set([
          9009, 9001, 9103, // 화상: 작열우모, 지옥나비의 꿈, 울화통
          9005, 9029, 9108, // 출혈: 상처붙이, 작고 나쁠 인형, 경외심
          9113, 9086, 9044, // 진동: 시큼한 주향, 잔향, 진동형 팔찌
          9117, 9169, 9047, // 파열: 유연 화약, 가시오랏줄, 가시 올가미
          9041, 9054, 9124, // 침잠: 적색 지령, 녹아내린 시계태엽, 장엄
          9051, 9046, 9129, // 호흡: 돌무덤, 물부리, 낡은 목각 인형
          9134, 9043, 9052, // 충전: 순찰용 손전등, 사원증, 휴대용 전지 소켓
          9032, 9194, 9140, // 참격: 꿈을 꾸는 전기양, 짧은 케인 소드, 결의
          9198, 9145, 9030, // 관통: 증명의 깃털, 찢어진 밴돌리어, 수집하는 해골
          9012, 9202, 9150, // 타격: 오늘의 표정, 포켓 암기 노트, 시간 굴레
        ])

        // 가호에서 시작 기프트 추가 선택 수 계산
        // baseId 103(쏟아지는 유성우), 109(완전한 가능성)가 ADDITIONAL_START_EGO_GIFT_SELECT +1
        const BLESSING_START_GIFT_IDS = [103, 109]
        let maxStartGifts = 1 // 기본 1개
        for (const inv of state.giftInventory) {
          if (!inv.startsWith('blessing_')) continue
          const parts = inv.split('_')
          const baseId = parseInt(parts[1])
          if (BLESSING_START_GIFT_IDS.includes(baseId)) maxStartGifts += 1
        }

        const startPool = gifts.filter(g => START_GIFT_IDS.has(g.game_id))
        const KEYWORD_ORDER = ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격']
        const grouped = new Map<string, GiftData[]>()
        for (const kw of KEYWORD_ORDER) grouped.set(kw, [])
        for (const g of startPool) {
          const kw = g.keyword ?? '공통'
          if (!grouped.has(kw)) grouped.set(kw, [])
          grouped.get(kw)!.push(g)
        }

        return (
          <div className="planner-gift-start-layout" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div className="planner-gift-start-main" style={{ flex: 1, minWidth: 0 }}>
              {/* 키워드별 카드 그리드 (게임 UI 스타일) */}
              <div className="planner-gift-start-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: '0.75rem' }}>
                {KEYWORD_ORDER.map(kw => {
                  const kwGifts = grouped.get(kw) ?? []
                  if (kwGifts.length === 0) return null
                  const slug = getKeywordSlug(kw)
                  const iconUrl = slug ? getKeywordIconUrl(slug) : null
                  return (
                    <div key={kw} className="planner-gift-start-group" style={{
                      background: '#1a1510',
                      border: '1px solid #2a2520',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                    }}>
                      {/* 키워드 헤더 */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                        padding: '0.5rem 0.75rem',
                        background: '#12100d',
                        borderBottom: '1px solid #2a2520',
                      }}>
                        {iconUrl && (
                          <Image src={iconUrl} alt="" width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain' }} />
                        )}
                        <span style={{ color: '#e8dcc8', fontSize: '0.8125rem', fontWeight: 600 }}>{keywordLabel(slug)}</span>
                      </div>
                      {/* 기프트 3개 */}
                      <div className="planner-gift-start-card-row" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}>
                        {kwGifts.map(gift => {
                          const isSelected = startIds.has(gift.game_id)
                          return (
                            <button
                              key={gift.id}
                              title={getGiftDisplayName(gift)}
                              aria-label={getGiftDisplayName(gift)}
                              onClick={() => {
                                const key = `start_${gift.game_id}`
                                if (isSelected) {
                                  dispatch({ type: 'REMOVE_GIFT', giftId: key })
                                } else if (startIds.size < maxStartGifts) {
                                  dispatch({ type: 'ADD_GIFT', giftId: key })
                                }
                              }}
                              className="group"
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                                cursor: startIds.size >= maxStartGifts && !isSelected ? 'not-allowed' : 'pointer',
                                opacity: startIds.size >= maxStartGifts && !isSelected ? 0.4 : 1,
                                transition: 'all 0.15s',
                              }}
                            >
                              <div style={{
                                width: '3.5rem', height: '3.5rem',
                                clipPath: OCTAGON_CLIP,
                                backgroundImage: `url(${GIFT_BG_URL})`,
                                backgroundSize: 'contain',
                                position: 'relative',
                                overflow: 'hidden',
                                outline: isSelected ? '2px solid #c8900a' : 'none',
                                outlineOffset: '2px',
                              }}>
                                <GiftGrade grade={gift.grade} style={{
                                  position: 'absolute', top: '4%', left: '5%', zIndex: 10,
                                  fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                                  fontWeight: 700, fontSize: '0.875rem', lineHeight: 1,
                                  color: 'rgb(251,183,46)',
                                  textShadow: '0 0 0.375rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
                                }} />
                                <div style={{ position: 'absolute', inset: '15%' }}>
                                  {gift.image_url?.startsWith('http') && (
                                    <Image src={gift.image_url} alt={getGiftDisplayName(gift)} fill sizes="56px" style={{ objectFit: 'contain' }} />
                                  )}
                                </div>
                                {isSelected && (
                                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(200,144,10,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                                    <span style={{ color: '#e8b030', fontSize: '1.25rem', textShadow: '0 0 0.5rem rgba(0,0,0,0.8)' }}>✓</span>
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: '0.5625rem', color: '#aaa', textAlign: 'center', lineHeight: 1.2, maxWidth: '3.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {getGiftDisplayName(gift)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <SelectedPanel
              title={t('start.selectedTitle')}
              selectedGifts={getGiftsByIds(startIds)}
              onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `start_${gift.game_id}` })}
              badge={
                <span style={{
                  fontSize: '0.5625rem',
                  color: startIds.size >= maxStartGifts ? '#dc2626' : '#c8900a',
                  background: startIds.size >= maxStartGifts ? 'rgba(220,38,38,0.1)' : 'rgba(200,144,10,0.1)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  border: `1px solid ${startIds.size >= maxStartGifts ? 'rgba(220,38,38,0.25)' : 'rgba(200,144,10,0.25)'}`,
                  fontWeight: 600,
                }}>
                  {t('start.selected', { count: startIds.size, max: maxStartGifts })}
                </span>
              }
            />
          </div>
        )
      })()}

      {/* ── Final tab ───────────────────────────────────────────────────── */}
      {subTab === 'final' && (() => {
        // hooks moved to component top level
        const gradeGroups = finalGradeGroups

        const GRADE_OPTIONS = [
          { value: null, label: t('final.all') },
          { value: 'EX', label: 'EX' },
          { value: '5', label: 'Ⅴ' },
          { value: '4', label: 'Ⅳ' },
          { value: '3', label: 'Ⅲ' },
          { value: '2', label: 'Ⅱ' },
          { value: '1', label: 'Ⅰ' },
        ]

        const gradeGroupOrder = ['EX', '5', '4', '3', '2', '1']

        return (
          <div className="planner-gift-final" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* ── Top section: drop zone ──────────────────────────────── */}
            <div
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setFinalDragOver(true) }}
              onDragLeave={() => setFinalDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setFinalDragOver(false)
                const gameId = e.dataTransfer.getData('text/plain')
                const gift = giftMap.get(Number(gameId))
                if (gift) {
                  addFinalGift(gift)
                }
              }}
              className="planner-gift-final-build"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
                padding: '0.625rem',
                background: finalDragOver ? 'rgba(200,144,10,0.07)' : 'rgba(26,21,16,0.4)',
                border: `1px ${finalDragOver ? 'solid' : 'solid'} ${finalDragOver ? '#c8900a' : '#1f1a14'}`,
                borderRadius: '0.5rem',
                boxShadow: finalDragOver ? '0 0 0.75rem rgba(200,144,10,0.25)' : 'none',
                transition: 'all 0.15s',
                minHeight: '6rem',
              }}
            >
              {/* Drop zone header */}
              <div className="planner-gift-final-build-header" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>
                    {t('final.buildTitle')}
                  </span>
                  {finalVisibleIds.size > 0 && (
                    <span style={{
                      fontSize: '0.5625rem',
                      color: '#c8900a',
                      background: 'rgba(200,144,10,0.12)',
                      padding: '0.0625rem 0.375rem',
                      borderRadius: '0.25rem',
                      border: '1px solid rgba(200,144,10,0.2)',
                      fontWeight: 700,
                    }}>
                      {t('final.selectedCount', { count: finalVisibleIds.size })}
                    </span>
                  )}
                </div>
                {finalVisibleIds.size > 0 && (
                  <button
                    onClick={() => {
                      Array.from(storedFinalIds).forEach(id => {
                        removeFinalGiftVariants(id)
                      })
                    }}
                    style={{
                      fontSize: '0.6875rem',
                      color: '#dc2626',
                      background: 'rgba(220,38,38,0.08)',
                      border: '1px solid rgba(220,38,38,0.2)',
                      borderRadius: '0.25rem',
                      padding: '0.125rem 0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.16)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)' }}
                  >
                    {t('final.clearAll')}
                  </button>
                )}
              </div>
              <p className="planner-gift-final-help" style={{ fontSize: '0.625rem', color: '#44403c', marginTop: '-0.25rem' }}>
                {t('final.help')}
              </p>
              {state.identitySlots.length > 0 && finalVisibleIds.size > 0 && (
                <div className="planner-gift-final-condition-legend" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.125rem', fontSize: '0.5625rem' }}>
                  <span style={{ color: '#ef4444' }}>● {t('final.conditionUnmet')}</span>
                  <span style={{ color: '#e8b030' }}>● {t('final.conditionWarn')}</span>
                </div>
              )}

              {/* Drop zone content */}
              {finalVisibleIds.size === 0 ? (
                <div className="planner-gift-final-drop-empty" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '4rem',
                  border: '1px dashed rgba(200,144,10,0.2)',
                  borderRadius: '0.375rem',
                  color: finalDragOver ? '#c8900a' : '#3f3520',
                  fontSize: '0.75rem',
                  transition: 'color 0.15s',
                }}>
                  {t('final.emptyDrop')}
                </div>
              ) : (
                <div className="planner-gift-card-grid planner-gift-final-selected-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))',
                  gap: '0.5rem',
                }}>
                  {finalEntries.map(entry => {
                    const gift = giftMap.get(entry.id)
                    if (!gift) return null
                    const enh = entry.level
                    const canEnh = !!(gift.effect_plus)
                    const setEnh = (level: number) => {
                      const { oldId, newId } = finalEnhanceEdit(state.giftInventory, entry, level)
                      if (oldId && newId) dispatch({ type: 'REPLACE_GIFT', oldId, newId })
                      else if (newId) dispatch({ type: 'ADD_GIFT', giftId: newId })
                      else if (oldId) dispatch({ type: 'REMOVE_GIFT', giftId: oldId })
                    }
                    const cycleEnh = () => {
                      if (!canEnh) return
                      setEnh((enh + 1) % (gift.effect_plusplus ? 3 : 2))
                    }
                    // Start and observed gifts are removed from their own tabs.
                    const removeGift = entry.source === 'final' ? () => removeFinalGiftVariants(gift.game_id) : undefined
                    return (
                      <div key={gift.id} className="min-w-0">
                        <GiftCard
                          gift={gift}
                          isSelected={false}
                          onClick={canEnh ? cycleEnh : () => {}}
                          enhance={canEnh ? enh : undefined}
                          onEnhance={canEnh ? cycleEnh : undefined}
                          onRemove={removeGift}
                          conditionStatus={getConditionStatus(gift)}
                        />
                        {canEnh && <GiftEnhancePicker level={enh} max={gift.effect_plusplus ? 2 : 1} giftName={gift.name} onChange={setEnh} />}
                      </div>
                    )
                  })}
                </div>
              )}

            </div>

            {/* ── Bottom section: full gift list ──────────────────────── */}
            <div className="planner-gift-final-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600 }}>{t('final.listTitle')}</span>

              {/* Search input */}
              <div className="planner-gift-final-search" style={{ position: 'relative' }}>
                <Search
                  size={14}
                  color="#555"
                  style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
                <input
                  type="text"
                  placeholder={t('final.searchPlaceholder')}
                  value={finalSearch}
                  onChange={e => setFinalSearch(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '2rem',
                    paddingRight: '0.75rem',
                    paddingTop: '0.375rem',
                    paddingBottom: '0.375rem',
                    background: '#1a1510',
                    border: '1px solid #2a2520',
                    borderRadius: '0.375rem',
                    color: '#d1d5db',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Keyword filter tabs + grade dropdown */}
              <div className="planner-gift-final-filters" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Scrollable keyword tabs */}
                <div className="planner-gift-final-keywords" style={{
                  display: 'flex',
                  gap: '0.25rem',
                  overflowX: 'auto',
                  flex: 1,
                  paddingBottom: '0.125rem',
                  scrollbarWidth: 'none',
                }}>
                  {KEYWORD_FILTERS.map(tab => {
                    const isActive = finalFilterKeyword === tab.slug
                    const iconUrl = tab.slug ? getKeywordIconUrl(tab.slug) : null
                    return (
                      <button
                        key={tab.slug ?? 'all'}
                        onClick={() => setFinalFilterKeyword(isActive && tab.slug !== null ? null : tab.slug)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          background: isActive ? 'rgba(200,144,10,0.18)' : '#1a1510',
                          border: `1px solid ${isActive ? '#c8900a60' : '#2a2520'}`,
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          color: isActive ? '#e8b030' : '#888',
                          fontSize: '0.6875rem',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'all 0.15s',
                        }}
                      >
                        {iconUrl && (
                          <Image src={iconUrl} alt="" width={12} height={12} style={{ width: '0.75rem', height: '0.75rem', objectFit: 'contain' }} />
                        )}
                        {keywordLabel(tab.slug)}
                      </button>
                    )
                  })}
                </div>

                {/* Grade dropdown */}
                <select
                  value={finalFilterGrade ?? ''}
                  onChange={e => setFinalFilterGrade(e.target.value || null)}
                  className="planner-gift-grade-select"
                  style={{
                    background: '#1a1510',
                    border: '1px solid #2a2520',
                    borderRadius: '0.375rem',
                    color: '#d1d5db',
                    fontSize: '0.6875rem',
                    padding: '0.25rem 0.375rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                    outline: 'none',
                  }}
                >
                  {GRADE_OPTIONS.map(opt => (
                    <option key={opt.value ?? 'all'} value={opt.value ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gift grid (grouped by grade) */}
              <div className="planner-gift-final-grid-scroll" style={{ maxHeight: '35rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {gradeGroupOrder.filter(g => gradeGroups[g]?.length > 0).map(grade => (
                  <div key={grade}>
                    {/* Grade divider */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.375rem',
                    }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: GRADE_COLORS[grade] ?? '#888',
                        fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                      }}>
                        {GRADE_ROMAN[grade]}
                      </span>
                      <div style={{ flex: 1, height: '1px', background: `${GRADE_COLORS[grade] ?? '#333'}40` }} />
                      <span style={{ fontSize: '0.5625rem', color: '#444' }}>{gradeGroups[grade].length}</span>
                    </div>

                    {/* Cards row */}
                    <div className="planner-gift-card-grid planner-gift-final-source-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))',
                      gap: '0.5rem',
                    }}>
                      {gradeGroups[grade].map(gift => {
                        const alreadyAdded = finalIds.has(gift.game_id)
                        return (
                          <div
                            key={gift.id}
                            draggable={!alreadyAdded}
                            onDragStart={e => {
                              e.dataTransfer.setData('text/plain', String(gift.game_id))
                              e.dataTransfer.effectAllowed = 'copy'
                            }}
                            style={{ opacity: alreadyAdded ? 0.3 : 1, transition: 'opacity 0.15s' }}
                          >
                            <GiftCard
                              gift={gift}
                              isSelected={alreadyAdded}
                              onClick={() => {
                                if (!alreadyAdded) {
                                  addFinalGift(gift)
                                }
                              }}
                              disabled={alreadyAdded}
                              conditionStatus={getConditionStatus(gift)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {filteredFinalSourceGifts.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#3f3520', fontSize: '0.75rem', padding: '2rem 0' }}>
                    {t('final.noResults')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
      <style jsx global>{`
        @media (max-width: 767px) {
          .planner-gift-tab {
            gap: 0.875rem !important;
          }

          .planner-gift-subtabs {
            overflow-x: auto;
            scrollbar-width: none;
          }

          .planner-gift-subtabs::-webkit-scrollbar,
          .planner-keyword-sidebar::-webkit-scrollbar,
          .planner-gift-final-keywords::-webkit-scrollbar {
            display: none;
          }

          .planner-gift-subtab {
            min-height: 2.75rem !important;
            padding: 0.625rem 0.875rem !important;
            font-size: 0.9375rem !important;
            white-space: nowrap;
            flex: 0 0 auto;
          }

          .planner-gift-subtab span {
            font-size: 0.75rem !important;
            min-width: 1.5rem;
            text-align: center;
          }

          .planner-gift-info-bar {
            padding: 0.625rem 0.75rem !important;
            gap: 0.5rem !important;
          }

          .planner-gift-info-bar > span {
            font-size: 0.875rem !important;
          }

          .planner-gift-observe-layout,
          .planner-gift-start-layout {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.875rem !important;
          }

          .planner-gift-observe-layout > .planner-selected-panel,
          .planner-gift-start-layout > .planner-selected-panel {
            order: -1 !important;
          }

          .planner-gift-grid-panel {
            flex-direction: column !important;
            width: 100%;
            gap: 0.75rem !important;
          }

          .planner-keyword-sidebar {
            width: 100%;
            max-width: none !important;
            min-width: 0 !important;
            flex-direction: row !important;
            overflow-x: auto;
            gap: 0.375rem !important;
            padding: 0.125rem 0 0.25rem;
            scroll-snap-type: x proximity;
          }

          .planner-keyword-filter {
            min-height: 2.75rem !important;
            min-width: 8.25rem;
            flex: 0 0 auto;
            border: 1px solid #2a2520 !important;
            border-left: 1px solid #2a2520 !important;
            border-bottom: 2px solid transparent !important;
            border-radius: 0.375rem !important;
            padding: 0.5rem 0.625rem !important;
            font-size: 0.9375rem !important;
            scroll-snap-align: start;
          }

          .planner-keyword-filter.is-active {
            border-bottom-color: #c8900a !important;
          }

          .planner-keyword-filter > span:last-child {
            font-size: 0.75rem !important;
            line-height: 1.8 !important;
          }

          .planner-gift-grid-scroll {
            width: 100%;
            max-height: none !important;
            overflow-y: visible !important;
            padding-right: 0 !important;
            gap: 0.875rem !important;
          }

          .planner-gift-card-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            gap: 0.375rem !important;
          }

          .planner-gift-empty {
            padding: 2rem 1rem !important;
            font-size: 0.9375rem !important;
          }

          .planner-selected-panel {
            width: 100%;
            min-width: 0 !important;
            max-width: none !important;
            padding: 0.75rem !important;
          }

          .planner-selected-panel-title {
            font-size: 0.9375rem !important;
          }

          .planner-selected-panel-empty {
            font-size: 0.875rem !important;
          }

          .planner-selected-panel-list {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.375rem !important;
          }

          .planner-selected-gift-row {
            min-width: 0;
            padding: 0.375rem !important;
          }

          .planner-selected-remove {
            width: 1.75rem !important;
            height: 1.75rem !important;
            min-width: 1.75rem;
          }

          .planner-gift-start-main {
            width: 100%;
          }

          .planner-gift-start-grid {
            grid-template-columns: 1fr !important;
            gap: 0.625rem !important;
          }

          .planner-gift-start-card-row {
            justify-content: space-between !important;
            gap: 0.375rem !important;
            padding: 0.75rem 0.625rem !important;
          }

          .planner-gift-start-card-row button {
            min-width: 0;
            min-height: 5.75rem;
            flex: 1 1 0;
          }

          .planner-gift-start-card-row button > span {
            font-size: 0.75rem !important;
            max-width: 5.75rem !important;
            white-space: normal !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .planner-gift-final-build {
            padding: 0.75rem !important;
          }

          .planner-gift-final-build-header,
          .planner-gift-final-filters,
          .planner-gift-final-condition-legend {
            align-items: stretch !important;
            flex-wrap: wrap !important;
          }

          .planner-gift-final-build-header > div {
            flex-wrap: wrap;
          }

          .planner-gift-final-build-header button,
          .planner-gift-grade-select {
            min-height: 2.75rem !important;
            font-size: 0.9375rem !important;
          }

          .planner-gift-final-help,
          .planner-gift-final-drop-empty,
          .planner-gift-final-list > span {
            font-size: 0.875rem !important;
          }

          .planner-gift-final-drop-empty {
            min-height: 5rem !important;
            padding: 0.5rem;
            text-align: center;
          }

          .planner-gift-final-condition-legend {
            gap: 0.375rem !important;
            font-size: 0.75rem !important;
          }

          .planner-gift-final-search input {
            min-height: 2.75rem !important;
            font-size: 1rem !important;
          }

          .planner-gift-final-keywords {
            order: 2;
            flex: 1 0 100% !important;
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            overflow-x: visible !important;
            gap: 0.375rem !important;
            padding-bottom: 0 !important;
          }

          .planner-gift-final-keywords button {
            min-height: 2.75rem !important;
            justify-content: center;
            font-size: 0.875rem !important;
            white-space: normal !important;
          }

          .planner-gift-grade-select {
            width: 100%;
            padding: 0.5rem 0.625rem !important;
          }

          .planner-gift-final-selected-grid,
          .planner-gift-final-source-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            gap: 0.375rem !important;
          }

          .planner-gift-final-grid-scroll {
            max-height: none !important;
            overflow-y: visible !important;
          }

          .planner-gift-quick-adds {
            gap: 0.5rem !important;
          }

          .planner-quick-add-label {
            font-size: 0.875rem !important;
          }

          .planner-quick-add-list {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.375rem !important;
          }

          .planner-quick-add-chip {
            min-width: 0;
            min-height: 2.75rem !important;
            justify-content: flex-start;
            font-size: 0.875rem !important;
          }

          .planner-quick-add-chip > span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }

        @media (max-width: 359px) {
          .planner-gift-card-grid,
          .planner-gift-final-selected-grid,
          .planner-gift-final-source-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  )
}
