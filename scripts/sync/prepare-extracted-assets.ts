import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import sharp from 'sharp'
import { z } from 'zod'

const Sha = z.string().regex(/^[0-9a-f]{64}$/i)
const DataFile = z.object({ path: z.string(), kind: z.string(), sha256: Sha, bytes: z.number().int().nonnegative() })
const DataManifest = z.object({ schemaVersion: z.literal(1), counts: z.unknown(), files: z.array(DataFile) })
const ImageEntry = z.object({
  kind: z.string(), subtype: z.string().nullish(), imageState: z.string().nullish(), name: z.string(), label: z.string().nullish(), path: z.string(), container: z.string(), pathId: z.string(), sha256: Sha,
  // PowerShell writes null for images without a sinner, entity or state (theme packs, keywords, events).
  width: z.number().int().positive(), height: z.number().int().positive(), sinner: z.string().nullish().transform(value => value ?? ''),
  dbLinked: z.boolean().nullish(), entityName: z.string().nullish(),
}).passthrough()
const ImageManifest = z.array(ImageEntry)
const RunManifest = z.object({
  schemaVersion: z.literal(2), imageCount: z.number().int().nonnegative(), latestGameServerVersionVerified: z.boolean(),
  scope: z.string(), extractor: z.string(), dataCounts: z.unknown(),
})

type Report = {
  ok: boolean
  prepared: boolean
  source: string
  output: string
  warnings: string[]
  errors: string[]
  plan: { dataFiles: number; verifiedImages?: number; imageFiles: number; outputFiles: number; catalogNotice: string; excludedSkills?: number; previousArtwork?: Record<string, { matched: number; unmatched: number; ambiguous: number }> }
}

export type PrepareOptions = { source: string; output: string; prepare?: boolean; repoRoot?: string; previousArtwork?: string }

function inside(child: string, parent: string) {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function prospectiveRealPath(path: string) {
  const suffix: string[] = []
  let cursor = resolve(path)
  while (!existsSync(cursor)) {
    suffix.unshift(basename(cursor))
    const parent = dirname(cursor)
    if (parent === cursor) break
    cursor = parent
  }
  return resolve(realpathSync(cursor), ...suffix)
}

function isSymlink(path: string) {
  try { return lstatSync(path).isSymbolicLink() } catch { return false }
}

function safeRelativePath(path: string) {
  if (isAbsolute(path) || path.split(/[\\/]/).includes('..')) throw new Error(`unsafe manifest path: ${path}`)
  return path.replaceAll('\\', '/').normalize('NFC')
}

function sha256(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function readJson(path: string) {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  return JSON.parse(text) as unknown
}

// macOS unzip stores Korean names as NFD while manifests use NFC. APFS opens either form but Linux does not,
// so walked files remember their on-disk spelling for checkedPath.
const onDiskPaths = new Map<string, string>()

function walk(root: string): string[] {
  const result: string[] = []
  const visit = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      const info = lstatSync(path)
      if (info.isSymbolicLink()) throw new Error(`symlink is not allowed: ${relative(root, path)}`)
      if (info.isDirectory()) visit(path)
      else if (info.isFile()) {
        onDiskPaths.set(path.normalize('NFC'), path)
        result.push(path.normalize('NFC'))
      }
    }
  }
  visit(root)
  return result
}

function checkedPath(source: string, rel: string) {
  const path = resolve(source, safeRelativePath(rel))
  if (!inside(path, source)) throw new Error(`path escapes source: ${rel}`)
  return onDiskPaths.get(path) ?? path
}

function reportPath(output: string) {
  return `${output}.report.json`
}

function writeReport(output: string, report: Report) {
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(reportPath(output), `${JSON.stringify(report, null, 2)}\n`)
}

function outputName(sourcePath: string) {
  return `${basename(sourcePath, '.json')}.txt`
}

function collectSkillRefs(value: unknown, refs: Set<number>) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) collectSkillRefs(item, refs)
    return
  }
  for (const [key, item] of Object.entries(value)) {
    if (/skillId$/i.test(key) && (typeof item === 'number' || /^\d+$/.test(String(item)))) refs.add(Number(item))
    else if (/skillIDList$/i.test(key) && Array.isArray(item)) for (const id of item) if (typeof id === 'number') refs.add(id)
    collectSkillRefs(item, refs)
  }
}

