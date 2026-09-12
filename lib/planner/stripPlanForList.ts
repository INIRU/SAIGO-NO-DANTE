import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import type { PlanSummary } from '@/components/planner/PlanCard'
import { DECK_MAIN_KEYWORDS, computeDeckMainKeywordsFromSlots, normalizeDeckMainKeyword } from '@/lib/decks/keyword-rules'
import {
  getLegacyPlanFloorDifficulty,
  isAllowedFloorDifficulty,
  isFloorDifficulty,
  normalizePlanDifficulty,
  type FloorDifficulty,
} from '@/lib/planner/floor-difficulty'
import type { Difficulty } from '@/lib/planner/types'

const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)
const COMBAT_KEYWORDS = ['참격', '관통', '타격'] as const
const COMBAT_KEYWORD_ORDER = new Map<string, number>(
  COMBAT_KEYWORDS.map((keyword, index) => [keyword, index]),
)
const COMBAT_KEYWORD_ALIASES: Record<string, typeof COMBAT_KEYWORDS[number]> = {
  slash: '참격',
  '참격': '참격',
  pierce: '관통',
  penetrate: '관통',
  '관통': '관통',
  blunt: '타격',
  hit: '타격',
  '타격': '타격',
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

type FloorPlanEntryRaw = {
  constraints?: unknown
  floor?: unknown
  difficulty?: unknown
  theme_id?: unknown
  gift_ids?: unknown
  memo?: unknown
}

const FLOOR_SEGMENTS = [
  { key: '1-5', start: 1, end: 5 },
  { key: '6-10', start: 6, end: 10 },
  { key: '11-15', start: 11, end: 15 },
] as const

export function isConfiguredFloor(entry: FloorPlanEntryRaw) {
  return Boolean(
    entry.theme_id ||
    (Array.isArray(entry.constraints) && entry.constraints.length > 0) ||
    (Array.isArray(entry.gift_ids) && entry.gift_ids.length > 0) ||
    (typeof entry.memo === 'string' && entry.memo.trim())
  )
}

function getFloorNumber(entry: FloorPlanEntryRaw, index: number) {
  return typeof entry.floor === 'number' && Number.isFinite(entry.floor)
    ? Math.floor(entry.floor)
    : index + 1
}

function computeDifficultySummary(floorPlan: unknown, planDifficulty: unknown): PlanSummary['difficulty_summary'] {
  if (!Array.isArray(floorPlan) || floorPlan.length === 0) return undefined

  const normalizedPlanDifficulty = normalizePlanDifficulty(planDifficulty)
  const entries = floorPlan
    .map((entry, index) => ({ entry: (entry ?? {}) as FloorPlanEntryRaw, floor: getFloorNumber((entry ?? {}) as FloorPlanEntryRaw, index) }))
    .filter(({ entry, floor }) => floor >= 1 && floor <= 15 && isConfiguredFloor(entry))

  if (entries.length === 0) return undefined

  const summary: NonNullable<PlanSummary['difficulty_summary']> = []

  for (const segment of FLOOR_SEGMENTS) {
    const counts: Partial<Record<FloorDifficulty, number>> = {}

    for (const { entry, floor } of entries) {
      if (floor < segment.start || floor > segment.end) continue
      const difficulty = isFloorDifficulty(entry.difficulty) && isAllowedFloorDifficulty(entry.difficulty, floor)
        ? entry.difficulty
        : getLegacyPlanFloorDifficulty(normalizedPlanDifficulty, floor)
      counts[difficulty] = (counts[difficulty] ?? 0) + 1
    }

    const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0)
    if (total > 0) {
      summary.push({ key: segment.key, start: segment.start, end: segment.end, counts })
    }
  }

  return summary
}

function extractSelectedMainKeywords(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const selected: string[] = []
  const seen = new Set<string>()
  for (const item of tags) {
    if (typeof item !== 'string') continue
    const keyword = normalizeDeckMainKeyword(item)
    if (!keyword || seen.has(keyword)) continue
    seen.add(keyword)
    selected.push(keyword)
  }
  return selected.sort((a, b) => DECK_MAIN_KEYWORDS.indexOf(a as typeof DECK_MAIN_KEYWORDS[number]) - DECK_MAIN_KEYWORDS.indexOf(b as typeof DECK_MAIN_KEYWORDS[number]))
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

export function normalizePlannerListKeyword(rawKeyword: string) {
  const keyword = rawKeyword.trim()
  if (!keyword) return null

  const themeKeyword = normalizeThemeKeyword(keyword)
  if (THEME_KW_SET.has(themeKeyword)) return themeKeyword

  return COMBAT_KEYWORD_ALIASES[keyword.toLowerCase()] ?? COMBAT_KEYWORD_ALIASES[keyword] ?? null
}

export function normalizePlannerListKeywords(rawKeywords: readonly string[]) {
  const keywords: string[] = []
  const seen = new Set<string>()

  for (const rawKeyword of rawKeywords) {
    const keyword = normalizePlannerListKeyword(rawKeyword)
    if (!keyword || seen.has(keyword)) continue
    seen.add(keyword)
    keywords.push(keyword)
  }

  return keywords
}

export function computeFilterKeywords(deck: DeckSlotRaw[] | null): string[] {
  const formed = (deck ?? []).filter(s => (s.slot_order ?? 99) < 99)
  const keywords = new Set<string>()

  for (const slot of formed) {
    for (const rawKeyword of [...(slot.keywords ?? []), ...(slot.skill_keyword_list ?? []), ...(slot.skill_types ?? [])]) {
      const normalized = normalizePlannerListKeyword(rawKeyword)
      if (normalized) keywords.add(normalized)
    }
  }

  return [...keywords].sort((a, b) => {
    const aCombat = COMBAT_KEYWORD_ORDER.has(a)
    const bCombat = COMBAT_KEYWORD_ORDER.has(b)
    if (aCombat !== bCombat) return aCombat ? -1 : 1
    if (aCombat && bCombat) return (COMBAT_KEYWORD_ORDER.get(a) ?? 99) - (COMBAT_KEYWORD_ORDER.get(b) ?? 99)
    return a.localeCompare(b)
  })
}

export function stripPlanForList(plan: Record<string, unknown>): PlanSummary {
  const deck = (plan.deck as DeckSlotRaw[] | null) ?? null
  const egos = (plan.egos as EgoSlotRaw[] | null) ?? null

  const theme_keywords = computeThemeKeywords(deck)
  const filter_keywords = computeFilterKeywords(deck)
  const savedSelectedKeywords = extractSelectedMainKeywords(plan.tags)
  const selected_keywords = savedSelectedKeywords.length > 0
    ? savedSelectedKeywords
    : computeDeckMainKeywordsFromSlots(deck ?? [])
  const difficulty_summary = computeDifficultySummary(plan.floor_plan, plan.difficulty as Difficulty)
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
    selected_keywords,
    difficulty_summary,
    identity_names,
  } as unknown as PlanSummary
}
