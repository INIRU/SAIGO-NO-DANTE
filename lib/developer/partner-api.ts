import { SITE_URL } from '@/lib/seo/metadata'
import { computeSkillImageIndices, getIdentityPortraitUrl, getSkillIconUrl } from '@/lib/utils/images'
import { computeAttackTypeCounts, computeEgoCostTotals, computeSinProduction, type SkillDistributionTuple } from '@/lib/decks/deck-analysis'
import { isAwakenedUptie, normalizeUptie, rowsAtUptie } from '@/lib/decks/deck-identity-uptie'

export type Lang = 'ko' | 'en' | 'ja'
// Rows come straight from PostgREST selects and stored plan JSON; the shapes are checked by the tests.
type Row = Record<string, any>

/** Resources of /api/v1. Partner ones are refused to keys whose account has no partner tier. */
export const RESOURCES: Record<string, { partner: boolean }> = {
  decks: { partner: false },
  planners: { partner: false },
  identities: { partner: true },
  egos: { partner: true },
  'ego-gifts': { partner: true },
  'theme-packs': { partner: true },
  'md-events': { partner: true },
  keywords: { partner: true },
}

/** Missing → Korean; anything but ko/en/ja → null (the caller answers 400). */
export const parseLang = (value: string | null): Lang | null =>
  value === null ? 'ko' : value === 'ko' || value === 'en' || value === 'ja' ? value : null

/**
 * Collapses `x`, `x_kr`, `x_en`, `x_jp` into one `x` in the requested language, at every depth.
 * An empty translation falls back to Korean, like the site does.
 */
export function localize<T>(value: T, lang: Lang): T {
  if (Array.isArray(value)) return value.map(item => localize(item, lang)) as T
  if (!value || typeof value !== 'object') return value
  const row = value as Row
  const out: Row = {}
  for (const [key, item] of Object.entries(row)) {
    const base = key.match(/^(.+)_(kr|en|jp)$/)?.[1]
    if (!base) {
      if (!(key in out)) out[key] = localize(item, lang)
      continue
    }
    const picked = lang === 'en' ? row[`${base}_en`] : lang === 'ja' ? row[`${base}_jp`] : null
    out[base] = picked || (row[`${base}_kr`] ?? row[base])
  }
  return out as T
}

const identityUrl = (row: Row, lang: Lang) => `${SITE_URL}/${lang}/sinners/${row.sinner_id}/identities/${row.id}`
const egoUrl = (row: Row, lang: Lang) => `${SITE_URL}/${lang}/sinners/${row.sinner_id}/ego/${row.id}`
const bySkillOrder = (a: Row, b: Row) => a.skill_order - b.skill_order || (a.variant_order ?? 0) - (b.variant_order ?? 0) || String(a.id).localeCompare(String(b.id))

/** Icon numbering counts variants within one uptie level, so each level is numbered on its own. */
function withSkillIcons(identity: Row, skills: Row[]): Row[] {
  const levels = new Map<number, Row[]>()
  for (const skill of [...skills].sort(bySkillOrder)) levels.set(skill.uptie_level ?? 0, [...(levels.get(skill.uptie_level ?? 0) ?? []), skill])
  const index: Record<string, number> = {}
  for (const group of levels.values()) Object.assign(index, computeSkillImageIndices(group as { id: string; skill_order: number }[]))
  return skills.map(skill => ({ ...skill, icon_url: getSkillIconUrl(identity as { sinner_id: string; game_id: string }, index[skill.id] ?? skill.skill_order, skill) }))
}

/** One catalog row in the requested language, with the site page, its OG card and image addresses where they exist. */
export function presentCatalogItem(resource: string, row: Row, lang: Lang): Row {
  const item = localize(row, lang)
  if (resource === 'identities') {
    const url = identityUrl(row, lang)
    return {
      ...item,
      ...(Array.isArray(row.skills) ? { skills: localize(withSkillIcons(row, row.skills), lang) } : {}),
      image_url: getIdentityPortraitUrl(row.sinner_id, row.folder_name, row.game_id, false),
      url,
      card_url: `${url}/opengraph-image`,
    }
  }
  if (resource === 'egos') return { ...item, url: egoUrl(row, lang), card_url: `${egoUrl(row, lang)}/opengraph-image` }
  // Other resources refer to a keyword by its Korean name, which the localized name replaces.
  if (resource === 'keywords') return { key: row.name, ...item }
  return item
}

