import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ManifestEntry, Upload } from '@/scripts/sync/keyword-icons'
import { expectedSkillIcons, uploadMissingSkillIcons } from '@/scripts/sync/skill-icons'

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex').toUpperCase()
const noise = (seed: number) => {
  const raw = Buffer.alloc(16 * 16 * 4)
  for (let i = 0; i < raw.length; i += 4) { raw[i] = (i * 7 + seed * 31) % 256; raw[i + 1] = (i * 13 + seed * 17) % 256; raw[i + 2] = (i * 29 + seed * 5) % 256; raw[i + 3] = 255 }
  return raw
}
// Sprite name → noise seed. 1041205 is the skill an existing identity gained after its icons were uploaded.
const SPRITES: Record<string, number> = { '1041201': 1, '1041205': 2, '1010199': 3, '1041206_4': 4, '1041207': 5 }

let source: string
let manifest: ManifestEntry[]
const rawOf = (name: string) => noise(SPRITES[name])

beforeAll(async () => {
  source = mkdtempSync(join(tmpdir(), 'skill-icons-'))
  mkdirSync(join(source, 'Images', '스킬'), { recursive: true })
  manifest = []
  for (const name of Object.keys(SPRITES)) {
    const bytes = await sharp(rawOf(name), { raw: { width: 16, height: 16, channels: 4 } }).png().toBuffer()
    writeFileSync(join(source, 'Images', '스킬', `${name}.png`), bytes)
    manifest.push({ kind: '스킬', name, path: `스킬/${name}.png`, sha256: sha(bytes) })
  }
  // The same sprite name with two different pictures cannot be told apart; an image of another kind never counts.
  manifest.push({ kind: '스킬', name: '1041208', path: '스킬/a.png', sha256: 'A'.repeat(64) }, { kind: '스킬', name: '1041208', path: '스킬/b.png', sha256: 'B'.repeat(64) })
  manifest.push({ kind: '키워드', name: '1041209', path: '키워드/x.png', sha256: 'C'.repeat(64) })
})
afterAll(() => rmSync(source, { recursive: true, force: true }))

class FakeBucket {
  uploads: { key: string; body: Buffer; options: Record<string, unknown> }[] = []
  failWith: string | null = null
  async upload(key: string, body: Buffer, options: Record<string, unknown>) {
    if (this.failWith) return { error: { message: this.failWith } }
    this.uploads.push({ key, body, options })
    return { error: null }
  }
}

const RYOSHU = { id: 'identity-10412', game_id: '10412', sinner_id: 'ryoshu' }
const skill = (id: string, image_id: string | null, skill_order: number, uptie_level = 4, identity_id = RYOSHU.id) => ({ id, identity_id, image_id, skill_order, uptie_level })

const run = (over: Partial<Parameters<typeof uploadMissingSkillIcons>[0]> = {}) => {
  const bucket = new FakeBucket(), uploads: Upload[] = []
  const listed: string[] = []
  const options = {
    source, manifest, uploads, bucket, fix: true,
    identities: [RYOSHU], skills: [skill('s5', '1041205', 5)],
    listDir: async (dir: string) => { listed.push(dir); return new Set<string>() as ReadonlySet<string> },
    ...over,
  }
  return { bucket, uploads, listed, done: uploadMissingSkillIcons(options) }
}

describe('REQ-DATA-SYNC-041 the Storage key of each skill icon', () => {
  it('REQ-DATA-SYNC-041 is the key the site reads: image_id when set, else <identity id><index> from computeSkillImageIndices', () => {
    const icons = expectedSkillIcons([RYOSHU], [
      skill('a', '1041205', 5), skill('b', null, 1), skill('c', null, 2), skill('d', null, 4),
    ])
    expect([...icons.keys()].sort()).toEqual(['icons/skills/ryoshu/1041201.webp', 'icons/skills/ryoshu/1041202.webp', 'icons/skills/ryoshu/1041204.webp', 'icons/skills/ryoshu/1041205.webp'])
  })

  it('REQ-DATA-SYNC-041 a sprite that borrows another sinner\'s original is stored under the sinner its id prefix names', () => {
    const icons = expectedSkillIcons([RYOSHU], [skill('a', '1010199', 1)])
    expect([...icons.keys()]).toEqual(['icons/skills/yi-sang/1010199.webp'])
  })

  it('REQ-DATA-SYNC-041 one key per sprite however many uptie levels share it, and rows of unknown identities are ignored', () => {
    const icons = expectedSkillIcons([RYOSHU], [skill('a', '1041205', 5, 3), skill('b', '1041205', 5, 4), skill('c', '1041205', 5, 4, 'unknown')])
    expect([...icons.keys()]).toEqual(['icons/skills/ryoshu/1041205.webp'])
    expect(icons.get('icons/skills/ryoshu/1041205.webp')).toMatchObject({ sprite: '1041205', identity: '10412' })
  })
})

