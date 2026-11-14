'use client'

import { useCallback, useMemo } from 'react'
import { maxObserved, type Observation } from '@/lib/planner/observation'
import type { GiftData, PlannerAction } from '@/lib/planner/types'
import {
  observableGifts,
  observeIdsFromKey,
  observeKeyOf,
  startIdsOf,
} from '@/features/planner/lib/gift-plan-selection'

/** 기프트 탭이 쓰는 관찰·시작 선택 집합과 관찰 토글. 관찰 목록은 observe_ 항목이 바뀔 때만 새로 만든다. */
export function useGiftPlanSelection(
  giftInventory: string[],
  dispatch: React.Dispatch<PlannerAction>,
  gifts: GiftData[],
  observation: Observation,
) {
  const observeKey = observeKeyOf(giftInventory)
  const observeIds = useMemo(() => observeIdsFromKey(observeKey), [observeKey])
  const toggleObserve = useCallback((gift: GiftData) => {
    const key = `observe_${gift.game_id}`
    if (observeIds.has(gift.game_id)) {
      dispatch({ type: 'REMOVE_GIFT', giftId: key })
    } else if (observeIds.size < maxObserved(observation)) {
      dispatch({ type: 'ADD_GIFT', giftId: key })
    }
  }, [dispatch, observeIds, observation])
  const startIds = useMemo(() => startIdsOf(giftInventory), [giftInventory])
  const observeGifts = useMemo(() => observableGifts(gifts, observation), [gifts, observation])

  return { observeIds, startIds, toggleObserve, observeGifts }
}
