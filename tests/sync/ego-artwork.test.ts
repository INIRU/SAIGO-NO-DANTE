import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STORAGE_BASE } from '@/lib/constants/game'
import {
  EGO_ARTWORK_QUALITY, egoArtworkFile, egoArtworkHash, egoArtworkPublicUrl, planEgoArtworkBackfill, uploadEgoArtworkCopy,
  type EgoArtworkRow,
} from '@/scripts/sync/ego-artwork'

const sha12 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex').slice(0, 12)
const ego = { game_id: '20211', sinner_id: 'faust', folder_name: 'Hollow' }

class FakeBucket {
  uploads: { key: string; body: Buffer; options: Record<string, unknown> }[] = []
  failWith: string | null = null
  async upload(key: string, body: Buffer, options: Record<string, unknown>) {
    if (this.failWith) return { error: { message: this.failWith } }
    this.uploads.push({ key, body, options })
    return { error: null }
  }
}

describe('REQ-DATA-SYNC-043 hashed artwork name and URL', () => {
  it('REQ-DATA-SYNC-043 names the copy {id}_cg-{first 12 hex of the WebP sha256}.webp, the way lib/generated/ego-artwork.json does', () => {
    const bytes = Buffer.from('webp bytes')
    expect(egoArtworkHash(bytes)).toBe(sha12(bytes))
    expect(egoArtworkFile('20211', 'b2a9a36548b9')).toBe('20211_cg-b2a9a36548b9.webp')
  })

  it('REQ-DATA-SYNC-043 builds the public URL with an encoded folder, like the EGO profile URLs', () => {
    expect(egoArtworkPublicUrl('sinners/faust/ego/9 2/20205_cg-abc.webp')).toBe(`${STORAGE_BASE}/sinners/faust/ego/9%202/20205_cg-abc.webp`)
    expect(egoArtworkPublicUrl('sinners/faust/ego/Hollow/20211_cg-b2a9a36548b9.webp')).toBe(`${STORAGE_BASE}/sinners/faust/ego/Hollow/20211_cg-b2a9a36548b9.webp`)
  })

  it('REQ-DATA-SYNC-043 encodes the hashed copy at WebP quality 95, like the 111 verified ones', () => {
    expect(EGO_ARTWORK_QUALITY).toBe(95)
  })
})

describe('REQ-DATA-SYNC-043 uploadEgoArtworkCopy', () => {
  const webp = Buffer.from('1024 square art')
  const hash = sha12(webp)
  const key = `sinners/faust/ego/Hollow/20211_cg-${hash}.webp`

  it('REQ-DATA-SYNC-043 uploads the hashed copy without replacing, records it for a restore and returns the public URL', async () => {
    const bucket = new FakeBucket(), uploads: { key: string; before: null }[] = []
    const result = await uploadEgoArtworkCopy({ ego, webp, stored: new Set(), bucket, uploads, fix: true })
    expect(result).toEqual({ gameId: '20211', key, url: `${STORAGE_BASE}/${key}`, uploaded: true })
    expect(bucket.uploads).toEqual([{ key, body: webp, options: { contentType: 'image/webp', cacheControl: '3600', upsert: false } }])
    expect(uploads).toEqual([{ key, before: null }])
  })

  it('REQ-DATA-SYNC-043 skips an object Storage already has (same bytes, same name) and does not record it', async () => {
    const bucket = new FakeBucket(), uploads: { key: string; before: null }[] = []
    const stored = new Set([`20211_cg-${hash}.webp`])
    const result = await uploadEgoArtworkCopy({ ego, webp, stored, bucket, uploads, fix: true })
    expect(result).toMatchObject({ key, uploaded: false })
    expect(bucket.uploads).toEqual([])
    expect(uploads).toEqual([])
  })

  it('REQ-DATA-SYNC-043 treats an "already exists" upload error as present, but any other error stops the apply', async () => {
    const bucket = new FakeBucket(), uploads: { key: string; before: null }[] = []
    bucket.failWith = 'The resource already exists'
    expect(await uploadEgoArtworkCopy({ ego, webp, stored: new Set(), bucket, uploads, fix: true })).toMatchObject({ uploaded: false })
    expect(uploads).toEqual([])
    bucket.failWith = 'Bucket not found'
    await expect(uploadEgoArtworkCopy({ ego, webp, stored: new Set(), bucket, uploads, fix: true })).rejects.toThrow(`upload ${key}: Bucket not found`)
  })

  it('REQ-DATA-SYNC-043 only plans without --fix: no upload, no record', async () => {
    const bucket = new FakeBucket(), uploads: { key: string; before: null }[] = []
    const result = await uploadEgoArtworkCopy({ ego, webp, stored: new Set(), bucket, uploads, fix: false })
    expect(result).toEqual({ gameId: '20211', key, url: `${STORAGE_BASE}/${key}`, uploaded: false })
    expect(bucket.uploads).toEqual([])
    expect(uploads).toEqual([])
  })

  it('REQ-DATA-SYNC-043 adds an uploaded name to the stored set so a repeat in the same run skips it', async () => {
    const bucket = new FakeBucket(), stored = new Set<string>()
    await uploadEgoArtworkCopy({ ego, webp, stored, bucket, uploads: [], fix: true })
    await uploadEgoArtworkCopy({ ego, webp, stored, bucket, uploads: [], fix: true })
    expect(bucket.uploads).toHaveLength(1)
  })
})

