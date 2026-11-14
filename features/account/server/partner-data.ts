import { cacheLife, cacheTag } from 'next/cache'
import { publicSupabase } from '@/lib/supabase/public'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { isUuid } from '@/lib/utils/uuid'

type Row = Record<string, any>

// Public credentials preserve the same RLS boundary as the public site.
const db = () =>
  publicSupabase().schema('limbus')

const IDENTITY = 'id, game_id, sinner_id, folder_name, name_kr, name_en, name_jp, tier, rarity, sin_affinity, hp, speed_min, speed_max, def_level, keywords, skill_keyword_list, unit_keyword_list, affiliation, association_list, slash_res, pierce_res, blunt_res, release_date'
const SKILLS = 'skills(id, name, name_en, name_jp, skill_type, atk_type, sin_affinity, coins, base_power, coin_power, description, description_en, description_jp, skill_order, variant_order, uptie_level, image_id, atk_weight, offense_level)'
const PASSIVES = 'passives(id, name, name_en, name_jp, passive_type, sin_affinity, sin_count, sin_requirements, active_cond, description, description_en, description_jp, passive_order, uptie_level)'
const EGO = 'id, game_id, sinner_id, folder_name, name_kr, name_en, name_jp, grade, sin_affinity, resistance, cost, keywords, release_date, image_url, cor_image_url, artwork_url, corrosion_artwork_url'
const EGO_SKILLS = 'ego_skills(id, name, name_en, name_jp, skill_type, category, sin_affinity, coins, base_power, coin_power, description, description_en, description_jp, skill_order, construe_level, atk_weight, offense_level, mental_consume)'

/** Table, list columns, extra columns of the one-item read, order and cache tag per partner catalog. */
const CATALOGS: Record<string, { table: string; columns: string; detail?: string; order: string[]; tag: string }> = {
  identities: { table: 'identities', columns: IDENTITY, detail: `acquisition, break_section, base_hp, hp_per_level, ${SKILLS}, ${PASSIVES}`, order: ['sinner_id', 'game_id'], tag: CACHE_TAGS.identities },
  egos: {
    table: 'ego',
    columns: EGO,
    detail: `passive_name, passive_name_en, passive_name_jp, passive_content, passive_content_en, passive_content_jp, ${EGO_SKILLS}, ego_passives(game_passive_id, min_stage, max_stage, name, name_en, name_jp, description, description_en, description_jp)`,
    order: ['sinner_id', 'game_id'],
    tag: CACHE_TAGS.ego,
  },
  'ego-gifts': {
    table: 'ego_gifts',
    columns: 'id, game_id, name, name_en, name_jp, keyword, grade, enhancement, price, buy_disabled, is_synthesis, difficulty, convert_to, image_url, effect_base, effect_base_en, effect_base_jp, effect_plus, effect_plus_en, effect_plus_jp, effect_plusplus, effect_plusplus_en, effect_plusplus_jp, activation_condition',
    order: ['game_id'],
    tag: CACHE_TAGS.egoGifts,
  },
  'theme-packs': {
    table: 'ego_gift_themes',
    columns: 'id, name, name_en, name_jp, difficulty, image_url, boss_image_url, floor_info, ego_gift_ids, specific_ego_gift_ids, fixed_reward_gift_ids, attribute_type, attack_type, is_hidden, hidden_rate, is_unrecordable',
    order: ['id'],
    tag: CACHE_TAGS.themes,
  },
  'md-events': {
    table: 'md_events',
    // Choices also point at their follow-up event, so the embed names the owning key.
    columns: 'id, name, name_en, name_jp, desc_text, desc_text_en, desc_text_jp, source, image_url, theme_ids, gift_ids, variant_of, event_type, category, judgment, choices:md_event_choices!md_event_choices_event_id_fkey(id, sort_order, option_index, result_index, message, message_en, message_jp, message_desc, message_desc_en, message_desc_jp, result_text, result_text_en, result_text_jp, probability, next_event_id, effects, outcome, result_condition, selection_condition)',
    order: ['id'],
    tag: CACHE_TAGS.mirrorDungeon,
  },
  keywords: {
    table: 'keyword_meta',
    columns: 'name, name_en, name_jp, description, description_en, description_jp, max_stack, icon_slug, category, effect_type, game_id',
    order: ['name'],
    tag: CACHE_TAGS.keywords,
  },
}

/**
 * Every row of a partner catalog in all three languages, cached until a game data sync invalidates it.
 * One request, and PostgREST returns at most 1,000 rows. The largest catalog has 456 (gifts); page it when one nears 1,000.
 */
export async function loadCatalog(resource: string): Promise<Row[]> {
  'use cache'
  cacheLife('max')
  const catalog = CATALOGS[resource]
  cacheTag(catalog.tag, CACHE_TAGS.gameData)
  let query = db().from(catalog.table).select(catalog.columns)
  for (const column of catalog.order) query = query.order(column)
  const { data, error } = await query
  // Errors are thrown so that a failed read is never cached as an empty catalog.
  if (error) throw new Error(error.message)
  return data as unknown as Row[]
}

/** One identity or E.G.O with its skills and passives; null when it does not exist. */
export async function loadCatalogItem(resource: 'identities' | 'egos', id: string): Promise<Row | null> {
  'use cache'
  cacheLife('max')
  const catalog = CATALOGS[resource]
  cacheTag(catalog.tag, CACHE_TAGS.gameData)
  const { data, error } = await db().from(catalog.table).select(`${catalog.columns}, ${catalog.detail}`).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data as unknown as Row | null
}

const FORMATION_IDENTITY = `id, game_id, sinner_id, folder_name, name_kr, name_en, name_jp, rarity, slash_res, pierce_res, blunt_res, ${SKILLS}`
const FORMATION_EGO = 'id, sinner_id, name_kr, name_en, name_jp, grade, sin_affinity, image_url, cost, ego_skills(skill_type, category, construe_level, skill_order)'

/** A public deck with every slot's identity, skills and E.G.O, for presentDeck. */
export async function loadDeckDetail(id: string): Promise<Row | null> {
  const { data, error } = await db()
    .from('decks')
    .select(`id, title, description, lang, main_keywords, tags, created_at, updated_at, vote_count, view_count, deck_identities(slot_order, uptie, s1_count, s2_count, s3_count, identity:identities(${FORMATION_IDENTITY})), deck_egos(grade, ego:ego_id(${FORMATION_EGO}))`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as unknown as Row | null
}

/** A public plan plus the identities and E.G.O its JSON refers to, for presentPlan. */
export async function loadPlanDetail(id: string): Promise<{ plan: Row; identities: Row[]; egos: Row[] } | null> {
  const { data: plan, error } = await db()
    .from('md_plans')
    .select('id, title, description, lang, difficulty, deck, egos, floor_plan, gift_inventory, tags, created_at, updated_at, vote_count, view_count')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!plan) return null
  const ids = (value: unknown, key: string) => (Array.isArray(value) ? value.map(entry => entry?.[key]).filter((entry): entry is string => isUuid(entry)) : [])
  const [identities, egos] = await Promise.all([
    db().from('identities').select(FORMATION_IDENTITY).in('id', ids(plan.deck, 'identity_id')),
    db().from('ego').select(FORMATION_EGO).in('id', ids(plan.egos, 'ego_id')),
  ])
  if (identities.error || egos.error) throw new Error((identities.error ?? egos.error)!.message)
  return { plan, identities: identities.data as unknown as Row[], egos: egos.data as unknown as Row[] }
}
