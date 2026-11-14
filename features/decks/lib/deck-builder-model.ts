import { DEFAULT_EGO_NAMES } from '@/lib/decks/default-ego'
import { computeDeckResources, computeSinProduction, fieldedEntries } from '@/lib/decks/deck-analysis'
import { rowsAtUptie, topUptiePassives, topUptieSkills } from '@/lib/decks/deck-identity-uptie'
import { DECK_MAIN_KEYWORDS, MAX_DECK_MAIN_KEYWORDS, type DeckKeywordSlot } from '@/lib/decks/keyword-rules'
import { localizeIdentityName, localizePassiveDescription, localizePassiveName } from '@/lib/decks/localize'
import { isDeployedSlot } from '@/lib/constants/game'
import type { EGO, Identity, Passive, Sinner, Skill } from '@/lib/types'
import { getIdentityImageUrl } from '@/lib/utils/images'
import type { DeckDraft } from '@/features/notes'
import type { DeckInsightIdentity } from '../components/DeckInsights'

export interface EditMode {
  deckId: string
  title: string
  description: string
  /** When the deck was last saved on the server; an older browser draft is not offered. */
  updatedAt?: string | null
  tags: string[]
  content_type?: string
  mainKeywords?: string[]
  identitySlotIds: Record<string, string>
  gacksungSlots: Record<string, boolean>
  upties?: Record<string, number>
  skillDistribution?: Record<string, [number, number, number]>
  formationOrder: string[]
  egoSlotIds: Record<string, Record<string, string>>
}

export type ForkMode = Omit<EditMode, 'deckId'> & { forkedFrom: string }

export type DeckBuilderSlots = Record<string, Identity | undefined>
export type DeckBuilderEgoSlots = Record<string, Record<string, EGO>>

export function sanitizeDeckMainKeywords(value: readonly string[] | undefined): string[] {
  if (!value) return []
  const allowed = new Set<string>(DECK_MAIN_KEYWORDS)
  const seen = new Set<string>()
  return value.filter(keyword => {
    if (!allowed.has(keyword) || seen.has(keyword)) return false
    seen.add(keyword)
    return true
  }).slice(0, MAX_DECK_MAIN_KEYWORDS)
}

/** The identities a sinner-keyed map of ids points at (a sinner whose id is unknown stays empty). */
export function pickIdentitySlots(identityIds: Record<string, string>, identities: readonly Identity[]): DeckBuilderSlots {
  const slots: DeckBuilderSlots = {}
  for (const [sinnerId, identityId] of Object.entries(identityIds)) {
    slots[sinnerId] = identities.find(i => i.id === identityId)
  }
  return slots
}

/** The E.G.O a sinner-and-grade-keyed map of ids points at. With `keepEmptySinners` a sinner whose E.G.O are all unknown keeps an empty entry. */
export function pickEgoSlots(egoIds: Record<string, Record<string, string>>, egos: readonly EGO[], { keepEmptySinners = true } = {}): DeckBuilderEgoSlots {
  const slots: DeckBuilderEgoSlots = {}
  for (const [sinnerId, gradeMap] of Object.entries(egoIds)) {
    if (keepEmptySinners) slots[sinnerId] = {}
    for (const [grade, egoId] of Object.entries(gradeMap)) {
      const ego = egos.find(e => e.id === egoId)
      if (ego) (slots[sinnerId] ??= {})[grade] = ego
    }
  }
  return slots
}

/** A new deck starts with each sinner's default (else ZAYIN) E.G.O. */
export function defaultEgoSlots(sinners: readonly Sinner[], egos: readonly EGO[]): DeckBuilderEgoSlots {
  const initial: DeckBuilderEgoSlots = {}
  for (const sinner of sinners) {
    const defaultName = DEFAULT_EGO_NAMES[sinner.name_kr]
    const ego = defaultName
      ? egos.find(e => e.sinner_id === sinner.id && (e.name_kr === defaultName))
          ?? egos.find(e => e.sinner_id === sinner.id && e.grade === 'ZAYIN')
      : egos.find(e => e.sinner_id === sinner.id && e.grade === 'ZAYIN')
    if (ego) initial[sinner.id] = { [ego.grade]: ego }
  }
  return initial
}

/** Skills and passives follow each slot's uptie (nearest level the data has): identity id → uptie. */
export function buildIdentityUpties(sinners: readonly Sinner[], deckSlots: DeckBuilderSlots, upties: Record<string, number>) {
  return new Map(sinners.flatMap(s => deckSlots[s.id] ? [[deckSlots[s.id]!.id, upties[s.id]] as const] : []))
}

