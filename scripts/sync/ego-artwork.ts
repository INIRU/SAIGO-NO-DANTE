import { createHash } from 'node:crypto'
import { STORAGE_BASE } from '../../lib/constants/game'

/**
 * Full-size E.G.O art for the detail hero: `{game id}_cg-{hash12}.webp` next to the profile, hash12 = first 12 hex of the
 * SHA-256 of that WebP (the convention of lib/generated/ego-artwork.json, docs/data-pipeline.md), quality 95.
 * The hashed name never repeats for different bytes, so the URL can be cached for good and a changed picture gets a new URL.
 * The row's `ego.artwork_url` holds the public URL; getEgoArtworkUrl (lib/utils/images.ts) prefers it over the hand-kept map.
 */
export const EGO_ARTWORK_QUALITY = 95

/** Objects an apply uploaded; none replaced an existing one (before: null), so extraction-restore removes them. */
export type Upload = { key: string; before: null }
type Bucket = { upload(key: string, body: Buffer, options: { contentType: string; cacheControl: string; upsert: boolean }): PromiseLike<{ error: { message: string } | null }> }

export const egoArtworkHash = (webp: Buffer) => createHash('sha256').update(webp).digest('hex').slice(0, 12)
export const egoArtworkFile = (gameId: string, hash: string) => `${gameId}_cg-${hash}.webp`
export const egoFolderKey = (sinnerId: string, folder: string) => `sinners/${sinnerId}/ego/${folder}`
/** Public URL of a Storage key; every segment is encoded as the EGO profile URLs are ("9 2" → "9%202"). */
export const egoArtworkPublicUrl = (key: string) => `${STORAGE_BASE}/${key.split('/').map(encodeURIComponent).join('/')}`

export type EgoArtworkUpload = { gameId: string; key: string; url: string; uploaded: boolean }

/**
 * Uploads the hashed copy of an EGO's art unless Storage has it. Never replaces (upsert: false); an upload recorded in `uploads`
 * is removed by a restore. Without `fix` it only plans. `stored` is the file names in the EGO's folder and gains each upload.
 */
export async function uploadEgoArtworkCopy(options: {
  ego: { game_id: string; sinner_id: string; folder_name: string }
  webp: Buffer
  stored: Set<string>
  bucket: Bucket
  uploads: Upload[]
  fix: boolean
}): Promise<EgoArtworkUpload> {
  const { ego, webp } = options
  const file = egoArtworkFile(ego.game_id, egoArtworkHash(webp))
  const key = `${egoFolderKey(ego.sinner_id, ego.folder_name)}/${file}`
  const result = { gameId: ego.game_id, key, url: egoArtworkPublicUrl(key), uploaded: false }
  if (!options.fix || options.stored.has(file)) return result
  const { error } = await options.bucket.upload(key, webp, { contentType: 'image/webp', cacheControl: '3600', upsert: false })
  if (error) {
    // Same name means same bytes: an object that appeared meanwhile is the one wanted.
    if (/already exists|duplicate/i.test(error.message)) { options.stored.add(file); return result }
    throw Error(`upload ${key}: ${error.message}`)
  }
  options.uploads.push({ key, before: null })
  options.stored.add(file)
  return { ...result, uploaded: true }
}

export type EgoArtworkRow = { id: string; game_id: string; sinner_id: string; folder_name: string; image_url: string | null; artwork_url: string | null }
export type EgoArtworkAction =
  | { kind: 'map'; id: string; gameId: string; url: string }
  | { kind: 'copy'; id: string; gameId: string; sinnerId: string; folder: string; from: string }
  | { kind: 'skip'; id: string; gameId: string; reason: 'has-artwork-url' | 'profile-not-awaken' | 'no-cg' }

const PROFILE = /\d+_awaken_profile\.webp(?:\?.*)?$/

/**
 * What backfill-ego-artwork-url.ts does per EGO row, decided from data only:
 *  - artwork_url already set: skip (a rerun changes nothing);
 *  - image_url is not an `_awaken_profile` (e.g. 21210 already shows its CG): skip, the hero uses image_url as it is;
 *  - id in the hand-kept map: artwork_url = the profile URL with `{id}_cg-{hash}.webp`;
 *  - else if `{id}_cg.webp` exists in Storage (`cgStored` = game ids): copy it to a hashed name, then set the URL;
 *  - else skip (no cg).
 */
export function planEgoArtworkBackfill(input: { rows: readonly EgoArtworkRow[]; map: Readonly<Record<string, string>>; cgStored: ReadonlySet<string> }): EgoArtworkAction[] {
  return input.rows.map((row): EgoArtworkAction => {
    const base = { id: row.id, gameId: row.game_id }
    if (row.artwork_url) return { kind: 'skip', ...base, reason: 'has-artwork-url' }
    if (!row.image_url || !PROFILE.test(row.image_url)) return { kind: 'skip', ...base, reason: 'profile-not-awaken' }
    const hash = Object.hasOwn(input.map, row.game_id) ? input.map[row.game_id] : null
    if (hash) return { kind: 'map', ...base, url: row.image_url.replace(PROFILE, egoArtworkFile(row.game_id, hash)) }
    if (input.cgStored.has(row.game_id)) {
      return { kind: 'copy', ...base, sinnerId: row.sinner_id, folder: row.folder_name, from: `${egoFolderKey(row.sinner_id, row.folder_name)}/${row.game_id}_cg.webp` }
    }
    return { kind: 'skip', ...base, reason: 'no-cg' }
  })
}
