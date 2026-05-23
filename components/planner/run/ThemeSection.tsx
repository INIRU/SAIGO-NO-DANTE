'use client'

import { useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { ThemeData, GiftData, IdentityData } from '@/lib/planner/types'
import { DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import { getLegacyPlanFloorDifficulty, isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import { getAvailableThemes } from '@/lib/planner/fusion'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import GiftCard from '@/components/ui/GiftCard'
import ThemePackCard from '@/components/ui/ThemePackCard'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  identities: IdentityData[]
}

export default function ThemeSection({ state, dispatch, themes, giftMap, identities }: Props) {
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const currentDifficulty = isFloorDifficulty(currentLog?.difficulty) && isAllowedFloorDifficulty(currentLog.difficulty, state.currentFloor)
    ? currentLog.difficulty
    : getLegacyPlanFloorDifficulty(state.difficulty, state.currentFloor)
  const diffKey = DIFFICULTY_FLOOR_KEY[currentDifficulty]
  const [showGifts, setShowGifts] = useState(true)

  const available = useMemo(
    () => getAvailableThemes(themes, diffKey, state.currentFloor),
    [themes, diffKey, state.currentFloor]
  )

  const ownedSet = useMemo(() => new Set(state.giftInventory.map(Number)), [state.giftInventory])

  const conditionCounts = useMemo(
    () => getGiftConditionCountsForSlots(state.identitySlots, identities),
    [state.identitySlots, identities],
  )

  const selectedTheme = currentLog?.themeId ? themes.find(t => t.id === currentLog.themeId) : null
  const themeGifts = useMemo(() => {
    if (!selectedTheme) return []
    const specificIds = selectedTheme.specific_ego_gift_ids ?? []
    return specificIds.map(id => giftMap.get(id)).filter(Boolean) as GiftData[]
  }, [selectedTheme, giftMap])

  // 조건 체크 (GiftPlanTab 패턴)
  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    return getGiftActivationConditionStatus({ gift, ...conditionCounts })
  }

  // 기프트 정렬: 보유 → 하단
  const sortedGifts = useMemo(() => {
    return [...themeGifts].sort((a, b) => {
      const aOwned = ownedSet.has(a.game_id) ? 1 : 0
      const bOwned = ownedSet.has(b.game_id) ? 1 : 0
      return aOwned - bOwned
    })
  }, [themeGifts, ownedSet])

  return (
    <div>
      {/* 테마팩 선택 — 카드 그리드 (거던 페이지 패턴) */}
      <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem', color: '#999' }}>
        테마팩 선택 ({available.length}개)
      </h3>
      {available.length === 0 ? (
        <p style={{ color: '#555', fontSize: '0.8125rem', padding: '2rem 0' }}>이 층 / 난이도에서 사용 가능한 테마팩이 없습니다</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2" style={{ marginBottom: '1.5rem' }}>
          {available.map(theme => (
            <ThemePackCard
              key={theme.id}
              theme={theme}
              onClick={() => dispatch({ type: 'SET_FLOOR_THEME', themeId: theme.id })}
              isSelected={currentLog?.themeId === theme.id}
              showGiftCount
            />
          ))}
        </div>
      )}

      {/* 선택된 테마 전용 기프트 — GiftCard 사용 */}
      {selectedTheme && sortedGifts.length > 0 && (
        <div>
          <button onClick={() => setShowGifts(!showGifts)} className="flex items-center gap-1" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#c8900a', marginBottom: '0.75rem', minHeight: '2.75rem', padding: '0.5rem 0' }}>
            <Star style={{ width: '0.875rem', height: '0.875rem' }} />
            전용 기프트 ({sortedGifts.length})
            <span style={{ color: '#555', fontSize: '0.6875rem', fontWeight: 400, marginLeft: '0.25rem' }}>{showGifts ? '▲' : '▼'}</span>
          </button>
          {showGifts && (
            <div className="flex flex-wrap gap-2 sm:gap-3" style={{ position: 'relative', zIndex: 0 }}>
              {sortedGifts.map(gift => {
                const owned = ownedSet.has(gift.game_id)
                return (
                  <GiftCard
                    key={gift.game_id}
                    gift={gift}
                    size="4.5rem"
                    isSelected={owned}
                    onClick={() => dispatch({ type: owned ? 'REMOVE_GIFT' : 'ACQUIRE_GIFT', giftId: String(gift.game_id) })}
                    conditionStatus={!owned ? getConditionStatus(gift) : null}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
