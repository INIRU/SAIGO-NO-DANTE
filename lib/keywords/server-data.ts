import { cacheLife, cacheTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import type { KeywordInfo } from '@/lib/keywords/catalog'
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
})
const KeywordRowsSchema = z.array(KeywordRowSchema)
const KEYWORD_META_BASE_SELECT = 'name, description, max_stack, icon_slug, sin_affinity, name_en, name_jp, description_en, description_jp'
const KEYWORD_META_EFFECT_SELECT = `${KEYWORD_META_BASE_SELECT}, effect_type`

function isMissingEffectTypeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
  const text = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
  return candidate.code === '42703' || (text.includes('effect_type') && text.includes('column'))
}

export async function getKeywordData(): Promise<Record<string, KeywordInfo>> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.keywords, CACHE_TAGS.gameData)

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

  const effectResult = await fetchKeywordRows(KEYWORD_META_EFFECT_SELECT)
  if (effectResult.error && isMissingEffectTypeError(effectResult.error)) {
    const baseResult = await fetchKeywordRows(KEYWORD_META_BASE_SELECT)
    allData.push(...baseResult.rows)
  } else {
    allData.push(...effectResult.rows)
  }

  const keywords: Record<string, KeywordInfo> = {}
  let parsedRows: z.infer<typeof KeywordRowsSchema>
  try {
    parsedRows = KeywordRowsSchema.parse(allData)
  } catch (parseErr) {
    console.error('[layout] keyword_meta parse error:', parseErr)
    parsedRows = []
  }
  for (const row of parsedRows) {
    keywords[row.name] = {
      desc: row.description ?? '',
      ...(row.max_stack != null ? { maxStack: row.max_stack } : {}),
      ...(row.icon_slug ? { iconSlug: row.icon_slug } : {}),
      ...(row.sin_affinity ? { sinAffinity: row.sin_affinity } : {}),
      ...(row.effect_type ? { effectType: row.effect_type } : {}),
      nameEn: row.name_en ?? null,
      nameJp: row.name_jp ?? null,
      descEn: row.description_en ?? null,
      descJp: row.description_jp ?? null,
    }
  }
  return keywords
}

/**
 * Keep only the description the reader's locale shows (getLocalizedKeywordDesc falls
 * back to Korean only when the locale text is missing). Names stay in every locale
 * because keyword text matching uses them.
 */
export function localizeKeywordCatalog(keywords: Record<string, KeywordInfo>, lang: SupportedLang): Record<string, KeywordInfo> {
  const out: Record<string, KeywordInfo> = {}
  for (const [name, info] of Object.entries(keywords)) {
    const local = lang === 'en' ? info.descEn : lang === 'ja' ? info.descJp : null
    out[name] = {
      ...info,
      desc: local ? '' : info.desc,
      descEn: lang === 'en' ? info.descEn : null,
      descJp: lang === 'ja' ? info.descJp : null,
    }
  }
  return out
}
