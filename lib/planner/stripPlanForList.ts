import { THEME_KEYWORDS, SPECIAL_CHARGE_KEYWORDS, CHARGE_SUB_KEYWORDS } from '@/lib/constants/keywords'
import type { PlanSummary } from '@/components/planner/PlanCard'

const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

export type DeckSlotRaw = {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
  game_id?: string | null
  folder_name?: string | null
  keywords?: string[]
  slot_order?: number
}

export type EgoSlotRaw = {
  ego_id?: string
  sinner_id?: string
  name_kr?: string
  grade?: string
}

export function computeThemeKeywords(deck: DeckSlotRaw[] | null): string[] {
  const formed = (deck ?? []).filter(s => (s.slot_order ?? 99) < 99 && s.keywords)
  const total = formed.length
  if (total === 0) return []

  const freq: Record<string, number> = {}
  for (const slot of formed) {
    const normalized = new Set((slot.keywords ?? []).map(kw => {
      if (SPECIAL_CHARGE_KEYWORDS.has(kw) || CHARGE_SUB_KEYWORDS.has(kw)) return '충전'
      return kw
    }))
    for (const kw of normalized) {
      if (THEME_KW_SET.has(kw)) freq[kw] = (freq[kw] ?? 0) + 1
    }
  }

  const minCount = total <= 1 ? 1 : Math.max(2, Math.ceil(total * 0.4))
  return Object.entries(freq)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kw]) => kw)
}

export function stripPlanForList(plan: Record<string, unknown>): PlanSummary {
  const deck = (plan.deck as DeckSlotRaw[] | null) ?? null
  const egos = (plan.egos as EgoSlotRaw[] | null) ?? null

  const theme_keywords = computeThemeKeywords(deck)
  const identity_names = (deck ?? [])
    .map(s => s.name_kr)
    .filter((n): n is string => Boolean(n))

  // Slim deck: keep only fields needed for portrait grid + owned-identity filter
  const slimDeck = deck?.map(s => ({
    identity_id: s.identity_id,
    sinner_id: s.sinner_id,
    name_kr: s.name_kr,
    game_id: s.game_id,
    folder_name: s.folder_name,
    slot_order: s.slot_order,
  })) ?? null

  // Slim egos: keep only ego_id for owned-ego filter
  const slimEgos = egos?.map(e => ({ ego_id: e.ego_id })) ?? null

  return {
    ...plan,
    deck: slimDeck,
    egos: slimEgos,
    theme_keywords,
    identity_names,
  } as PlanSummary
}
