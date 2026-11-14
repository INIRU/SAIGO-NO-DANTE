import { normalizeThemeKeyword } from '../constants/keywords'
import { isDeployedSlot } from '@/lib/constants/game'

export const DECK_MAIN_KEYWORDS = ['참격', '관통', '타격', '화상', '파열', '침잠', '호흡', '진동', '충전', '출혈'] as const
export const MAX_DECK_MAIN_KEYWORDS = 5
/** The attack types a main keyword may be set to by hand even before any skill of the deck uses them. */
export const MANUAL_ATTACK_MAIN_KEYWORDS = new Set<string>(['참격', '관통', '타격'])

const DECK_MAIN_KEYWORD_SET = new Set<string>(DECK_MAIN_KEYWORDS)
const DECK_MAIN_KEYWORD_ORDER = new Map<string, number>(
  DECK_MAIN_KEYWORDS.map((keyword, index) => [keyword, index]),
)
/** Status keywords: the ones a formation can be a keyword deck of. */
export const KEYWORD_DECK_KEYWORDS = ['화상', '파열', '침잠', '호흡', '진동', '충전', '출혈'] as const
const STATUS_KEYWORDS = new Set<string>(KEYWORD_DECK_KEYWORDS)

type DeckKeywordSkill = {
  atk_type?: string | null
  skill_type?: string | null
}

type DeckKeywordIdentity = {
  keywords?: string[] | null
  skill_keyword_list?: string[] | null
  affiliation?: string | null
  association_list?: string[] | null
  skills?: DeckKeywordSkill[] | null
}

export type DeckKeywordSlot = {
  slot_order?: number | null
  keywords?: string[] | null
  skill_keyword_list?: string[] | null
  skills?: DeckKeywordSkill[] | null
  identities?: DeckKeywordIdentity | DeckKeywordIdentity[] | null
}

type DeckKeywordCounts = {
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

function isFormationKeywordSlot(slotOrder: number | null | undefined): boolean {
  return isDeployedSlot(slotOrder)
}

function isAssignedKeywordSlot(slotOrder: number | null | undefined): boolean {
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

/** Players call a formation a keyword deck once five deployed identities share that status keyword. */
const KEYWORD_DECK_MIN_IDENTITIES = 5

/** Keywords that make this formation a keyword deck, in DECK_MAIN_KEYWORDS order. Empty = mixed. */
export function computeKeywordDeckCombo(slots: readonly DeckKeywordSlot[]): string[] {
  return Object.entries(computeDeckKeywordCounts(slots).counts)
    .filter(([, count]) => count >= KEYWORD_DECK_MIN_IDENTITIES)
    .map(([keyword]) => keyword)
    .sort((a, b) => (DECK_MAIN_KEYWORD_ORDER.get(a) ?? 99) - (DECK_MAIN_KEYWORD_ORDER.get(b) ?? 99))
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

export function normalizeGiftAffiliationLabel(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—•·:：]+/, '')
    .trim()
}

export function getDeckIdentityAffiliations(identity: DeckKeywordIdentity | null | undefined): string[] {
  if (!identity) return []
  const affiliations = new Set<string>()
  const add = (value: string | null | undefined) => {
    if (!value) return
    const normalized = normalizeGiftAffiliationLabel(value)
    if (normalized) affiliations.add(normalized)
  }
  add(identity.affiliation)
  for (const affiliation of identity.association_list ?? []) add(affiliation)
  return Array.from(affiliations)
}

function computeAffiliationCounts(
  slots: readonly DeckKeywordSlot[],
  includeSlot: (slotOrder: number | null | undefined) => boolean,
): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const slot of slots) {
    if (!includeSlot(slot.slot_order)) continue
    for (const affiliation of getDeckIdentityAffiliations(getSlotIdentity(slot))) {
      counts[affiliation] = (counts[affiliation] ?? 0) + 1
    }
  }

  return counts
}

export function computeFormationGiftAffiliationCounts(slots: readonly DeckKeywordSlot[]): Record<string, number> {
  return computeAffiliationCounts(slots, isFormationKeywordSlot)
}

export function computeAllGiftAffiliationCounts(slots: readonly DeckKeywordSlot[]): Record<string, number> {
  return computeAffiliationCounts(slots, isAssignedKeywordSlot)
}

/** The count keys a condition's affiliations match (each key once: an exact label wins over fuzzy suffix matches). */
function matchGiftAffiliationKeys(keys: readonly string[], rawAffiliations: readonly string[]): string[] {
  const used = new Set<string>()
  for (const rawAffiliation of rawAffiliations) {
    const affiliation = normalizeGiftAffiliationLabel(rawAffiliation)
    if (keys.includes(affiliation)) {
      used.add(affiliation)
      continue
    }
    for (const key of keys) {
      if (used.has(key)) continue
      if (affiliation.endsWith(key) || affiliation.includes(` ${key}`)) used.add(key)
    }
  }
  return Array.from(used)
}

/** Sums the matched keys' counts. An identity with two of the listed affiliations counts twice: use the Members form for "A or B". */
export function countGiftConditionAffiliations(
  counts: Record<string, number>,
  rawAffiliations: readonly string[],
): number {
  return matchGiftAffiliationKeys(Object.keys(counts), rawAffiliations).reduce((sum, key) => sum + counts[key], 0)
}

/** Affiliation -> the slots (by array index) that carry it; for "A or B" conditions where one identity counts once. */
function computeAffiliationMembers(
  slots: readonly DeckKeywordSlot[],
  includeSlot: (slotOrder: number | null | undefined) => boolean,
): Record<string, string[]> {
  const members: Record<string, string[]> = {}
  slots.forEach((slot, index) => {
    if (!includeSlot(slot.slot_order)) return
    for (const affiliation of getDeckIdentityAffiliations(getSlotIdentity(slot))) {
      ;(members[affiliation] ??= []).push(String(index))
    }
  })
  return members
}

export function computeFormationGiftAffiliationMembers(slots: readonly DeckKeywordSlot[]): Record<string, string[]> {
  return computeAffiliationMembers(slots, isFormationKeywordSlot)
}

export function computeAllGiftAffiliationMembers(slots: readonly DeckKeywordSlot[]): Record<string, string[]> {
  return computeAffiliationMembers(slots, isAssignedKeywordSlot)
}

/** Identities carrying any of the condition's affiliations, each once. */
export function countGiftConditionAffiliationMembers(
  members: Record<string, readonly string[]>,
  rawAffiliations: readonly string[],
): number {
  const ids = new Set<string>()
  for (const key of matchGiftAffiliationKeys(Object.keys(members), rawAffiliations)) {
    for (const id of members[key]) ids.add(id)
  }
  return ids.size
}
