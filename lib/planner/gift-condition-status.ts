import { normalizeForStats, normalizeThemeKeyword } from '@/lib/constants/keywords'
import { countGiftConditionAffiliationMembers, countGiftConditionAffiliations, normalizeGiftAffiliationLabel } from '@/lib/decks/keyword-rules'
import type { GiftData, IdentityData, IdentitySlot } from '@/lib/planner/types'
import { isDeployedSlot } from '@/lib/constants/game'

/**
 * A gift whose activation condition the formation does not meet. warn: the deployed identities (slots 1-7) fall short
 * but the bench makes up the rest; unmet: short even with the bench. Subjects are the condition's keywords or
 * affiliations in Korean; components/ui/GiftCondition.tsx turns them into the page language.
 */
export type GiftConditionStatus = {
  level: 'warn' | 'unmet'
  kind: 'keyword' | 'affiliation' | 'skill'
  subjects: string[]
  /** The count of the next unreached tier (the only tier for a plain condition). */
  need: number
  formation: number
  all: number
  /** Tiered conditions (6/8/10/12 or more): how many tiers the deployed identities reach. Absent for a single threshold. */
  tier?: { reached: number; total: number }
  /** Only some effects depend on the condition; the gift's base effect is on whatever the status says. */
  partial?: boolean
}

/** Stable identity of a status, for memo comparisons and list keys. */
export function giftConditionKey(status: GiftConditionStatus | null | undefined): string {
  return status
    ? status.level + ':' + status.formation + '/' + status.all + '/' + status.need
      + (status.tier ? ':t' + status.tier.reached + '/' + status.tier.total : '') + (status.partial ? ':p' : '')
    : ''
}

type GiftConditionIdentity = Pick<IdentitySlot, 'identity_id' | 'slot_order'> &
  Pick<IdentityData, 'keywords' | 'skill_keyword_list' | 'affiliation' | 'association_list' | 'skill_condition_list'>

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
  /** Affiliation -> the identities carrying it; lets an "A or B" condition count each identity once. Absent: counts are summed. */
  formationAffiliationMembers?: Record<string, string[]>
  allAffiliationMembers?: Record<string, string[]>
  /** Skill condition (e.g. 혈찬 소모) -> identity count. Absent when no identity carries skill_condition_list data: the status is then unknown, not unmet. */
  formationSkillCounts?: Record<string, number>
  allSkillCounts?: Record<string, number>
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
    skill_condition_list: source?.skill_condition_list ?? slot.skill_condition_list,
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
      skill_condition_list: conditionData.skill_condition_list,
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
    formationAffiliationMembers: {},
    allAffiliationMembers: {},
  }
  let hasSkillData = false
  const skillCounts = { formation: {} as Record<string, number>, all: {} as Record<string, number> }

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
    const member = String(slot.slot_order)
    const addMember = (target: Record<string, string[]>) => {
      for (const label of new Set(affiliations.map(normalizeGiftAffiliationLabel).filter(Boolean))) (target[label] ??= []).push(member)
    }
    addMember(counts.allAffiliationMembers!)
    const skills = identity.skill_condition_list
    if (Array.isArray(skills)) {
      hasSkillData = true
      addIdentityCounts(skillCounts.all, skills, value => value.trim())
    }

    if (isFormationSlot(slot.slot_order)) {
      addIdentityCounts(counts.formationKeywordCounts, keywords, normalizeThemeKeyword)
      addIdentityCounts(counts.formationAffiliationCounts, affiliations, normalizeGiftAffiliationLabel)
      addMember(counts.formationAffiliationMembers!)
      if (Array.isArray(skills)) addIdentityCounts(skillCounts.formation, skills, value => value.trim())
    }
  }

  if (hasSkillData) {
    counts.formationSkillCounts = skillCounts.formation
    counts.allSkillCounts = skillCounts.all
  }
  return counts
}

/**
 * Whether the formation meets a gift's activation condition; null = on (or nothing to show).
 * - Deployed identities meet it: null. Only the bench makes up the rest: 'warn'. Short even with the bench: 'unmet'.
 * - Deployed count: DEPLOYED_SLOT_COUNT (7). In the game's mirror-dungeon battle data (battle-mirrordungeon participantInfo,
 *   6150 entries) 7 is the most common size (3232) and the largest; smaller battles send 3-6. The other 5 of the 12 sit out
 *   a battle, so only a bench-inclusive count is a warning.
 * - tiers (6/8/10/12 or more): judged against the next tier the deployed identities have not reached; tier tells how many are reached.
 * - affiliations (2 or more) = "A or B": an identity carrying several of them counts once (needs the *Members counts; summed otherwise).
 * - partial: only some effects need the condition; the status stays, flagged, and the base effect is on.
 * - skill (혈찬 소모): needs the *SkillCounts; without them the identities' skill data is unknown and the status is null.
 * - A condition without those fields (an older row) behaves exactly as before.
 */
export function getGiftActivationConditionStatus({
  gift,
  formationKeywordCounts,
  allKeywordCounts,
  formationAffiliationCounts = {},
  allAffiliationCounts = {},
  formationAffiliationMembers,
  allAffiliationMembers,
  formationSkillCounts,
  allSkillCounts,
}: {
  gift: Pick<GiftData, 'activation_condition'>
  formationKeywordCounts: Record<string, number>
  allKeywordCounts: Record<string, number>
  formationAffiliationCounts?: Record<string, number>
  allAffiliationCounts?: Record<string, number>
  formationAffiliationMembers?: Record<string, string[]>
  allAffiliationMembers?: Record<string, string[]>
  formationSkillCounts?: Record<string, number>
  allSkillCounts?: Record<string, number>
}): GiftConditionStatus | null {
  const cond = gift.activation_condition
  if (!cond) return null
  const thresholds = Array.from(new Set(
    (cond.tiers ?? []).map(tier => tier?.count ?? 0).filter(count => count > 0),
  )).sort((a, b) => a - b)
  if (thresholds.length === 0 && cond.count) thresholds.push(cond.count)
  if (thresholds.length === 0) return null

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
    formationHave = formationAffiliationMembers
      ? countGiftConditionAffiliationMembers(formationAffiliationMembers, affiliations)
      : countGiftConditionAffiliations(formationAffiliationCounts, affiliations)
    allHave = allAffiliationMembers
      ? countGiftConditionAffiliationMembers(allAffiliationMembers, affiliations)
      : countGiftConditionAffiliations(allAffiliationCounts, affiliations)
    kind = 'affiliation'
    subjects = affiliations.map(normalizeGiftAffiliationLabel)
  } else if (cond.type === 'skill' && cond.skill_condition && formationSkillCounts && allSkillCounts) {
    const key = cond.skill_condition.trim()
    formationHave = formationSkillCounts[key] ?? 0
    allHave = allSkillCounts[key] ?? 0
    kind = 'skill'
    subjects = [key]
  } else {
    return null
  }

  const reached = thresholds.filter(count => formationHave >= count).length
  if (reached === thresholds.length) return null
  const need = thresholds[reached]
  return {
    level: allHave >= need ? 'warn' : 'unmet',
    kind,
    subjects,
    need,
    formation: formationHave,
    all: allHave,
    ...(thresholds.length > 1 ? { tier: { reached, total: thresholds.length } } : {}),
    ...(cond.partial ? { partial: true } : {}),
  }
}
