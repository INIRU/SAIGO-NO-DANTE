import { cacheLife, cacheTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import type { KeywordInfo } from '@/lib/keywords/catalog'
import { isMissingColumnError, keywordTextsFromRefs, loadKeywordRefTexts } from '@/lib/keywords/ref-text'
import type { SupportedLang } from '@/lib/i18n/types'

const KeywordRowSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  max_stack: z.number().nullable().optional(),
  icon_slug: z.string().nullable().optional(),
  sin_affinity: z.string().nullable().optional(),
  effect_type: z.enum(['positive', 'negative', 'neutral']).nullable().optional(),
  name_en: z.string().nullable().optional(),
  name_jp: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  description_jp: z.string().nullable().optional(),
  game_id: z.string().nullable().optional(),
})
const KeywordRowsSchema = z.array(KeywordRowSchema)
const KEYWORD_META_BASE_SELECT = 'name, description, max_stack, icon_slug, sin_affinity, name_en, name_jp, description_en, description_jp'
// Most complete first: a column whose migration is not applied yet (effect_type, game_id) falls back to the next set.
const KEYWORD_META_SELECTS = [
  `${KEYWORD_META_BASE_SELECT}, effect_type, game_id`,
  `${KEYWORD_META_BASE_SELECT}, effect_type`,
  KEYWORD_META_BASE_SELECT,
]

async function loadKeywordData(): Promise<Record<string, KeywordInfo>> {
  const supabase = createAdminClient()
  const allData: any[] = []

  const fetchKeywordRows = async (selectColumns: string) => {
    const rows: any[] = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .schema('limbus')
        .from('keyword_meta')
        .select(selectColumns)
        .range(from, from + 999)
      if (error) return { rows, error }
      if (!data || data.length === 0) break
      rows.push(...data)
      if (data.length < 1000) break
      from += 1000
    }
    return { rows, error: null }
  }

  for (const select of KEYWORD_META_SELECTS) {
    const result = await fetchKeywordRows(select)
    if (result.error && isMissingColumnError(result.error) && select !== KEYWORD_META_BASE_SELECT) continue
    allData.push(...result.rows)
    break
  }

  const keywords: Record<string, KeywordInfo> = {}
  let parsedRows: z.infer<typeof KeywordRowsSchema>
  try {
    parsedRows = KeywordRowsSchema.parse(allData)
  } catch (parseErr) {
    console.error('[layout] keyword_meta parse error:', parseErr)
    parsedRows = []
  }
  // Names and descriptions come from the game text references of rows with a game_id (keyword_meta's are the fallback).
  const refs = parsedRows.some(row => row.game_id) ? await loadKeywordRefTexts(supabase) : null
  for (const row of parsedRows.map(row => keywordTextsFromRefs(row, refs))) {
    keywords[row.name] = {
      desc: row.description ?? '',
      ...(row.max_stack != null ? { maxStack: row.max_stack } : {}),
      ...(row.icon_slug ? { iconSlug: row.icon_slug } : {}),
      ...(row.sin_affinity ? { sinAffinity: row.sin_affinity } : {}),
      ...(row.effect_type ? { effectType: row.effect_type } : {}),
      ...(row.game_id ? { gameId: row.game_id } : {}),
      nameEn: row.name_en ?? null,
      nameJp: row.name_jp ?? null,
      descEn: row.description_en ?? null,
      descJp: row.description_jp ?? null,
    }
  }
  return keywords
}

export async function getKeywordData(): Promise<Record<string, KeywordInfo>> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.keywords, CACHE_TAGS.gameData)
  return loadKeywordData()
}

/**
 * keywordCatalogWithoutDescriptions, cached on its own for the layout. A page rendered per request is resumed with the
 * cache entries its prerender read, sent with every request; this keeps the descriptions out of that state.
 */
export async function getKeywordCatalog(): Promise<Record<string, KeywordInfo>> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.keywords, CACHE_TAGS.gameData)
  return keywordCatalogWithoutDescriptions(await loadKeywordData())
}

/**
 * The catalog every page carries (keyword names, icons, colours for skill text) without descriptions: those appear only
 * in tooltips, which load them from /api/keyword-descriptions/[lang] (keywordDescriptions) when first needed.
 */
export function keywordCatalogWithoutDescriptions(keywords: Record<string, KeywordInfo>): Record<string, KeywordInfo> {
  const out: Record<string, KeywordInfo> = {}
  for (const [name, info] of Object.entries(keywords)) out[name] = { ...info, desc: '', descEn: null, descJp: null }
  return out
}

/** Each keyword's description as the locale shows it (Korean when the locale text is missing). */
export function keywordDescriptions(keywords: Record<string, KeywordInfo>, lang: SupportedLang): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, info] of Object.entries(keywords)) {
    const text = (lang === 'en' ? info.descEn : lang === 'ja' ? info.descJp : null) || info.desc
    if (text) out[name] = text
  }
  return out
}
