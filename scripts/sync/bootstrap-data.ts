#!/usr/bin/env tsx
// Recover base catalog rows that the incremental identity sync cannot create.
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { IDENTITY_STAT_BASE_LEVEL, SINNER_SLUGS, STORAGE_BASE } from '../../lib/constants/game'
import { loadEgoSyncContext, loadSourceEgoKeywords, cleanLocaleContent } from './identity-data'
import { resolveEgoStages, type RawEgoStage } from './ego-stages'
import { passiveStageRange } from './ego-passives'

const root = resolve(process.env.LIMBUS_RECOVERY_ROOT ?? '../assets/recovery-2026-09-10')
const source = process.env.LIMBUS_DATA_DIR
if (!source) throw new Error('LIMBUS_DATA_DIR is required; no old export fallback is allowed')
const fix = process.argv.includes('--fix')
const option = (name: string) => { const at = process.argv.indexOf(name); return at === -1 ? null : process.argv[at + 1] ?? null }
// --ego-ids adds new EGO rows to an existing DB without rewriting sinners or other EGO.
const onlyEgoIds = option('--ego-ids')?.split(',') ?? null
const outputDir = resolve(option('--output') ?? root)
if (onlyEgoIds && outputDir === root) throw new Error('--ego-ids requires --output outside the recovery root')
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!, { db: { schema: 'limbus' } })
const sinCodes = ['CRIMSON', 'SCARLET', 'AMBER', 'SHAMROCK', 'AZURE', 'INDIGO', 'VIOLET']
const sinNames = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
const sin = (code: string) => sinNames[sinCodes.indexOf(code)] ?? null
const attack: Record<string, string> = { SLASH: 'slash', PENETRATE: 'pierce', HIT: 'blunt' }
const resistance: Record<string, string> = { '0': '무효', '0.5': '내성', '0.75': '견딤', '1': '보통', '1.5': '취약', '2': '치명' }
type Row = Record<string, any>
function readRows(file: string): Row[] {
  const value = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
  const rows = value.list ?? value.dataList
  if (!Array.isArray(rows)) throw new Error(`Missing data list: ${file}`)
  return rows
}
function load(pattern: RegExp, directory = source!): Map<number, Row> {
  const rows = new Map<number, Row>()
  for (const file of readdirSync(directory).sort().filter(file => pattern.test(file))) {
    for (const row of readRows(join(directory, file))) if (Number.isInteger(row.id)) rows.set(row.id, row)
  }
  return rows
}
function uuid(value: string): string {
  const hex = createHash('sha256').update(`limbus-source-recovery:${value}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
async function all(table: string): Promise<Row[]> {
  const rows: Row[] = []
  // ego_passives has no id; its key is (ego_id, game_passive_id).
  const order = table === 'ego_passives' ? ['ego_id', 'game_passive_id'] : ['id']
  for (let offset = 0;;) {
    let query = client.from(table).select('*')
    for (const column of order) query = query.order(column)
    const { data, error } = await query.range(offset, offset + 499)
    if (error) throw error
    if (!data.length) return rows
    rows.push(...data); offset += data.length
  }
}
/**
 * Storage folder of an EGO without Drive art (new EGO from an extraction): its English name, with characters outside
 * plain ASCII written as _uXXXX_ like the Drive export's folders (e.g. "[" → "_u5b_").
 */
const egoStorageFolder = (name: string) => name.replace(/[^A-Za-z0-9 ._'()!,-]/g, char => `_u${char.codePointAt(0)!.toString(16)}_`)
async function main() {
  // Prepared extracts keep locales in KR/EN/JP; the original recovery input kept them at the root.
  const localeDir = (lang: string) => existsSync(join(source!, lang)) ? join(source!, lang) : source!
  const characters = load(/^character\.txt$/)
  const names = Object.fromEntries(['KR', 'EN', 'JP'].map(lang => [lang, load(new RegExp(`^${lang}_Characters\\.txt$`), localeDir(lang))]))
  const sinners = [...characters.values()].map(character => {
    const slug = SINNER_SLUGS[character.id - 1]
    if (!slug || !names.KR.get(character.id)?.name || !names.EN.get(character.id)?.name || !names.JP.get(character.id)?.name) throw new Error(`Missing sinner locale: ${character.id}`)
    return { id: slug, name: names.EN.get(character.id)!.name, name_kr: names.KR.get(character.id)!.name, name_en: names.EN.get(character.id)!.name, name_jp: names.JP.get(character.id)!.name, order_num: character.id }
  })
  if (sinners.length !== 12) throw new Error(`Expected 12 sinners; found ${sinners.length}`)
  const definitions = load(/^ego-(?:\d+|a\d+c\d+p\d+)\.txt$/i)
  const skillDefinitions = load(/^ego-skill-.*\.txt$/i)
  const passiveDefinitions = load(/^passive-.*\.txt$/i)
  const egoNames = Object.fromEntries(['KR', 'EN', 'JP'].map(lang => [lang, load(new RegExp(`^${lang}_Egos(?:[-_].*)?\\.txt$`, 'i'), localeDir(lang))]))
  const context = loadEgoSyncContext()
  const keywordSources = loadSourceEgoKeywords()
  // The Drive art list exists on the Mac recovery root only; the Windows extraction adds new EGO under English-name folders.
  const artFile = join(root, 'drive-complete-art.json')
  const art: Row[] = existsSync(artFile) ? JSON.parse(readFileSync(artFile, 'utf8')).files : []
  const folderById = new Map<string, string>()
  for (const file of art) {
    const gameId = file.name.match(/^(\d{5})_/)?.[1]
    if (gameId && file.path.includes('/EGO/')) folderById.set(gameId, file.path.split('/EGO/')[1].split('/')[0])
  }
  const existing = await all('ego')
  const existingByGameId = new Map(existing.map(row => [String(row.game_id), row]))
  if (existingByGameId.size !== existing.length) throw new Error('Duplicate EGO game IDs in target database')
  const egos: Row[] = [], skills: Row[] = [], passives: Row[] = [], skipped: Row[] = []
  for (const definition of definitions.values()) {
    const gameId = String(definition.id), sinner = SINNER_SLUGS[definition.characterId - 1]
    if (onlyEgoIds && !onlyEgoIds.includes(gameId)) continue
    // Empty/cut EGO placeholders have no awakening skill. Never fabricate them.
    if (definition.hidden || !definition.awakeningSkillId) { skipped.push({ gameId, reason: definition.hidden ? 'hidden story-only EGO' : 'no awakening skill' }); continue }
    const kr = egoNames.KR.get(definition.id), en = egoNames.EN.get(definition.id), jp = egoNames.JP.get(definition.id)
    // Drive art predates new EGO; their folders follow the existing English-name convention.
    // An existing EGO keeps its folder (its images are already there); a new one gets its English name.
    const folder = folderById.get(gameId) ?? existingByGameId.get(gameId)?.folder_name ?? (onlyEgoIds && en?.name ? egoStorageFolder(en.name) : undefined)
    if (!sinner || !kr?.name || !en?.name || !jp?.name || !folder) throw new Error(`Missing EGO source/name/art mapping: ${gameId}`)
    const id = existingByGameId.get(gameId)?.id ?? uuid(`ego:${gameId}`)
    const asset = `${STORAGE_BASE}/sinners/${sinner}/ego/${encodeURIComponent(folder)}/${gameId}`
    const firstSkill = skillDefinitions.get(definition.awakeningSkillId)
    if (!firstSkill) throw new Error(`Missing EGO skill: ${gameId}`)
    const firstStage = resolveEgoStages(firstSkill.skillData)[0]
    const passiveIds: number[] = [...(definition.passiveList ?? []), ...(definition.awakeningPassiveList ?? [])].filter(Number.isInteger)
    const maxStage = resolveEgoStages(firstSkill.skillData).at(-1)!.gaksungLevel
    const currentPassiveIds = passiveIds.filter(pid => {
      const source = passiveDefinitions.get(pid)
      if (!source) throw new Error(`Missing passive definition: ${pid}`)
      const range = passiveStageRange(source.requireIDList ?? [])
      return maxStage >= range.min_stage && maxStage <= range.max_stage
    })
    const passiveText = (lang: 'kr' | 'en' | 'jp', field: 'name' | 'desc') => currentPassiveIds.map(pid => {
      const p = context.passives[lang].get(pid)
      return field === 'name' ? cleanLocaleContent(p?.name ?? '') : context.formatText(p?.desc, lang)
    }).filter(Boolean).join('\n\n') || null
    // Stage-aware passive rows (as restore-ego-passives.ts), so a new EGO's detail page has its passives per stage.
    for (const pid of new Set(passiveIds)) {
      const row: Row = { ego_id: id, game_passive_id: pid, ...passiveStageRange(passiveDefinitions.get(pid)!.requireIDList ?? []) }
      for (const lang of ['kr', 'en', 'jp'] as const) {
        const localized = context.passives[lang].get(pid)
        if (!localized?.name || !localized.desc) throw new Error(`Missing ${lang} passive ${pid}`)
        const suffix = lang === 'kr' ? '' : `_${lang}`
        row[`name${suffix}`] = cleanLocaleContent(localized.name)
        row[`description${suffix}`] = context.formatText(localized.desc, lang)
      }
      passives.push(row)
    }
    egos.push({ id, sinner_id: sinner, game_id: gameId, name: kr.name, name_kr: kr.name, name_en: en.name, name_jp: jp.name,
      keywords: [...new Set([...(existingByGameId.get(gameId)?.keywords ?? []), ...(keywordSources.get(gameId)?.keywords ?? [])])],
      grade: definition.egoType, sin_affinity: sin(firstStage.attributeType!), folder_name: folder, image_url: `${asset}_awaken_profile.webp`,
      cor_image_url: definition.corrosionSkillId ? `${asset}_erosion_profile.webp` : null,
      cost: sinCodes.map(code => definition.requirementList?.find((r: Row) => r.attributeType === code)?.num ?? 0),
      resistance: sinCodes.map(code => { const value = definition.attributeResistList?.find((r: Row) => r.type === code)?.value; if (resistance[String(value)] == null) throw new Error(`Unknown EGO resistance ${gameId}: ${value}`); return resistance[String(value)] }),
      passive_name: passiveText('kr', 'name'), passive_content: passiveText('kr', 'desc'), passive_name_en: passiveText('en', 'name'), passive_content_en: passiveText('en', 'desc'), passive_name_jp: passiveText('jp', 'name'), passive_content_jp: passiveText('jp', 'desc'),
    })
    for (const [category, skillId] of [['awakening', definition.awakeningSkillId], ['corrosion', definition.corrosionSkillId]] as const) {
      if (!skillId) continue
      const skill = skillDefinitions.get(skillId)
      if (!skill) throw new Error(`Missing skill ${skillId}`)
      for (const stage of resolveEgoStages(skill.skillData as RawEgoStage[])) {
        const level = stage.gaksungLevel
        const localized = (lang: 'kr' | 'en' | 'jp') => {
          for (let at = level; at >= 1; at--) { const value = context.skills[lang].get(`${skillId}_${at}`); if (value) return value }
          throw new Error(`Missing skill text: ${skillId}/${lang}/${level}`)
        }
        const krSkill = localized('kr'), enSkill = localized('en'), jpSkill = localized('jp')
        const coins = stage.coinList ?? []
        if (!coins.length || stage.defaultValue == null || stage.mpUsage == null) throw new Error(`Missing EGO stats: ${skillId}/${level}`)
        skills.push({ id: uuid(`ego-skill:${id}:${skillId}:${level}`), ego_id: id, game_skill_id: skillId, construe_level: level, category,
          name: krSkill.name, name_en: enSkill.name, name_jp: jpSkill.name, description: context.formatSkill(krSkill, 'kr'), description_en: context.formatSkill(enSkill, 'en'), description_jp: context.formatSkill(jpSkill, 'jp'),
          skill_type: attack[stage.atkType!], sin_affinity: sin(stage.attributeType!), base_power: stage.defaultValue,
          coin_power: (coins[0].operatorType === 'SUB' ? -1 : 1) * coins[0].scale, coins: coins.length, atk_weight: stage.targetNum, mental_consume: stage.mpUsage, skill_order: category === 'awakening' ? 1 : 2,
          offense_level: stage.skillLevelCorrection == null ? null : IDENTITY_STAT_BASE_LEVEL + stage.skillLevelCorrection,
        })
      }
    }
  }
  if (onlyEgoIds && egos.length !== onlyEgoIds.length) throw new Error(`Requested EGO not found: ${onlyEgoIds.filter(id => !egos.some(row => row.game_id === id)).join(',')}`)
  const report = { source: resolve(source!), sinners, egos, skills, passives, skipped }
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(join(outputDir, 'bootstrap-plan.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ sinners: sinners.length, egos: egos.length, skills: skills.length, passives: passives.length, fifthStageSkills: skills.filter(row => row.construe_level === 5).length, skipped, fix }))
  if (!fix) return
  const tables = onlyEgoIds ? ['ego', 'ego_skills', 'ego_passives'] as const : ['sinners', 'ego', 'ego_skills', 'ego_passives'] as const
  const backup = join(outputDir, 'before-bootstrap'); mkdirSync(backup, { recursive: true })
  for (const table of tables) {
    const file = join(backup, `${table}.json`)
    // Never overwrite the original recovery point on retry.
    try { writeFileSync(file, JSON.stringify(await all(table), null, 2), { flag: 'wx' }) } catch (error: any) { if (error.code !== 'EEXIST') throw error }
  }
  for (const [table, rows] of ([['sinners', sinners], ['ego', egos], ['ego_skills', skills], ['ego_passives', passives]] as const).filter(([table]) => (tables as readonly string[]).includes(table))) {
    for (let offset = 0; offset < rows.length; offset += 100) {
      const { error } = await client.from(table).upsert(rows.slice(offset, offset + 100), { onConflict: table === 'ego_passives' ? 'ego_id,game_passive_id' : 'id' })
      if (error) throw error
    }
    console.log(`${table}: ${rows.length} restored`)
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
