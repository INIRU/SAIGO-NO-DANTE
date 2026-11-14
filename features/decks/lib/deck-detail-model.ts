import { SINNER_SLUGS, STORAGE_BASE, isDeployedSlot } from '@/lib/constants/game'
import { sinColorOf } from '@/lib/constants/sin'
import { THEME_KEYWORDS, normalizeThemeKeyword } from '@/lib/constants/keywords'
import { normalizeSin } from '@/lib/constants/sin'
import { computeSkillImageIndices, getIdentityImageUrl, getIdentityPortraitUrl, getSkillIconUrl } from '@/lib/utils/images'
import { skillSlot } from '@/lib/identity/skill-model'
import type { Identity, Skill } from '@/lib/types'
import type { EgoEntry, IdentityDetail, IdentitySlot } from '@/lib/decks/identity-types'
import { computeDeckResources, computeSinProduction, fieldedEntries } from '@/lib/decks/deck-analysis'
import {
  computeAllGiftAffiliationCounts, computeAllGiftAffiliationMembers, computeAllGiftKeywordCounts, computeFormationGiftAffiliationCounts,
  computeFormationGiftAffiliationMembers, computeFormationGiftKeywordCounts, normalizeDeckMainKeyword, type DeckKeywordSlot,
} from '@/lib/decks/keyword-rules'
import { getGiftActivationConditionStatus } from '@/lib/planner/gift-condition-status'
import type { GiftData } from '@/lib/planner/types'
import type { DeckInsightIdentity } from '../components/DeckInsights'
import type { NoteEgoEntry, NoteIdentityEntry, NotePassiveEntry, NoteSkillEntry } from '@/features/notes/components/NoteChips'
import { localizeEgoName, localizeIdentityName, localizePassiveDescription, localizePassiveName, localizeSkillDescription, localizeSkillName } from '@/lib/decks/localize'
import { rowsAtUptie, topUptiePassives, topUptieSkills } from '@/lib/decks/deck-identity-uptie'

export type SinnerEgo = {
  sinner_id: string
  id?: string | null
  name?: string | null
  name_kr: string | null
  name_en?: string | null
  name_jp?: string | null
  grade: string
  sin_affinity: string | null
  image_url: string | null
}

const THEME_KW_SET = new Set<string>(THEME_KEYWORDS)

export const BOARD_SLOT_COUNT = 12

export function buildBoardSlots(slots: IdentitySlot[]): (IdentitySlot | null)[] {
  const board: (IdentitySlot | null)[] = Array.from({ length: BOARD_SLOT_COUNT }, () => null)
  const bySinner = new Map<string, IdentitySlot>()

  for (const slot of slots.filter(slot => slot.identities)) {
    const sinnerId = slot.identities!.sinner_id
    const existing = bySinner.get(sinnerId)
    const shouldReplace =
      !existing ||
      (slot.slot_order < 99 && existing.slot_order === 99) ||
      (slot.slot_order < 99 && existing.slot_order < 99 && slot.slot_order < existing.slot_order) ||
      (slot.slot_order === 99 && existing.slot_order === 99 && slot.slot_order < existing.slot_order)

    if (shouldReplace) bySinner.set(sinnerId, slot)
  }

  SINNER_SLUGS.forEach((sinnerId, index) => {
    board[index] = bySinner.get(sinnerId) ?? null
  })

  return board
}

export function topKeywords(slots: IdentitySlot[]): string[] {
  const formed = slots.filter(s => s.slot_order < 99 && s.identities)
  const total = formed.length
  if (total === 0) return []

  const freq: Record<string, number> = {}
  for (const slot of formed) {
    for (const kw of slot.identities?.keywords ?? []) {
      const nkw = normalizeThemeKeyword(kw)
      if (THEME_KW_SET.has(nkw)) freq[nkw] = (freq[nkw] ?? 0) + 1
    }
  }

  const minCount = total <= 1 ? 1 : Math.max(2, Math.ceil(total * 0.4))
  return Object.entries(freq)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([kw]) => kw)
}