const POST_PATH = { decks: 'decks', planners: 'planner/community' } as const

/** Site page and OG card of a deck or plan. */
export function withLinks(resource: keyof typeof POST_PATH, row: Row, lang: Lang): Row {
  const url = `${SITE_URL}/${lang}/${POST_PATH[resource]}/${row.id}`
  return { ...row, url, card_url: `${url}/opengraph-image` }
}

type Slot = { slot_order: number; uptie?: unknown; s1_count?: number | null; s2_count?: number | null; s3_count?: number | null; identity: Row | null }

/**
 * Formation in slot order (99 = no order set, so it sorts last), each identity's skills at the slot's uptie,
 * the chosen E.G.O and the same analysis numbers the deck and plan pages show.
 */
function presentFormation(slots: Slot[], egoSlots: { grade?: string | null; ego: Row | null }[], lang: Lang) {
  const analysisSkills: Row[][] = []
  const distributions: (SkillDistributionTuple | null)[] = []
  const formation = slots
    .filter((slot): slot is Slot & { identity: Row } => !!slot.identity)
    .sort((a, b) => a.slot_order - b.slot_order)
    .map(slot => {
      const identity = slot.identity
      const uptie = normalizeUptie(slot.uptie)
      const skills = rowsAtUptie(
        ((identity.skills ?? []) as Row[]).map(skill => ({ ...skill, identity_id: identity.id as string })),
        new Map([[identity.id as string, uptie]]),
      ).sort(bySkillOrder)
      const counts = [slot.s1_count, slot.s2_count, slot.s3_count]
      const distribution = counts.every(count => typeof count === 'number') ? (counts as unknown as SkillDistributionTuple) : null
      analysisSkills.push(skills)
      distributions.push(distribution)
      const name = localize({ name: identity.name, name_kr: identity.name_kr, name_en: identity.name_en, name_jp: identity.name_jp }, lang).name
      return {
        slot_order: slot.slot_order,
        uptie,
        skill_counts: distribution,
        identity: {
          id: identity.id,
          name,
          sinner_id: identity.sinner_id,
          rarity: identity.rarity ?? null,
          image_url: getIdentityPortraitUrl(identity.sinner_id, identity.folder_name, identity.game_id, isAwakenedUptie(uptie)),
          url: identityUrl(identity, lang),
          resistances: { slash: identity.slash_res ?? null, pierce: identity.pierce_res ?? null, blunt: identity.blunt_res ?? null },
        },
        skills: localize(withSkillIcons(identity, skills), lang).map(skill => ({
          skill_order: skill.skill_order,
          variant_order: skill.variant_order ?? 0,
          name: skill.name,
          skill_type: skill.skill_type,
          atk_type: skill.atk_type ?? null,
          sin_affinity: skill.sin_affinity ?? null,
          coins: skill.coins,
          base_power: skill.base_power,
          coin_power: skill.coin_power,
          offense_level: skill.offense_level ?? null,
          atk_weight: skill.atk_weight ?? null,
          icon_url: skill.icon_url,
        })),
      }
    })
  const egoRows = egoSlots.filter((slot): slot is { grade?: string | null; ego: Row } => !!slot.ego)
  const { attack, defense } = computeAttackTypeCounts(analysisSkills as Parameters<typeof computeAttackTypeCounts>[0], egoRows.map(slot => slot.ego.ego_skills))
  return {
    formation,
    egos: egoRows.map(({ grade, ego }) => ({
      id: ego.id,
      grade: grade ?? ego.grade ?? null,
      name: localize({ name: ego.name, name_kr: ego.name_kr, name_en: ego.name_en, name_jp: ego.name_jp }, lang).name,
      sinner_id: ego.sinner_id,
      sin_affinity: ego.sin_affinity ?? null,
      image_url: ego.image_url ?? null,
      cost: ego.cost ?? null,
      url: egoUrl(ego, lang),
    })),
    analysis: {
      attack_types: attack,
      defense_types: defense,
      sin_production: computeSinProduction(analysisSkills.map((skills, index) => ({ skills: skills as Parameters<typeof computeSinProduction>[0][number]['skills'], distribution: distributions[index] }))),
      ego_cost: computeEgoCostTotals(egoRows.map(slot => slot.ego.cost)),
    },
  }
}

