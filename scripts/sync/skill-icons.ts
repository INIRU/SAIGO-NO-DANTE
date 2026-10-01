import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { STORAGE_BASE } from '../../lib/constants/game'
import { computeSkillImageIndices, getSkillIconUrl } from '../../lib/utils/images'
import type { ManifestEntry, Upload } from './keyword-icons'

/** Skill icons the extraction ships as Images/스킬/…/<sprite>_<name>.png, manifest kind '스킬' (name: sprite, e.g. 1041205 or 1041204_4). */
export const SKILL_SPRITE_KIND = '스킬'
export const SKILL_ICON_DIR = 'icons/skills'

type Bucket = { upload(key: string, body: Buffer, options: { contentType: string; cacheControl: string; upsert: boolean }): PromiseLike<{ error: { message: string } | null }> }
type IdentityRow = { id: string; game_id: string | null; sinner_id: string }
type SkillRow = { id: string; identity_id: string; image_id: string | null; skill_order: number; uptie_level: number }
/** Names of the files directly inside a Storage folder. */
export type StorageLister = (dir: string) => Promise<ReadonlySet<string>>

export type SkillIconReport = {
  /** Icons uploaded (or, without --fix, that would be): Storage key, sprite and the identity's game id. */
  newSkillIcons: { key: string; sprite: string; identity: string }[]
  /** Skill icons missing in Storage that the extraction could not supply: no image of that sprite, or two different ones. */
  skillsWithoutIcon: { key: string; sprite: string; identity: string; reason: 'no-sprite' | 'ambiguous' }[]
}

/**
 * Every Storage key the site reads a skill icon from, with the sprite and identity it is for: `getSkillIconUrl` on each skill row, with
 * the image indices `computeSkillImageIndices` gives the identity's skills of one uptie level (used only when a row has no image_id).
 */
export function expectedSkillIcons(identities: readonly IdentityRow[], skills: readonly SkillRow[]) {
  const byIdentity = new Map(identities.map(identity => [identity.id, identity]))
  const groups = new Map<string, SkillRow[]>()
  for (const skill of skills) {
    if (!byIdentity.has(skill.identity_id)) continue
    const group = `${skill.identity_id}/${skill.uptie_level}`
    groups.set(group, [...(groups.get(group) ?? []), skill])
  }
  const icons = new Map<string, { sprite: string; identity: string }>()
  for (const group of groups.values()) {
    const identity = byIdentity.get(group[0].identity_id)!
    const indices = computeSkillImageIndices([...group].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, skill_order }) => ({ id, skill_order })))
    for (const skill of group) {
      const url = getSkillIconUrl({ sinner_id: identity.sinner_id, game_id: identity.game_id }, indices[skill.id] ?? skill.skill_order, skill)
      if (!url.startsWith(`${STORAGE_BASE}/`)) continue
      const key = url.slice(STORAGE_BASE.length + 1)
      if (!icons.has(key)) icons.set(key, { sprite: key.slice(key.lastIndexOf('/') + 1).replace(/\.webp$/, ''), identity: String(identity.game_id) })
    }
  }
  return icons
}

/** A manifest image as lossless WebP after its hash is checked against the manifest (skill icons are never recompressed lossy). */
async function losslessWebp(source: string, entry: ManifestEntry) {
  const bytes = readFileSync(join(source, 'Images', entry.path))
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256.toLowerCase()) throw Error(`image hash mismatch: ${entry.path}`)
  return sharp(bytes).webp({ lossless: true }).toBuffer()
}

/**
 * Uploads the skill icons Storage lacks for identities the DB already has (the new-identity upload only covers new ones, so a skill an
 * existing identity gains later has no icon). Only missing files are written (upsert: false, never replaced) and each is recorded in
 * `uploads` so a restore deletes it. Without `fix` it only plans.
 */
export async function uploadMissingSkillIcons(options: {
  source: string
  manifest: readonly ManifestEntry[]
  identities: readonly IdentityRow[]
  skills: readonly SkillRow[]
  listDir: StorageLister
  bucket: Bucket
  uploads: Upload[]
  fix: boolean
}): Promise<SkillIconReport> {
  const expected = expectedSkillIcons(options.identities, options.skills)
  const stored = new Map<string, ReadonlySet<string>>()
  const report: SkillIconReport = { newSkillIcons: [], skillsWithoutIcon: [] }
  for (const [key, { sprite, identity }] of expected) {
    const dir = key.slice(0, key.lastIndexOf('/'))
    if (!stored.has(dir)) stored.set(dir, await options.listDir(dir))
    if (stored.get(dir)!.has(key.slice(dir.length + 1))) continue
    const matches = options.manifest.filter(entry => entry.kind === SKILL_SPRITE_KIND && entry.name === sprite)
    if (!matches.length) { report.skillsWithoutIcon.push({ key, sprite, identity, reason: 'no-sprite' }); continue }
    // Two files for one sprite name that differ cannot be told apart.
    if (new Set(matches.map(entry => entry.sha256.toLowerCase())).size > 1) { report.skillsWithoutIcon.push({ key, sprite, identity, reason: 'ambiguous' }); continue }
    if (options.fix) {
      const { error } = await options.bucket.upload(key, await losslessWebp(options.source, matches[0]), { contentType: 'image/webp', cacheControl: '3600', upsert: false })
      if (error) throw Error(`upload ${key}: ${error.message}`)
      options.uploads.push({ key, before: null })
    }
    report.newSkillIcons.push({ key, sprite, identity })
  }
  return report
}