describe('REQ-DATA-SYNC-043 apply-extraction wiring', () => {
  const source = readFileSync('scripts/sync/apply-extraction.ts', 'utf8')

  it('REQ-DATA-SYNC-043 uploads the hashed copy of each new EGO cg, sets ego.artwork_url and reports it as report.egoArtwork', () => {
    expect(source).toContain('uploadEgoArtworkCopy')
    expect(source).toContain('EGO_ARTWORK_QUALITY')
    expect(source).toContain('artwork_url')
    expect(source).toContain('report.egoArtwork')
    expect(source).toContain("from './ego-artwork'")
  })
})

describe('REQ-DATA-SYNC-044 planEgoArtworkBackfill', () => {
  const row = (over: Partial<EgoArtworkRow> & { game_id: string }): EgoArtworkRow => ({
    id: `id-${over.game_id}`, sinner_id: 'faust', folder_name: 'Hollow', artwork_url: null,
    image_url: `${STORAGE_BASE}/sinners/faust/ego/Hollow/${over.game_id}_awaken_profile.webp`, ...over,
  })
  const map = { '20205': '81c2d795203b' }

  it('REQ-DATA-SYNC-044 sets artwork_url from the map for a mapped EGO, in the profile URL pattern', () => {
    const plan = planEgoArtworkBackfill({
      rows: [row({ game_id: '20205', folder_name: '9 2', image_url: `${STORAGE_BASE}/sinners/faust/ego/9%202/20205_awaken_profile.webp` })],
      map, cgStored: new Set(),
    })
    expect(plan).toEqual([{ kind: 'map', gameId: '20205', id: 'id-20205', url: `${STORAGE_BASE}/sinners/faust/ego/9%202/20205_cg-81c2d795203b.webp` }])
  })

  it('REQ-DATA-SYNC-044 plans a copy of {id}_cg.webp for an unmapped EGO whose cg exists in Storage', () => {
    const plan = planEgoArtworkBackfill({ rows: [row({ game_id: '20211' }), row({ game_id: '20510', sinner_id: 'meursault' })], map, cgStored: new Set(['20211', '20510']) })
    expect(plan).toEqual([
      { kind: 'copy', gameId: '20211', id: 'id-20211', sinnerId: 'faust', folder: 'Hollow', from: 'sinners/faust/ego/Hollow/20211_cg.webp' },
      { kind: 'copy', gameId: '20510', id: 'id-20510', sinnerId: 'meursault', folder: 'Hollow', from: 'sinners/meursault/ego/Hollow/20510_cg.webp' },
    ])
  })

  it('REQ-DATA-SYNC-044 skips what is already set, has no cg, or whose profile is not an _awaken_profile, saying why', () => {
    const set = `${STORAGE_BASE}/sinners/faust/ego/Hollow/20211_cg-b2a9a36548b9.webp`
    const plan = planEgoArtworkBackfill({
      rows: [row({ game_id: '20211', artwork_url: set }), row({ game_id: '20299' }), row({ game_id: '21210', image_url: `${STORAGE_BASE}/sinners/gregor/ego/X/21210_cg.webp` }), row({ game_id: '20300', image_url: null })],
      map, cgStored: new Set(['20211', '21210', '20300']),
    })
    expect(plan.map(({ kind, gameId, reason }: { kind: string; gameId: string; reason?: string }) => [kind, gameId, reason])).toEqual([
      ['skip', '20211', 'has-artwork-url'], ['skip', '20299', 'no-cg'], ['skip', '21210', 'profile-not-awaken'], ['skip', '20300', 'profile-not-awaken'],
    ])
  })

  it('REQ-DATA-SYNC-044 plans nothing twice: a run on rows the backfill already filled plans only skips', () => {
    const filled = row({ game_id: '20205', artwork_url: `${STORAGE_BASE}/x/20205_cg-81c2d795203b.webp` })
    expect(planEgoArtworkBackfill({ rows: [filled], map, cgStored: new Set(['20205']) })).toEqual([{ kind: 'skip', gameId: '20205', id: 'id-20205', reason: 'has-artwork-url' }])
  })
})
