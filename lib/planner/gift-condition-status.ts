import { normalizeForStats, normalizeThemeKeyword } from '@/lib/constants/keywords'
import { countGiftConditionAffiliations, normalizeGiftAffiliationLabel } from '@/lib/decks/keyword-rules'
import type { GiftData, IdentityData, IdentitySlot } from '@/lib/planner/types'
import { isDeployedSlot } from '@/lib/constants/game'

/**
 * A gift whose activation condition the formation does not meet. warn: the deployed identities (slots 1-7) fall short
 * but the bench makes up the rest; unmet: short even with the bench. Subjects are the condition's keywords or
 * affiliations in Korean; components/ui/GiftCondition.tsx turns them into the page language.
 */
export type GiftConditionStatus = {
  level: 'warn' | 'unmet'
  kind: 'keyword' | 'affiliation'
  subjects: string[]
  need: number
  formation: number
  all: number
}

/** Stable identity of a status, for memo comparisons and list keys. */
export function giftConditionKey(status: GiftConditionStatus | null | undefined): string {
  return status ? status.level + ':' + status.formation + '/' + status.all + '/' + status.need : ''
}

type GiftConditionIdentity = Pick<IdentitySlot, 'identity_id' | 'slot_order'> &
  Pick<IdentityData, 'keywords' | 'skill_keyword_list' | 'affiliation' | 'association_list'>

type IdentityConditionSource = Partial<IdentityData> & {
  id?: string | null
  identity_id?: string | null
  slot_order?: number | null
}

export type GiftConditionCounts = {
  formationKeywordCounts: Record<string, number>
  allKeywordCounts: Record<string, number>
  formationAffiliationCounts: Record<string, number>
  allAffiliationCounts: Record<string, number>
}

function hasOwnField<T extends object, K extends PropertyKey>(value: T, key: K): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isFormationSlot(slotOrder: number | null | undefined): boolean {
  return isDeployedSlot(slotOrder)
}

function isAssignedSlot(slotOrder: number | null | undefined): boolean {
  return typeof slotOrder === 'number' && slotOrder >= 0 && slotOrder < 99
}

function getIdentityKey(identity: IdentityConditionSource): string | null {
  return identity.identity_id ?? identity.id ?? null
}

function getIdentitySourceMap(identitySource: readonly IdentityConditionSource[] = []): Map<string, IdentityConditionSource> {
  const map = new Map<string, IdentityConditionSource>()
  for (const identity of identitySource) {
    const key = getIdentityKey(identity)
    if (key) map.set(key, identity)
  }
  return map
}

function mergeIdentityConditionData(
  slot: IdentitySlot,
  source: IdentityConditionSource | undefined,
): GiftConditionIdentity {
  const skillKeywordSource = source && hasOwnField(source, 'skill_keyword_list')
    ? source.skill_keyword_list
    : hasOwnField(slot, 'skill_keyword_list')
      ? slot.skill_keyword_list
      : undefined

  return {
    identity_id: slot.identity_id,
    slot_order: slot.slot_order,
    keywords: source?.keywords ?? slot.keywords,
    skill_keyword_list: skillKeywordSource as string[] | null | undefined,
    affiliation: source?.affiliation ?? slot.affiliation ?? null,
    association_list: source?.association_list ?? slot.association_list ?? null,
  }
}

export function enrichIdentitySlotsForGiftConditions(
  slots: readonly IdentitySlot[],
  identitySource: readonly IdentityConditionSource[] = [],
): IdentitySlot[] {
  const sourceMap = getIdentitySourceMap(identitySource)
  return slots.map(slot => {
    const source = sourceMap.get(slot.identity_id)
    if (!source) return slot
    const conditionData = mergeIdentityConditionData(slot, source)
    return {
      ...slot,
      keywords: Array.isArray(conditionData.keywords) ? conditionData.keywords : [],
      skill_keyword_list: conditionData.skill_keyword_list,
      affiliation: conditionData.affiliation,
      association_list: conditionData.association_list,
    }
  })
}

export function getIdentityGiftConditionKeywords(identity: Pick<IdentityData, 'keywords' | 'skill_keyword_list'>): string[] {
  if (hasOwnField(identity, 'skill_keyword_list') && identity.skill_keyword_list !== undefined) {
    return Array.isArray(identity.skill_keyword_list) ? identity.skill_keyword_list : []
  }
  return Array.isArray(identity.keywords) ? identity.keywords : []
}

