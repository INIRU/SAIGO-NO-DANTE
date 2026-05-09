import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import type { PlanSummary } from '@/components/planner/PlanCard'

const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)
const COMBAT_KEYWORDS = ['slash', 'pierce', 'blunt'] as const
const COMBAT_KEYWORD_ALIASES: Record<string, typeof COMBAT_KEYWORDS[number]> = {
  slash: 'slash',
  '참격': 'slash',
  pierce: 'pierce',
  penetrate: 'pierce',
  '관통': 'pierce',
  blunt: 'blunt',
  hit: 'blunt',
  '타격': 'blunt',
}

export type DeckSlotRaw = {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
  game_id?: string | null
  folder_name?: string | null
  keywords?: string[]
  skill_keyword_list?: string[]
  skill_types?: string[]
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
      return normalizeThemeKeyword(kw)
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

function normalizeFilterKeyword(rawKeyword: string) {
  const keyword = rawKeyword.trim()
  if (!keyword) return null

  const themeKeyword = normalizeThemeKeyword(keyword)
  if (THEME_KW_SET.has(themeKeyword)) return themeKeyword

  return COMBAT_KEYWORD_ALIASES[keyword.toLowerCase()] ?? COMBAT_KEYWORD_ALIASES[keyword] ?? null
}

export function computeFilterKeywords(deck: DeckSlotRaw[] | null): string[] {
  const formed = (deck ?? []).filter(s => (s.slot_order ?? 99) < 99)
  const keywords = new Set<string>()

  for (const slot of formed) {
    for (const rawKeyword of [...(slot.keywords ?? []), ...(slot.skill_keyword_list ?? []), ...(slot.skill_types ?? [])]) {
      const normalized = normalizeFilterKeyword(rawKeyword)
      if (normalized) keywords.add(normalized)
    }
  }

  return [...keywords].sort((a, b) => {
    const aCombat = COMBAT_KEYWORDS.includes(a as typeof COMBAT_KEYWORDS[number])
    const bCombat = COMBAT_KEYWORDS.includes(b as typeof COMBAT_KEYWORDS[number])
    if (aCombat !== bCombat) return aCombat ? -1 : 1
    return a.localeCompare(b)
  })
}

export function stripPlanForList(plan: Record<string, unknown>): PlanSummary {
  const deck = (plan.deck as DeckSlotRaw[] | null) ?? null
  const egos = (plan.egos as EgoSlotRaw[] | null) ?? null

  const theme_keywords = computeThemeKeywords(deck)
  const filter_keywords = computeFilterKeywords(deck)
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
    filter_keywords,
    identity_names,
  } as unknown as PlanSummary
}
