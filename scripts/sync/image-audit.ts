import type { SupabaseClient } from '@supabase/supabase-js'
import { expectedSkillIcons } from './skill-icons'
import { keywordIconSource } from './keyword-icons'
import { storageKeyOf } from './sync-result'

/** Read-only look at the images the DB references against what Storage holds: nothing here writes. */
export const IMAGE_AUDIT_KINDS = ['keywords', 'skills', 'gifts', 'themePacks', 'events'] as const
export type ImageKind = typeof IMAGE_AUDIT_KINDS[number]
export type KindAudit = { checked: number; missing: number; keys: string[] }
export type MissingImages = Record<ImageKind, KindAudit>
/** How many missing keys per kind are kept in the report (the count is always complete). */
export const IMAGE_AUDIT_KEY_LIMIT = 20

export type AuditSource = {
  rows(table: string, columns: string): Promise<Record<string, unknown>[]>
  /** Names of the files directly inside a Storage folder. */
  list(dir: string): Promise<ReadonlySet<string>>
}

type Options = {
  limit?: number
  /** Whether a site asset (`/assets/game-ui/...`) exists; without it local keyword icons are not checked. */
  localExists?: (publicPath: string) => boolean
}

const text = (value: unknown) => typeof value === 'string' && value ? value : null

/**
 * For every kind, the Storage key each DB row makes the site request (keyword icons through the site's own alias/variant resolution,
 * skill icons as the skill pages build them, gift/theme pack/event images from their image_url) and whether Storage has it.
 * Theme pack boss images are not audited.
 */
export async function auditImages(source: AuditSource, options: Options = {}): Promise<MissingImages> {
  const limit = options.limit ?? IMAGE_AUDIT_KEY_LIMIT
  const [keywords, identities, skills, gifts, themes, events] = await Promise.all([
    source.rows('keyword_meta', 'name,icon_slug'),
    source.rows('identities', 'id,game_id,sinner_id'),
    source.rows('skills', 'id,identity_id,image_id,skill_order,uptie_level'),
    source.rows('ego_gifts', 'image_url'),
    source.rows('ego_gift_themes', 'image_url'),
    source.rows('md_events', 'image_url'),
  ])

  // Storage keys per kind, and the local site assets keyword icons are drawn from.
  const refs: Record<ImageKind, Set<string>> = { keywords: new Set(), skills: new Set(), gifts: new Set(), themePacks: new Set(), events: new Set() }
  const local = new Set<string>()
  for (const row of keywords) {
    const icon = keywordIconSource(String(row.name), text(row.icon_slug))
    if (icon?.kind === 'storage') refs.keywords.add(icon.key)
    else if (icon?.kind === 'local' && options.localExists) local.add(icon.path)
  }
  for (const key of expectedSkillIcons(identities as never, skills as never).keys()) refs.skills.add(key)
  for (const [kind, rows] of [['gifts', gifts], ['themePacks', themes], ['events', events]] as const) {
    for (const row of rows) { const key = storageKeyOf(text(row.image_url)); if (key) refs[kind].add(key) }
  }

  const folders = new Map<string, ReadonlySet<string>>()
  const has = async (key: string) => {
    const dir = key.slice(0, Math.max(0, key.lastIndexOf('/')))
    if (!folders.has(dir)) folders.set(dir, await source.list(dir))
    return folders.get(dir)!.has(key.slice(dir.length + 1))
  }
  const result = {} as MissingImages
  for (const kind of IMAGE_AUDIT_KINDS) {
    const missing: string[] = []
    for (const key of refs[kind]) if (!await has(key)) missing.push(key)
    if (kind === 'keywords') for (const path of local) if (!options.localExists!(path)) missing.push(path)
    result[kind] = { checked: refs[kind].size + (kind === 'keywords' ? local.size : 0), missing: missing.length, keys: missing.slice(0, limit) }
  }
  return result
}

/** One log line per kind. */
export function formatMissingImages(result: MissingImages) {
  return IMAGE_AUDIT_KINDS.map(kind => {
    const { checked, missing, keys } = result[kind]
    if (!missing) return `${kind}: all ${checked} present`
    return `${kind}: ${missing} of ${checked} missing: ${keys.join(', ')}${missing > keys.length ? `, +${missing - keys.length} more` : ''}`
  })
}

/** The audit as the apply runs it: a failure to read is noted, never thrown (the audit warns, it does not fail an apply). */
export async function auditImagesSafely(source: AuditSource, options: Options = {}): Promise<MissingImages | { error: string }> {
  try { return await auditImages(source, options) } catch (error) { return { error: error instanceof Error ? error.message : String(error) } }
}

/** Reads the `limbus` tables and the `limbus-assets` bucket through a Supabase client (select and list only). */
export function supabaseAuditSource(client: SupabaseClient): AuditSource {
  return {
    async rows(table, columns) {
      const rows: Record<string, unknown>[] = []
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.schema('limbus').from(table).select(columns).order(table === 'keyword_meta' ? 'name' : 'id').range(offset, offset + 999)
        if (error) throw Error(`${table}: ${error.message}`)
        rows.push(...(data as unknown as Record<string, unknown>[]))
        if (data.length < 1000) return rows
      }
    },
    async list(dir) {
      const names = new Set<string>()
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.storage.from('limbus-assets').list(dir, { limit: 1000, offset })
        if (error) throw Error(`Storage ${dir}: ${error.message}`)
        for (const item of data) names.add(item.name)
        if (data.length < 1000) return names
      }
    },
  }
}
