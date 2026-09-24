import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import sharp from 'sharp'
import { afterEach, expect, it } from 'vitest'
import { collectSinnerSkillIconIds, prepareExtractedAssets } from './prepare-extracted-assets'

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))))

const hash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex')

it('includes only skill icons referenced by the twelve sinners and their EGO', () => {
  const icons = collectSinnerSkillIconIds(
    [
      { id: 10416, characterId: 4, attributeList: [{ skillId: 1041601 }], defenseSkillIDList: [1041604] },
      { id: 40001, characterId: 40, attributeList: [{ skillId: 9002401 }] },
      { id: 400025, characterId: 1, hidden: true, attributeList: [{ skillId: 9100401 }] },
    ],
    [{ id: 20401, characterId: 4, awakeningSkillId: 2040111 }],
    [
      { id: 1041601, skillData: [{ iconID: '1041601_alt' }] },
      { id: 1041604, skillData: [{}] },
      { id: 2040111, skillData: [{ iconId: 2040111 }] },
      { id: 9002401, skillData: [{ iconID: 9002401 }] },
      { id: 9100401, skillData: [{ iconID: 9100401 }] },
    ],
  )
  expect(icons).toEqual(new Set(['1041601', '1041604', '2040111', '1041601_alt']))
  expect(icons.has('9002401')).toBe(false)
  expect(icons.has('9100401')).toBe(false)
})

async function fixture(dataFiles: Array<{ path: string; body: string }> = [{ path: 'Data/static-data/personality/personality-01.json', body: '{"list":[]}' }], imageDir = '수감자') {
  const root = await mkdtemp(join(tmpdir(), 'limbus-extract-'))
  roots.push(root)
  const source = join(root, 'source')
  const output = join(root, 'prepared')
  const repo = join(root, 'repo')
  for (const dir of ['Reports', `Images/${imageDir}`, 'Data', 'Localize/kr', 'Localize/en', 'Localize/jp']) mkdirSync(join(source, dir), { recursive: true })
  mkdirSync(repo)
  const png = await sharp({ create: { width: 2, height: 3, channels: 4, background: '#00000000' } }).png().toBuffer()
  writeFileSync(join(source, `Images/${imageDir}/10101_normal.png`), png)
  const files = dataFiles.map(file => {
    const path = join(source, file.path)
    mkdirSync(join(path, '..'), { recursive: true })
    const body = Buffer.from(file.body)
    writeFileSync(path, body)
    const locale = file.path.match(/^Localize\/(kr|en|jp)\//)?.[1]
    return { path: file.path, kind: locale ?? 'Data', sha256: hash(body), bytes: body.length }
  })
  const counts = { data: files.filter(file => file.kind === 'Data').length, languages: { kr: files.filter(file => file.kind === 'kr').length, en: files.filter(file => file.kind === 'en').length, jp: files.filter(file => file.kind === 'jp').length }, categories: {} as Record<string, number> }
  for (const file of files.filter(file => file.kind === 'Data')) {
    const category = file.path.split('/')[2]
    counts.categories[category] = (counts.categories[category] ?? 0) + 1
  }
  writeFileSync(join(source, 'Reports/run.json'), JSON.stringify({ schemaVersion: 2, imageCount: 1, latestGameServerVersionVerified: false, scope: 'test', extractor: 'test', dataCounts: counts }))
  writeFileSync(join(source, 'Reports/manifest.json'), JSON.stringify([{ kind: '인격', name: '10101_normal', path: '수감자/10101_normal.png', container: 'Assets/test.png', pathId: '1', sha256: hash(png), width: 2, height: 3, sinner: 'yi-sang' }]))
  writeFileSync(join(source, 'Reports/data-manifest.json'), JSON.stringify({ schemaVersion: 1, counts, files }))
  return { root, source, output, repo }
}

it('validates first, strips BOM, maps locales, and writes a provenance catalog', async () => {
  const f = await fixture([
    { path: 'Data/static-data/personality/personality-01.json', body: '\uFEFF{"list":[]}' },
    { path: 'Localize/kr/KR_Personalities.json', body: '{"dataList":[]}' },
  ])
  const receipt = join(f.root, 'artwork.json')
  writeFileSync(receipt, JSON.stringify([{ key: 'sinners/yi-sang/10101_normal.webp', status: 'verified' }]))
  const dryRun = await prepareExtractedAssets({ source: f.source, output: f.output, repoRoot: f.repo })
  expect(dryRun).toMatchObject({ ok: true, prepared: false })
  const prepared = await prepareExtractedAssets({ source: f.source, output: f.output, repoRoot: f.repo, prepare: true, previousArtwork: receipt })
  expect(prepared).toMatchObject({ ok: true, prepared: true })
  expect(readFileSync(join(f.output, 'complete-data/personality-01.txt'), 'utf8')).toBe('{"list":[]}')
  expect(readFileSync(join(f.output, 'complete-data/KR/KR_Personalities.txt'), 'utf8')).toBe('{"dataList":[]}')
  expect(JSON.parse(readFileSync(join(f.output, 'image-catalog.json'), 'utf8'))[0]).toMatchObject({ gameId: '10101', sourcePath: 'Images/수감자/10101_normal.png', previousArtworkCandidates: ['sinners/yi-sang/10101_normal.webp'] })
  expect(prepared.plan.previousArtwork?.인격).toEqual({ matched: 1, unmatched: 0, ambiguous: 0 })
})

it('rejects changed hashes without creating partial prepared data', async () => {
  const f = await fixture()
  writeFileSync(join(f.source, 'Data/static-data/personality/personality-01.json'), '{"list":[1]}')
  const report = await prepareExtractedAssets({ source: f.source, output: f.output, repoRoot: f.repo, prepare: true })
  expect(report.ok).toBe(false)
  expect(report.errors.join()).toMatch(/size mismatch|hash mismatch/)
  expect(() => readFileSync(join(f.output, 'complete-data/personality-01.txt'))).toThrow()
})

it('rejects malformed JSON and different-content basename collisions', async () => {
  const malformed = await fixture([{ path: 'Data/static-data/personality/bad.json', body: '{' }])
  expect((await prepareExtractedAssets({ source: malformed.source, output: malformed.output, repoRoot: malformed.repo })).ok).toBe(false)

  const collision = await fixture([
    { path: 'Data/static-data/a/same.json', body: '{"a":1}' },
    { path: 'Data/static-data/b/same.json', body: '{"a":2}' },
  ])
  const report = await prepareExtractedAssets({ source: collision.source, output: collision.output, repoRoot: collision.repo })
  expect(report.errors.join()).toMatch(/basename collision/)
})

it('rejects manifest path traversal', async () => {
  const f = await fixture()
  const manifestPath = join(f.source, 'Reports/data-manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.files[0].path = '../escape.json'
  writeFileSync(manifestPath, JSON.stringify(manifest))
  const report = await prepareExtractedAssets({ source: f.source, output: f.output, repoRoot: f.repo })
  expect(report.ok).toBe(false)

  const unsafeOutput = join(f.repo, 'generated')
  await expect(prepareExtractedAssets({ source: f.source, output: unsafeOutput, repoRoot: f.repo })).rejects.toThrow(/repository/)
  expect(existsSync(`${unsafeOutput}.report.json`)).toBe(false)
})

it('matches NFC manifest paths against NFD folder names from macOS unzip', async () => {
  const f = await fixture(undefined, '수감자'.normalize('NFD'))
  expect(await prepareExtractedAssets({ source: f.source, output: f.output, repoRoot: f.repo })).toMatchObject({ ok: true, errors: [] })
})
