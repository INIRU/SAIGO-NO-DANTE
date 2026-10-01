import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { KEYWORD_AUDIT_FILE, keywordIconKey, readBuffIconIds, readKeywordAudit, spriteOfTag, uploadMissingKeywordIcons, type ManifestEntry, type Upload } from '@/scripts/sync/keyword-icons'

const FIXTURES = resolve(__dirname, '../fixtures/keyword-icons/complete-data')
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex').toUpperCase()

// A 16x16 noisy opaque PNG per sprite: a lossy WebP could not reproduce it, a lossless one does.
const noise = (seed: number) => {
  const raw = Buffer.alloc(16 * 16 * 4)
  for (let i = 0; i < raw.length; i += 4) { raw[i] = (i * 7 + seed * 31) % 256; raw[i + 1] = (i * 13 + seed * 17) % 256; raw[i + 2] = (i * 29 + seed * 5) % 256; raw[i + 3] = 255 }
  return raw
}
const SPRITES: Record<string, number> = { BulletHole: 1, Nail: 2, BlackWingHole: 3, NoirShieldUp: 4, NoirShieldUp2: 5, Twin: 6 }

let source: string
let manifest: ManifestEntry[]
const rawOf = (name: string) => noise(SPRITES[name])

beforeAll(async () => {
  source = mkdtempSync(join(tmpdir(), 'keyword-icons-'))
  mkdirSync(join(source, 'Images', '키워드'), { recursive: true })
  manifest = []
  for (const name of Object.keys(SPRITES)) {
    const bytes = await sharp(rawOf(name), { raw: { width: 16, height: 16, channels: 4 } }).png().toBuffer()
    writeFileSync(join(source, 'Images', '키워드', `${name}_라벨.png`), bytes)
    manifest.push({ kind: '키워드', name, path: `키워드/${name}_라벨.png`, sha256: sha(bytes) })
  }
  // Same sprite name, different pictures; and an image of another kind with a keyword's name.
  manifest.push({ kind: '키워드', name: 'Twin', path: '키워드/Twin_다른.png', sha256: 'A'.repeat(64) })
  manifest.push({ kind: '기프트', name: 'Rival', path: '기프트/Rival.png', sha256: 'B'.repeat(64) })
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

const run = (over: Partial<Parameters<typeof uploadMissingKeywordIcons>[0]> = {}) => {
  const bucket = new FakeBucket(), uploads: Upload[] = []
  const options = {
    source, manifest, uploads, bucket, fix: true,
    keywords: [] as { name: string; icon_slug: string | null }[], refs: [] as { id: string; keyword_name: string | null }[],
    primaryTags: new Map<string, string>(), iconIds: new Map<string, string>(), stored: new Set<string>(), ...over,
  }
  return { bucket, uploads, done: uploadMissingKeywordIcons(options) }
}

describe('REQ-DATA-SYNC-039 buff data and the audit file', () => {
  it('REQ-DATA-SYNC-039 reads iconId (and iconID) from buff files only; the first file that names a sprite wins', () => {
    const ids = readBuffIconIds(FIXTURES)
    expect(ids.get('NailPersonality')).toBe('Nail')
    expect(ids.get('AssemblePersonality')).toBe('Assemble')
    expect(ids.get('GodokPanicType')).toBe('Godok_Panic')
    expect(ids.has('BulletHole')).toBe(false)
    expect(ids.has('NotABuffFile')).toBe(false)
  })

  it('REQ-DATA-SYNC-039 reads the primary tag per keyword from the keywords sync audit and tolerates a missing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'keyword-audit-'))
    try {
      writeFileSync(join(dir, KEYWORD_AUDIT_FILE), JSON.stringify([{ name: '검은 날개', tag: 'BlackWingHole', icon_slug: 'black-wings' }, { name: '이름만', tag: null }]))
      expect([...readKeywordAudit(join(dir, KEYWORD_AUDIT_FILE))]).toEqual([['검은 날개', 'BlackWingHole']])
      expect(readKeywordAudit(join(dir, 'missing.json')).size).toBe(0)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  it('REQ-DATA-SYNC-039 only slugs the site reads from their own Storage file are this step\'s: aliases, variants and local assets are not', () => {
    expect(keywordIconKey('검은 날개', 'black-wings')).toBe('icons/keywords/black-wings.webp')
    expect(keywordIconKey('x', 'gaze-of-contempt')).toBeNull() // alias of another file
    expect(keywordIconKey('x', 'tiantui-star')).toBeNull() // local atlas asset
    expect(keywordIconKey('참격', 'whatever')).toBeNull() // local stat icon
    expect(keywordIconKey('x', null)).toBeNull()
  })
})

describe('REQ-DATA-SYNC-039 sprite resolution', () => {
  it('REQ-DATA-SYNC-039 pairs a keyword whose tag is the sprite name (no iconId) and uploads it as lossless WebP without replacing', async () => {
    const { bucket, uploads, done } = run({ keywords: [{ name: '잿빛 탄환', icon_slug: 'ashen-bullet' }], primaryTags: new Map([['잿빛 탄환', 'BulletHole']]) })
    const report = await done
    expect(report.newKeywordIcons).toEqual([{ name: '잿빛 탄환', key: 'icons/keywords/ashen-bullet.webp', sprite: 'BulletHole' }])
    expect(bucket.uploads).toHaveLength(1)
    const [sent] = bucket.uploads
    expect(sent.key).toBe('icons/keywords/ashen-bullet.webp')
    expect(sent.options).toMatchObject({ contentType: 'image/webp', upsert: false })
    const decoded = sharp(sent.body)
    expect((await decoded.metadata()).format).toBe('webp')
    expect(await decoded.ensureAlpha().raw().toBuffer()).toEqual(rawOf('BulletHole'))
    expect(uploads).toEqual([{ key: 'icons/keywords/ashen-bullet.webp', before: null }])
  })

  it('REQ-DATA-SYNC-039 the buff iconId overrides the tag as the sprite name', async () => {
    const iconIds = readBuffIconIds(FIXTURES)
    const { bucket, done } = run({ keywords: [{ name: '못', icon_slug: 'promised-nail' }], primaryTags: new Map([['못', 'NailPersonality']]), iconIds })
    expect((await done).newKeywordIcons).toEqual([{ name: '못', key: 'icons/keywords/promised-nail.webp', sprite: 'Nail' }])
    expect(await sharp(bucket.uploads[0].body).ensureAlpha().raw().toBuffer()).toEqual(rawOf('Nail'))
  })

  it('REQ-DATA-SYNC-039 reference ids that name the keyword are candidate tags when the audit has none', async () => {
    const { done } = run({
      keywords: [{ name: '검은 날개', icon_slug: 'black-wings' }],
      refs: [{ id: 'Unrelated', keyword_name: '다른 것' }, { id: 'BlackWingHole', keyword_name: '검은 날개' }, { id: 'NoSuchSprite', keyword_name: '검은 날개' }],
    })
    expect((await done).newKeywordIcons).toEqual([{ name: '검은 날개', key: 'icons/keywords/black-wings.webp', sprite: 'BlackWingHole' }])
  })

  it('REQ-DATA-SYNC-039 several tags leading to different sprites: the primary tag settles it, otherwise the keyword is reported and skipped', async () => {
    const keywords = [{ name: '검은 신의 가호', icon_slug: 'blessing-of-the-obsidian-god' }]
    const refs = [{ id: 'NoirShieldUp', keyword_name: '검은 신의 가호' }, { id: 'NoirShieldUp2', keyword_name: '검은 신의 가호' }]
    const settled = run({ keywords, refs, primaryTags: new Map([['검은 신의 가호', 'NoirShieldUp2']]) })
    expect((await settled.done).newKeywordIcons).toEqual([{ name: '검은 신의 가호', key: 'icons/keywords/blessing-of-the-obsidian-god.webp', sprite: 'NoirShieldUp2' }])

    const unsettled = run({ keywords, refs })
    const report = await unsettled.done
    expect(report.newKeywordIcons).toEqual([])
    expect(report.keywordsWithoutIcon).toEqual([{ name: '검은 신의 가호', slug: 'blessing-of-the-obsidian-god', reason: 'ambiguous', tags: ['NoirShieldUp', 'NoirShieldUp2'], sprites: ['NoirShieldUp', 'NoirShieldUp2'] }])
    expect(unsettled.bucket.uploads).toEqual([])
    expect(unsettled.uploads).toEqual([])
  })

  it('REQ-DATA-SYNC-039 two different images under one sprite name are ambiguous, and another kind of image never counts', async () => {
    const { bucket, done } = run({
      keywords: [{ name: '쌍둥이', icon_slug: 'twin' }, { name: '라이벌', icon_slug: 'rival' }],
      primaryTags: new Map([['쌍둥이', 'Twin'], ['라이벌', 'Rival']]),
    })
    const report = await done
    expect(report.newKeywordIcons).toEqual([])
    expect(report.keywordsWithoutIcon.map(row => [row.name, row.reason])).toEqual([['쌍둥이', 'ambiguous'], ['라이벌', 'no-sprite']].sort((a, b) => a[0].localeCompare(b[0], 'ko')))
    expect(bucket.uploads).toEqual([])
  })

  it('REQ-DATA-SYNC-039 a keyword with no sprite in the extraction is reported with the sprites it looked for', async () => {
    const { done } = run({ keywords: [{ name: '진동 - 보존', icon_slug: 'tremor-conservation' }], primaryTags: new Map([['진동 - 보존', 'VibrationFocusing']]) })
    expect((await done).keywordsWithoutIcon).toEqual([{ name: '진동 - 보존', slug: 'tremor-conservation', reason: 'no-sprite', tags: ['VibrationFocusing'], sprites: ['VibrationFocusing'] }])
  })
})

describe('REQ-DATA-SYNC-039 what is left alone', () => {
  it('REQ-DATA-SYNC-039 icons Storage already has are neither uploaded nor reported, and slugs that are not their own file are skipped', async () => {
    const { bucket, uploads, done } = run({
      keywords: [{ name: '잿빛 탄환', icon_slug: 'ashen-bullet' }, { name: '비슷', icon_slug: 'gaze-of-contempt' }, { name: '참격', icon_slug: 'stat:slash' }, { name: '없음', icon_slug: null }],
      primaryTags: new Map([['잿빛 탄환', 'BulletHole'], ['비슷', 'BulletHole']]),
      stored: new Set(['ashen-bullet.webp']),
    })
    expect(await done).toEqual({ newKeywordIcons: [], keywordsWithoutIcon: [] })
    expect(bucket.uploads).toEqual([])
    expect(uploads).toEqual([])
  })

  it('REQ-DATA-SYNC-039 without --fix it plans only: nothing is uploaded or recorded', async () => {
    const { bucket, uploads, done } = run({ fix: false, keywords: [{ name: '잿빛 탄환', icon_slug: 'ashen-bullet' }], primaryTags: new Map([['잿빛 탄환', 'BulletHole']]) })
    expect((await done).newKeywordIcons).toHaveLength(1)
    expect(bucket.uploads).toEqual([])
    expect(uploads).toEqual([])
  })

  it('REQ-DATA-SYNC-039 a failed upload (including a file that appeared meanwhile) and a hash mismatch stop the apply', async () => {
    const keywords = [{ name: '잿빛 탄환', icon_slug: 'ashen-bullet' }], primaryTags = new Map([['잿빛 탄환', 'BulletHole']])
    const failing = run({ keywords, primaryTags })
    failing.bucket.failWith = 'The resource already exists'
    await expect(failing.done).rejects.toThrow('upload icons/keywords/ashen-bullet.webp: The resource already exists')
    expect(failing.uploads).toEqual([])

    const tampered = manifest.map(entry => entry.name === 'BulletHole' ? { ...entry, sha256: 'C'.repeat(64) } : entry)
    const hashed = run({ keywords, primaryTags, manifest: tampered })
    await expect(hashed.done).rejects.toThrow('image hash mismatch')
    expect(hashed.bucket.uploads).toEqual([])
  })
})

describe('REQ-DATA-SYNC-046 keyword tags without their own art', () => {
  it('REQ-DATA-SYNC-046 gives 공격 레벨+ (AttackLevelAdder) the Offense Level sword with a plus (MD511); iconId and the tag itself still come first', () => {
    expect(spriteOfTag('AttackLevelAdder', new Map())).toBe('MD511')
    expect(spriteOfTag('AttackLevelAdder', new Map([['AttackLevelAdder', 'SomethingElse']]))).toBe('SomethingElse')
    expect(spriteOfTag('NoirNail', new Map([['NoirNail', 'NoirNailBoss']]))).toBe('NoirNailBoss')
    expect(spriteOfTag('Combustion', new Map())).toBe('Combustion')
  })
})
