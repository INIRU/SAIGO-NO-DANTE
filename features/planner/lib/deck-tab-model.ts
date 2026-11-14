import { getIdentitySkillDistribution } from '@/lib/planner/types'
import type { EgoData, EgoSlot, IdentityData, IdentitySlot, SinnerData, SkillDistribution, SkillSummary } from '@/lib/planner/types'
import { computeDeckResources, computeSinProduction, fieldedEntries } from '@/lib/decks/deck-analysis'
import { isDeployedSlot } from '@/lib/constants/game'
import { DEFAULT_EGO_NAMES } from '@/lib/decks/default-ego'
import { MANUAL_ATTACK_MAIN_KEYWORDS, MAX_DECK_MAIN_KEYWORDS, type DeckKeywordSlot } from '@/lib/decks/keyword-rules'
import type { PlannerDeckEgo } from '@/features/decks/components/PlannerDeckSelection'

// 덱 탭(DeckTab)이 쓰는 순수 계산. 기능 입구가 내보내는 파일에는 두지 않는다.

/** A formation slot without its order: what the roster keeps, so formation clicks leave it untouched. */
export type RosterSlot = Omit<IdentitySlot, 'slot_order'>

/** Highest-valued skill other than the target that can give one count away; null when none can. */
export const getHighestDonorIndex = (dist: SkillDistribution, targetIdx: number) => {
  let donorIdx: number | null = null
  for (let idx = 0; idx < dist.length; idx++) {
    if (idx === targetIdx || dist[idx] <= 0) continue
    if (donorIdx === null || dist[idx] > dist[donorIdx]) donorIdx = idx
  }
  return donorIdx
}

const getLowestReceiverIndex = (dist: SkillDistribution, targetIdx: number) => {
  let receiverIdx: number | null = null
  for (let idx = 0; idx < dist.length; idx++) {
    if (idx === targetIdx) continue
    if (receiverIdx === null || dist[idx] < dist[receiverIdx]) receiverIdx = idx
  }
  return receiverIdx
}

/** The distribution after moving one count to (delta > 0) or away from (delta < 0) a skill; null when nothing changes. */
export function skillDistributionAfter(dist: SkillDistribution, idx: number, delta: number): SkillDistribution | null {
  const next: SkillDistribution = [dist[0], dist[1], dist[2]]

  if (delta > 0) {
    const donorIdx = getHighestDonorIndex(dist, idx)
    if (dist[idx] >= 6 || donorIdx === null) return null
    next[idx] += 1
    next[donorIdx] -= 1
  } else if (delta < 0) {
    const receiverIdx = getLowestReceiverIndex(dist, idx)
    if (dist[idx] <= 0 || receiverIdx === null) return null
    next[idx] -= 1
    next[receiverIdx] += 1
  } else {
    return null
  }
  return next
}

/** The roster's content key: each slot but its order, in sinner order, one JSON line per slot. */
export function rosterKeyOf(identitySlots: IdentitySlot[], sinners: SinnerData[]) {
  const rank = new Map(sinners.map((sinner, index) => [sinner.id, index]))
  return [...identitySlots]
    .sort((a, b) => (rank.get(a.sinner_id) ?? 99) - (rank.get(b.sinner_id) ?? 99))
    .map(({ slot_order: _order, ...slot }) => JSON.stringify(slot))
    .join('\n')
}

export function rosterFromKey(rosterKey: string): RosterSlot[] {
  return rosterKey ? rosterKey.split('\n').map(line => JSON.parse(line)) : []
}

/** Identities by sinner, highest rarity first. */
export function groupIdentitiesBySinner(identities: IdentityData[]) {
  const map = new Map<string, IdentityData[]>()
  for (const ident of identities) {
    if (!map.has(ident.sinner_id)) map.set(ident.sinner_id, [])
    map.get(ident.sinner_id)!.push(ident)
  }
  for (const [, list] of map) {
    list.sort((a, b) => b.rarity - a.rarity)
  }
  return map
}

/** E.G.O by sinner, in the given grade order. */
export function groupEgosBySinner(egos: EgoData[], gradeOrder: readonly string[]) {
  const map = new Map<string, EgoData[]>()
  for (const ego of egos) {
    if (!map.has(ego.sinner_id)) map.set(ego.sinner_id, [])
    map.get(ego.sinner_id)!.push(ego)
  }
  for (const [, list] of map) {
    list.sort((a, b) => gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade))
  }
  return map
}

/** The slots' skill rows grouped by identity. */
export function groupSkillsByIdentity(skills: SkillSummary[]) {
  const map = new Map<string, SkillSummary[]>()
  for (const skill of skills) (map.get(skill.identity_id) ?? map.set(skill.identity_id, []).get(skill.identity_id)!).push(skill)
  return map
}