export function collectSinnerSkillIconIds(personalities: unknown[], egos: unknown[], skills: unknown[]) {
  const refs = new Set<number>()
  const collectPublic = (entries: unknown[], minId: number, maxId: number) => {
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue
      const source = entry as { id?: unknown; characterId?: unknown; hidden?: unknown }
      const id = Number(source.id)
      const characterId = Number(source.characterId)
      if (!Number.isInteger(id) || id < minId || id > maxId) continue
      if (!Number.isInteger(characterId) || characterId < 1 || characterId > 12 || source.hidden === true) continue
      collectSkillRefs(entry, refs)
    }
  }
  collectPublic(personalities, 10101, 11299)
  collectPublic(egos, 20101, 21299)
  /*
   * Skill definitions can override the image name at any data level. Preserve
   * every referenced definition's explicit icon while retaining its ID fallback.
   */
  const icons = new Set([...refs].map(String))
  for (const entry of skills) {
    if (!entry || typeof entry !== 'object') continue
    const skill = entry as { id?: unknown; skillData?: unknown[] }
    if (!refs.has(Number(skill.id))) continue
    for (const level of skill.skillData ?? []) {
      if (!level || typeof level !== 'object') continue
      const icon = (level as { iconID?: unknown; iconId?: unknown }).iconID ?? (level as { iconId?: unknown }).iconId
      if (typeof icon === 'number' || (typeof icon === 'string' && icon)) icons.add(String(icon))
    }
  }
  return icons
}

function listsFromFiles(source: string, files: z.infer<typeof DataFile>[], category: string) {
  const result: unknown[] = []
  for (const entry of files.filter(file => file.path.startsWith(`Data/static-data/${category}/`))) {
    const parsed = readJson(checkedPath(source, entry.path)) as { list?: unknown[] }
    if (Array.isArray(parsed.list)) result.push(...parsed.list)
  }
  return result
}