export function adaptBoardIdentity(identity: IdentityDetail, locale: string): Identity {
  const name = localizeIdentityName(identity, locale)
  return {
    id: identity.id,
    sinner_id: identity.sinner_id,
    name,
    name_kr: identity.name_kr,
    name_en: identity.name_en,
    name_jp: identity.name_jp,
    tier: identity.tier,
    hp: identity.hp ?? 0,
    speed_min: identity.speed_min ?? 0,
    speed_max: identity.speed_max ?? 0,
    def_level: identity.def_level ?? 0,
    keywords: identity.keywords ?? [],
    rarity: identity.rarity,
    slash_res: identity.slash_res ?? undefined,
    pierce_res: identity.pierce_res ?? undefined,
    blunt_res: identity.blunt_res ?? undefined,
    game_id: identity.game_id,
    folder_name: identity.folder_name,
  }
}

const SINNER_NAMES: Record<string, string> = {
  'yi-sang': '이상', 'faust': '파우스트', 'don-quixote': '돈키호테',
  'ryoshu': '료슈', 'meursault': '뫼르소', 'hong-lu': '홍루',
  'heathcliff': '히스클리프', 'ishmael': '이스마엘', 'rodion': '로쟈',
  'sinclair': '싱클레어', 'outis': '오티스', 'gregor': '그레고르',
}

function uniqueNames(...names: Array<string | null | undefined>): string[] {
  return [...new Set(names.map(name => name?.trim()).filter((name): name is string => Boolean(name)))]
}

function getNoteSkillBaseOrder(skill: Pick<IdentityDetail['skills'][number], 'skill_order' | 'skill_type'>): number {
  return skillSlot(skill)
}

