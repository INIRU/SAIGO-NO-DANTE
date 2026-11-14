'use client'

import { useMemo } from 'react'
import { getRootEvents } from '@/lib/utils/event-catalog'
import type { SupportedLang } from '@/lib/i18n/types'
import type { EgoGift, EgoGiftTheme, MdEvent, MdEventChoice, Recipe } from '../types'
import {
  buildGiftSlotMap, countChoicesByEvent, groupChoicesByEvent, indexEventsById, indexGiftImages, indexGiftNames, indexGiftNamesByGameId,
  indexGiftsByGameId, indexRecipesByResult, localizeChoices, localizeEvents, themeGiftNameSet,
} from '../lib/md-data'

/** The mirror dungeon page's lookups over the loaded gifts, packs, events and choices (names in the page language). `giftIdParam` is the gift the address opens. */
export function useMirrorDungeonData({ lang, gifts, recipes, themes, events, choices, selectedThemeId, giftIdParam }: {
  lang: SupportedLang
  gifts: EgoGift[]
  recipes: Recipe[]
  themes: EgoGiftTheme[]
  events: MdEvent[]
  choices: MdEventChoice[]
  selectedThemeId: number | null
  giftIdParam: string
}) {
  const localizedEvents = useMemo(() => localizeEvents(events, lang), [events, lang])
  const localizedChoices = useMemo(() => localizeChoices(choices, lang), [choices, lang])

  // 이벤트 조회 맵 (EventModal + EventTab 공용)
  const eventById = useMemo(() => indexEventsById(localizedEvents), [localizedEvents])
  const choicesByEventId = useMemo(() => groupChoicesByEvent(localizedChoices), [localizedChoices])
  const eventCount = useMemo(() => getRootEvents(events, choicesByEventId).length, [events, choicesByEventId])

  // ThemeModal용 선택지 수 맵 (choices 배열 직접 순회, choicesByEventId 파생)
  const choiceCountByEventId = useMemo(() => countChoicesByEvent(choicesByEventId), [choicesByEventId])

  const selected = useMemo(() => gifts.find(g => String(g.id) === giftIdParam) ?? null, [gifts, giftIdParam])

  // game_id → EgoGift 매핑 (테마팩 필터 + EventTab 공용)
  const giftByGameId = useMemo(() => indexGiftsByGameId(gifts), [gifts])
  // 테마팩별 기프트 이름 Set (GiftTab 필터용)
  const themeGiftNames = useMemo(() => themeGiftNameSet(selectedThemeId, themes, giftByGameId), [selectedThemeId, themes, giftByGameId])
  // game_id → 로컬라이즈된 기프트 이름 (convert_to {0} 치환용)
  const giftNameByGameId = useMemo(() => indexGiftNamesByGameId(gifts, lang), [gifts, lang])
  // 레시피 맵: result_name → Recipe
  const recipeMap = useMemo(() => indexRecipesByResult(recipes), [recipes])
  // 기프트 이름 → 이미지 URL 맵
  const giftImageMap = useMemo(() => indexGiftImages(gifts), [gifts])
  const giftNameMap = useMemo(() => indexGiftNames(gifts, lang), [gifts, lang])
  // 편성 전용 효과 슬롯 번호 파싱 (gift.id → Set<number>)
  const giftSlotMap = useMemo(() => buildGiftSlotMap(gifts), [gifts])

  return {
    localizedEvents, eventById, choicesByEventId, eventCount, choiceCountByEventId, selected, giftByGameId, themeGiftNames,
    giftNameByGameId, recipeMap, giftImageMap, giftNameMap, giftSlotMap,
  }
}
