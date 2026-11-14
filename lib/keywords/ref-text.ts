import type { SupabaseClient } from '@supabase/supabase-js'
import { hasRawPlaceholder } from '@/lib/game-text/placeholders'
import { gameTextToPlain } from '@/lib/game-text/rich-text'
import { KEYWORD_DESCRIPTION_OVERRIDES } from '@/lib/keywords/description-overrides'

/**
 * Display texts of a keyword live in limbus.game_text_refs (the game's own BattleKeywords entry, one row per game id);
 * limbus.keyword_meta keeps the curated fields (icon, category, max stack, effect type) and its own copies of the texts as
 * the fallback. keyword_meta.game_id names the primary reference of a keyword. The Korean `name` stays the catalogue key.
 */
export type KeywordRefTexts = {
  name: string | null
  name_en: string | null
  name_jp: string | null
  description: string | null
  description_en: string | null
  description_jp: string | null
}

type KeywordRefTextTable = Readonly<Record<string, KeywordRefTexts>>

/** The keyword_meta fields the references replace. */
type KeywordMetaTexts = {
  name: string
  game_id?: string | null
  name_en?: string | null
  name_jp?: string | null
  description?: string | null
  description_en?: string | null
  description_jp?: string | null
}

const text = (value: string | null | undefined) => (value && value.trim() ? value : null)
/** A reference name as plain text: the game writes some names with Unity tags (`[<s>큰 형님</s>]`, `サ<size=50%>ル</size>`). */
const plainName = (value: string | null | undefined) => text(value) && text(gameTextToPlain(value!, { keepPlaceholders: true }).trim())

/**
 * `row` with the localized names and descriptions of its primary reference (row.game_id), per language and only where
 * the reference has a non-empty text; every other value stays keyword_meta's. Two exceptions keep keyword_meta's text:
 * the hand-written Korean description (KEYWORD_DESCRIPTION_OVERRIDES), and a description in which the reference still has
 * a bare `{0}` slot while keyword_meta holds the labelled `{{potency}}` form — unless keyword_meta has none.
 */
export function keywordTextsFromRefs<T extends KeywordMetaTexts>(row: T, refs: KeywordRefTextTable | null | undefined): T {
  const ref = row.game_id ? refs?.[row.game_id] : undefined
  if (!ref) return row
  const description = (own: string | null | undefined, fromRef: string | null | undefined) => {
    // keyword_meta holds descriptions trimmed (rawGameText); the game's own text keeps stray trailing spaces and newlines.
    const candidate = text(fromRef)?.trim()
    if (!candidate) return own
    return hasRawPlaceholder(candidate) && text(own) ? own : candidate
  }
  return {
    ...row,
    name_en: plainName(ref.name_en) ?? row.name_en,
    name_jp: plainName(ref.name_jp) ?? row.name_jp,
    description: row.name in KEYWORD_DESCRIPTION_OVERRIDES ? row.description : description(row.description, ref.description),
    description_en: description(row.description_en, ref.description_en),
    description_jp: description(row.description_jp, ref.description_jp),
  }
}

const PAGE = 1000

/**
 * Keyword references by game id, or null when the table cannot be read (the callers then show keyword_meta's texts).
 * Plain read, not cached: it runs inside the callers' cached functions.
 */
export async function loadKeywordRefTexts(supabase: SupabaseClient): Promise<Record<string, KeywordRefTexts> | null> {
  const table: Record<string, KeywordRefTexts> = {}
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.schema('limbus').from('game_text_refs')
      .select('id, name, name_en, name_jp, description, description_en, description_jp')
      .eq('kind', 'keyword')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[keywords] game_text_refs read failed, using keyword_meta texts:', error.message)
      return null
    }
    for (const row of (data ?? []) as unknown as (KeywordRefTexts & { id: string })[]) {
      table[row.id] = {
        name: row.name, name_en: row.name_en, name_jp: row.name_jp,
        description: row.description, description_en: row.description_en, description_jp: row.description_jp,
      }
    }
    if (!data || data.length < PAGE) break
  }
  return table
}

/** PostgREST / Postgres "column does not exist": a migration this code reads has not been applied yet. */
export function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
  const text = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
  return candidate.code === '42703' || candidate.code === 'PGRST204' || (text.includes('column') && text.includes('does not exist'))
}