export async function prepareExtractedAssets(options: PrepareOptions): Promise<Report> {
  const source = realpathSync(resolve(options.source))
  const rawOutput = resolve(options.output)
  const rawReceiptOutput = reportPath(rawOutput)
  if (isSymlink(rawOutput)) throw new Error('output must not be a symlink')
  if (isSymlink(rawReceiptOutput)) throw new Error('report must not be a symlink')
  const output = prospectiveRealPath(rawOutput)
  const repo = realpathSync(resolve(options.repoRoot ?? dirname(dirname(dirname(fileURLToPath(import.meta.url))))))
  const receiptOutput = prospectiveRealPath(reportPath(output))
  if (inside(output, source) || inside(receiptOutput, source)) throw new Error('output and report must not be inside source')
  if (inside(output, repo) || inside(receiptOutput, repo)) throw new Error('output and report must not be inside repository')
  if (existsSync(output) && !lstatSync(output).isDirectory()) throw new Error('output must be a directory')
  if (existsSync(output) && readdirSync(output).length > 0) throw new Error('refusing to overwrite populated output')
  const report: Report = {
    ok: false, prepared: false, source, output, warnings: [], errors: [],
    plan: { dataFiles: 0, imageFiles: 0, outputFiles: 0, catalogNotice: 'Catalog entries preserve extractor metadata; they do not mean upload completion or confirmed DB mapping.' },
  }

  try {
    walk(source)
    const reports = join(source, 'Reports')
    const run = RunManifest.parse(readJson(join(reports, 'run.json')))
    const images = ImageManifest.parse(readJson(join(reports, 'manifest.json')))
    const data = DataManifest.parse(readJson(join(reports, 'data-manifest.json')))
    if (!run.latestGameServerVersionVerified) report.warnings.push('latestGameServerVersionVerified is false')
    report.warnings.push('No sprite atlas metadata is present; images are treated as already extracted PNG files.')
    report.warnings.push('The catalog does not include every *_info vertical card or UI atlas asset. Keep existing assets; *_profile is a different crop and must not be renamed to *_info.')
    if (run.imageCount !== images.length) throw new Error(`run imageCount ${run.imageCount} != manifest ${images.length}`)
    if (!isDeepStrictEqual(run.dataCounts, data.counts)) throw new Error('run dataCounts != data-manifest counts')
    if (new Set(images.map(entry => entry.path)).size !== images.length) throw new Error('duplicate image manifest path')
    if (new Set(data.files.map(entry => entry.path)).size !== data.files.length) throw new Error('duplicate data manifest path')

    const actualImages = walk(join(source, 'Images')).filter(path => path.endsWith('.png'))
    const listedImages = new Set(images.map(entry => `Images/${safeRelativePath(entry.path)}`))
    const actualImageRel = new Set(actualImages.map(path => relative(source, path).replaceAll('\\', '/')))
    const missingImages = [...listedImages].filter(path => !actualImageRel.has(path))
    const unlistedImages = [...actualImageRel].filter(path => !listedImages.has(path))
    if (missingImages.length || unlistedImages.length) throw new Error(`image inventory mismatch: missing=${missingImages.length}, unlisted=${unlistedImages.length}`)

    for (const entry of images) {
      const path = checkedPath(source, `Images/${entry.path}`)
      const buffer = readFileSync(path)
      if (sha256(buffer).toUpperCase() !== entry.sha256.toUpperCase()) throw new Error(`image hash mismatch: ${entry.path}`)
      const meta = await sharp(buffer).metadata()
      if (meta.width !== entry.width || meta.height !== entry.height) throw new Error(`image dimensions mismatch: ${entry.path}`)
    }

    const actualData = walk(join(source, 'Data')).concat(walk(join(source, 'Localize'))).filter(path => path.endsWith('.json'))
    const listedData = new Set(data.files.map(entry => safeRelativePath(entry.path)))
    const actualDataRel = new Set(actualData.map(path => relative(source, path).replaceAll('\\', '/')))
    const missingData = [...listedData].filter(path => !actualDataRel.has(path))
    const unlistedData = [...actualDataRel].filter(path => !listedData.has(path))
    if (missingData.length || unlistedData.length) throw new Error(`data inventory mismatch: missing=${missingData.length}, unlisted=${unlistedData.length}`)

    const actualCounts = { data: 0, languages: { kr: 0, en: 0, jp: 0 }, categories: {} as Record<string, number> }
    for (const entry of data.files) {
      const parts = safeRelativePath(entry.path).split('/')
      if (parts[0] === 'Data' && parts[1] === 'static-data') {
        if (entry.kind !== 'Data') throw new Error(`data kind/path mismatch: ${entry.path}`)
        actualCounts.data++
        const category = parts[2] ?? basename(entry.path)
        actualCounts.categories[category] = (actualCounts.categories[category] ?? 0) + 1
      } else if (parts[0] === 'Localize' && ['kr', 'en', 'jp'].includes(parts[1])) {
        const locale = parts[1] as 'kr' | 'en' | 'jp'
        if (entry.kind.toLowerCase() !== locale) throw new Error(`locale kind/path mismatch: ${entry.path}`)
        actualCounts.languages[locale]++
      } else throw new Error(`unsupported data path: ${entry.path}`)
    }
    if (!isDeepStrictEqual(actualCounts, data.counts)) throw new Error('data-manifest counts do not match inventory')

    const outputs = new Map<string, Buffer>()
    for (const entry of data.files) {
      const path = checkedPath(source, entry.path)
      const raw = readFileSync(path)
      if (raw.byteLength !== entry.bytes) throw new Error(`data size mismatch: ${entry.path}`)
      if (sha256(raw).toLowerCase() !== entry.sha256.toLowerCase()) throw new Error(`data hash mismatch: ${entry.path}`)
      const clean = Buffer.from(raw.toString('utf8').replace(/^\uFEFF/, ''), 'utf8')
      JSON.parse(clean.toString('utf8'))
      const parts = entry.path.split('/')
      const locale = parts[0] === 'Localize' ? ({ kr: 'KR', en: 'EN', jp: 'JP' } as const)[parts[1] as 'kr' | 'en' | 'jp'] : undefined
      if (parts[0] === 'Localize' && !locale) throw new Error(`unsupported locale path: ${entry.path}`)
      const target = locale ? join(locale, outputName(path)) : outputName(path)
      const previous = outputs.get(target)
      if (previous && !previous.equals(clean)) throw new Error(`basename collision with different content: ${target}`)
      outputs.set(target, clean)
    }

    const sinnerSkillIcons = collectSinnerSkillIconIds(
      listsFromFiles(source, data.files, 'personality'),
      listsFromFiles(source, data.files, 'ego'),
      listsFromFiles(source, data.files, 'skill'),
    )
    const catalogImages = images.filter(entry => entry.kind !== '스킬' || sinnerSkillIcons.has(entry.name))
    report.plan.excludedSkills = images.filter(entry => entry.kind === '스킬').length - catalogImages.filter(entry => entry.kind === '스킬').length
    const catalogVariants = new Map<string, Set<string>>()
    for (const entry of catalogImages) {
      const key = `${entry.kind}\0${entry.name}`
      const hashes = catalogVariants.get(key) ?? new Set<string>()
      hashes.add(entry.sha256.toLowerCase())
      catalogVariants.set(key, hashes)
    }
    const ambiguousImages = [...catalogVariants.values()].filter(hashes => hashes.size > 1).length
    if (ambiguousImages) report.warnings.push(`${ambiguousImages} catalog image kind/name groups have multiple hashes; every source path is preserved and none is selected automatically.`)

    const previousCandidateSets = new Map<string, Set<string>>()
    if (options.previousArtwork) {
      const receiptPath = realpathSync(resolve(options.previousArtwork))
      const receipt = z.array(z.object({ key: z.string(), status: z.string() })).parse(readJson(receiptPath))
      for (const item of receipt) {
        if (item.status !== 'verified') continue
        const name = basename(item.key).replace(/\.webp$/i, '')
        const candidates = previousCandidateSets.get(name) ?? new Set<string>()
        candidates.add(item.key)
        previousCandidateSets.set(name, candidates)
      }
      const counts: Record<string, { matched: number; unmatched: number; ambiguous: number }> = {}
      for (const entry of catalogImages) {
        const candidates = previousCandidateSets.get(entry.name) ?? new Set<string>()
        const count = counts[entry.kind] ?? { matched: 0, unmatched: 0, ambiguous: 0 }
        if (candidates.size === 1) count.matched++
        else if (candidates.size === 0) count.unmatched++
        else count.ambiguous++
        counts[entry.kind] = count
      }
      report.plan.previousArtwork = counts
    }
    report.plan = { ...report.plan, dataFiles: data.files.length, verifiedImages: images.length, imageFiles: catalogImages.length, outputFiles: outputs.size + 1 }
    report.ok = true
    if (options.prepare) {
      const temp = mkdtempSync(`${output}.tmp-`)
      try {
        for (const [target, content] of outputs) {
          const path = join(temp, 'complete-data', target)
          mkdirSync(dirname(path), { recursive: true })
          writeFileSync(path, content)
        }
        const catalog = catalogImages.map(entry => ({
          kind: entry.kind,
          gameId: entry.kind === '키워드' ? null : entry.name.match(/^(\d+)/)?.[1] ?? null,
          subtype: entry.subtype ?? null, imageState: entry.imageState ?? null, name: entry.name, label: entry.label ?? null,
          container: entry.container, pathId: entry.pathId, sha256: entry.sha256, width: entry.width, height: entry.height,
          sinner: entry.sinner || null, dbLinked: entry.dbLinked ?? false, entityName: entry.entityName ?? '', sourcePath: `Images/${entry.path}`,
          previousArtworkCandidates: [...(previousCandidateSets.get(entry.name) ?? [])],
          notice: report.plan.catalogNotice,
        }))
        writeFileSync(join(temp, 'image-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)
        if (existsSync(output)) rmSync(output, { recursive: true })
        renameSync(temp, output)
        report.prepared = true
      } catch (error) {
        rmSync(temp, { recursive: true, force: true })
        throw error
      }
    }
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error))
    report.ok = false
    report.prepared = false
  }
  writeReport(output, report)
  return report
}

function parseArgs(argv: string[]) {
  let source = ''
  let output = ''
  let prepare = false
  let previousArtwork: string | undefined
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--source') source = argv[++i] ?? ''
    else if (argv[i] === '--output') output = argv[++i] ?? ''
    else if (argv[i] === '--prepare') prepare = true
    else if (argv[i] === '--previous-artwork') previousArtwork = argv[++i] ?? ''
    else throw new Error(`unknown argument: ${argv[i]}`)
  }
  if (!source || !output) throw new Error('usage: --source <LimbusAssets> --output <outside-repo-dir> [--prepare] [--previous-artwork <receipt.json>]')
  return { source, output, prepare, previousArtwork }
}

// Matched by name: inside the apply-extraction bundle import.meta.url is the bundle, not this file.
if (/prepare-extracted-assets\.[cm]?[jt]s$/.test(process.argv[1] ?? '')) {
  prepareExtractedAssets(parseArgs(process.argv.slice(2))).then(report => {
    console.log(JSON.stringify(report, null, 2))
    process.exitCode = report.ok ? 0 : 1
  }).catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
