import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { STORAGE_BASE } from '../../lib/constants/game'
import { getKeywordIconUrl } from '../../lib/constants/keywords'

/** Keyword icons the extraction ships as buff sprites: Images/키워드/<SpriteName>_<KR label>.png, manifest kind '키워드' (name: sprite). */
export const KEYWORD_SPRITE_KIND = '키워드'
export const KEYWORD_ICON_DIR = 'icons/keywords'
/** apply-extraction.ts has the keywords sync write its keyword rows (name, tag, …) here, so this step knows each keyword's primary tag. */
export const KEYWORD_AUDIT_FILE = 'keyword-audit.json'

export type ManifestEntry = { kind: string; name: string; path: string; sha256: string }
/** Objects an apply uploaded; none replaced an existing one (before: null), so extraction-restore removes them. */
export type Upload = { key: string; before: null }
type Bucket = { upload(key: string, body: Buffer, options: { contentType: string; cacheControl: string; upsert: boolean }): PromiseLike<{ error: { message: string } | null }> }

export type KeywordIconReport = {
  /** Icons uploaded (or, without --fix, that would be): the keyword, its Storage key and the sprite it came from. */
  newKeywordIcons: { name: string; key: string; sprite: string }[]
  /** Keywords whose icon is missing in Storage and could not be paired with exactly one extracted sprite. */
  keywordsWithoutIcon: { name: string; slug: string; reason: 'no-sprite' | 'ambiguous'; tags: string[]; sprites: string[] }[]
}

const toRecordList = (value: unknown): Record<string, unknown>[] => {
  const record = value as { list?: unknown; dataList?: unknown } | null
  const list = Array.isArray(value) ? value : record?.list ?? record?.dataList
  return Array.isArray(list) ? list.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : []
}

/** Buff id → the sprite its icon uses when that is not the id itself (`iconId`, 300 entries of the 9/24 data). A file that parses badly is skipped. */
export function readBuffIconIds(dataDir: string): Map<string, string> {
  const ids = new Map<string, string>()
  for (const file of readdirSync(dataDir).filter(name => /buff.*\.txt$/i.test(name)).sort()) {
    let value: unknown
    try { value = JSON.parse(readFileSync(join(dataDir, file), 'utf8').replace(/^﻿/, '')) } catch { continue }
    for (const item of toRecordList(value)) {
      const icon = item.iconId ?? item.iconID
      // The same buff in two files can lack iconId in one: the first one that names a sprite wins.
      if (typeof item.id === 'string' && typeof icon === 'string' && icon && !ids.has(item.id)) ids.set(item.id, icon)
    }
  }
  return ids
}

/** Keyword name → its primary tag, from the rows the keywords sync wrote to the audit file (empty if it was not written). */
export function readKeywordAudit(file: string): Map<string, string> {
  const tags = new Map<string, string>()
  if (!existsSync(file)) return tags
  for (const row of JSON.parse(readFileSync(file, 'utf8')) as { name?: unknown; tag?: unknown }[]) {
    if (typeof row.name === 'string' && typeof row.tag === 'string' && row.tag) tags.set(row.name, row.tag)
  }
  return tags
}

/**
 * Storage key the site reads this keyword's icon from, only when it is `icons/keywords/<its own slug>.webp`. Local assets (stat icons,
 * coins, atlas keywords) and slugs the site's alias/variant tables point at another file are not this step's to upload.
 */
export function keywordIconKey(name: string, slug: string | null): string | null {
  if (!slug) return null
  const url = getKeywordIconUrl(name, slug)
  const prefix = `${STORAGE_BASE}/${KEYWORD_ICON_DIR}/`
  if (!url?.startsWith(prefix)) return null
  const file = decodeURIComponent(url.slice(prefix.length))
  return file === `${slug}.webp` ? `${KEYWORD_ICON_DIR}/${file}` : null
}

type Resolution = { entry: ManifestEntry; sprite: string } | { reason: 'no-sprite' | 'ambiguous'; sprites: string[] }

/**
 * The one sprite of a keyword: for each candidate tag the buff's `iconId` (else the tag) names the sprite, which must have exactly one image
 * in the manifest. Tags that lead to different sprites are settled by the primary tag; otherwise the keyword is reported, not guessed.
 */