export function buildNoteLookups(
  slots: IdentitySlot[],
  allEgos: SinnerEgo[],
  locale: string,
  localizeSinnerName: (sinnerId: string) => string,
) {
  const skillLookup: Record<string, NoteSkillEntry> = {}
  const passiveLookup: Record<string, NotePassiveEntry> = {}
  const egoLookup: Record<string, NoteEgoEntry> = {}
  const identityLookup: Record<string, NoteIdentityEntry> = {}

  for (const slot of slots) {
    const id_ = slot.identities
    if (!id_) continue
    const koreanSinnerName = SINNER_NAMES[id_.sinner_id] ?? id_.sinner_id
    const localizedSinnerName = localizeSinnerName(id_.sinner_id)
    const sinnerTokenNames = uniqueNames(koreanSinnerName, localizedSinnerName)
    const identityName = localizeIdentityName(id_, locale)
    const identityImageUrl = id_.game_id && id_.folder_name
      ? getIdentityPortraitUrl(id_.sinner_id, id_.folder_name, id_.game_id, false)
      : undefined

    const identityEntry: NoteIdentityEntry = {
      name: identityName,
      rarity: id_.rarity,
      imageUrl: identityImageUrl,
      sinnerName: localizedSinnerName,
      keywords: id_.keywords ?? undefined,
    }
    for (const sinnerName of sinnerTokenNames) {
      for (const name of uniqueNames(id_.name_kr, id_.name, id_.name_en, id_.name_jp, identityName)) {
        identityLookup[`${sinnerName}:${name}`] = identityEntry
      }
    }

    const sortedSkills = topUptieSkills(id_.skills ?? []).sort((a, b) => a.skill_order - b.skill_order || ((a as Record<string, unknown>).variant_order as number ?? 0) - ((b as Record<string, unknown>).variant_order as number ?? 0))
    const frameSkills: Skill[] = sortedSkills.map(skill => ({
      ...skill,
      identity_id: id_.id,
      sin_affinity: (normalizeSin(skill.sin_affinity) ?? 'wrath') as Skill['sin_affinity'],
      description: localizeSkillDescription(skill, locale) ?? skill.description ?? '',
      atk_weight: skill.atk_weight ?? undefined,
      offense_level: skill.offense_level ?? undefined,
      uptie_level: skill.uptie_level ?? undefined,
      variant_order: skill.variant_order ?? undefined,
    }))
    const frameSkillById = new Map(frameSkills.map(skill => [skill.id, skill]))
    const imgIdx = computeSkillImageIndices(sortedSkills)
    const orderCount: Record<number, number> = {}
    for (const sk of sortedSkills) {
      const baseOrder = getNoteSkillBaseOrder(sk)
      const subIdx = orderCount[baseOrder] || 0
      orderCount[baseOrder] = subIdx + 1
      const iconUrl = id_.game_id
        ? `${STORAGE_BASE}/icons/skills/${id_.sinner_id}/${id_.game_id}${String(imgIdx[sk.id] ?? sk.skill_order).padStart(2, '0')}.webp`
        : undefined
      const entry = {
        name: localizeSkillName(sk, locale), skill_type: sk.atk_type ?? sk.skill_type, sin_affinity: sk.sin_affinity,
        skill_order: sk.skill_order, description: localizeSkillDescription(sk, locale),
        iconUrl, identityName, sinnerName: localizedSinnerName,
        skill: frameSkillById.get(sk.id),
        skills: frameSkills,
        identity: { sinner_id: id_.sinner_id, game_id: id_.game_id, keywords: id_.keywords },
      }
      for (const sinnerName of sinnerTokenNames) {
        const key = subIdx === 0
          ? `${sinnerName}:${baseOrder}`
          : `${sinnerName}:${baseOrder}:${subIdx + 1}`
        skillLookup[key] = entry
        if (subIdx === 1) {
          skillLookup[`${sinnerName}:${baseOrder}:1`] = entry
        }
        // 이전 형식 호환: S3 변형처럼 원래 skill_order로 저장된 토큰도 인식
        if (sk.skill_order !== baseOrder) {
          skillLookup[`${sinnerName}:${sk.skill_order}`] = entry
        }
      }
    }
    for (const pa of topUptiePassives(id_.passives ?? [])) {
      const entry = {
        name: localizePassiveName(pa, locale), sin_affinity: pa.sin_affinity,
        sin_count: pa.sin_count, sin_requirements: pa.sin_requirements, active_cond: pa.active_cond,
        description: localizePassiveDescription(pa, locale), sinnerName: localizedSinnerName,
        imageUrl: identityImageUrl,
      }
      for (const passiveName of uniqueNames(pa.name, localizePassiveName(pa, locale))) {
        passiveLookup[passiveName] = entry
      }
    }
  }
  for (const ego of allEgos) {
    const koreanSinnerName = SINNER_NAMES[ego.sinner_id] ?? ego.sinner_id
    const localizedSinnerName = localizeSinnerName(ego.sinner_id)
    const name = localizeEgoName(ego, locale)
    const entry = {
      name, grade: ego.grade, sin_affinity: ego.sin_affinity,
      image_url: ego.image_url, sinnerName: localizedSinnerName,
    }
    for (const sinnerName of uniqueNames(koreanSinnerName, localizedSinnerName)) {
      for (const egoName of uniqueNames(ego.name_kr, ego.name, ego.name_en, ego.name_jp, name)) {
        egoLookup[`${sinnerName}:${egoName}`] = entry
      }
    }
  }
  return { skillLookup, passiveLookup, egoLookup, identityLookup }
}

// ── Deck detail page ─────────────────────────────────────────────────────────

type EgoAttackSkill = {
  skill_type: string | null
  category?: string | null
  construe_level?: number | null
  skill_order?: number | null
}

