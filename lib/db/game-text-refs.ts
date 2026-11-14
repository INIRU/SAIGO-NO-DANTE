import { cacheLife, cacheTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import type { SupportedLang } from '@/lib/i18n/types'
import { flavorKeyOfKeyword } from '@/lib/game-text/flavor'
import { compactGameTextRefNames, type GameTextRefNamesWire } from '@/lib/game-text/ref-names-wire'

/**
 * What a `[Id]` of raw game text is, in one language: its kind, label and (keywords) the keyword_meta row it maps to.
 * `i` is the buff's own icon file (game_text_refs.icon_slug); without one it draws keyword_meta's.
 */
export type GameTextRefName = { k: 'keyword' | 'skilltag'; n: string; kw?: string; i?: string }
export type GameTextRefNames = Record<string, GameTextRefName>
export type GameTextRefDescriptions = Record<string, string>
/** Flavor lines of the keywords by game id (raw game text), only for keywords that have one. */
export type GameTextRefFlavors = Record<string, string>

const RowSchema = z.object({
  id: z.string(),
  kind: z.enum(['keyword', 'skilltag']),
  name: z.string().nullable(),
  name_en: z.string().nullable(),
  name_jp: z.string().nullable(),
  description: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  description_jp: z.string().nullable().optional(),
  flavor: z.string().nullable().optional(),
  flavor_en: z.string().nullable().optional(),
  flavor_jp: z.string().nullable().optional(),
  keyword_name: z.string().nullable(),
  icon_slug: z.string().nullable().optional(),
})
export type GameTextRefRow = z.infer<typeof RowSchema>

const BASE_COLUMNS = 'id, kind, name, name_en, name_jp, keyword_name'
const NAME_COLUMNS = `${BASE_COLUMNS}, icon_slug`
const ALL_COLUMNS = `${BASE_COLUMNS}, description, description_en, description_jp`
const FLAVOR_COLUMNS = `${BASE_COLUMNS}, flavor, flavor_en, flavor_jp`
const PAGE = 1000

async function loadRows(columns: string): Promise<GameTextRefRow[]> {
  const supabase = createAdminClient()
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .schema('limbus')
      .from('game_text_refs')
      .select(columns)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`game_text_refs: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return z.array(RowSchema).parse(rows)
}

/** The language's own text, else another language's: ko → en → jp, en → ko → jp, ja → ko → en (the game has gaps, e.g. CantBreak is only in JP). */
const pick = (lang: SupportedLang, ko: string | null | undefined, en: string | null | undefined, jp: string | null | undefined) =>
  (lang === 'en' ? en || ko || jp : lang === 'ja' ? jp || ko || en : ko || en || jp) || ''

/** Labels per id as the locale shows them (another language's when the locale text is missing, the id when there is none). */
export function gameTextRefNames(rows: readonly GameTextRefRow[], lang: SupportedLang): GameTextRefNames {
  const out: GameTextRefNames = {}
  for (const row of rows) {
    out[row.id] = {
      k: row.kind,
      n: pick(lang, row.name, row.name_en, row.name_jp) || row.id,
      ...(row.keyword_name ? { kw: row.keyword_name } : {}),
      ...(row.icon_slug ? { i: row.icon_slug } : {}),
    }
  }
  return out
}

/** Game descriptions of the keywords as the locale shows them (raw game text; skill tags have none). */
export function gameTextRefDescriptions(rows: readonly GameTextRefRow[], lang: SupportedLang): GameTextRefDescriptions {
  const out: GameTextRefDescriptions = {}
  for (const row of rows) {
    if (row.kind !== 'keyword') continue
    const text = pick(lang, row.description, row.description_en, row.description_jp)
    if (text) out[row.id] = text
  }
  return out
}

/**
 * Flavor lines of the keywords as the locale shows them (raw game text; most keywords have none), by game id and, for
 * a tooltip of a keyword_meta row, by `kw:<keyword_meta name>` (the first reference of that keyword with a flavor).
 */
function gameTextRefFlavors(rows: readonly GameTextRefRow[], lang: SupportedLang): GameTextRefFlavors {
  const out: GameTextRefFlavors = {}
  for (const row of rows) {
    if (row.kind !== 'keyword') continue
    const text = pick(lang, row.flavor, row.flavor_en, row.flavor_jp).trim()
    if (!text) continue
    out[row.id] = text
    if (row.keyword_name && !out[flavorKeyOfKeyword(row.keyword_name)]) out[flavorKeyOfKeyword(row.keyword_name)] = text
  }
  return out
}

export async function getGameTextRefNames(lang: SupportedLang): Promise<GameTextRefNames> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameTextRefs, CACHE_TAGS.gameData)
  return gameTextRefNames(await loadRows(NAME_COLUMNS), lang)
}

/** getGameTextRefNames in the smaller form of the [lang] layout (see ref-names-wire), read on its own so the layout's cache entries stay small. */
async function getGameTextRefNamesWire(lang: SupportedLang): Promise<GameTextRefNamesWire> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameTextRefs, CACHE_TAGS.gameData)
  return compactGameTextRefNames(gameTextRefNames(await loadRows(NAME_COLUMNS), lang))
}

/** A failed read or a still empty table gives null instead of an error, so the site keeps working. */
async function orNull<T extends object>(read: () => Promise<T>): Promise<T | null> {
  try {
    const names = await read()
    return Object.keys(names).length > 0 ? names : null
  } catch {
    return null
  }
}

/**
 * For the [lang] layout, which hands the names to every page: a failed read or a still empty table gives null instead of
 * an error, so the site keeps working and the browser requests the names itself (the first paint then shows raw ids once).
 */
export async function getGameTextRefNamesWireOrNull(lang: SupportedLang): Promise<GameTextRefNamesWire | null> {
  return orNull(() => getGameTextRefNamesWire(lang))
}

/** The same in the full form, for server code that reads the names itself (the motion feed). */
export async function getGameTextRefNamesOrNull(lang: SupportedLang): Promise<GameTextRefNames | null> {
  return orNull(() => getGameTextRefNames(lang))
}

export async function getGameTextRefDescriptions(lang: SupportedLang): Promise<GameTextRefDescriptions> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameTextRefs, CACHE_TAGS.gameData)
  return gameTextRefDescriptions(await loadRows(ALL_COLUMNS), lang)
}

export async function getGameTextRefFlavors(lang: SupportedLang): Promise<GameTextRefFlavors> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameTextRefs, CACHE_TAGS.gameData)
  return gameTextRefFlavors(await loadRows(FLAVOR_COLUMNS), lang)
}