/** Slots in the shape the keyword rules read: a slot's own lists first, then its identity's. */
export function deckKeywordSlotsFor(
  identitySlots: IdentitySlot[],
  identityById: Map<string, IdentityData>,
  skillsByIdentity: Map<string, SkillSummary[]>,
): DeckKeywordSlot[] {
  return identitySlots.map(slot => {
    const sourceIdentity = identityById.get(slot.identity_id)
    return {
      slot_order: slot.slot_order,
      identities: {
        skill_keyword_list: slot.skill_keyword_list ?? sourceIdentity?.skill_keyword_list ?? [],
        keywords: slot.keywords ?? sourceIdentity?.keywords ?? [],
        affiliation: slot.affiliation ?? sourceIdentity?.affiliation ?? null,
        association_list: slot.association_list ?? sourceIdentity?.association_list ?? [],
        skills: (skillsByIdentity.get(slot.identity_id) ?? [])
          .map(skill => ({ skill_type: skill.skill_type, atk_type: skill.skill_type })),
      },
    }
  })
}

/** Whether the auto-picked main keywords already equal the stored ones. */
export function sameKeywordList(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((keyword, index) => keyword === b[index])
}

/** Manual main keywords that no longer apply (not an attack type, and no slot has them) dropped. */
export function pruneManualMainKeywords(selected: string[], counts: Record<string, number>) {
  return selected.filter(keyword => (
    MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword) || (counts[keyword] ?? 0) > 0
  ))
}

/** The main keywords after clicking one; null when the click does nothing. Starts from the shown set, and the result is manual. */
export function toggledMainKeywords(keyword: string, counts: Record<string, number>, baseKeywords: string[]): string[] | null {
  const isManualAttackKeyword = MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword)
  if (!isManualAttackKeyword && (counts[keyword] ?? 0) <= 0) return null

  return baseKeywords.includes(keyword)
    ? baseKeywords.filter(item => item !== keyword)
    : baseKeywords.length >= MAX_DECK_MAIN_KEYWORDS
      ? baseKeywords
      : [...baseKeywords, keyword]
}

/** A sinner's chosen E.G.O by grade; one the data does not know is rebuilt from the slot. */
export function egosByGradeFor(egoSlots: EgoSlot[], sinnerId: string, egoById: Map<string, EgoData>) {
  const byGrade: Record<string, PlannerDeckEgo | undefined> = {}
  for (const slot of egoSlots.filter(e => e.sinner_id === sinnerId)) {
    byGrade[slot.grade] = egoById.get(slot.ego_id) ?? {
      id: slot.ego_id,
      sinner_id: slot.sinner_id,
      name_kr: slot.name_kr,
      grade: slot.grade,
      sin_affinity: slot.sin_affinity,
      image_url: null,
      cost: null,
    }
  }
  return byGrade
}

/** The sinner's default ZAYIN E.G.O: the named one when it exists, else the first ZAYIN. */
export function defaultEgoForSinner(egos: EgoData[], sinners: SinnerData[], sinnerId: string) {
  const sinnerName = sinners.find(s => s.id === sinnerId)?.name_kr
  const defaultName = sinnerName ? DEFAULT_EGO_NAMES[sinnerName] : undefined
  return defaultName
    ? egos.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN' && (e.name_kr === defaultName))
      ?? egos.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN')
    : egos.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN')
}

/** The slot an identity pick adds: it keeps the sinner's formation order, and the skill counts when it is the same identity. */
export function pickedIdentitySlot(ident: IdentityData, uptie: number, previous: IdentitySlot | undefined): IdentitySlot {
  const sameIdentity = previous?.identity_id === ident.id
  return {
    identity_id: ident.id,
    sinner_id: ident.sinner_id,
    name_kr: ident.name_kr,
    rarity: ident.rarity,
    keywords: ident.keywords ?? [],
    skill_keyword_list: ident.skill_keyword_list ?? [],
    game_id: ident.game_id,
    folder_name: ident.folder_name,
    slot_order: previous?.slot_order ?? 99,
    ...(sameIdentity ? { s1_count: previous.s1_count, s2_count: previous.s2_count, s3_count: previous.s3_count } : {}),
    ...(uptie === 4 ? {} : { uptie }),
  }
}

/** Resources and sin production under the keyword chart: resources over the whole roster (deployed marked), base sins over the deployed. */
export function deckAnalysisFor(
  roster: RosterSlot[],
  identitySlots: IdentitySlot[],
  egoSlots: EgoSlot[],
  skillsByIdentity: Map<string, SkillSummary[]>,
  egoById: Map<string, EgoData>,
) {
  const deployedSinners = new Set(identitySlots.filter(slot => isDeployedSlot(slot.slot_order)).map(slot => slot.sinner_id))
  const entries = roster.map(slot => ({
    skills: skillsByIdentity.get(slot.identity_id) ?? [],
    distribution: getIdentitySkillDistribution(slot),
    deployed: deployedSinners.has(slot.sinner_id),
    egos: egoSlots.filter(ego => ego.sinner_id === slot.sinner_id).map(ego => ({ cost: egoById.get(ego.ego_id)?.cost })),
  }))
  return { resources: computeDeckResources(entries), baseSinCounts: computeSinProduction(fieldedEntries(entries).map(({ skills }) => ({ skills }))) }
}