export type EgoSlot = {
  grade: string
  ego: {
    id: string
    name?: string | null
    name_kr: string | null
    name_en?: string | null
    name_jp?: string | null
    grade: string
    sin_affinity: string | null
    sinner_id: string
    folder_name: string | null
    image_url: string | null
    cost: number[] | null
    ego_skills?: EgoAttackSkill[] | null
  } | null
}

export type DeckDetail = {
  id: string
  title: string
  description: string | null
  tags: string[]
  main_keywords?: string[] | null
  content_type?: string
  vote_count: number
  view_count: number
  created_at: string
  deck_code?: string
  is_owner?: boolean
  is_admin?: boolean
  user_id: string
  guest_tag?: string | null
  profiles: { username: string; avatar_url?: string | null; public_profile?: boolean } | null
  deck_identities: IdentitySlot[]
  deck_egos?: EgoSlot[]
  all_sinner_egos?: SinnerEgo[]
}

/** The deck API's answer with its one-element relations (identity, E.G.O) turned into plain objects. */
export function normalizeDeckDetail(data: DeckDetail): DeckDetail {
  return {
    ...data,
    deck_identities: (data.deck_identities ?? []).map((slot: IdentitySlot & { identities: unknown }) => ({
      ...slot,
      identities: Array.isArray(slot.identities)
        ? (slot.identities[0] as IdentityDetail | undefined) ?? null
        : slot.identities as unknown as IdentityDetail | null,
    })),
    deck_egos: (data.deck_egos ?? []).map((es: EgoSlot & { ego: unknown }) => ({
      ...es,
      ego: Array.isArray(es.ego)
        ? (es.ego[0] as EgoSlot['ego'] | undefined) ?? null
        : es.ego as EgoSlot['ego'],
    })),
  }
}

/**
 * With the server-rendered deck already shown, only the fields its prefetch lacks are patched in (deck_code,
 * is_owner, is_admin, all_sinner_egos, the counts), so the identity and E.G.O rows already drawn stay as they are.
 */
export function mergeViewerFields(prev: DeckDetail, fixed: DeckDetail): DeckDetail {
  return {
    ...prev,
    deck_code: fixed.deck_code,
    is_owner: fixed.is_owner,
    is_admin: fixed.is_admin,
    all_sinner_egos: fixed.all_sinner_egos ?? [],
    vote_count: fixed.vote_count,
    view_count: fixed.view_count,
  }
}