export function groupSkillsByIdentity(skills: readonly Skill[], identityUpties: ReadonlyMap<string, number | undefined>) {
  const raw: Record<string, Skill[]> = {}
  for (const s of rowsAtUptie(skills, identityUpties)) {
    ;(raw[s.identity_id] ??= []).push(s)
  }
  // 4동기화 우선: 같은 (skill_order, variant_order)에서 최고 uptie_level만 유지
  const map: Record<string, Skill[]> = {}
  for (const [id, list] of Object.entries(raw)) {
    map[id] = topUptieSkills(list).sort((a, b) => a.skill_order - b.skill_order || (a.variant_order ?? 0) - (b.variant_order ?? 0))
  }
  return map
}

export function groupPassivesByIdentity(passives: readonly Passive[], identityUpties: ReadonlyMap<string, number | undefined>) {
  const raw: Record<string, Passive[]> = {}
  for (const p of rowsAtUptie(passives, identityUpties)) {
    ;(raw[p.identity_id] ??= []).push(p)
  }
  // 4동기화 우선: 같은 (passive_type, passive_order)에서 최고 uptie_level만 유지
  const map: Record<string, Passive[]> = {}
  for (const [id, list] of Object.entries(raw)) {
    map[id] = topUptiePassives(list).sort((a, b) => a.passive_order - b.passive_order)
  }
  return map
}

/** The placed identities as the keyword rules read them (a sinner outside the formation order counts as slot 99). */
export function buildDeckKeywordSlots(sinners: readonly Sinner[], deckSlots: DeckBuilderSlots, formationOrder: readonly string[], skillsByIdentityId: Record<string, Skill[]>): DeckKeywordSlot[] {
  return sinners
    .map(sinner => {
      const identity = deckSlots[sinner.id]
      if (!identity) return null
      const formationIndex = formationOrder.indexOf(sinner.id)
      const slot: DeckKeywordSlot = {
        slot_order: formationIndex >= 0 ? formationIndex : 99,
        identities: {
          skill_keyword_list: identity.skill_keyword_list ?? [],
          affiliation: identity.affiliation ?? null,
          association_list: identity.association_list ?? [],
          skills: (skillsByIdentityId[identity.id] ?? []).map(skill => ({
            skill_type: skill.skill_type,
            atk_type: (skill as Skill & { atk_type?: string | null }).atk_type ?? skill.skill_type,
          })),
        },
      }
      return slot
    })
    .filter((slot): slot is DeckKeywordSlot => Boolean(slot))
}

/** One keyword picked or dropped; a pick past the limit returns the same list (the state does not change). */
export function toggleMainKeywordIn(base: string[], keyword: string): string[] {
  if (base.includes(keyword)) return base.filter(item => item !== keyword)
  if (base.length >= MAX_DECK_MAIN_KEYWORDS) return base
  return [...base, keyword]
}

/** A sinner joins or leaves the formation order (twelve at most; a thirteenth returns the same list). */
export function toggleFormationSlot(order: string[], sinnerId: string): string[] {
  if (order.includes(sinnerId)) return order.filter(id => id !== sinnerId)
  if (order.length >= 12) return order
  return [...order, sinnerId]
}

/** How many placed identities keep a skill distribution other than 3-2-1. */
export function countCustomSkillsets(skillDistribution: Record<string, [number, number, number]>, deckSlots: DeckBuilderSlots) {
  return Object.entries(skillDistribution).filter(([sinnerId, dist]) => {
    if (!deckSlots[sinnerId]) return false
    return !(dist[0] === 3 && dist[1] === 2 && dist[2] === 1)
  }).length
}

