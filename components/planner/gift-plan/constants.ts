// Re-export all gift constants from canonical location
export {
  OCTAGON_CLIP,
  GRADE_ROMAN,
  GRADE_COLORS,
  GRADE_ORDER,
  KEYWORD_FILTERS,
  SLUG_TO_KEYWORD,
  STATS_SLUGS,
  GIFT_BG_URL,
  getGiftKeywordIconUrl as getKeywordIconUrl,
  getGiftKeywordSlug as getKeywordSlug,
} from '@/lib/constants/gift'

export { STORAGE_BASE } from '@/lib/constants/game'

export type GiftSubTab = 'observe' | 'start'