function resolveSprite(tags: string[], primaryTag: string | undefined, iconIds: ReadonlyMap<string, string>, manifest: readonly ManifestEntry[]): Resolution {
  const found = new Map<string, ManifestEntry>(), bySprite = new Map<string, string>(), ambiguous = new Set<string>()
  for (const tag of tags) {
    const sprite = iconIds.get(tag) ?? tag
    bySprite.set(tag, sprite)
    const matches = manifest.filter(entry => entry.kind === KEYWORD_SPRITE_KIND && entry.name === sprite)
    if (!matches.length) continue
    // Two files for one sprite name that differ cannot be told apart.
    if (new Set(matches.map(entry => entry.sha256.toLowerCase())).size > 1) ambiguous.add(sprite)
    else found.set(sprite, matches[0])
  }
  const sprites = [...new Set([...found.keys(), ...ambiguous])]
  if (!sprites.length) return { reason: 'no-sprite', sprites: [...new Set(bySprite.values())] }
  const primary = primaryTag ? bySprite.get(primaryTag) : undefined
  const chosen = sprites.length === 1 ? sprites[0] : primary && sprites.includes(primary) ? primary : null
  const entry = chosen ? found.get(chosen) : undefined
  return entry ? { entry, sprite: chosen! } : { reason: 'ambiguous', sprites }
}

/** A manifest image as lossless WebP after its hash is checked against the manifest (UI icons are never recompressed lossy). */
async function losslessWebp(source: string, entry: ManifestEntry) {
  const bytes = readFileSync(join(source, 'Images', entry.path))
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256.toLowerCase()) throw Error(`image hash mismatch: ${entry.path}`)
  return sharp(bytes).webp({ lossless: true }).toBuffer()
}

/**
 * Uploads the keyword icons Storage lacks (icons/keywords/<slug>.webp) from the extraction's keyword sprites; existing files are never
 * replaced (upsert: false) and each upload is recorded in `uploads` so a restore deletes it. Without `fix` it only plans.
 */
export async function uploadMissingKeywordIcons(options: {
  source: string
  manifest: readonly ManifestEntry[]
  /** keyword_meta rows (name, icon_slug) as they are in the DB after the keywords sync. */
  keywords: readonly { name: string; icon_slug: string | null }[]
  /** game_text_refs rows that name a keyword: each id is a candidate tag of it. */
  refs: readonly { id: string; keyword_name: string | null }[]
  /** Primary tag per keyword name (readKeywordAudit). */
  primaryTags: ReadonlyMap<string, string>
  iconIds: ReadonlyMap<string, string>
  /** File names in Storage icons/keywords/. */
  stored: ReadonlySet<string>
  bucket: Bucket
  uploads: Upload[]
  fix: boolean
}): Promise<KeywordIconReport> {
  const refTags = new Map<string, string[]>()
  for (const ref of options.refs) if (ref.keyword_name) refTags.set(ref.keyword_name, [...(refTags.get(ref.keyword_name) ?? []), ref.id])
  const report: KeywordIconReport = { newKeywordIcons: [], keywordsWithoutIcon: [] }
  const planned = new Set<string>()
  for (const { name, icon_slug: slug } of [...options.keywords].sort((a, b) => a.name.localeCompare(b.name, 'ko'))) {
    const key = keywordIconKey(name, slug)
    if (!key || options.stored.has(key.slice(KEYWORD_ICON_DIR.length + 1)) || planned.has(key)) continue
    const primary = options.primaryTags.get(name)
    const tags = [...new Set([...(primary ? [primary] : []), ...(refTags.get(name) ?? []).sort()])]
    const found = resolveSprite(tags, primary, options.iconIds, options.manifest)
    if (!('entry' in found)) { report.keywordsWithoutIcon.push({ name, slug: slug!, reason: found.reason, tags, sprites: found.sprites }); continue }
    planned.add(key)
    if (options.fix) {
      const { error } = await options.bucket.upload(key, await losslessWebp(options.source, found.entry), { contentType: 'image/webp', cacheControl: '3600', upsert: false })
      if (error) throw Error(`upload ${key}: ${error.message}`)
      options.uploads.push({ key, before: null })
    }
    report.newKeywordIcons.push({ name, key, sprite: found.sprite })
  }
  return report
}
