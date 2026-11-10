'use client'

import { maxObserved, observationCost, type Observation } from '@/features/planner/lib/observation'
import GiftGrade from '@/components/ui/GiftGrade'

import { GIFT_BG_URL } from '@/lib/constants/gift'

import { getGameUiAsset } from '@/lib/utils/game-ui'
import { useCallback, useMemo, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import type { PlannerState, PlannerAction, GiftData } from '@/lib/planner/types'
import { START_GIFT_IDS } from '@/features/planner/lib/start-gifts'
import {
  GRADE_ROMAN,
  GRADE_ORDER,
  OCTAGON_CLIP,
  getKeywordIconUrl,
  getKeywordSlug,
} from '@/lib/planner/gift-plan-constants'
import type { GiftSubTab } from '@/lib/planner/gift-plan-constants'
import GiftGridPanel from './GiftGridPanel'
import SelectedPanel from './SelectedPanel'

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  /** The current season's start observation (md_observation). */
  observation: Observation
}

// ── Main component ───────────────────────────────────────────────────────────
export default function GiftPlanTab({ state, dispatch, gifts, giftMap, observation }: Props) {
  const locale = useLocale()
  const t = useTranslations('planner.giftTab')
  const tFloor = useTranslations('planner.floorTab')
  const [subTab, setSubTab] = useState<GiftSubTab>('observe')
  const getGiftDisplayName = (gift: GiftData) => locale === 'en'
    ? gift.name_en || gift.name
    : locale === 'ja'
      ? gift.name_jp || gift.name
      : gift.name

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
    } else if (observeIds.size < maxObserved(observation)) {
      dispatch({ type: 'ADD_GIFT', giftId: key })
    }
  }, [dispatch, observeIds, observation])
  const startIds = useMemo(
    () => new Set(
      state.giftInventory
        .filter(id => id.startsWith('start_'))
        .map(id => parseInt(id.replace('start_', '')))
    ),
    [state.giftInventory]
  )
  function getGiftsByIds(ids: Set<number>): GiftData[] {
    return Array.from(ids)
      .map(id => giftMap.get(id))
      .filter(Boolean) as GiftData[]
  }

  const observeGifts = useMemo(
    // Only what the start observation can actually offer, per the game's observation list.
    () => {
      const ids = new Set(observation.giftIds)
      return gifts.filter(g => ids.has(g.game_id))
    },
    [gifts, observation]
  )

  const subTabs: { key: GiftSubTab; label: string; count: number }[] = [
    { key: 'observe', label: t('tabs.observe'), count: observeIds.size },
    { key: 'start', label: t('tabs.start'), count: startIds.size },
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
                borderBottom: `2px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
                cursor: 'pointer',
                color: isActive ? 'var(--gold-light)' : 'var(--text-muted)',
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
                  background: isActive ? 'rgba(200,144,10,0.2)' : 'var(--bg-card)',
                  color: isActive ? 'var(--gold)' : 'var(--text-muted)',
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
              <span style={{ color: 'var(--gold-light)', fontWeight: 700 }}>{observationCost(observation, observeIds.size)}</span>
            </span>
            <span style={{
              fontSize: '0.6875rem',
              color: observeIds.size >= 3 ? '#dc2626' : 'var(--gold)',
              background: observeIds.size >= 3 ? 'rgba(220,38,38,0.1)' : 'rgba(200,144,10,0.1)',
              padding: '0.125rem 0.5rem',
              borderRadius: '0.25rem',
              border: `1px solid ${observeIds.size >= 3 ? 'rgba(220,38,38,0.25)' : 'rgba(200,144,10,0.25)'}`,
              fontWeight: 600,
            }}>
              {t('observe.selected', { count: observeIds.size, max: maxObserved(observation) })}
            </span>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
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
              bandLabel={tFloor('finalAutoObserveTag')}
              selectedGifts={getGiftsByIds(observeIds)}
              onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `observe_${gift.game_id}` })}
              badge={
                <span style={{
                  fontSize: '0.5625rem',
                  color: 'var(--gold)',
                  background: 'rgba(200,144,10,0.12)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  border: '1px solid rgba(200,144,10,0.2)',
                }}>
                  {observeIds.size}/{maxObserved(observation)}
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
                    color: 'var(--gold-dim)',
                  }}>
                    <Image
                      src={getGameUiAsset('start-buffs/starlight')}
                      alt={t('observe.starlightAlt')}
                      width={14}
                      height={14}
                      style={{ width: '0.875rem', height: '0.875rem' }}
                    />
                    {t('observe.starlightCost', { count: observationCost(observation, observeIds.size) })}
                  </div>
                ) : undefined
              }
            />
          </div>
        </div>
      )}

      {/* ── Start tab ───────────────────────────────────────────────────── */}
      {subTab === 'start' && (() => {
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
                      background: 'var(--bg-card)',
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
                        <span style={{ color: 'var(--text-primary)', fontSize: '0.8125rem', fontWeight: 600 }}>{keywordLabel(slug)}</span>
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
                                outline: isSelected ? '2px solid var(--gold)' : 'none',
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
                                    <span style={{ color: 'var(--gold-light)', fontSize: '1.25rem', textShadow: '0 0 0.5rem rgba(0,0,0,0.8)' }}>✓</span>
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
              bandLabel={tFloor('finalAutoStartTag')}
              selectedGifts={getGiftsByIds(startIds)}
              onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `start_${gift.game_id}` })}
              badge={
                <span style={{
                  fontSize: '0.5625rem',
                  color: startIds.size >= maxStartGifts ? '#dc2626' : 'var(--gold)',
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

        /* Tablet width in the stacked layout: more columns instead of five cards stretched to ~8rem each. */
        @media (min-width: 480px) and (max-width: 767px) {
          .planner-gift-card-grid {
            grid-template-columns: repeat(auto-fill, minmax(5rem, 1fr)) !important;
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