// PostgREST returns a to-one embed as an object or, without a detected unique key, as a one-item array.
const one = (value: Row | Row[] | null | undefined): Row | null => (Array.isArray(value) ? value[0] ?? null : value ?? null)
const list = (value: unknown): Row[] => (Array.isArray(value) ? value : [])

/** A deck row selected with its identities, skills and E.G.O (see loadDeckDetail). */
export function presentDeck(row: Row, lang: Lang): Row {
  const { deck_identities, deck_egos, ...deck } = row
  return {
    ...withLinks('decks', deck, lang),
    ...presentFormation(
      list(deck_identities).map(slot => ({ ...slot, identity: one(slot.identity) }) as Slot),
      list(deck_egos).map(slot => ({ grade: slot.grade, ego: one(slot.ego) })),
      lang,
    ),
  }
}

/** A plan keeps ids in JSON; the referenced identities, E.G.O, theme packs and gifts are passed in and joined here. */
export function presentPlan(row: Row, refs: { identities: Row[]; egos: Row[]; themes: Row[]; gifts: Row[] }, lang: Lang): Row {
  const { deck, egos, floor_plan, gift_inventory, ...plan } = row
  const identities = new Map(refs.identities.map(identity => [identity.id, identity]))
  const egoRows = new Map(refs.egos.map(ego => [ego.id, ego]))
  const themes = new Map(refs.themes.map(theme => [String(theme.id), theme]))
  const gifts = new Map(refs.gifts.map(gift => [String(gift.game_id), gift]))
  const gift = (id: unknown) => {
    const found = gifts.get(String(id))
    if (!found) return null
    const { game_id, name, grade, keyword, image_url } = localize(found, lang)
    return { game_id, name, grade, keyword, image_url }
  }
  return {
    ...withLinks('planners', plan, lang),
    ...presentFormation(
      list(deck).map(slot => ({ ...slot, identity: identities.get(slot.identity_id) ?? null }) as Slot),
      list(egos).map(slot => ({ grade: slot.grade, ego: egoRows.get(slot.ego_id) ?? null })),
      lang,
    ),
    floors: list(floor_plan).map(floor => {
      const theme = themes.get(String(floor.theme_id))
      return {
        floor: floor.floor,
        difficulty: floor.difficulty ?? null,
        memo: floor.memo ?? '',
        constraints: floor.constraints ?? [],
        theme: theme ? { id: theme.id, name: localize(theme, lang).name, image_url: theme.image_url ?? null } : null,
        gifts: list(floor.gift_ids).flatMap(id => gift(id) ?? []),
      }
    }),
    // Stored as "<source>_<game id>[_plus|_plusplus]" (observe_9708, final_9079_plus); older plans hold the bare game id.
    gift_inventory: list(gift_inventory).flatMap(key => {
      const match = String(key).match(/^(?:([a-z]+)_)?(\d+)(_plus(plus)?)?$/)
      const found = match && gift(match[2])
      return match && found ? [{ source: match[1] ?? null, enhancement: match[4] ? 2 : match[3] ? 1 : 0, ...found }] : []
    }),
    // Blessings share the inventory as "blessing_<id>_<level>".
    blessings: list(gift_inventory).flatMap(key => {
      const match = String(key).match(/^blessing_(\d+)_(\d+)$/)
      return match ? [{ id: Number(match[1]), level: Number(match[2]) }] : []
    }),
  }
}
