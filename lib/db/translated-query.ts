import { createAdminClient } from '@/lib/supabase/admin'
import type { SupportedLang } from '@/lib/i18n/types'

/**
 * Fetch translated game entities.
 * For 'ko', returns base table data directly (no JOIN needed).
 * For 'en'/'ja', overlays name/description from game_translations.
 */
export async function getTranslatedEntities<T extends Record<string, unknown>>(options: {
  table: string
  select: string
  lang: SupportedLang
  filters?: Record<string, unknown>
  orderBy?: { column: string; ascending?: boolean }
  limit?: number
}): Promise<T[]> {
  const { table, select, lang, filters, orderBy, limit } = options
  const supabase = createAdminClient()

  let query = supabase.schema('limbus').from(table).select(select)

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }
  }
  if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error || !data) {
    if (error) console.error('[getTranslatedEntities] query error:', error)
    return []
  }

  // Korean is the base language — no translation needed
  if (lang === 'ko') return data as unknown as T[]

  // For EN/JA, fetch translations and overlay
  return applyTranslations(data as unknown as T[], table, lang)
}

/**
 * Apply translations from game_translations table to entities.
 * Overlays `name` and `description` fields if translations exist.
 */
async function applyTranslations<T extends Record<string, unknown>>(
  entities: T[],
  entityType: string,
  lang: SupportedLang,
): Promise<T[]> {
  if (entities.length === 0) return entities

  const supabase = createAdminClient()

  // Get game_ids from entities (use game_id if available, else id)
  const gameIds = entities.map(e => String(e.game_id ?? e.id))

  const { data: translations, error } = await supabase
    .schema('limbus')
    .from('game_translations')
    .select('entity_id, name, description')
    .eq('entity_type', entityType)
    .eq('lang', lang)
    .in('entity_id', gameIds)

  if (error) {
    console.error('[applyTranslations] translation fetch error:', error)
    return entities
  }

  if (!translations || translations.length === 0) return entities

  const translationMap = new Map(
    translations.map(t => [t.entity_id, t])
  )

  return entities.map(entity => {
    const entityId = String(entity.game_id ?? entity.id)
    const translation = translationMap.get(entityId)
    if (!translation) return entity

    return {
      ...entity,
      // Overlay name fields — keep original as fallback
      ...(translation.name && entity.name != null ? { name: translation.name } : {}),
      ...(translation.name && entity.name_kr != null ? { name_kr: translation.name } : {}),
      ...(translation.description != null ? { description: translation.description } : {}),
    }
  })
}

/**
 * Translate a single entity's name/description.
 * Useful for detail pages where you already have the entity.
 */
export async function translateEntity<T extends Record<string, unknown>>(
  entity: T,
  entityType: string,
  lang: SupportedLang,
): Promise<T> {
  if (lang === 'ko') return entity

  const results = await applyTranslations([entity], entityType, lang)
  return results[0]
}
