'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import type { PlannerState, PlannerAction, ThemeData, GiftData } from '@/lib/planner/types'
import { DIFFICULTY_CONFIG, DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import { getAvailableThemes, getGiftsFromThemes, computeKeywordDistribution } from '@/lib/planner/fusion'

interface FloorTabProps {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
}

export default function FloorTab({ state, dispatch, themes, gifts, giftMap }: FloorTabProps) {
  const [openFloor, setOpenFloor] = useState<number | null>(null)

  const floorCount = DIFFICULTY_CONFIG[state.difficulty].floors
  const diffKey = DIFFICULTY_FLOOR_KEY[state.difficulty]

  const themeMap = useMemo(() => new Map(themes.map(t => [t.id, t])), [themes])

  const selectedThemes = state.floorPlan.map(f => f.theme_id)
  const accumulatedGifts = useMemo(
    () => getGiftsFromThemes(selectedThemes, themes, giftMap),
    [selectedThemes, themes, giftMap]
  )

  const keywordDistribution = useMemo(() => {
    const giftKeywords = accumulatedGifts
      .filter(g => g.keyword)
      .map(g => [g.keyword as string])
    return computeKeywordDistribution(giftKeywords)
  }, [accumulatedGifts])

  function selectTheme(floor: number, themeId: string | null) {
    dispatch({ type: 'SET_FLOOR_THEME', floor, themeId })
    setOpenFloor(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {state.floorPlan.map((entry, idx) => {
          const availableThemes = getAvailableThemes(themes, diffKey, entry.floor)
          const selectedTheme = entry.theme_id ? themeMap.get(entry.theme_id) : null
          const isOpen = openFloor === entry.floor
          const giftCount = selectedTheme
            ? ((selectedTheme.ego_gift_ids?.length ?? 0) + (selectedTheme.specific_ego_gift_ids?.length ?? 0))
            : 0

          return (
            <div key={entry.floor} style={{ display: 'flex', gap: '0.75rem' }}>
              {/* Timeline spine */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '1.5rem', flexShrink: 0 }}>
                {/* Node */}
                <div style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  borderRadius: '50%',
                  background: selectedTheme ? '#c8900a' : '#1a1510',
                  border: `2px solid ${selectedTheme ? '#c8900a' : '#333'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '0.625rem',
                  color: selectedTheme ? '#0d0b08' : '#6b7280',
                  fontWeight: 700,
                  zIndex: 1,
                }}>
                  {entry.floor}
                </div>
                {/* Connector line */}
                {idx < floorCount - 1 && (
                  <div style={{
                    width: '2px',
                    flex: 1,
                    minHeight: '1.5rem',
                    background: '#222',
                    margin: '0.125rem 0',
                  }} />
                )}
              </div>

              {/* Floor card */}
              <div style={{ flex: 1, paddingBottom: idx < floorCount - 1 ? '0.5rem' : 0 }}>
                <div style={{
                  background: '#1a1510',
                  border: `1px solid ${isOpen ? '#c8900a' : '#222'}`,
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}>
                  {/* Floor header */}
                  <button
                    onClick={() => setOpenFloor(isOpen ? null : entry.floor)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.625rem 0.75rem',
                      background: 'transparent',
                      border: 'none',
                      cursor: availableThemes.length > 0 ? 'pointer' : 'default',
                      textAlign: 'left',
                      color: '#e5e7eb',
                    }}
                  >
                    {/* Selected theme preview */}
                    {selectedTheme ? (
                      <>
                        {selectedTheme.image_url && (
                          <Image
                            src={selectedTheme.image_url}
                            alt={selectedTheme.name}
                            width={28}
                            height={49}
                            style={{ width: '1.75rem', height: '3.0625rem', objectFit: 'cover', borderRadius: '0.25rem', flexShrink: 0 }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e8b030', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {selectedTheme.name}
                          </div>
                          {giftCount > 0 && (
                            <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                              기프트 {giftCount}종
                            </div>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); selectTheme(entry.floor, null) }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            color: '#6b7280',
                            flexShrink: 0,
                          }}
                          title="선택 해제"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <div style={{ flex: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                        {availableThemes.length > 0
                          ? `${entry.floor}층 테마팩 선택... (${availableThemes.length}개)`
                          : `${entry.floor}층 — 해당 없음`}
                      </div>
                    )}
                    {availableThemes.length > 0 && (
                      isOpen
                        ? <ChevronUp size={14} color="#6b7280" style={{ flexShrink: 0 }} />
                        : <ChevronDown size={14} color="#6b7280" style={{ flexShrink: 0 }} />
                    )}
                  </button>

                  {/* Theme selector dropdown */}
                  {isOpen && availableThemes.length > 0 && (
                    <div style={{
                      borderTop: '1px solid #222',
                      maxHeight: '16rem',
                      overflowY: 'auto',
                    }}>
                      {availableThemes.map(theme => {
                        const tGiftCount = (theme.ego_gift_ids?.length ?? 0) + (theme.specific_ego_gift_ids?.length ?? 0)
                        const isSelected = entry.theme_id === theme.id
                        return (
                          <button
                            key={theme.id}
                            onClick={() => selectTheme(entry.floor, theme.id)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.625rem',
                              padding: '0.5rem 0.75rem',
                              background: isSelected ? 'rgba(200,144,10,0.12)' : 'transparent',
                              border: 'none',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: '#e5e7eb',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                          >
                            {theme.image_url ? (
                              <Image
                                src={theme.image_url}
                                alt={theme.name}
                                width={24}
                                height={42}
                                style={{ width: '1.5rem', height: '2.625rem', objectFit: 'cover', borderRadius: '0.125rem', flexShrink: 0 }}
                              />
                            ) : (
                              <div style={{ width: '1.5rem', height: '2.625rem', background: '#222', borderRadius: '0.125rem', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {theme.name}
                              </div>
                              {tGiftCount > 0 && (
                                <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.0625rem' }}>
                                  기프트 {tGiftCount}종
                                </div>
                              )}
                            </div>
                            {theme.boss_image_url && (
                              <Image
                                src={theme.boss_image_url}
                                alt="보스"
                                width={32}
                                height={36}
                                style={{ width: '2rem', height: '2.25rem', objectFit: 'contain', flexShrink: 0, opacity: 0.7 }}
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Accumulated keyword chart */}
      {keywordDistribution.length > 0 && (
        <div style={{
          background: '#1a1510',
          border: '1px solid #222',
          borderRadius: '0.5rem',
          padding: '0.875rem 1rem',
        }}>
          <div style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
            누적 기프트 키워드 분포
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {keywordDistribution.slice(0, 10).map(({ keyword, count }) => {
              const max = keywordDistribution[0].count
              return (
                <div key={keyword} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#e5e7eb', width: '4rem', flexShrink: 0 }}>
                    {keyword}
                  </span>
                  <div style={{ flex: 1, height: '0.375rem', background: '#222', borderRadius: '0.25rem', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(count / max) * 100}%`,
                      background: '#c8900a',
                      borderRadius: '0.25rem',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#8a6010', width: '1.5rem', textAlign: 'right', flexShrink: 0 }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '0.625rem', fontSize: '0.6875rem', color: '#4b5563' }}>
            총 {accumulatedGifts.length}개 기프트
          </div>
        </div>
      )}
    </div>
  )
}