/** One row of the deck note's skill distribution list: the identity, its 1-2-3 distribution and its three attack skills. */
export function buildSkillExchangeRow(slot: IdentitySlot, locale: string, sinnerName: string) {
  const identity = slot.identities!
  const adapted = adaptBoardIdentity(identity, locale)
  const dist: [number, number, number] = [slot.s1_count ?? 3, slot.s2_count ?? 2, slot.s3_count ?? 1]
  const sortedSkills = topUptieSkills((identity.skills ?? []).filter(s => !['evade', 'defense', 'counter'].includes(s.skill_type))).sort((a, b) => a.skill_order - b.skill_order)
  const imageIndices = computeSkillImageIndices(sortedSkills)
  const skillAt = (idx: number) => {
    const skill = sortedSkills.find(s => s.skill_order === idx + 1)
    return skill ? {
      name: localizeSkillName(skill, locale),
      iconSrc: getSkillIconUrl(adapted, imageIndices[skill.id] ?? idx + 1, skill),
      sinColor: sinColorOf(skill.sin_affinity, '#888888'),
    } : null
  }
  const skills: [ReturnType<typeof skillAt>, ReturnType<typeof skillAt>, ReturnType<typeof skillAt>] = [skillAt(0), skillAt(1), skillAt(2)]
  return {
    identity: {
      imageUrl: identity.folder_name && identity.game_id ? getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_normal_info`) : null,
      name: adapted.name ?? '',
      sinnerName,
    },
    distribution: dist,
    skills,
  }
}

// Saved uptie; rows without one fall back to gacksung (= uptie III–IV), non-awakened reading as uptie II.
export const slotUptie = (slot: IdentitySlot | null) => slot?.uptie ?? (slot?.gacksung === false ? 2 : 4)
export const EGO_GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

/** The formation in slot order, the waiting slots (99) last. */
export function sortDeckSlots(identities: readonly IdentitySlot[]) {
  return [...identities].sort((a, b) => {
    if (a.slot_order === 99 && b.slot_order !== 99) return 1
    if (b.slot_order === 99 && a.slot_order !== 99) return -1
    return a.slot_order - b.slot_order
  })
}

/** E.G.O 탭: 수감자 → 등급 → E.G.O */
export function buildFormationEgos(rows: readonly EgoSlot[], locale: string) {
  const map: Record<string, Record<string, { id: string; name: string; sin_affinity: string | null; image_url: string | null }>> = {}
  for (const row of rows) {
    if (!row.ego) continue
    ;(map[row.ego.sinner_id] ??= {})[row.grade] = { id: row.ego.id, name: localizeEgoName(row.ego, locale), sin_affinity: row.ego.sin_affinity, image_url: row.ego.image_url }
  }
  return map
}

/** The keywords the author saved, or the ones the formation shows most when none were saved. */
export function resolveDeckKeywords(mainKeywords: readonly string[] | null | undefined, sorted: IdentitySlot[]) {
  const persistedKeywords = (mainKeywords ?? [])
    .map(normalizeDeckMainKeyword)
    .filter((keyword): keyword is string => Boolean(keyword))

  return persistedKeywords.length > 0 ? persistedKeywords : topKeywords(sorted)
}

/** Slots whose skill distribution differs from the default 3-2-1. */
export function findCustomSkillSlots(formedSlots: IdentitySlot[]) {
  return formedSlots.filter(s => {
    const s1 = s.s1_count ?? 3, s2 = s.s2_count ?? 2, s3 = s.s3_count ?? 1
    return !(s1 === 3 && s2 === 2 && s3 === 1)
  })
}

/** EGO 그룹핑: by sinner, each in grade order. */
export function groupEgosBySinner(rows: readonly EgoSlot[]) {
  const grouped: Record<string, EgoEntry[]> = {}
  for (const row of rows) {
    if (!row.ego) continue
    const sid = row.ego.sinner_id
    ;(grouped[sid] ??= []).push({ grade: row.grade, ego: row.ego })
  }
  for (const sid of Object.keys(grouped)) {
    grouped[sid].sort((a, b) => EGO_GRADE_ORDER.indexOf(a.grade) - EGO_GRADE_ORDER.indexOf(b.grade))
  }
  return grouped
}

/** Whether the formation meets each gift's activation condition, by gift name. */
export function buildEgoGiftConditionLookup(filledSlots: IdentitySlot[], gifts: readonly { name: string; activation_condition?: GiftData['activation_condition'] }[]) {
  const assignedSlots = filledSlots.filter(slot => slot.slot_order >= 0 && slot.slot_order < 99)
  const deckKeywordSlots: DeckKeywordSlot[] = assignedSlots.map(slot => {
    const identity = slot.identities
    const keywordIdentity = identity as (IdentityDetail & { skill_keyword_list?: string[] | null }) | null
    return {
      slot_order: slot.slot_order,
      identities: {
        skill_keyword_list: keywordIdentity?.skill_keyword_list ?? identity?.keywords ?? [],
        affiliation: keywordIdentity?.affiliation ?? null,
        association_list: keywordIdentity?.association_list ?? [],
        skills: (identity?.skills ?? []).map(skill => ({
          skill_type: skill.skill_type,
          atk_type: skill.atk_type ?? skill.skill_type,
        })),
      },
    }
  })
  const formationKeywordCounts = computeFormationGiftKeywordCounts(deckKeywordSlots)
  const allKeywordCounts = computeAllGiftKeywordCounts(deckKeywordSlots)
  const formationAffiliationCounts = computeFormationGiftAffiliationCounts(deckKeywordSlots)
  const allAffiliationCounts = computeAllGiftAffiliationCounts(deckKeywordSlots)
  const formationAffiliationMembers = computeFormationGiftAffiliationMembers(deckKeywordSlots)
  const allAffiliationMembers = computeAllGiftAffiliationMembers(deckKeywordSlots)

  const map: Record<string, ReturnType<typeof getGiftActivationConditionStatus>> = {}
  for (const gift of gifts) {
    map[gift.name] = getGiftActivationConditionStatus({
      gift: { activation_condition: gift.activation_condition ?? null },
      formationKeywordCounts,
      allKeywordCounts,
      formationAffiliationCounts,
      allAffiliationCounts,
      formationAffiliationMembers,
      allAffiliationMembers,
    })
  }
  return map
}

/** Planner deck panels: the placed identities in sinner order, each with its skills and passives at its own uptie. */
export function buildInsightSlots(filledSlots: IdentitySlot[]) {
  const order = SINNER_SLUGS
  const bySinner = [...filledSlots].sort((a, b) => order.indexOf(a.identities!.sinner_id) - order.indexOf(b.identities!.sinner_id))
  const upties = new Map(bySinner.map(slot => [slot.identities!.id, slotUptie(slot)]))
  return bySinner.map(slot => {
    const identity = slot.identities!
    return {
      slot,
      identity,
      skills: rowsAtUptie((identity.skills ?? []).map(skill => ({ ...skill, identity_id: identity.id })), upties),
      passives: rowsAtUptie((identity.passives ?? []).map(passive => ({ ...passive, identity_id: identity.id })), upties),
    }
  })
}

type InsightSlots = ReturnType<typeof buildInsightSlots>

export function pickDeployedIdentityIds(insightSlots: InsightSlots) {
  return new Set(insightSlots.filter(({ slot }) => isDeployedSlot(slot.slot_order)).map(({ identity }) => identity.id))
}

export function buildInsightIdentities(insightSlots: InsightSlots, locale: string, localizeSinnerName: (sinnerId: string) => string): DeckInsightIdentity[] {
  return insightSlots.map(({ slot, identity, passives, skills }) => ({
    id: identity.id,
    name: localizeIdentityName(identity, locale),
    sinnerName: localizeSinnerName(identity.sinner_id),
    imageUrl: identity.folder_name && identity.game_id ? getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_normal_info`) : '',
    keywords: identity.skill_keyword_list ?? identity.keywords ?? [],
    passives: [...passives].sort((a, b) => a.passive_order - b.passive_order).map(passive => ({
      ...passive,
      name: localizePassiveName(passive, locale),
      description: localizePassiveDescription(passive, locale) ?? passive.description,
    })),
    deck: computeSinProduction([{ skills, distribution: [slot.s1_count ?? 3, slot.s2_count ?? 2, slot.s3_count ?? 1] as const }]),
  }))
}

/** The deck's resources, its sin production, and the production of the fielded identities alone. */
export function computeDeckAnalysis(egoRows: readonly EgoSlot[], insightSlots: InsightSlots) {
  const egos = egoRows.flatMap(row => row.ego ? [row.ego] : [])
  const entries = insightSlots.map(({ slot, identity, skills }) => ({
    skills,
    distribution: [slot.s1_count ?? 3, slot.s2_count ?? 2, slot.s3_count ?? 1] as const,
    deployed: isDeployedSlot(slot.slot_order),
    egos: egos.filter(ego => ego.sinner_id === identity.sinner_id).map(ego => ({ skills: ego.ego_skills, cost: ego.cost })),
  }))
  const resources = computeDeckResources(entries)
  return {
    resources,
    sinCounts: resources.production,
    baseSinCounts: computeSinProduction(fieldedEntries(entries).map(({ skills }) => ({ skills }))),
  }
}
