'use client'

import GiftCatalog, { type GiftCatalogFilters } from '@/components/gifts/GiftCatalog'
import type { EgoGift, EgoGiftTheme, Recipe } from '@/components/mirror-dungeon/types'

interface GiftTabProps extends GiftCatalogFilters {
  gifts: EgoGift[]
  themes: EgoGiftTheme[]
  getGiftKeywordIcon: (keyword: string) => string | null
  recipeMap: Map<string, Recipe>
  giftImageMap: Map<string, string>
  onSelectGift: (gift: EgoGift) => void
}

/** Mirror Dungeon gift list. A click opens the gift detail. */
export default function GiftTab({ gifts, themes, getGiftKeywordIcon, onSelectGift, recipeMap: _recipeMap, giftImageMap: _giftImageMap, ...filters }: GiftTabProps) {
  return (
    <GiftCatalog
      gifts={gifts}
      themes={themes}
      getGiftKeywordIcon={getGiftKeywordIcon}
      filters={filters}
      onGiftClick={onSelectGift}
    />
  )
}