describe('REQ-DATA-SYNC-041 uploading the icons an existing identity lacks', () => {
  it('REQ-DATA-SYNC-041 uploads only the missing file as lossless WebP without replacing, and records it for a restore', async () => {
    const { bucket, uploads, done } = run({
      skills: [skill('s1', '1041201', 1), skill('s5', '1041205', 5)],
      listDir: async () => new Set(['1041201.webp']),
    })
    const report = await done
    expect(report.newSkillIcons).toEqual([{ key: 'icons/skills/ryoshu/1041205.webp', sprite: '1041205', identity: '10412' }])
    expect(report.skillsWithoutIcon).toEqual([])
    expect(bucket.uploads).toHaveLength(1)
    const [sent] = bucket.uploads
    expect(sent.key).toBe('icons/skills/ryoshu/1041205.webp')
    expect(sent.options).toMatchObject({ contentType: 'image/webp', upsert: false })
    const decoded = sharp(sent.body)
    expect((await decoded.metadata()).format).toBe('webp')
    expect(await decoded.ensureAlpha().raw().toBuffer()).toEqual(rawOf('1041205'))
    expect(uploads).toEqual([{ key: 'icons/skills/ryoshu/1041205.webp', before: null }])
  })

  it('REQ-DATA-SYNC-041 lists each sinner folder once and uploads one file for rows that share a sprite', async () => {
    const { bucket, listed, done } = run({ skills: [skill('a', '1041205', 5, 3), skill('b', '1041205', 5, 4), skill('c', '1041207', 6)] })
    expect((await done).newSkillIcons.map(row => row.key)).toEqual(['icons/skills/ryoshu/1041205.webp', 'icons/skills/ryoshu/1041207.webp'])
    expect(bucket.uploads).toHaveLength(2)
    expect(listed).toEqual(['icons/skills/ryoshu'])
  })

  it('REQ-DATA-SYNC-041 nothing is uploaded or reported when every icon is in Storage', async () => {
    const { bucket, uploads, done } = run({ listDir: async () => new Set(['1041205.webp']) })
    expect(await done).toEqual({ newSkillIcons: [], skillsWithoutIcon: [] })
    expect(bucket.uploads).toEqual([])
    expect(uploads).toEqual([])
  })

  it('REQ-DATA-SYNC-041 a sprite the extraction lacks, or has twice with different pictures, or only as another kind, is reported and skipped', async () => {
    const { bucket, done } = run({ skills: [skill('a', '1041299', 1), skill('b', '1041208', 2), skill('c', '1041209', 3), skill('d', '1041205', 5)] })
    const report = await done
    expect(report.newSkillIcons.map(row => row.sprite)).toEqual(['1041205'])
    expect(report.skillsWithoutIcon).toEqual([
      { key: 'icons/skills/ryoshu/1041299.webp', sprite: '1041299', identity: '10412', reason: 'no-sprite' },
      { key: 'icons/skills/ryoshu/1041208.webp', sprite: '1041208', identity: '10412', reason: 'ambiguous' },
      { key: 'icons/skills/ryoshu/1041209.webp', sprite: '1041209', identity: '10412', reason: 'no-sprite' },
    ])
    expect(bucket.uploads).toHaveLength(1)
  })

  it('REQ-DATA-SYNC-041 without --fix it plans only: nothing is uploaded or recorded', async () => {
    const { bucket, uploads, done } = run({ fix: false })
    expect((await done).newSkillIcons).toHaveLength(1)
    expect(bucket.uploads).toEqual([])
    expect(uploads).toEqual([])
  })

  it('REQ-DATA-SYNC-041 a failed upload (a file that appeared meanwhile) and a hash mismatch stop the apply', async () => {
    const failing = run()
    failing.bucket.failWith = 'The resource already exists'
    await expect(failing.done).rejects.toThrow('upload icons/skills/ryoshu/1041205.webp: The resource already exists')
    expect(failing.uploads).toEqual([])

    const tampered = manifest.map(entry => entry.name === '1041205' ? { ...entry, sha256: 'D'.repeat(64) } : entry)
    const hashed = run({ manifest: tampered })
    await expect(hashed.done).rejects.toThrow('image hash mismatch')
    expect(hashed.bucket.uploads).toEqual([])
  })
})
