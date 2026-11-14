'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { buildGiftMap } from '@/lib/planner/fusion'
import { getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import type { GiftData, IdentityData, RecipeData, ThemeData } from '@/lib/planner/types'
import type { EgoGiftTheme, MdEvent, MdEventChoice } from '@/features/mirror-dungeon'
import { getSelectedBlessingCost, getSelectedBlessingLevels, normalizeBlessingMessages } from '../lib/blessing'
import {
  buildConditionSlots, buildEgoGiftLookup, buildGiftByName, buildRecipeMap, buildSlotGiftMap, groupChoicesByEventId, pickFinalGifts, pickInventoryGifts,
} from '../lib/plan-detail-model'

type Input = {
  gifts: GiftData[]
  themes: ThemeData[]
  recipes: RecipeData[]
  identities: IdentityData[]
  events: MdEvent[]
  eventChoices: MdEventChoice[]
  giftInventory: string[]
  /** The plan's identity slots, as the gift condition check reads them. */
  deck: Parameters<typeof buildConditionSlots>[0]
}

/** Everything the plan detail page derives from the catalog and the plan: lookups, gift groups, blessings and the formation's gift conditions. */
export function usePlanDetailModel({ gifts, themes, recipes, identities, events, eventChoices, giftInventory, deck }: Input) {
  const tBlessing = useTranslations('planner.blessingTab')
  const kwContext = useKeywordData()

  // Maps
  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
  const themeMap = useMemo(() => new Map(themes.map(t => [String(t.id), t])), [themes])
  const eventById = useMemo(() => new Map(events.map(event => [event.id, event])), [events])
  const choicesByEventId = useMemo(() => groupChoicesByEventId(eventChoices), [eventChoices])
  const eventThemes = useMemo(() => themes.map(theme => ({ ...theme, id: Number(theme.id) }) as EgoGiftTheme), [themes])

  // 레시피맵
  const giftByName = useMemo(() => buildGiftByName(gifts), [gifts])
  const recipeMap = useMemo(() => buildRecipeMap(recipes, giftByName), [recipes, giftByName])

  // EgoGift lookup for NoteRenderer
  const egoGiftLookup = useMemo(() => buildEgoGiftLookup(gifts), [gifts])

  const allowedKeywords = useMemo(() => new Set(Object.keys(kwContext.keywords)), [kwContext.keywords])
  const localizedBlessings = useMemo(
    () => normalizeBlessingMessages(tBlessing.raw('blessings'), baseId => tBlessing('fallbackName', { baseId })),
    [tBlessing],
  )
  const selectedBlessings = useMemo(
    () => getSelectedBlessingLevels(giftInventory),
    [giftInventory],
  )

  const totalBlessingCost = useMemo(
    () => getSelectedBlessingCost(localizedBlessings, selectedBlessings),
    [localizedBlessings, selectedBlessings],
  )

  // Gift categorization
  const observeGifts = useMemo(() => pickInventoryGifts(giftInventory, 'observe_', giftMap), [giftInventory, giftMap])
  const startGifts = useMemo(() => pickInventoryGifts(giftInventory, 'start_', giftMap), [giftInventory, giftMap])
  const finalGifts = useMemo(() => pickFinalGifts(giftInventory, giftMap), [giftInventory, giftMap])

  // 편성 슬롯 → 최종 기프트 이미지 매핑 (PlanDeckTabs에 전달)
  const slotGiftMap = useMemo(() => buildSlotGiftMap(finalGifts), [finalGifts])

  // Condition checks for final gifts
  const conditionCounts = useMemo(() => getGiftConditionCountsForSlots(buildConditionSlots(deck), identities), [deck, identities])

  return {
    giftMap, themeMap, eventById, choicesByEventId, eventThemes, recipeMap, egoGiftLookup, allowedKeywords,
    localizedBlessings, selectedBlessings, totalBlessingCost, observeGifts, startGifts, finalGifts, slotGiftMap, conditionCounts,
  }
}
