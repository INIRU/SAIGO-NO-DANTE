import { normalizeThemeKeyword } from '../constants/keywords'

export const DECK_MAIN_KEYWORDS = ['참격', '관통', '타격', '화상', '파열', '침잠', '호흡', '진동', '충전', '출혈'] as const
export const MAX_DECK_MAIN_KEYWORDS = 5

const DECK_MAIN_KEYWORD_SET = new Set<string>(DECK_MAIN_KEYWORDS)
const DECK_MAIN_KEYWORD_ORDER = new Map<string, number>(
  DECK_MAIN_KEYWORDS.map((keyword, index) => [keyword, index]),
)
const STATUS_KEYWORDS = new Set(['화상', '파열', '침잠', '호흡', '진동', '충전', '출혈'])

export type DeckKeywordSkill = {
  atk_type?: string | null
  skill_type?: string | null
}

export type DeckKeywordIdentity = {
  keywords?: string[] | null
  skill_keyword_list?: string[] | null
  skills?: DeckKeywordSkill[] | null
}

export type DeckKeywordSlot = {
  slot_order?: number | null
  keywords?: string[] | null
  skill_keyword_list?: string[] | null
  skills?: DeckKeywordSkill[] | null
  identities?: DeckKeywordIdentity | DeckKeywordIdentity[] | null
}

export type DeckKeywordCounts = {
  formationCount: number
  counts: Record<string, number>
}

export function normalizeDeckMainKeyword(value: string): string | null {
  const normalized = normalizeThemeKeyword(value.trim())
  return DECK_MAIN_KEYWORD_SET.has(normalized) ? normalized : null
}

export function parseDeckMainKeywordsInput(value: unknown): { value: string[] } | { error: string } {
  if (value === undefined || value === null) return { value: [] }
  if (!Array.isArray(value)) return { error: 'main_keywords must be an array' }

  const keywords: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') return { error: 'main_keywords must contain only strings' }
    const keyword = normalizeDeckMainKeyword(item)
    if (!keyword) return { error: `main_keywords contains unsupported keyword: ${item}` }
    if (seen.has(keyword)) continue
    seen.add(keyword)
    keywords.push(keyword)
  }

  if (keywords.length > MAX_DECK_MAIN_KEYWORDS) {
    return { error: `main_keywords must contain at most ${MAX_DECK_MAIN_KEYWORDS} keywords` }
  }

  return { value: keywords }
}

export function isFormationKeywordSlot(slotOrder: number | null | undefined): boolean {
  return typeof slotOrder === 'number' && slotOrder >= 0 && slotOrder <= 6
}

export function isAssignedKeywordSlot(slotOrder: number | null | undefined): boolean {
  return typeof slotOrder === 'number' && slotOrder >= 0 && slotOrder < 99
}

function getSlotIdentity(slot: DeckKeywordSlot): DeckKeywordIdentity {
  const identity = Array.isArray(slot.identities) ? slot.identities[0] : slot.identities
  return identity ?? slot
}

function computeKeywordCounts(
  slots: readonly DeckKeywordSlot[],
  includeSlot: (slotOrder: number | null | undefined) => boolean,
): DeckKeywordCounts {
  const counts: Record<string, number> = {}
  let formationCount = 0

  for (const slot of slots) {
    if (!includeSlot(slot.slot_order)) continue
    formationCount += 1

    const identity = getSlotIdentity(slot)
    const identityKeywords = new Set<string>()

    for (const rawKeyword of identity.skill_keyword_list ?? []) {
      const normalized = normalizeThemeKeyword(rawKeyword.trim())
      if (!STATUS_KEYWORDS.has(normalized)) continue
      identityKeywords.add(normalized)
    }

    for (const keyword of identityKeywords) {
      counts[keyword] = (counts[keyword] ?? 0) + 1
    }
  }

  return { formationCount, counts }
}

export function computeDeckKeywordCounts(slots: readonly DeckKeywordSlot[]): DeckKeywordCounts {
  return computeKeywordCounts(slots, isFormationKeywordSlot)
}

export function computeDeckMainKeywordsFromSlots(slots: readonly DeckKeywordSlot[], limit = MAX_DECK_MAIN_KEYWORDS): string[] {
  const { formationCount, counts } = computeDeckKeywordCounts(slots)
  if (formationCount === 0) return []

  const minKeywordCount = formationCount <= 1
    ? 1
    : Math.max(2, Math.ceil(formationCount * 0.4))

  return Object.entries(counts)
    .filter(([keyword, count]) => DECK_MAIN_KEYWORD_SET.has(keyword) && count >= minKeywordCount)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return (DECK_MAIN_KEYWORD_ORDER.get(a[0]) ?? Number.MAX_SAFE_INTEGER) -
        (DECK_MAIN_KEYWORD_ORDER.get(b[0]) ?? Number.MAX_SAFE_INTEGER)
    })
    .slice(0, limit)
    .map(([keyword]) => keyword)
}

export function computeFormationGiftKeywordCounts(slots: readonly DeckKeywordSlot[]): Record<string, number> {
  return computeDeckKeywordCounts(slots).counts
}

export function computeAllGiftKeywordCounts(slots: readonly DeckKeywordSlot[]): Record<string, number> {
  return computeKeywordCounts(slots, isAssignedKeywordSlot).counts
}