function addIdentityCounts(
  counts: Record<string, number>,
  values: readonly string[],
  normalize: (value: string) => string,
): void {
  const normalizedValues = new Set<string>()
  for (const rawValue of values) {
    const normalized = normalize(rawValue)
    if (normalized) normalizedValues.add(normalized)
  }
  for (const value of normalizedValues) {
    counts[value] = (counts[value] ?? 0) + 1
  }
}

export function getGiftConditionCountsForSlots(
  slots: readonly IdentitySlot[],
  identitySource: readonly IdentityConditionSource[] = [],
): GiftConditionCounts {
  const sourceMap = getIdentitySourceMap(identitySource)
  const counts: GiftConditionCounts = {
    formationKeywordCounts: {},
    allKeywordCounts: {},
    formationAffiliationCounts: {},
    allAffiliationCounts: {},
  }

  for (const slot of slots) {
    if (!isAssignedSlot(slot.slot_order)) continue
    const identity = mergeIdentityConditionData(slot, sourceMap.get(slot.identity_id))
    const keywords = getIdentityGiftConditionKeywords(identity)
    const affiliations = [
      identity.affiliation,
      ...(identity.association_list ?? []),
    ].filter((value): value is string => Boolean(value))

    addIdentityCounts(counts.allKeywordCounts, keywords, normalizeThemeKeyword)
    addIdentityCounts(counts.allAffiliationCounts, affiliations, normalizeGiftAffiliationLabel)

    if (isFormationSlot(slot.slot_order)) {
      addIdentityCounts(counts.formationKeywordCounts, keywords, normalizeThemeKeyword)
      addIdentityCounts(counts.formationAffiliationCounts, affiliations, normalizeGiftAffiliationLabel)
    }
  }

  return counts
}

export function getGiftActivationConditionStatus({
  gift,
  formationKeywordCounts,
  allKeywordCounts,
  formationAffiliationCounts = {},
  allAffiliationCounts = {},
}: {
  gift: Pick<GiftData, 'activation_condition'>
  formationKeywordCounts: Record<string, number>
  allKeywordCounts: Record<string, number>
  formationAffiliationCounts?: Record<string, number>
  allAffiliationCounts?: Record<string, number>
}): GiftConditionStatus | null {
  const cond = gift.activation_condition
  if (!cond || !cond.count) return null

  let formationHave = 0
  let allHave = 0
  let kind: GiftConditionStatus['kind']
  let subjects: string[]
  const countThemeKeyword = (counts: Record<string, number>, keyword: string): number => {
    const normalizedKeyword = normalizeThemeKeyword(keyword)
    return Object.entries(counts).reduce((sum, [rawKeyword, count]) => (
      normalizeForStats(rawKeyword) === normalizedKeyword ? sum + count : sum
    ), 0)
  }

  if (cond.type === 'keyword' && cond.keyword) {
    formationHave = countThemeKeyword(formationKeywordCounts, cond.keyword)
    allHave = countThemeKeyword(allKeywordCounts, cond.keyword)
    kind = 'keyword'
    subjects = [normalizeThemeKeyword(cond.keyword)]
  } else if (cond.type === 'multi_keyword' && cond.keywords) {
    formationHave = cond.keywords.reduce((sum, kw) => sum + countThemeKeyword(formationKeywordCounts, kw), 0)
    allHave = cond.keywords.reduce((sum, kw) => sum + countThemeKeyword(allKeywordCounts, kw), 0)
    kind = 'keyword'
    subjects = cond.keywords.map(keyword => normalizeThemeKeyword(keyword))
  } else if (cond.type === 'affiliation') {
    const affiliations = cond.affiliations ?? (cond.affiliation ? [cond.affiliation] : [])
    formationHave = countGiftConditionAffiliations(formationAffiliationCounts, affiliations)
    allHave = countGiftConditionAffiliations(allAffiliationCounts, affiliations)
    kind = 'affiliation'
    subjects = affiliations.map(normalizeGiftAffiliationLabel)
  } else {
    return null
  }

  if (formationHave >= cond.count) return null
  return { level: allHave >= cond.count ? 'warn' : 'unmet', kind, subjects, need: cond.count, formation: formationHave, all: allHave }
}
