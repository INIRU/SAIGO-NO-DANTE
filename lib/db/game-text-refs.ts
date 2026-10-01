import { cacheLife, cacheTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import type { SupportedLang } from '@/lib/i18n/types'

/** What a `[Id]` of raw game text is, in one language: its kind, label and (keywords) the keyword_meta row it maps to. */
export type GameTextRefName = { k: 'keyword' | 'skilltag'; n: string; kw?: string }
export type GameTextRefNames = Record<string, GameTextRefName>
export type GameTextRefDescriptions = Record<string, string>

const RowSchema = z.object({
  id: z.string(),
  kind: z.enum(['keyword', 'skilltag']),
  name: z.string().nullable(),
  name_en: z.string().nullable(),
  name_jp: z.string().nullable(),
  description: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  description_jp: z.string().nullable().optional(),
  keyword_name: z.string().nullable(),
})
export type GameTextRefRow = z.infer<typeof RowSchema>

const NAME_COLUMNS = 'id, kind, name, name_en, name_jp, keyword_name'
const ALL_COLUMNS = `${NAME_COLUMNS}, description, description_en, description_jp`
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

export async function getGameTextRefNames(lang: SupportedLang): Promise<GameTextRefNames> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameTextRefs, CACHE_TAGS.gameData)
  return gameTextRefNames(await loadRows(NAME_COLUMNS), lang)
}

/**
 * For the [lang] layout, which hands the names to every page: a failed read or a still empty table gives null instead of
 * an error, so the site keeps working and the browser requests the names itself (the first paint then shows raw ids once).
 */
export async function getGameTextRefNamesOrNull(lang: SupportedLang): Promise<GameTextRefNames | null> {
  try {
    const names = await getGameTextRefNames(lang)
    return Object.keys(names).length > 0 ? names : null
  } catch {
    return null
  }
}

export async function getGameTextRefDescriptions(lang: SupportedLang): Promise<GameTextRefDescriptions> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameTextRefs, CACHE_TAGS.gameData)
  return gameTextRefDescriptions(await loadRows(ALL_COLUMNS), lang)
}