/** The placed identities for the deck panels (keywords, passives, attack types, sin resources) and the resources behind them. */
export function buildDeckInsightData({ sinners, deckSlots, egoSlots, formationOrder, skillDistribution, skillsByIdentityId, passivesByIdentityId, locale, localizeSinnerName }: {
  sinners: readonly Sinner[]
  deckSlots: DeckBuilderSlots
  egoSlots: DeckBuilderEgoSlots
  formationOrder: readonly string[]
  skillDistribution: Record<string, [number, number, number]>
  skillsByIdentityId: Record<string, Skill[]>
  passivesByIdentityId: Record<string, Passive[]>
  locale: string
  localizeSinnerName: (sinnerId: string) => string
}) {
  const placed = sinners.flatMap(sinner => deckSlots[sinner.id] ? [{ sinner, identity: deckSlots[sinner.id]! }] : [])
  const skillsOf = (identity: Identity) => skillsByIdentityId[identity.id] ?? []
  const entries = placed.map(({ sinner, identity }) => ({
    skills: skillsOf(identity),
    distribution: skillDistribution[sinner.id],
    deployed: isDeployedSlot(formationOrder.indexOf(sinner.id)),
    egos: Object.values(egoSlots[sinner.id] ?? {}).map(ego => ({ skills: ego.ego_skills, cost: ego.cost })),
  }))
  const resources = computeDeckResources(entries)
  const identities: DeckInsightIdentity[] = placed.map(({ sinner, identity }) => ({
    id: identity.id,
    name: localizeIdentityName(identity, locale),
    sinnerName: localizeSinnerName(sinner.id),
    imageUrl: identity.folder_name && identity.game_id ? getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_normal_info`) : '',
    keywords: identity.skill_keyword_list ?? identity.keywords ?? [],
    passives: (passivesByIdentityId[identity.id] ?? []).map(passive => ({
      ...passive,
      name: localizePassiveName(passive, locale),
      description: localizePassiveDescription(passive, locale) ?? null,
    })),
    deck: computeSinProduction([{ skills: skillsOf(identity), distribution: skillDistribution[sinner.id] }]),
  }))
  const deployedIds = new Set(placed.filter(({ sinner }) => isDeployedSlot(formationOrder.indexOf(sinner.id))).map(({ identity }) => identity.id))
  return {
    identities,
    deployedIds,
    resources,
    sinCounts: resources.production,
    baseSinCounts: computeSinProduction(fieldedEntries(entries).map(({ skills }) => ({ skills }))),
  }
}

/** The rows the deck API stores: one per sinner with its slot, uptie and skill distribution, and the chosen E.G.O. */
export function buildDeckSaveRows({ sinners, deckSlots, gacksungSlots, upties, formationOrder, skillDistribution, egoSlots }: {
  sinners: readonly Sinner[]
  deckSlots: DeckBuilderSlots
  gacksungSlots: Record<string, boolean>
  upties: Record<string, number>
  formationOrder: readonly string[]
  skillDistribution: Record<string, [number, number, number]>
  egoSlots: DeckBuilderEgoSlots
}) {
  const identitySlots = sinners
    .filter(s => deckSlots[s.id])
    .map(s => {
      const dist = skillDistribution[s.id] ?? [3, 2, 1]
      return {
        identity_id: deckSlots[s.id]!.id,
        gacksung: gacksungSlots[s.id] ?? false,
        uptie: upties[s.id] ?? 4,
        slot_order: formationOrder.indexOf(s.id) >= 0 ? formationOrder.indexOf(s.id) : 99,
        s1_count: dist[0],
        s2_count: dist[1],
        s3_count: dist[2],
      }
    })
  const egoRows = Object.entries(egoSlots).flatMap(([, gradeMap]) =>
    Object.entries(gradeMap).map(([grade, ego]) => ({ ego_id: ego.id, grade }))
  )
  return { identitySlots, egoRows }
}

/** The editor's state as the draft stores it; `savedAt` stays 0 so the same state always serializes the same. */
export function buildDeckDraftState(state: {
  title: string
  contentType: string
  description: string
  deckSlots: DeckBuilderSlots
  egoSlots: DeckBuilderEgoSlots
  formationOrder: string[]
  mainKeywords: string[]
  mainKeywordsManual: boolean
  gacksungSlots: Record<string, boolean>
  skillDistribution: Record<string, [number, number, number]>
  upties: Record<string, number>
}): DeckDraft {
  return {
    title: state.title,
    contentType: state.contentType,
    description: state.description,
    deckSlotIds: Object.fromEntries(Object.entries(state.deckSlots).filter(([, v]) => v).map(([k, v]) => [k, v!.id])),
    egoSlotIds: Object.fromEntries(Object.entries(state.egoSlots).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([grade, ego]) => [grade, ego.id]))])),
    formationOrder: state.formationOrder,
    mainKeywords: state.mainKeywords,
    mainKeywordsManual: state.mainKeywordsManual,
    savedAt: 0,
    gacksungSlots: state.gacksungSlots,
    skillDistribution: state.skillDistribution,
    upties: state.upties,
  }
}
