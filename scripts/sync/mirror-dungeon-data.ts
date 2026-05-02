#!/usr/bin/env tsx
/**
 * sync-mirror-dungeon-data.ts
 * 거울 던전 관련 전체 데이터 동기화 (TypeScript + Zod)
 *
 * Usage:
 *   npx tsx scripts/sync/mirror-dungeon-data.ts [options]
 *
 * Options:
 *   --dry-run        비교만 (기본값)
 *   --fix            DB 자동 수정
 *   --verbose        상세 로그
 *   --gifts-only     EGO 기프트만 동기화
 *   --themes-only    테마팩만 동기화
 *   --events-only    이벤트만 동기화
 *   --recipes-only   레시피만 동기화
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { z } from 'zod'
import { config } from 'dotenv'
import { triggerRevalidation } from './_revalidate'

config({ path: '.env.local' })

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const FIX = args.includes('--fix')
const VERBOSE = args.includes('--verbose')
const GIFTS_ONLY = args.includes('--gifts-only')
const THEMES_ONLY = args.includes('--themes-only')
const EVENTS_ONLY = args.includes('--events-only')
const RECIPES_ONLY = args.includes('--recipes-only')
const DUMP_EVENTS_ARG = args.find(a => a.startsWith('--dump-events=') || a === '--dump-events')
const DUMP_EVENTS_PATH = DUMP_EVENTS_ARG
  ? (DUMP_EVENTS_ARG.includes('=') ? DUMP_EVENTS_ARG.split('=').slice(1).join('=') : args[args.indexOf(DUMP_EVENTS_ARG) + 1])
  : null
const ANY_FILTER = GIFTS_ONLY || THEMES_ONLY || EVENTS_ONLY || RECIPES_ONLY

const DO_GIFTS = !ANY_FILTER || GIFTS_ONLY
const DO_THEMES = !ANY_FILTER || THEMES_ONLY
const DO_EVENTS = !ANY_FILTER || EVENTS_ONLY
const DO_RECIPES = !ANY_FILTER || RECIPES_ONLY

// Current source contains both 971105 and 971107 in theme 1126's eventPool, but
// they render as the same visible root event. 971107 also points its illustId to
// 971105, so keep 971105 as the display-canonical row and drop 971107 plus its
// nextEventID child from the public DB target.
const CANONICAL_EVENT_EXCLUDE_IDS = new Set<number>([971107])

// ── Data dir ──────────────────────────────────────────────────────────────────
const DATA_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/Json (Text)'))
const KR_DIR = join(DATA_DIR, 'KR')
const EN_DIR = join(DATA_DIR, 'EN')
const JP_DIR = join(DATA_DIR, 'JP')
const KR_LATEST_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/kr'))
const EN_LATEST_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/en'))
const JP_LATEST_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/jp'))

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)
const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

const EVENT_IMAGE_ALIASES = new Map<number, number>([
  [971082, 971081],
  [971098, 971097],
  [971099, 971097],
])

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const GiftUpgradeSchema = z.object({
  upgradeLevel: z.number(),
  localizeID: z.number(),
  abilityIDList: z.array(z.number()).optional(),
})

const RawGiftSchema = z.object({
  id: z.number(),
  attributeType: z.string().optional(),
  keyword: z.string().optional(),
  tag: z.array(z.string()).optional(),
  price: z.number().optional(),
  sellPrice: z.number().optional(),
  lockType: z.boolean().optional(),
  upgradeDataList: z.array(GiftUpgradeSchema).optional(),
  convertDataList: z.array(z.number()).optional(),
  subEgoGiftAbilityIDList: z.array(z.number()).optional(),
})

const LocalizedGiftSchema = z.object({
  id: z.number(),
  name: z.string(),
  desc: z.string().optional(),
  simpleDesc: z.array(z.object({
    abilityID: z.number().optional(),
    simpleDesc: z.string().optional(),
  })).optional(),
})

const ThemeRawSchema = z.object({
  id: z.number(),
  desc: z.string().optional(),
  egoGiftPool: z.array(z.number()).optional(),
  specificEgoGiftPool: z.array(z.number()).optional(),
  uiConfigs: z.object({
    packSpriteId: z.string().optional(),
    bossSpriteId: z.string().optional(),
  }).optional(),
  unlockCondition: z.object({ unlockCode: z.number().optional() }).optional(),
  exceptionConditions: z.array(z.object({
    dungeonIdx: z.number(),
    selectableFloors: z.array(z.number()).optional(),
  })).optional(),
  difficulty: z.string().optional(),
  mapGenSequence: z.any().optional(),
})

const ThemeLocaleSchema = z.object({
  id: z.number(),
  name: z.string(),
})

const RecipeRawSchema = z.object({
  aEgoGiftId: z.number().optional(),
  bEgoGiftId: z.number().optional(),
  cEgoGiftId: z.number().optional(),
  resultEgoGiftId: z.number(),
  requiredEgoGiftIds: z.array(z.number()),
})

const AbEventSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  eventDesc: z.string().optional(),
  prevDesc: z.string().optional(),
  behaveDesc: z.string().optional(),
  successDesc: z.array(z.string()).optional(),
  failureDesc: z.array(z.string()).optional(),
})

const ActionEventOptionSchema = z.object({
  message: z.string().optional(),
  messageDesc: z.string().optional(),
  result: z.array(z.string()).optional(),
})

const ActionEventSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  subDesc: z.string().optional(),
  desc: z.string().optional(),
  options: z.array(ActionEventOptionSchema).optional(),
})

const EventGiftMappingSchema = z.object({
  eventId: z.number(),
  egoGiftList: z.array(z.number()),
})

const DropPoolItemSchema = z.object({
  excludeEgoGifts: z.array(z.number()).optional(),
  globalExcludeEgoGifts: z.array(z.number()).optional(),
})

// ── Keyword fallback map ───────────────────────────────────────────────────────
const KEYWORD_FALLBACK_KR: Record<string, string> = {
  Combustion: '화상', Laceration: '출혈', Vibration: '진동',
  Burst: '파열', Sinking: '침잠', Breath: '호흡', Charge: '충전',
  Random: '무작위', Slash: '참격', Penetrate: '관통', Hit: '타격',
  None: '공통', Common: '공통',
  Burn: '화상', Bleed: '출혈', Rupture: '파열', Poise: '호흡',
  VibrationExplosion: '진동 폭발', Switch_Vibration: '진동 전환',
  FusionVibration: '합성 진동', VibrationDistribution: '진동-분배',
  Binding: '속박', DefenseDown: '방어 레벨 감소', AttackUp: '공격 레벨 증가',
  Enhancement: '위력 증가', Vulnerable: '취약', Fragile: '취약',
  Blunt: '타격',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readBom(path: string): string {
  return readFileSync(path, 'utf-8').replace(/^\uFEFF/, '')
}

function loadJson(path: string): unknown {
  return JSON.parse(readBom(path))
}

function safeLoadJson(path: string): unknown | null {
  try {
    return loadJson(path)
  } catch {
    return null
  }
}

type ListData = { list?: unknown[]; dataList?: unknown[] }

function extractList(data: unknown): unknown[] {
  const d = data as ListData
  return d?.list ?? d?.dataList ?? []
}

function globFiles(dir: string, pattern: RegExp): string[] {
  try {
    return readdirSync(dir).filter(f => pattern.test(f)).sort()
  } catch {
    return []
  }
}

const RECIPE_COMMON_FILES = [
  'mirror-dungeon-common-data-md7.txt',
  'mirror-dungeon-common-data-md7-nextupdate.txt',
  'mirror-dungeon-common-data-md6.txt',
  'mirror-dungeon-common-data.txt',
]

type LoadedRecipeData = {
  sourceFile: string | null
  recipes: z.infer<typeof RecipeRawSchema>[]
}

function loadLatestRecipeData(): LoadedRecipeData {
  for (const fn of RECIPE_COMMON_FILES) {
    const data = safeLoadJson(join(DATA_DIR, fn))
    if (!data) continue
    const table = (data as Record<string, unknown>).egoGiftCombineFixedTable as Record<string, unknown> | undefined
    if (!table?.combineFixed) continue

    const recipes: z.infer<typeof RecipeRawSchema>[] = []
    for (const item of table.combineFixed as unknown[]) {
      const parsed = RecipeRawSchema.safeParse(item)
      if (parsed.success) recipes.push(parsed.data)
      else if (VERBOSE) console.warn('  ⚠ 레시피 파싱 실패:', parsed.error.issues[0])
    }
    return { sourceFile: fn, recipes }
  }

  return { sourceFile: null, recipes: [] }
}

function collectRecipeGiftIds(rawRecipes: z.infer<typeof RecipeRawSchema>[]): Set<number> {
  const ids = new Set<number>()
  for (const recipe of rawRecipes) {
    ids.add(recipe.resultEgoGiftId)
    for (const id of recipe.requiredEgoGiftIds) ids.add(id)
  }
  return ids
}


function parseGrade(tags: string[] | undefined): string {
  const t = tags ?? []
  // TIER_EX takes priority over TIER_N (some gifts have both)
  if (t.includes('TIER_EX')) return 'EX'
  for (const tag of t) {
    const m = tag.match(/^TIER_(\d)$/)
    if (m) return m[1]
  }
  return '1'
}

const KEYWORD_FALLBACK_EN: Record<string, string> = {
  Combustion: 'Burn', Laceration: 'Bleed', Vibration: 'Tremor',
  Burst: 'Rupture', Sinking: 'Sinking', Breath: 'Poise', Charge: 'Charge',
  Random: 'Random', Slash: 'Slash', Penetrate: 'Pierce', Hit: 'Blunt',
  None: 'Common', Common: 'Common',
  Burn: 'Burn', Bleed: 'Bleed', Rupture: 'Rupture', Poise: 'Poise',
  VibrationExplosion: 'Tremor Burst', Switch_Vibration: 'Tremor Conversion',
  FusionVibration: 'Composite Tremor', VibrationDistribution: 'Tremor-Distribution',
  Binding: 'Bind', DefenseDown: 'Def Level Down', AttackUp: 'Atk Level Up',
  Enhancement: 'Potency Up', Vulnerable: 'Fragile', Fragile: 'Fragile',
  Blunt: 'Blunt',
}

const KEYWORD_FALLBACK_JP: Record<string, string> = {
  Combustion: '火傷', Laceration: '出血', Vibration: '振動',
  Burst: '破裂', Sinking: '沈潜', Breath: '呼吸', Charge: '充電',
  Random: 'ランダム', Slash: '斬撃', Penetrate: '貫通', Hit: '打撃',
  None: '共通', Common: '共通',
  Burn: '火傷', Bleed: '出血', Rupture: '破裂', Poise: '呼吸',
  VibrationExplosion: '振動爆発', Switch_Vibration: '振動転換',
  FusionVibration: '合成振動', VibrationDistribution: '振動-分配',
  Binding: '束縛', DefenseDown: '防御レベル減少', AttackUp: '攻撃レベル増加',
  Enhancement: '威力増加', Vulnerable: '脆弱', Fragile: '脆弱',
  Blunt: '打撃',
}

type Lang = 'kr' | 'en' | 'jp'

const _keywordMaps: Record<Lang, Map<string, string> | null> = { kr: null, en: null, jp: null }

function getKeywordMapForLang(lang: Lang): Map<string, string> {
  if (_keywordMaps[lang]) return _keywordMaps[lang]!

  let fallback: Record<string, string>
  let dir: string
  let filePattern: RegExp

  if (lang === 'en') {
    fallback = KEYWORD_FALLBACK_EN
    dir = EN_DIR
    filePattern = /^EN_BattleKeywords.*\.txt$/
  } else if (lang === 'jp') {
    fallback = KEYWORD_FALLBACK_JP
    dir = JP_DIR
    filePattern = /^JP_BattleKeywords.*\.txt$/
  } else {
    fallback = KEYWORD_FALLBACK_KR
    dir = KR_DIR
    filePattern = /^KR_BattleKeywords.*\.txt$/
  }

  const map = new Map(Object.entries(fallback))
  for (const f of globFiles(dir, filePattern)) {
    const data = safeLoadJson(join(dir, f))
    for (const item of extractList(data)) {
      const parsed = z.object({ id: z.string(), name: z.string() }).safeParse(item)
      if (parsed.success && !map.has(parsed.data.id)) {
        map.set(parsed.data.id, parsed.data.name)
      }
    }
  }

  _keywordMaps[lang] = map
  if (VERBOSE) console.log(`  배틀 키워드 매핑 [${lang}]: ${map.size}종`)
  return map
}

function cleanDesc(desc: string | undefined, lang: Lang = 'kr'): string | null {
  if (!desc) return null
  const map = getKeywordMapForLang(lang)
  return desc
    .replace(/<style="[^"]*">/g, '').replace(/<\/style>/g, '')
    .replace(/<\/?noparse>/g, '')
    .replace(/<size=[^>]*>/g, '').replace(/<\/size>/g, '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color[^>]*>/g, '')
    .replace(/\[([A-Za-z_]+)\]/g, (m, key) => map.get(key) ?? m)
    .trim()
}

function isBuyDisabled(tags: string[] | undefined): boolean {
  return (tags ?? []).includes('NO_SALE')
}

// ANSI color helpers
const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`
const GRAY = (s: string) => `\x1b[90m${s}\x1b[0m`
const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`

// ── Section 1: EGO Gifts ──────────────────────────────────────────────────────

interface GiftRow {
  id?: string
  game_id: number
  name: string
  keyword: string
  grade: string
  price: number | null
  sell_price: number | null
  buy_disabled: boolean
  enhancement: boolean
  effect_base: string | null
  effect_plus: string | null
  effect_plusplus: string | null
  name_en?: string | null
  name_jp?: string | null
  effect_base_en?: string | null
  effect_base_jp?: string | null
  effect_plus_en?: string | null
  effect_plus_jp?: string | null
  effect_plusplus_en?: string | null
  effect_plusplus_jp?: string | null
  is_synthesis: boolean
  convert_to: number | null
  difficulty?: string
  image_url?: string
  activation_condition?: GiftActivationCondition
}

type GiftActivationCondition = {
  type: 'keyword' | 'multi_keyword' | 'affiliation' | 'skill'
  keyword?: string
  keywords?: string[]
  affiliation?: string
  affiliations?: string[]
  skill_condition?: string
  count: number
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${stableJson(record[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sameJson(a: unknown, b: unknown): boolean {
  return stableJson(a ?? null) === stableJson(b ?? null)
}

function extractActivationCondition(effect: string | null, keyword: string): GiftActivationCondition | undefined {
  if (!effect) return undefined

  const keywordTrimmed = keyword.trim()

  const affiliationMatch = effect.match(/(?:편성된\s*)?(?:아래 효과는\s*)?(?:전투 내\s*)?([가-힣A-Za-z0-9 .·-]+?)\s*소속 인격이\s*(\d+)인 이상(?:\s*일 때|이면| 있다면)?/)
  if (affiliationMatch) {
    return {
      type: 'affiliation',
      count: Number(affiliationMatch[2]),
      affiliation: affiliationMatch[1].trim(),
    }
  }

  const bloodfeastMatch = effect.match(/혈찬을 소모하는 스킬을 보유한 인격이\s*(\d+)인 이상/)
  if (bloodfeastMatch) {
    return {
      type: 'skill',
      count: Number(bloodfeastMatch[1]),
      skill_condition: '혈찬 소모',
    }
  }

  if (!keywordTrimmed || keywordTrimmed === '공통') return undefined

  const keywordPattern = new RegExp(`${escapeRegExp(keywordTrimmed)}[^\\n]*?(?:공격\\s*)?스킬[^\\n]*?보유한 인격이\\s*(\\d+)인 이상`)
  const keywordMatch = effect.match(keywordPattern)
  if (!keywordMatch) return undefined

  return {
    type: 'keyword',
    count: Number(keywordMatch[1]),
    keyword: keywordTrimmed,
  }
}

async function syncGifts(): Promise<void> {
  console.log(BOLD('\n[1/4] EGO 기프트 동기화'))

  // 1a. Gift definition files: mirrordungeon variants + story-twth + future non-md families
  // Skip: buff (stat-only), story-chapter (a1c*), walpu (walpurgis), hellschicken, story- (except story-twth)
  const GIFT_PATTERN = /^ego-gift-.*\.txt$/
  const SKIP_PATTERN = /^ego-gift-(buff|a1c|walpu|hellschicken|story-(?!twth))/

  const giftFiles = globFiles(DATA_DIR, GIFT_PATTERN).filter(f => !SKIP_PATTERN.test(f))
  if (VERBOSE) console.log(`  기프트 파일: ${giftFiles.join(', ')}`)

  const giftMap = new Map<number, z.infer<typeof RawGiftSchema>>()
  for (const f of giftFiles) {
    const data = loadJson(join(DATA_DIR, f))
    const list = extractList(data)
    for (const item of list) {
      const parsed = RawGiftSchema.safeParse(item)
      if (parsed.success) {
        giftMap.set(parsed.data.id, parsed.data)
      } else if (VERBOSE) {
        console.warn(`  ⚠ ${f} 파싱 실패:`, parsed.error.issues[0])
      }
    }
    if (VERBOSE) console.log(`  ${f}: ${list.length} items`)
  }

  // Some BokGak/return gifts live in story-scoped files that are normally skipped,
  // but the latest fixed-combination table references them directly.
  const { recipes: recipeRefs } = loadLatestRecipeData()
  const recipeGiftIds = collectRecipeGiftIds(recipeRefs)
  let recipeRefGiftCount = 0
  for (const f of globFiles(DATA_DIR, GIFT_PATTERN).filter(f => SKIP_PATTERN.test(f))) {
    const data = loadJson(join(DATA_DIR, f))
    for (const item of extractList(data)) {
      const parsed = RawGiftSchema.safeParse(item)
      if (!parsed.success) continue
      if (!recipeGiftIds.has(parsed.data.id) || giftMap.has(parsed.data.id)) continue
      giftMap.set(parsed.data.id, parsed.data)
      recipeRefGiftCount++
    }
  }
  if (recipeRefGiftCount > 0) {
    console.log(`  레시피 참조 기프트 보강: ${recipeRefGiftCount}종`)
  }

  // Hidden boss gift IDs
  const hiddenBossIds = new Set<number>()
  for (const f of globFiles(DATA_DIR, /^(ego-gift-mirrordungeon\d*-hb|hidden-ego-gift-mirrordungeon).*\.txt$/)) {
    const data = loadJson(join(DATA_DIR, f))
    for (const item of extractList(data)) {
      const parsed = z.object({ id: z.number() }).safeParse(item)
      if (parsed.success) hiddenBossIds.add(parsed.data.id)
    }
  }
  if (hiddenBossIds.size > 0) console.log(`  히든보스 기프트: ${hiddenBossIds.size}종`)
  console.log(`  기프트 정의: ${giftMap.size}종`)

  // 1b. Locale (KR) — all KR_EGOgift_MirrorDungeon* files
  const localizeMap = new Map<number, z.infer<typeof LocalizedGiftSchema>>()

  const krGiftFiles = globFiles(KR_DIR, /^KR_EGOgift_.*\.txt$/)
  for (const f of krGiftFiles) {
    const data = loadJson(join(KR_DIR, f))
    for (const item of extractList(data)) {
      const parsed = LocalizedGiftSchema.safeParse(item)
      if (parsed.success && !localizeMap.has(parsed.data.id)) {
        localizeMap.set(parsed.data.id, parsed.data)
      }
    }
  }

  // Fallback: root-level KR_ files (recent patches)
  for (const f of globFiles(DATA_DIR, /^KR_EGOgift_.*\.txt$/)) {
    const data = loadJson(join(DATA_DIR, f))
    for (const item of extractList(data)) {
      const parsed = LocalizedGiftSchema.safeParse(item)
      if (parsed.success && !localizeMap.has(parsed.data.id)) {
        localizeMap.set(parsed.data.id, parsed.data)
      }
    }
  }
  // Latest JSON locales (kr/ dir — newer patches like TwiningThreads)
  for (const f of globFiles(KR_LATEST_DIR, /^KR_EGOgift_.*\.json$/)) {
    const data = safeLoadJson(join(KR_LATEST_DIR, f))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = LocalizedGiftSchema.safeParse(item)
      if (parsed.success && !localizeMap.has(parsed.data.id)) {
        localizeMap.set(parsed.data.id, parsed.data)
      }
    }
  }
  console.log(`  로컬라이즈: ${localizeMap.size}개`)

  // EN/JP 로컬라이즈 로드
  const enLocalizeMap = new Map<number, z.infer<typeof LocalizedGiftSchema>>()
  for (const f of globFiles(DATA_DIR, /^EN_EGOgift.*\.txt$/)) {
    const data = safeLoadJson(join(DATA_DIR, f))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = LocalizedGiftSchema.safeParse(item)
      if (parsed.success && !enLocalizeMap.has(parsed.data.id))
        enLocalizeMap.set(parsed.data.id, parsed.data)
    }
  }
  for (const f of globFiles(EN_DIR, /^EN_EGOgift.*\.txt$/)) {
    const data = safeLoadJson(join(EN_DIR, f))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = LocalizedGiftSchema.safeParse(item)
      if (parsed.success)
        enLocalizeMap.set(parsed.data.id, parsed.data)
    }
  }
  // Latest JSON locales (en/ dir)
  for (const f of globFiles(EN_LATEST_DIR, /^EN_EGOgift.*\.json$/)) {
    const data = safeLoadJson(join(EN_LATEST_DIR, f))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = LocalizedGiftSchema.safeParse(item)
      if (parsed.success)
        enLocalizeMap.set(parsed.data.id, parsed.data)
    }
  }

  const jpLocalizeMap = new Map<number, z.infer<typeof LocalizedGiftSchema>>()
  for (const f of globFiles(DATA_DIR, /^JP_EGOgift.*\.txt$/)) {
    const data = safeLoadJson(join(DATA_DIR, f))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = LocalizedGiftSchema.safeParse(item)
      if (parsed.success && !jpLocalizeMap.has(parsed.data.id))
        jpLocalizeMap.set(parsed.data.id, parsed.data)
    }
  }
  for (const f of globFiles(JP_DIR, /^JP_EGOgift.*\.txt$/)) {
    const data = safeLoadJson(join(JP_DIR, f))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = LocalizedGiftSchema.safeParse(item)
      if (parsed.success)
        jpLocalizeMap.set(parsed.data.id, parsed.data)
    }
  }
  // Latest JSON locales (jp/ dir)
  for (const f of globFiles(JP_LATEST_DIR, /^JP_EGOgift.*\.json$/)) {
    const data = safeLoadJson(join(JP_LATEST_DIR, f))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = LocalizedGiftSchema.safeParse(item)
      if (parsed.success)
        jpLocalizeMap.set(parsed.data.id, parsed.data)
    }
  }
  console.log(`  EN 로컬라이즈: ${enLocalizeMap.size}개, JP: ${jpLocalizeMap.size}개`)

  // 1c. Keyword category map
  const categoryMap = new Map<string, string>(Object.entries(KEYWORD_FALLBACK_KR))
  const catData = safeLoadJson(join(KR_DIR, 'KR_EgoGiftCategory.json'))
  if (catData) {
    for (const item of extractList(catData)) {
      const parsed = z.object({ id: z.string(), name: z.string() }).safeParse(item)
      if (parsed.success) categoryMap.set(parsed.data.id, parsed.data.name)
    }
  }

  // 1d. Transform
  const gifts: GiftRow[] = []
  let missingLocalize = 0

  for (const [id, item] of giftMap) {
    const upgrades = item.upgradeDataList ?? []
    const baseUpgrade = upgrades.find(u => u.upgradeLevel === 0)
    const plusUpgrade = upgrades.find(u => u.upgradeLevel === 1)
    const ppUpgrade = upgrades.find(u => u.upgradeLevel === 2)

    const baseLocalizeId = baseUpgrade?.localizeID ?? id
    const plusLocalizeId = plusUpgrade?.localizeID
    const ppLocalizeId = ppUpgrade?.localizeID

    const baseLoc = localizeMap.get(baseLocalizeId)
    if (!baseLoc) {
      missingLocalize++
      if (VERBOSE) console.log(`  ⚠ ID ${id}: 로컬라이즈 없음 (localizeID: ${baseLocalizeId})`)
      continue
    }

    // Skip upgrade variants (name ends with '+')
    if (baseLoc.name.endsWith('+')) continue

    let keyword = '공통'
    if (item.keyword && item.keyword !== 'None') {
      keyword = categoryMap.get(item.keyword) ?? KEYWORD_FALLBACK_KR[item.keyword] ?? item.keyword
    }

    const convertTo = item.convertDataList?.[0] ?? null

    let effectBase = cleanDesc(baseLoc.desc)
    if (effectBase && convertTo && effectBase.includes('{0}')) {
      const convertLoc = localizeMap.get(convertTo)
      const convertName = convertLoc?.name ?? `기프트 #${convertTo}`
      effectBase = effectBase.replace('{0}', `→ [${convertName}]`)
    }

    const activationCondition = extractActivationCondition(effectBase, keyword)

    gifts.push({
      game_id: id,
      name: baseLoc.name,
      name_en: enLocalizeMap.get(baseLocalizeId)?.name ?? enLocalizeMap.get(id)?.name ?? null,
      name_jp: jpLocalizeMap.get(baseLocalizeId)?.name ?? jpLocalizeMap.get(id)?.name ?? null,
      keyword,
      grade: parseGrade(item.tag),
      price: item.price ?? null,
      sell_price: item.sellPrice ?? null,
      buy_disabled: isBuyDisabled(item.tag),
      enhancement: upgrades.length > 1,
      effect_base: effectBase,
      effect_base_en: (() => {
        let desc = cleanDesc(enLocalizeMap.get(baseLocalizeId)?.desc ?? enLocalizeMap.get(id)?.desc, 'en')
        if (desc && convertTo && desc.includes('{0}')) {
          const convertLocEn = enLocalizeMap.get(convertTo)
          const convertName = convertLocEn?.name ?? localizeMap.get(convertTo)?.name ?? `Gift #${convertTo}`
          desc = desc.replace('{0}', `→ [${convertName}]`)
        }
        return desc
      })(),
      effect_base_jp: (() => {
        let desc = cleanDesc(jpLocalizeMap.get(baseLocalizeId)?.desc ?? jpLocalizeMap.get(id)?.desc, 'jp')
        if (desc && convertTo && desc.includes('{0}')) {
          const convertLocJp = jpLocalizeMap.get(convertTo)
          const convertName = convertLocJp?.name ?? localizeMap.get(convertTo)?.name ?? `ギフト #${convertTo}`
          desc = desc.replace('{0}', `→ [${convertName}]`)
        }
        return desc
      })(),
      effect_plus: plusLocalizeId ? cleanDesc(localizeMap.get(plusLocalizeId)?.desc) : null,
      effect_plusplus: ppLocalizeId ? cleanDesc(localizeMap.get(ppLocalizeId)?.desc) : null,
      effect_plus_en: plusLocalizeId ? cleanDesc(enLocalizeMap.get(plusLocalizeId)?.desc, 'en') : null,
      effect_plus_jp: plusLocalizeId ? cleanDesc(jpLocalizeMap.get(plusLocalizeId)?.desc, 'jp') : null,
      effect_plusplus_en: ppLocalizeId ? cleanDesc(enLocalizeMap.get(ppLocalizeId)?.desc, 'en') : null,
      effect_plusplus_jp: ppLocalizeId ? cleanDesc(jpLocalizeMap.get(ppLocalizeId)?.desc, 'jp') : null,
      is_synthesis: false,
      convert_to: convertTo,
      activation_condition: activationCondition,
    })

    // Replace runtime placeholders {0}, {1}, etc. with default value "0"
    // (only for non-convert_to gifts — convert_to gifts are handled in frontend)
    if (!convertTo) {
      const last = gifts[gifts.length - 1]
      if (last.effect_base) last.effect_base = last.effect_base.replace(/\{(\d+)\}/g, '0')
      if (last.effect_base_en) last.effect_base_en = last.effect_base_en.replace(/\{(\d+)\}/g, '0')
      if (last.effect_base_jp) last.effect_base_jp = last.effect_base_jp.replace(/\{(\d+)\}/g, '0')
      if (last.effect_plus) last.effect_plus = last.effect_plus.replace(/\{(\d+)\}/g, '0')
      if (last.effect_plusplus) last.effect_plusplus = last.effect_plusplus.replace(/\{(\d+)\}/g, '0')
      if (last.effect_plus_en) last.effect_plus_en = last.effect_plus_en.replace(/\{(\d+)\}/g, '0')
      if (last.effect_plus_jp) last.effect_plus_jp = last.effect_plus_jp.replace(/\{(\d+)\}/g, '0')
      if (last.effect_plusplus_en) last.effect_plusplus_en = last.effect_plusplus_en.replace(/\{(\d+)\}/g, '0')
      if (last.effect_plusplus_jp) last.effect_plusplus_jp = last.effect_plusplus_jp.replace(/\{(\d+)\}/g, '0')
    }

  }
  console.log(`  변환 완료: ${gifts.length}종 (로컬라이즈 누락: ${missingLocalize})`)

  // 1d-2. Mark is_synthesis: load recipe result IDs from common data files
  const synthesisIds = new Set<number>()
  for (const recipe of recipeRefs) synthesisIds.add(recipe.resultEgoGiftId)
  for (const gift of gifts) {
    if (synthesisIds.has(gift.game_id)) gift.is_synthesis = true
  }
  console.log(`  합성 기프트: ${gifts.filter(g => g.is_synthesis).length}종`)

  // 1e. Droppool difficulty
  // Sort by numeric suffix: droppool-7.txt > droppool-6.txt > droppool.txt (no suffix = 0)
  const droppoolFiles = globFiles(DATA_DIR, /^mirrordungeon-egogift-droppool.*\.txt$/)
    .filter(f => !f.includes('dummy'))
    .sort((a, b) => {
      // Parse version as tuple [major, minor] — e.g. droppool-5-2.txt → [5,2], droppool-7.txt → [7,0], droppool.txt → [0,0]
      const parseVer = (f: string): [number, number] => {
        const m = f.match(/droppool(?:-(\d+)(?:-(\d+))?)?\.txt$/)
        return [parseInt(m?.[1] ?? '0', 10), parseInt(m?.[2] ?? '0', 10)]
      }
      const [ma, sa] = parseVer(a)
      const [mb, sb] = parseVer(b)
      return ma !== mb ? ma - mb : sa - sb
    })
  const latestDroppool = droppoolFiles[droppoolFiles.length - 1]

  if (latestDroppool) {
    const dpData = loadJson(join(DATA_DIR, latestDroppool))
    // Handle { list: [item] } wrapper as well as bare array/object
    const dpList = (dpData as { list?: unknown[] })?.list ?? (Array.isArray(dpData) ? dpData : null)
    const dpRaw = dpList ? dpList[0] : dpData
    const dp = DropPoolItemSchema.safeParse(dpRaw)
    if (dp.success) {
      const normalExclude = new Set(dp.data.excludeEgoGifts ?? [])
      const globalExclude = new Set(dp.data.globalExcludeEgoGifts ?? [])
      let nCount = 0, hCount = 0, eCount = 0
      for (const gift of gifts) {
        if (hiddenBossIds.has(gift.game_id)) {
          gift.difficulty = '익스트림'; eCount++
        } else if (normalExclude.has(gift.game_id) || globalExclude.has(gift.game_id)) {
          gift.difficulty = '하드'; hCount++
        } else {
          gift.difficulty = '노말'; nCount++
        }
      }
      console.log(`  ${latestDroppool} 기준: 노말 ${nCount}, 하드 ${hCount}, 익스트림 ${eCount}`)
    }
  } else {
    for (const gift of gifts) gift.difficulty = '노말'
    console.log('  ⚠ droppool 파일 없음, 모두 노말로 설정')
  }

  // 1f. Compare with DB
  const { data: existingGifts, error: fetchErr } = await supabase
    .schema('limbus')
    .from('ego_gifts')
    .select('id, game_id, name, name_en, name_jp, keyword, grade, effect_base, effect_base_en, effect_base_jp, effect_plus, effect_plus_en, effect_plus_jp, effect_plusplus, effect_plusplus_en, effect_plusplus_jp, price, sell_price, buy_disabled, enhancement, is_synthesis, convert_to, difficulty, image_url, activation_condition')

  if (fetchErr) throw new Error(`ego_gifts fetch 실패: ${fetchErr.message}`)

  const existingByGameId = new Map<number, typeof existingGifts[0]>()
  const existingByName = new Map<string, typeof existingGifts[0]>()
  for (const g of existingGifts ?? []) {
    if (g.game_id) existingByGameId.set(g.game_id, g)
    existingByName.set(g.name, g)
  }

  let newCount = 0, updateCount = 0, matchCount = 0
  const toUpsert: GiftRow[] = []

  for (const gift of gifts) {
    const existing = existingByGameId.get(gift.game_id) ?? existingByName.get(gift.name)

    if (!existing) {
      newCount++
      console.log(GREEN(`  🆕 ${gift.name} (game_id: ${gift.game_id})`))
      toUpsert.push(gift)
    } else {
      const changes: string[] = []
      if (existing.keyword !== gift.keyword) changes.push(`keyword: ${existing.keyword} → ${gift.keyword}`)
      if (existing.grade !== gift.grade) changes.push(`grade: ${existing.grade} → ${gift.grade}`)
      if (existing.effect_base !== gift.effect_base) changes.push('effect_base 변경')
      if ((existing.name_en ?? null) !== (gift.name_en ?? null)) changes.push('name_en 변경')
      if ((existing.name_jp ?? null) !== (gift.name_jp ?? null)) changes.push('name_jp 변경')
      if ((existing.effect_base_en ?? null) !== (gift.effect_base_en ?? null)) changes.push('effect_base_en 변경')
      if ((existing.effect_base_jp ?? null) !== (gift.effect_base_jp ?? null)) changes.push('effect_base_jp 변경')
      if (existing.effect_plus !== gift.effect_plus) changes.push('effect_plus 변경')
      if (existing.effect_plusplus !== gift.effect_plusplus) changes.push('effect_plusplus 변경')
      if ((existing.effect_plus_en ?? null) !== (gift.effect_plus_en ?? null)) changes.push('effect_plus_en 변경')
      if ((existing.effect_plus_jp ?? null) !== (gift.effect_plus_jp ?? null)) changes.push('effect_plus_jp 변경')
      if ((existing.effect_plusplus_en ?? null) !== (gift.effect_plusplus_en ?? null)) changes.push('effect_plusplus_en 변경')
      if ((existing.effect_plusplus_jp ?? null) !== (gift.effect_plusplus_jp ?? null)) changes.push('effect_plusplus_jp 변경')
      if ((existing.price ?? null) !== gift.price) changes.push(`price: ${existing.price} → ${gift.price}`)
      if ((existing.sell_price ?? null) !== gift.sell_price) changes.push(`sell_price: ${existing.sell_price} → ${gift.sell_price}`)
      if (existing.buy_disabled !== gift.buy_disabled) changes.push(`buy_disabled: ${existing.buy_disabled} → ${gift.buy_disabled}`)
      if (existing.enhancement !== gift.enhancement) changes.push(`enhancement: ${existing.enhancement} → ${gift.enhancement}`)
      if ((existing.convert_to ?? null) !== (gift.convert_to ?? null)) changes.push(`convert_to: ${existing.convert_to} → ${gift.convert_to}`)
      if (existing.is_synthesis !== gift.is_synthesis) changes.push(`is_synthesis: ${existing.is_synthesis} → ${gift.is_synthesis}`)
      if (existing.difficulty !== gift.difficulty) changes.push(`difficulty: ${existing.difficulty} → ${gift.difficulty}`)
      if (existing.game_id !== gift.game_id) changes.push(`game_id: ${existing.game_id} → ${gift.game_id}`)
      if (gift.activation_condition && !sameJson(existing.activation_condition, gift.activation_condition)) changes.push('activation_condition 변경')

      if (changes.length > 0) {
        updateCount++
        console.log(YELLOW(`  🔄 ${gift.name}: ${changes.join(', ')}`))
        // Keep image_url stable; only update activation_condition when source text yields one.
        toUpsert.push({
          ...gift,
          id: existing.id,
          image_url: existing.image_url ?? undefined,
          activation_condition: gift.activation_condition ?? existing.activation_condition ?? undefined,
        })
      } else {
        matchCount++
        if (VERBOSE) console.log(GRAY(`  ✅ ${gift.name}`))
        // Only update if game_id was missing
        if (!existing.game_id) {
          toUpsert.push({
            ...gift,
            id: existing.id,
            image_url: existing.image_url ?? undefined,
            activation_condition: gift.activation_condition ?? existing.activation_condition ?? undefined,
          })
        }
      }
    }
  }

  console.log(`\n  신규: ${newCount}, 변경: ${updateCount}, 변경없음: ${matchCount}`)

  if (FIX && toUpsert.length > 0) {
    console.log('  DB 업데이트 중...')
    const toInsertNew = toUpsert.filter(item => !item.id)
    const toUpdate = toUpsert.filter(item => !!item.id)

    // Insert new gifts
    if (toInsertNew.length > 0) {
      const { error } = await supabase.schema('limbus').from('ego_gifts').insert(toInsertNew)
      if (error) {
        for (const item of toInsertNew) {
          const { error: e } = await supabase.schema('limbus').from('ego_gifts').insert(item)
          if (e) console.error(`  ❌ ${item.name}: ${e.message}`)
          else console.log(`  ✅ 신규: ${item.name}`)
        }
      } else {
        console.log(`  ✅ 신규 ${toInsertNew.length}종 추가`)
      }
    }

    // Update existing gifts (batch upsert, 30 rows per batch with delay)
    const BATCH_SIZE = 30
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.schema('limbus').from('ego_gifts')
        .upsert(batch, { onConflict: 'id' })
      if (error) {
        console.error(`  ❌ 배치 ${i + 1}~${i + batch.length} 실패: ${error.message}`)
        // Fallback: individual updates for failed batch
        for (const item of batch) {
          const { error: e } = await supabase.schema('limbus').from('ego_gifts')
            .update(item).eq('id', item.id)
          if (e) console.error(`  ❌ ${item.name}: ${e.message}`)
        }
      } else if (VERBOSE) {
        console.log(`  ✅ 변경 ${i + 1}~${i + batch.length}`)
      }
      if (i + BATCH_SIZE < toUpdate.length) await new Promise(r => setTimeout(r, 200))
    }
    if (toUpdate.length > 0) console.log(`  ✅ ${toUpdate.length}종 업데이트 완료`)
  } else if (!FIX) {
    console.log('  --dry-run 모드. DB 수정 없음.')
  }
}

// ── Section 2: Themes ─────────────────────────────────────────────────────────

interface ThemeRow {
  id: number
  name: string
  name_en?: string | null
  name_jp?: string | null
  dungeon_id: null
  unlock_code: number | null
  ego_gift_ids: number[]
  specific_ego_gift_ids: number[]
  image_url?: string | null
  boss_image_url?: string | null
  difficulty?: string | null
  floor_info?: Record<string, number[] | string> | null
  is_hidden?: boolean
}

function loadThemeNameMap(paths: string[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const path of paths) {
    const data = safeLoadJson(path)
    if (!data) continue
    const list = Array.isArray(data) ? data : extractList(data)
    for (const item of list) {
      const parsed = ThemeLocaleSchema.safeParse(item)
      if (parsed.success && !map.has(parsed.data.id)) {
        map.set(parsed.data.id, parsed.data.name)
      }
    }
  }
  return map
}

function sortedNumberArrayJson(values: number[] | null | undefined): string {
  return JSON.stringify([...(values ?? [])].sort((a, b) => a - b))
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, stableJsonValue(entry)])
    )
  }
  return value
}

function stableJsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableJsonValue(left)) === JSON.stringify(stableJsonValue(right))
}

function collectFixedMapEventIds(value: unknown, out = new Set<number>()): Set<number> {
  if (Array.isArray(value)) {
    for (const item of value) collectFixedMapEventIds(item, out)
    return out
  }
  if (!value || typeof value !== 'object') return out

  const record = value as Record<string, unknown>
  if (record.encounterType === 3 && typeof record.encounterId === 'number') {
    out.add(record.encounterId)
  }
  for (const child of Object.values(record)) collectFixedMapEventIds(child, out)
  return out
}

function getEventImageCandidates(eventId: number): number[] {
  const candidates = [eventId]
  const alias = EVENT_IMAGE_ALIASES.get(eventId)
  if (alias) candidates.unshift(alias)

  const idText = String(eventId)
  if (idText.length > 6) {
    const parentId = Number(idText.slice(0, -2))
    if (Number.isInteger(parentId)) candidates.push(parentId)
  }

  return [...new Set(candidates)]
}

async function syncThemes(): Promise<void> {
  console.log(BOLD('\n[2/4] 테마팩 동기화'))

  // Theme locale
  const themeNameMap = loadThemeNameMap([
    join(KR_DIR, 'KR_MirrorDungeonTheme-1.txt'),
    join(KR_LATEST_DIR, 'KR_MirrorDungeonTheme-1.json'),
  ])
  const themeNameEnMap = loadThemeNameMap([
    join(EN_DIR, 'EN_MirrorDungeonTheme-1.txt'),
    join(EN_LATEST_DIR, 'EN_MirrorDungeonTheme-1.json'),
  ])
  const themeNameJpMap = loadThemeNameMap([
    join(JP_DIR, 'JP_MirrorDungeonTheme-1.txt'),
    join(JP_LATEST_DIR, 'JP_MirrorDungeonTheme-1.json'),
  ])
  console.log(`  테마 로컬라이즈: KR ${themeNameMap.size}개, EN ${themeNameEnMap.size}개, JP ${themeNameJpMap.size}개`)

  // Load all theme floor files: t1~t6 + hidden
  const themeFiles = [
    ...globFiles(DATA_DIR, /^mirrordungeon-theme-floor-t\d+\.txt$/),
    ...globFiles(DATA_DIR, /^mirrordungeon-theme-floor-hidden\.txt$/),
  ]

  // dungeonIdx → difficulty label
  const DUNGEON_LABELS: Record<number, string> = {
    0: '노말',
    1: '하드',
    2: '평행중첩',
    3: '익스트림',
  }

  const themes: ThemeRow[] = []
  for (const f of themeFiles) {
    const isHiddenFile = f.includes('hidden')
    const data = loadJson(join(DATA_DIR, f))
    for (const item of extractList(data)) {
      const parsed = ThemeRawSchema.safeParse(item)
      if (!parsed.success) {
        if (VERBOSE) console.warn(`  ⚠ 테마 파싱 실패 (${f}):`, parsed.error.issues[0])
        continue
      }
      const t = parsed.data
      const name = themeNameMap.get(t.id) ?? t.desc ?? `Theme ${t.id}`

      // Build floor_info from exceptionConditions
      const floorInfo: Record<string, number[] | string> = {}
      for (const cond of t.exceptionConditions ?? []) {
        const label = DUNGEON_LABELS[cond.dungeonIdx]
        if (label && cond.selectableFloors) {
          floorInfo[label] = cond.selectableFloors.map((f: number) => f + 1)
        } else if (label) {
          // dungeonIdx without selectableFloors → theme available on ALL floors of that difficulty
          if (!floorInfo[label]) floorInfo[label] = '전체'
        }
      }

      // Derive difficulty from exceptionConditions
      const dungeonIndices = (t.exceptionConditions ?? []).map(c => c.dungeonIdx)
      let difficulty: string
      if (dungeonIndices.length === 1 && dungeonIndices[0] === 3) {
        difficulty = 'extreme'
      } else if (t.difficulty === 'DIFFICULT') {
        difficulty = 'hard'
      } else {
        difficulty = 'normal'
      }

      // Image URLs: theme pack uses numeric ID, boss uses bossSpriteId
      const bossSpriteId = t.uiConfigs?.bossSpriteId

      themes.push({
        id: t.id,
        name,
        name_en: themeNameEnMap.get(t.id) ?? null,
        name_jp: themeNameJpMap.get(t.id) ?? null,
        dungeon_id: null,
        unlock_code: t.unlockCondition?.unlockCode ?? null,
        ego_gift_ids: t.egoGiftPool ?? [],
        specific_ego_gift_ids: t.specificEgoGiftPool ?? [],
        image_url: `${STORAGE_BASE}/icons/theme-packs/${t.id}.webp`,
        boss_image_url: bossSpriteId ? `${STORAGE_BASE}/icons/theme-packs/boss/${bossSpriteId}.webp` : null,
        difficulty,
        floor_info: Object.keys(floorInfo).length > 0 ? floorInfo : null,
        is_hidden: isHiddenFile,
      })
    }
  }
  console.log(`  테마팩 ${themes.length}종 로드`)

  // Compare with DB
  const { data: existingThemes, error: fetchErr } = await supabase
    .schema('limbus')
    .from('ego_gift_themes')
    .select('id, name, name_en, name_jp, unlock_code, ego_gift_ids, specific_ego_gift_ids, image_url, boss_image_url, difficulty, floor_info, is_hidden')

  if (fetchErr) throw new Error(`ego_gift_themes fetch 실패: ${fetchErr.message}`)

  const existingMap = new Map<number, typeof existingThemes[0]>()
  for (const t of existingThemes ?? []) existingMap.set(t.id, t)

  let newCount = 0, updateCount = 0, matchCount = 0
  const toUpsert: ThemeRow[] = []

  for (const theme of themes) {
    const existing = existingMap.get(theme.id)
    if (!existing) {
      newCount++
      console.log(GREEN(`  🆕 ${theme.name} (id: ${theme.id})`))
      toUpsert.push(theme)
    } else {
      const changes: string[] = []
      if (existing.name !== theme.name) changes.push(`name: ${existing.name} → ${theme.name}`)
      if ((existing.name_en ?? null) !== (theme.name_en ?? null)) changes.push('name_en 변경')
      if ((existing.name_jp ?? null) !== (theme.name_jp ?? null)) changes.push('name_jp 변경')
      const existIds = sortedNumberArrayJson(existing.ego_gift_ids)
      const newIds = sortedNumberArrayJson(theme.ego_gift_ids)
      if (existIds !== newIds) changes.push(`ego_gift_ids 변경 (${(existing.ego_gift_ids ?? []).length} → ${theme.ego_gift_ids.length})`)
      const existSpec = sortedNumberArrayJson(existing.specific_ego_gift_ids)
      const newSpec = sortedNumberArrayJson(theme.specific_ego_gift_ids)
      if (existSpec !== newSpec) changes.push('specific_ego_gift_ids 변경')
      if (existing.difficulty !== theme.difficulty) changes.push(`difficulty: ${existing.difficulty} → ${theme.difficulty}`)
      if ((existing as Record<string, unknown>).unlock_code !== theme.unlock_code) changes.push(`unlock_code: ${(existing as Record<string, unknown>).unlock_code} → ${theme.unlock_code}`)
      if ((existing as Record<string, unknown>).is_hidden !== theme.is_hidden) changes.push(`is_hidden: ${(existing as Record<string, unknown>).is_hidden} → ${theme.is_hidden}`)
      if (!stableJsonEqual(existing.floor_info ?? null, theme.floor_info ?? null)) changes.push(`floor_info 변경`)

      if (changes.length > 0) {
        updateCount++
        console.log(YELLOW(`  🔄 ${theme.name}: ${changes.join(', ')}`))
        // Preserve existing image_url / boss_image_url if already set; use derived difficulty
        toUpsert.push({
          ...theme,
          image_url: theme.image_url ?? existing.image_url,
          boss_image_url: theme.boss_image_url ?? existing.boss_image_url,
        })
      } else {
        matchCount++
        if (VERBOSE) console.log(GRAY(`  ✅ ${theme.name}`))
      }
    }
  }

  console.log(`\n  신규: ${newCount}, 변경: ${updateCount}, 변경없음: ${matchCount}`)

  if (FIX && toUpsert.length > 0) {
    const { error } = await supabase.schema('limbus').from('ego_gift_themes')
      .upsert(toUpsert, { onConflict: 'id' })
    if (error) console.error(`  ❌ 테마팩 upsert 실패: ${error.message}`)
    else console.log(`  ✅ 테마팩 ${toUpsert.length}종 upsert 완료`)
  } else if (!FIX) {
    console.log('  --dry-run 모드. DB 수정 없음.')
  }
}

// ── Section 3: Recipes ────────────────────────────────────────────────────────

interface RecipeRow {
  id?: string
  result_name: string
  keyword: string
  ingredients: string[]
  final_result: string | null
}

async function syncRecipes(): Promise<void> {
  console.log(BOLD('\n[3/4] 레시피 동기화'))

  // Load latest common data (md7 > md6 > base)
  const { sourceFile, recipes: rawRecipes } = loadLatestRecipeData()
  if (sourceFile) console.log(`  ${sourceFile}: ${rawRecipes.length}개 레시피 로드`)

  if (rawRecipes.length === 0) {
    console.log('  ⚠ 레시피 데이터 없음, 건너뜀')
    return
  }

  // Build gift name lookup (game_id → name) from locale files
  const giftNameMap = new Map<number, string>()
  const localePatterns = [
    { dir: KR_DIR, pattern: /^KR_EGOgift_.*\.txt$/ },
    { dir: DATA_DIR, pattern: /^KR_EGOgift_.*\.txt$/ },
    { dir: KR_LATEST_DIR, pattern: /^KR_EGOgift_.*\.json$/ },
  ]
  for (const { dir, pattern } of localePatterns) {
    for (const f of globFiles(dir, pattern)) {
      const data = loadJson(join(dir, f))
      for (const item of extractList(data)) {
        const parsed = LocalizedGiftSchema.safeParse(item)
        if (parsed.success && !giftNameMap.has(parsed.data.id)) {
          giftNameMap.set(parsed.data.id, parsed.data.name)
        }
      }
    }
  }

  // Keyword map for result gift keyword lookup
  const categoryMap = new Map<string, string>(Object.entries(KEYWORD_FALLBACK_KR))

  // Build gift keyword lookup (game_id → Korean keyword) from raw gift files
  const rawGiftKeywordMap = new Map<number, string>()
  const recipeGiftIds = collectRecipeGiftIds(rawRecipes)
  const GIFT_PATTERN_RECIPE = /^ego-gift-.*\.txt$/
  for (const f of globFiles(DATA_DIR, GIFT_PATTERN_RECIPE)) {
    const data = loadJson(join(DATA_DIR, f))
    for (const item of extractList(data)) {
      const parsed = RawGiftSchema.safeParse(item)
      if (parsed.success && recipeGiftIds.has(parsed.data.id) && parsed.data.keyword) {
        const kw = parsed.data.keyword
        if (kw !== 'None' && kw !== 'Common') {
          const krKeyword = categoryMap.get(kw) ?? KEYWORD_FALLBACK_KR[kw] ?? kw
          rawGiftKeywordMap.set(parsed.data.id, krKeyword)
        }
      }
    }
  }

  // Deduplicate recipes by (resultEgoGiftId + sorted requiredEgoGiftIds)
  const seen = new Set<string>()
  const recipes: RecipeRow[] = []

  for (const r of rawRecipes) {
    const key = `${r.resultEgoGiftId}:${[...r.requiredEgoGiftIds].sort().join(',')}`
    if (seen.has(key)) continue
    seen.add(key)

    const resultName = giftNameMap.get(r.resultEgoGiftId)
    if (!resultName) {
      if (VERBOSE) console.warn(`  ⚠ 결과 기프트 이름 없음 (id: ${r.resultEgoGiftId})`)
      continue
    }

    const ingredients = r.requiredEgoGiftIds.map(id => {
      const name = giftNameMap.get(id)
      if (!name && VERBOSE) console.warn(`  ⚠ 재료 기프트 이름 없음 (id: ${id})`)
      return name ?? `기프트 #${id}`
    })

    recipes.push({
      result_name: resultName,
      keyword: rawGiftKeywordMap.get(r.resultEgoGiftId) ?? '공통',
      ingredients,
      final_result: resultName,
    })
  }

  console.log(`  레시피: ${recipes.length}종 (중복 제거 후)`)

  // Compare with DB
  const { data: existingRecipes, error: fetchErr } = await supabase
    .schema('limbus')
    .from('ego_gift_recipes')
    .select('id, result_name, keyword, ingredients, final_result')

  if (fetchErr) throw new Error(`ego_gift_recipes fetch 실패: ${fetchErr.message}`)

  const recipeKey = (resultName: string, ingredients: string[] | null | undefined): string =>
    `${resultName}:${JSON.stringify([...(ingredients ?? [])].sort())}`

  const existingByKey = new Map<string, typeof existingRecipes[0]>()
  for (const r of existingRecipes ?? []) {
    const key = recipeKey(r.result_name, r.ingredients)
    if (!existingByKey.has(key)) existingByKey.set(key, r)
  }

  let newCount = 0, updateCount = 0, matchCount = 0
  const toInsert: RecipeRow[] = []
  const toUpdate: RecipeRow[] = []

  for (const recipe of recipes) {
    const existing = existingByKey.get(recipeKey(recipe.result_name, recipe.ingredients))
    if (!existing) {
      newCount++
      console.log(GREEN(`  🆕 ${recipe.result_name} (재료: ${recipe.ingredients.length}개)`))
      toInsert.push(recipe)
    } else {
      const changes: string[] = []
      if (existing.keyword !== recipe.keyword) changes.push(`keyword: ${existing.keyword} → ${recipe.keyword}`)
      if ((existing.final_result ?? null) !== recipe.final_result) changes.push(`final_result: ${existing.final_result} → ${recipe.final_result}`)
      if (changes.length > 0) {
        updateCount++
        console.log(YELLOW(`  🔄 ${recipe.result_name}: ${changes.join(', ')}`))
        toUpdate.push({ ...recipe, id: existing.id })
      } else {
        matchCount++
        if (VERBOSE) console.log(GRAY(`  ✅ ${recipe.result_name}`))
      }
    }
  }

  console.log(`\n  신규: ${newCount}, 변경: ${updateCount}, 변경없음: ${matchCount}`)

  if (FIX) {
    if (toInsert.length > 0) {
      const { error } = await supabase.schema('limbus').from('ego_gift_recipes').insert(toInsert)
      if (error) console.error(`  ❌ 레시피 insert 실패: ${error.message}`)
      else console.log(`  ✅ 신규 레시피 ${toInsert.length}종 추가`)
    }
    for (const recipe of toUpdate) {
      const { error } = await supabase.schema('limbus').from('ego_gift_recipes')
        .update({ ingredients: recipe.ingredients, keyword: recipe.keyword, final_result: recipe.final_result })
        .eq('id', recipe.id!)
      if (error) console.error(`  ❌ ${recipe.result_name} 업데이트 실패: ${error.message}`)
      else if (VERBOSE) console.log(`  ✅ ${recipe.result_name} 업데이트`)
    }
  } else {
    console.log('  --dry-run 모드. DB 수정 없음.')
  }
}

// ── Section 4: Events ─────────────────────────────────────────────────────────

interface RewardEffect {
  type: string
  [key: string]: unknown
}

interface RewardGroup {
  probability: number | string
  next_event_id?: number
  effects: RewardEffect[]
}

interface NestedEvent {
  id: number
  name?: string | null
  desc?: string | null
  options?: EventOption[]
}

interface EventOption {
  message?: string
  messageDesc?: string
  result?: string[]
  messageEn?: string | null
  messageJp?: string | null
  messageDescEn?: string | null
  messageDescJp?: string | null
  resultEn?: string[] | null
  resultJp?: string[] | null
  rewards?: RewardGroup[]
  next_event?: NestedEvent
}

interface EventRow {
  id: number
  name: string | null
  desc_text: string | null
  /** internal only — not written to md_events; used to populate md_event_choices */
  options: EventOption[] | null
  gift_ids: number[] | null
  source: string
  theme_ids: number[] | null
  image_url?: string | null
  name_en: string | null
  name_jp: string | null
  desc_text_en: string | null
  desc_text_jp: string | null
  variant_of: number | null
  event_type: string | null
  category: string | null
}

/** Only the columns that exist on limbus.md_events — no options/option_gifts/parent_id. */
function toDbRow(r: EventRow): Omit<EventRow, 'options'> {
  const { options: _options, ...rest } = r
  return rest
}

interface ChoiceRow {
  event_id: number
  sort_order: number
  message: string | null
  message_en: string | null
  message_jp: string | null
  message_desc: string | null
  message_desc_en: string | null
  message_desc_jp: string | null
  result_text: string | null
  result_text_en: string | null
  result_text_jp: string | null
  probability: number | string | null
  next_event_id: number | null
  effects: unknown[]
}

// ── Reward enrichment helpers ─────────────────────────────────────────────────

function parseProbability(cond: string | null | undefined): number | string {
  if (!cond || cond === 'Prob_1') return 1.0
  const m = cond.match(/^Prob_([\d.]+)$/)
  if (m) return parseFloat(m[1])
  return cond
}

function parseHpMpEffect(effect: string): RewardEffect | null {
  let m = effect.match(/^LoseHpMpDifferentAmount_(\d+)_(\d+)$/)
  if (m) return { type: 'hp_mp_loss_diff', hp: parseInt(m[1]), mp: parseInt(m[2]) }

  m = effect.match(/^RecoverHpMpDifferentAmount_(\d+)_(\d+)$/)
  if (m) return { type: 'hp_mp_recover_diff', hp: parseInt(m[1]), mp: parseInt(m[2]) }

  if (effect === 'RecoverMpOnlyUntilMax') return { type: 'mp_recover_full' }
  if (effect === 'RecoverHpOnlyUntilMax') return { type: 'hp_recover_full' }
  if (effect === 'RecoverHpMpUntilMax') return { type: 'hp_mp_recover_full' }

  m = effect.match(/^RecoverRatioHpOnly_(\d+)$/)
  if (m) return { type: 'hp_recover_ratio', amount: parseInt(m[1]) }

  m = effect.match(/^LoseRatioHpOnly_(\d+)$/)
  if (m) return { type: 'hp_loss_ratio', amount: parseInt(m[1]) }

  m = effect.match(/^RecoverHpMpSameAmount_(\d+)$/)
  if (m) return { type: 'hp_mp_recover', amount: parseInt(m[1]) }

  m = effect.match(/^LoseHpMpSameAmount_(\d+)$/)
  if (m) return { type: 'hp_mp_loss', amount: parseInt(m[1]) }

  m = effect.match(/^LoseHpOnly_(\d+)$/)
  if (m) return { type: 'hp_loss', amount: parseInt(m[1]) }

  m = effect.match(/^RecoverHpOnly_(\d+)$/)
  if (m) return { type: 'hp_recover', amount: parseInt(m[1]) }

  m = effect.match(/^LoseMpOnly_(\d+)$/)
  if (m) return { type: 'mp_loss', amount: parseInt(m[1]) }

  m = effect.match(/^RecoverMpOnly_(\d+)$/)
  if (m) return { type: 'mp_recover', amount: parseInt(m[1]) }

  return null
}

type ItemReward = { num?: number; rewardId?: number } | undefined

const EFFECT_MAP: Record<string, (item?: ItemReward, rf?: Record<string, unknown>) => RewardEffect> = {
  'MirrorDungeonAcquireCost': (item) => ({ type: 'cost', amount: item?.num ?? 0 }),
  'MirrorDungeonLossCost':    (item) => ({ type: 'cost_loss', amount: item?.num ?? 0 }),
  'GetConfirmedEgogift':           (item) => ({ type: 'gift', gift_id: item?.rewardId ?? null, count: item?.num ?? 1 }),
  'GetConfirmedEgogiftOnWinBattle':(item) => ({ type: 'gift_battle', gift_id: item?.rewardId ?? null, count: item?.num ?? 1 }),
  'StartBattle_Abnormality': (_item, rf) => ({ type: 'battle_abnormality', battle_id: rf?.nextBattleID ?? null }),
  'StartBattle_Normal':      (_item, rf) => ({ type: 'battle', battle_id: rf?.nextBattleID ?? null }),
  'StartBattle':             (_item, rf) => ({ type: 'battle', battle_id: rf?.nextBattleID ?? null }),
  'Nothing':                 () => ({ type: 'nothing' }),
  'GetCharacter':            () => ({ type: 'get_character' }),
  'LevelupPersonality':      () => ({ type: 'level_up' }),
}

function parseResultForm(rf: Record<string, unknown>): RewardEffect | null {
  const effect = rf.resultEffect as string | undefined
  if (!effect) return null

  const hpmp = parseHpMpEffect(effect)
  if (hpmp) return hpmp

  const fn = EFFECT_MAP[effect]
  if (fn) return fn(rf.itemReward as ItemReward, rf)

  if (VERBOSE) console.log(`    unknown effect: ${effect}`)
  return { type: 'unknown', effect }
}

type ActionEvent = {
  eachOptionList?: Array<{
    resultList?: Array<{
      resultCondition?: string | null
      nextEventID?: number
      eventResultDataList?: Array<{ resultForm?: Record<string, unknown> }>
    }>
  }>
}

type PersonalityEvent = {
  eventResults?: Array<{
    eventResult?: string
    eventResultDataList?: Array<{
      resultCondition?: string | null
      nextEventID?: number
      eventResultDataList?: Array<{ resultForm?: Record<string, unknown> }>
    }>
  }>
}

function extractActionOptionRewards(actionEvent: ActionEvent): RewardGroup[][] {
  const optionList = actionEvent?.eachOptionList ?? []
  return optionList.map((opt) => {
    const results = opt.resultList ?? []
    const rewardGroups: RewardGroup[] = results.map((result) => {
      const prob = parseProbability(result.resultCondition)
      const nextId = (result.nextEventID && result.nextEventID > 0) ? result.nextEventID : undefined
      const effects = (result.eventResultDataList ?? [])
        .map(rd => rd.resultForm ? parseResultForm(rd.resultForm) : null)
        .filter((e): e is RewardEffect => e !== null)
      return { probability: prob, ...(nextId !== undefined ? { next_event_id: nextId } : {}), effects }
    })
    return rewardGroups.filter(rg => rg.effects.length > 0 || rg.next_event_id !== undefined)
  })
}

function extractPersonalityRewards(personalityEvent: PersonalityEvent): Record<string, RewardGroup[]> {
  const eventResults = personalityEvent?.eventResults ?? []
  const out: Record<string, RewardGroup[]> = {}
  for (const er of eventResults) {
    const label = er.eventResult?.toLowerCase() ?? 'unknown'
    const resultList = er.eventResultDataList ?? []
    const rewardGroups: RewardGroup[] = resultList.map((result) => {
      const prob = parseProbability(result.resultCondition)
      const nextId = (result.nextEventID && result.nextEventID > 0) ? result.nextEventID : undefined
      const effects = (result.eventResultDataList ?? [])
        .map(rd => rd.resultForm ? parseResultForm(rd.resultForm) : null)
        .filter((e): e is RewardEffect => e !== null)
      return { probability: prob, ...(nextId !== undefined ? { next_event_id: nextId } : {}), effects }
    })
    out[label] = rewardGroups.filter(rg => rg.effects.length > 0 || rg.next_event_id !== undefined)
  }
  return out
}

// ── Event helper: recursively extract EGO_GIFT rewardIds ─────────────────────
function extractGiftsRecursive(obj: unknown): number[] {
  const gifts: number[] = []
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      for (const item of obj) gifts.push(...extractGiftsRecursive(item))
    } else {
      const o = obj as Record<string, unknown>
      const ir = o.itemReward as { type?: string; rewardId?: number } | undefined
      if (ir && ir.type === 'EGO_GIFT' && typeof ir.rewardId === 'number' && ir.rewardId < 990000) {
        gifts.push(ir.rewardId)
      }
      for (const v of Object.values(o)) {
        gifts.push(...extractGiftsRecursive(v))
      }
    }
  }
  return gifts
}

// ── Event helper: recursively extract nextEventID values ─────────────────────
function extractNextEventIds(obj: unknown): number[] {
  const ids: number[] = []
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      for (const item of obj) ids.push(...extractNextEventIds(item))
    } else {
      const o = obj as Record<string, unknown>
      const nid = o.nextEventID
      if (typeof nid === 'number' && nid > 0) ids.push(nid)
      for (const v of Object.values(o)) {
        ids.push(...extractNextEventIds(v))
      }
    }
  }
  return ids
}

function joinChoiceResult(result: string[] | null | undefined): string | null {
  return Array.isArray(result) ? result.join('\n') : null
}

function makeAbEventOptions(
  successDesc: string[] | undefined,
  failureDesc: string[] | undefined,
  labels: { success: string; failure: string },
): EventOption[] | null {
  const opts: EventOption[] = [
    ...(successDesc ?? []).map((s, i) => ({
      message: `${labels.success}${(successDesc?.length ?? 0) > 1 ? ` ${i + 1}` : ''}`,
      result: [s],
    })),
    ...(failureDesc ?? []).map((s, i) => ({
      message: `${labels.failure}${(failureDesc?.length ?? 0) > 1 ? ` ${i + 1}` : ''}`,
      result: [s],
    })),
  ]
  return opts.length > 0 ? opts : null
}

function mergeChoiceLocales(
  options: EventOption[] | null,
  enOptions: EventOption[] | null | undefined,
  jpOptions: EventOption[] | null | undefined,
): EventOption[] | null {
  if (!options) return null
  return options.map((opt, i) => {
    const en = enOptions?.[i]
    const jp = jpOptions?.[i]
    return {
      ...opt,
      messageEn: en?.message ?? null,
      messageJp: jp?.message ?? null,
      messageDescEn: en?.messageDesc ?? null,
      messageDescJp: jp?.messageDesc ?? null,
      resultEn: en?.result ?? null,
      resultJp: jp?.result ?? null,
    }
  })
}

function makeChoiceRow(
  eventId: number,
  opt: EventOption,
  sortOrder: number,
  reward: RewardGroup | null,
): ChoiceRow {
  return {
    event_id: eventId,
    sort_order: sortOrder,
    message: opt.message ?? null,
    message_en: opt.messageEn ?? null,
    message_jp: opt.messageJp ?? null,
    message_desc: opt.messageDesc ?? null,
    message_desc_en: opt.messageDescEn ?? null,
    message_desc_jp: opt.messageDescJp ?? null,
    result_text: joinChoiceResult(opt.result),
    result_text_en: joinChoiceResult(opt.resultEn),
    result_text_jp: joinChoiceResult(opt.resultJp),
    probability: reward?.probability ?? null,
    next_event_id: reward?.next_event_id ?? null,
    effects: reward?.effects ?? [],
  }
}

function buildChoiceRows(rows: EventRow[]): ChoiceRow[] {
  const choiceRows: ChoiceRow[] = []
  const eventIds = new Set(rows.map(row => row.id))
  const droppedNextEventIds = new Set<number>()
  for (const row of rows) {
    if (!row.options) continue
    for (let i = 0; i < row.options.length; i++) {
      const opt = row.options[i]
      const rewards = opt.rewards
      if (Array.isArray(rewards) && rewards.length > 0) {
        for (let j = 0; j < rewards.length; j++) {
          const choiceRow = makeChoiceRow(row.id, opt, i * 100 + j, rewards[j])
          if (choiceRow.next_event_id != null && !eventIds.has(choiceRow.next_event_id)) {
            droppedNextEventIds.add(choiceRow.next_event_id)
            choiceRow.next_event_id = null
          }
          choiceRows.push(choiceRow)
        }
      } else {
        choiceRows.push(makeChoiceRow(row.id, opt, i * 100, null))
      }
    }
  }
  if (droppedNextEventIds.size > 0) {
    console.log(`  제외된 이벤트 nextEventID 제거: ${[...droppedNextEventIds].sort((a, b) => a - b).join(', ')}`)
  }
  return choiceRows
}

async function syncEvents(): Promise<void> {
  console.log(BOLD('\n[4/4] 이벤트 동기화'))

  /* ── 1. 게임 이벤트 데이터 로드 ─────────────────────────────────────────── */
  console.log('  게임 이벤트 데이터 로드...')

  type GameEvent = { id: number; actionEvent?: { eachOptionList?: unknown[] }; [k: string]: unknown }

  const actionRaw = safeLoadJson(join(DATA_DIR, 'mirror-dungeon-action-choice-event.txt'))
  const personalityRaw = safeLoadJson(join(DATA_DIR, 'mirror-dungeon-personality-choice-event.txt'))

  const actionGameList: GameEvent[] = ((actionRaw as { list?: unknown[] })?.list ?? []) as GameEvent[]
  const personalityGameList: GameEvent[] = ((personalityRaw as { list?: unknown[] })?.list ?? []) as GameEvent[]

  const allGameEvents = new Map<number, GameEvent>()
  for (const ev of [...actionGameList, ...personalityGameList]) {
    allGameEvents.set(ev.id, ev)
  }
  console.log(`  action: ${actionGameList.length}개, personality: ${personalityGameList.length}개`)

  /* ── 2. KR 이벤트 텍스트 로드 (소스 추적 포함) ──────────────────────────── */
  console.log('  KR 이벤트 텍스트 로드...')

  interface KrEntry {
    name: string | null
    desc: string | null
    options: EventOption[] | null
    source: string
  }
  interface LocaleSimpleEntry {
    name: string | null
    desc: string | null
    options: EventOption[] | null
  }
  const krTexts = new Map<number, KrEntry>()

  for (const fname of readdirSync(KR_DIR).sort()) {
    if (!fname.startsWith('KR_ActionEvents') && !fname.startsWith('KR_AbEvents')) continue
    if (!fname.endsWith('.txt')) continue
    // Exclude: Refraction (굴절철도), story chapters (a1c5~a1c9)
    if (
      fname.includes('Refraction') || fname.includes('a1c5') || fname.includes('a1c6') ||
      fname.includes('a1c7') || fname.includes('a1c8') || fname.includes('a1c9') ||
      fname.includes('ResultLog')
    ) continue

    const data = safeLoadJson(join(KR_DIR, fname))
    if (!data) continue
    const isAbEvent = fname.startsWith('KR_AbEvents')
    const source = fname.replace(/^KR_/, '').replace(/\.txt$/, '')

    for (const item of extractList(data)) {
      const id = (item as { id?: unknown }).id
      if (typeof id !== 'number') continue
      // Only include mirror-dungeon IDs (>=10000 or >=900000)
      if (id < 10000) continue
      if (krTexts.has(id)) continue // first source wins

      if (isAbEvent) {
        const e = AbEventSchema.safeParse(item)
        if (!e.success) continue
        const descParts: string[] = []
        if (e.data.behaveDesc) descParts.push(e.data.behaveDesc)
        krTexts.set(id, {
          name: e.data.title ?? null,
          desc: descParts.join('\n') || null,
          options: makeAbEventOptions(e.data.successDesc, e.data.failureDesc, { success: '성공', failure: '실패' }),
          source,
        })
      } else {
        const e = ActionEventSchema.safeParse(item)
        if (!e.success) continue
        krTexts.set(id, {
          name: e.data.name ?? null,
          desc: e.data.desc ?? null,
          options: e.data.options?.map(opt => ({
            message: opt.message,
            messageDesc: opt.messageDesc,
            result: opt.result,
          })) ?? null,
          source,
        })
      }
    }
  }
  // Second pass: KR_LATEST_DIR JSON files (new format, e.g. KR_ActionEvents_twth.json, KR_ActionEvents_Mirror7.json)
  for (const fname of readdirSync(KR_LATEST_DIR).sort()) {
    if (!fname.startsWith('KR_ActionEvents') && !fname.startsWith('KR_AbEvents')) continue
    if (!fname.endsWith('.json')) continue
    // Exclude: Refraction, story chapters, ResultLog
    if (
      fname.includes('Refraction') || fname.includes('a1c5') || fname.includes('a1c6') ||
      fname.includes('a1c7') || fname.includes('a1c8') || fname.includes('a1c9') ||
      fname.includes('ResultLog')
    ) continue

    const data = safeLoadJson(join(KR_LATEST_DIR, fname))
    if (!data) continue
    const isAbEvent = fname.startsWith('KR_AbEvents')
    const source = fname.replace(/^KR_/, '').replace(/\.json$/, '')

    for (const item of extractList(data)) {
      const id = (item as { id?: unknown }).id
      if (typeof id !== 'number') continue
      if (id < 10000) continue
      if (krTexts.has(id)) continue // first source wins (KR_DIR txt takes priority)

      if (isAbEvent) {
        const e = AbEventSchema.safeParse(item)
        if (!e.success) continue
        const descParts: string[] = []
        if (e.data.behaveDesc) descParts.push(e.data.behaveDesc)
        krTexts.set(id, {
          name: e.data.title ?? null,
          desc: descParts.join('\n') || null,
          options: makeAbEventOptions(e.data.successDesc, e.data.failureDesc, { success: '성공', failure: '실패' }),
          source,
        })
      } else {
        const e = ActionEventSchema.safeParse(item)
        if (!e.success) continue
        krTexts.set(id, {
          name: e.data.name ?? null,
          desc: e.data.desc ?? null,
          options: e.data.options?.map(opt => ({
            message: opt.message,
            messageDesc: opt.messageDesc,
            result: opt.result,
          })) ?? null,
          source,
        })
      }
    }
  }
  console.log(`  KR 텍스트: ${krTexts.size}개`)

  /* ── 2b. EN locale text ─────────────────────────────────────────────────── */
  const enTexts = new Map<number, LocaleSimpleEntry>()

  // First pass: EN_DIR txt files
  for (const fname of readdirSync(EN_DIR).sort()) {
    if (!fname.startsWith('EN_ActionEvents') && !fname.startsWith('EN_AbEvents')) continue
    if (!fname.endsWith('.txt')) continue
    if (
      fname.includes('Refraction') || fname.includes('a1c5') || fname.includes('a1c6') ||
      fname.includes('a1c7') || fname.includes('a1c8') || fname.includes('a1c9') ||
      fname.includes('ResultLog')
    ) continue
    const data = safeLoadJson(join(EN_DIR, fname))
    if (!data) continue
    const isAbEvent = fname.startsWith('EN_AbEvents')
    for (const item of extractList(data)) {
      const id = (item as { id?: unknown }).id
      if (typeof id !== 'number' || id < 10000) continue
      if (enTexts.has(id)) continue
      if (isAbEvent) {
        const e = AbEventSchema.safeParse(item)
        if (!e.success) continue
        const descParts: string[] = []
        if (e.data.behaveDesc) descParts.push(e.data.behaveDesc)
        enTexts.set(id, {
          name: e.data.title ?? null,
          desc: descParts.join('\n') || null,
          options: makeAbEventOptions(e.data.successDesc, e.data.failureDesc, { success: 'Success', failure: 'Failure' }),
        })
      } else {
        const e = ActionEventSchema.safeParse(item)
        if (!e.success) continue
        enTexts.set(id, {
          name: e.data.name ?? null,
          desc: e.data.desc ?? null,
          options: e.data.options?.map(opt => ({
            message: opt.message,
            messageDesc: opt.messageDesc,
            result: opt.result,
          })) ?? null,
        })
      }
    }
  }
  // Second pass: EN_LATEST_DIR JSON files
  for (const fname of readdirSync(EN_LATEST_DIR).sort()) {
    if (!fname.startsWith('EN_ActionEvents') && !fname.startsWith('EN_AbEvents')) continue
    if (!fname.endsWith('.json')) continue
    if (
      fname.includes('Refraction') || fname.includes('a1c5') || fname.includes('a1c6') ||
      fname.includes('a1c7') || fname.includes('a1c8') || fname.includes('a1c9') ||
      fname.includes('ResultLog')
    ) continue
    const data = safeLoadJson(join(EN_LATEST_DIR, fname))
    if (!data) continue
    const isAbEvent = fname.startsWith('EN_AbEvents')
    for (const item of extractList(data)) {
      const id = (item as { id?: unknown }).id
      if (typeof id !== 'number' || id < 10000) continue
      if (enTexts.has(id)) continue
      if (isAbEvent) {
        const e = AbEventSchema.safeParse(item)
        if (!e.success) continue
        const descParts: string[] = []
        if (e.data.behaveDesc) descParts.push(e.data.behaveDesc)
        enTexts.set(id, {
          name: e.data.title ?? null,
          desc: descParts.join('\n') || null,
          options: makeAbEventOptions(e.data.successDesc, e.data.failureDesc, { success: 'Success', failure: 'Failure' }),
        })
      } else {
        const e = ActionEventSchema.safeParse(item)
        if (!e.success) continue
        enTexts.set(id, {
          name: e.data.name ?? null,
          desc: e.data.desc ?? null,
          options: e.data.options?.map(opt => ({
            message: opt.message,
            messageDesc: opt.messageDesc,
            result: opt.result,
          })) ?? null,
        })
      }
    }
  }
  console.log(`  EN 텍스트: ${enTexts.size}개`)

  /* ── 2c. JP locale text ─────────────────────────────────────────────────── */
  const jpTexts = new Map<number, LocaleSimpleEntry>()

  // First pass: JP_DIR txt files
  for (const fname of readdirSync(JP_DIR).sort()) {
    if (!fname.startsWith('JP_ActionEvents') && !fname.startsWith('JP_AbEvents')) continue
    if (!fname.endsWith('.txt')) continue
    if (
      fname.includes('Refraction') || fname.includes('a1c5') || fname.includes('a1c6') ||
      fname.includes('a1c7') || fname.includes('a1c8') || fname.includes('a1c9') ||
      fname.includes('ResultLog')
    ) continue
    const data = safeLoadJson(join(JP_DIR, fname))
    if (!data) continue
    const isAbEvent = fname.startsWith('JP_AbEvents')
    for (const item of extractList(data)) {
      const id = (item as { id?: unknown }).id
      if (typeof id !== 'number' || id < 10000) continue
      if (jpTexts.has(id)) continue
      if (isAbEvent) {
        const e = AbEventSchema.safeParse(item)
        if (!e.success) continue
        const descParts: string[] = []
        if (e.data.behaveDesc) descParts.push(e.data.behaveDesc)
        jpTexts.set(id, {
          name: e.data.title ?? null,
          desc: descParts.join('\n') || null,
          options: makeAbEventOptions(e.data.successDesc, e.data.failureDesc, { success: '成功', failure: '失敗' }),
        })
      } else {
        const e = ActionEventSchema.safeParse(item)
        if (!e.success) continue
        jpTexts.set(id, {
          name: e.data.name ?? null,
          desc: e.data.desc ?? null,
          options: e.data.options?.map(opt => ({
            message: opt.message,
            messageDesc: opt.messageDesc,
            result: opt.result,
          })) ?? null,
        })
      }
    }
  }
  // Second pass: JP_LATEST_DIR JSON files
  for (const fname of readdirSync(JP_LATEST_DIR).sort()) {
    if (!fname.startsWith('JP_ActionEvents') && !fname.startsWith('JP_AbEvents')) continue
    if (!fname.endsWith('.json')) continue
    if (
      fname.includes('Refraction') || fname.includes('a1c5') || fname.includes('a1c6') ||
      fname.includes('a1c7') || fname.includes('a1c8') || fname.includes('a1c9') ||
      fname.includes('ResultLog')
    ) continue
    const data = safeLoadJson(join(JP_LATEST_DIR, fname))
    if (!data) continue
    const isAbEvent = fname.startsWith('JP_AbEvents')
    for (const item of extractList(data)) {
      const id = (item as { id?: unknown }).id
      if (typeof id !== 'number' || id < 10000) continue
      if (jpTexts.has(id)) continue
      if (isAbEvent) {
        const e = AbEventSchema.safeParse(item)
        if (!e.success) continue
        const descParts: string[] = []
        if (e.data.behaveDesc) descParts.push(e.data.behaveDesc)
        jpTexts.set(id, {
          name: e.data.title ?? null,
          desc: descParts.join('\n') || null,
          options: makeAbEventOptions(e.data.successDesc, e.data.failureDesc, { success: '成功', failure: '失敗' }),
        })
      } else {
        const e = ActionEventSchema.safeParse(item)
        if (!e.success) continue
        jpTexts.set(id, {
          name: e.data.name ?? null,
          desc: e.data.desc ?? null,
          options: e.data.options?.map(opt => ({
            message: opt.message,
            messageDesc: opt.messageDesc,
            result: opt.result,
          })) ?? null,
        })
      }
    }
  }
  console.log(`  JP 텍스트: ${jpTexts.size}개`)

  /* ── 3. 테마팩 매핑 (3-tier) ────────────────────────────────────────────── */
  console.log('  테마팩 eventPool 매핑...')

  // Tier 1: eventPool 직접 (theme floor files)
  const eventToThemes = new Map<number, Set<number>>()
  for (let i = 1; i <= 6; i++) {
    const data = safeLoadJson(join(DATA_DIR, `mirrordungeon-theme-floor-t${i}.txt`))
    for (const item of extractList(data)) {
      const t = item as { id?: number; mapGenOption?: { eventPool?: number[]; specialEventPool?: number[] } }
      if (typeof t.id !== 'number') continue
      for (const eid of [
        ...(t.mapGenOption?.eventPool ?? []),
        ...(t.mapGenOption?.specialEventPool ?? []),
      ]) {
        if (!eventToThemes.has(eid)) eventToThemes.set(eid, new Set())
        eventToThemes.get(eid)!.add(t.id)
      }
    }
  }
  try {
    const hiddenData = safeLoadJson(join(DATA_DIR, 'mirrordungeon-theme-floor-hidden.txt'))
    for (const item of extractList(hiddenData)) {
      const t = item as {
        id?: number
        mapGenOption?: { eventPool?: number[]; specialEventPool?: number[] }
        mapGenSequence?: unknown
      }
      if (typeof t.id !== 'number') continue
      for (const eid of [
        ...(t.mapGenOption?.eventPool ?? []),
        ...(t.mapGenOption?.specialEventPool ?? []),
        ...collectFixedMapEventIds(t.mapGenSequence),
      ]) {
        if (!eventToThemes.has(eid)) eventToThemes.set(eid, new Set())
        eventToThemes.get(eid)!.add(t.id)
      }
    }
  } catch { /* optional */ }

  // Collect theme IDs by tier
  // Also track which themes are seasonal (have relatedEventId) — they must not be
  // included in dungeonId-based fallback mapping (they link via their own eventPool).
  const seasonalThemeIds = new Set<number>()
  const themeIdsByTier: Record<string | number, number[]> = {}
  const allThemeIds: number[] = []
  for (let i = 1; i <= 6; i++) {
    const data = safeLoadJson(join(DATA_DIR, `mirrordungeon-theme-floor-t${i}.txt`))
    themeIdsByTier[i] = extractList(data)
      .map(it => (it as { id?: number }).id)
      .filter((id): id is number => typeof id === 'number')
    // Identify seasonal themes (have relatedEventId set)
    for (const item of extractList(data)) {
      const t = item as { id?: number; relatedEventId?: number }
      if (typeof t.id === 'number' && typeof t.relatedEventId === 'number') {
        seasonalThemeIds.add(t.id)
      }
    }
    allThemeIds.push(...themeIdsByTier[i])
  }
  try {
    const hiddenData = safeLoadJson(join(DATA_DIR, 'mirrordungeon-theme-floor-hidden.txt'))
    const hiddenIds = extractList(hiddenData)
      .map(it => (it as { id?: number }).id)
      .filter((id): id is number => typeof id === 'number')
    themeIdsByTier['hidden'] = hiddenIds
    allThemeIds.push(...hiddenIds)
  } catch { /* optional */ }

  // Permanent themes only (no relatedEventId) — used for nodepool dungeonId fallback
  const permanentThemeIds = allThemeIds.filter(id => !seasonalThemeIds.has(id))

  // Tier 2: generatenodepool → dungeonId → themes
  const eventToDungeonIds = new Map<number, Set<number>>()
  for (const fname of globFiles(DATA_DIR, /^(mirrordungeon|hells-chicken-dungeon)-generatenodepool-event.*\.txt$/)) {
    const data = safeLoadJson(join(DATA_DIR, fname))
    for (const item of extractList(data)) {
      const it = item as { dungeonId?: number; dungeonEventList?: number[] }
      if (typeof it.dungeonId !== 'number') continue
      for (const eid of it.dungeonEventList ?? []) {
        if (!eventToDungeonIds.has(eid)) eventToDungeonIds.set(eid, new Set())
        eventToDungeonIds.get(eid)!.add(it.dungeonId)
      }
    }
  }

  const dungeonIdToThemes: Record<number, number[]> = {
    1: themeIdsByTier[1].filter(id => !seasonalThemeIds.has(id)),
    2: [...themeIdsByTier[1], ...themeIdsByTier[2], ...themeIdsByTier[3], ...themeIdsByTier[4], ...themeIdsByTier[5]].filter(id => !seasonalThemeIds.has(id)),
    3: permanentThemeIds,
    // 특수 던전
    910301: [1101], 910302: [1101],
    910701: [1104], 911501: [1104, 1116],
    910901: [1105], 911801: [1105, 1120],
  }

  const nodepoolEventThemes = new Map<number, number[]>()
  for (const [eid, dids] of eventToDungeonIds) {
    const themes = new Set<number>()
    for (const did of dids) {
      if (dungeonIdToThemes[did]) dungeonIdToThemes[did].forEach(t => themes.add(t))
    }
    if (themes.size > 0) nodepoolEventThemes.set(eid, [...themes])
  }
  console.log(`  nodepool 자동 매핑: ${nodepoolEventThemes.size}개 이벤트`)

  // Tier 3: source fallback (exclude seasonal themes — they link only via their own eventPool)
  const tier1to5 = [...themeIdsByTier[1], ...themeIdsByTier[2], ...themeIdsByTier[3], ...themeIdsByTier[4], ...themeIdsByTier[5]].filter(id => !seasonalThemeIds.has(id))
  const sourceToThemes: Record<string, number[]> = {
    // Generic Mirror events: theme linkage comes from nodepool matching, not filename fallback
    'ActionEvents_Mirror':  [],
    'ActionEvents_Mirror3': [...themeIdsByTier[1]],
    'ActionEvents_Mirror4': tier1to5,
    'ActionEvents_Mirror6': [],
    'ActionEvents_Mirror7': [],
    'ActionEvents':         [],
    'AbEvents_Mirror':      [],
    'AbEvents_Mirror3':     [...themeIdsByTier[1]],
    'AbEvents_Mirror4':     tier1to5,
    'AbEvents_Mirror6':     [],
    // 타래엮기
    'ActionEvents_twth':    [1126],
    'AbEvents_twth':        [1126],
    // 왈푸르기스
    'ActionEvents-walpu4':  [1107],
    'ActionEvents-walpu5':  [1114],
    'ActionEvents-walpu6':  [1119],
    'ActionEvents-walpu8':  [1124],
    'AbEvents-walpu4':      [1107],
    'AbEvents-walpu5':      [1114],
    'AbEvents-walpu6':      [1119],
    'AbEvents-walpu8':      [1124],
    // 특수 던전
    'ActionEvents-cultivation':     [1121],
    'ActionEvents-pilgrimage':       [1122],
    'ActionEvents_lcbcheckup':       [1115, 1125],
    'ActionEvents_lcbcheckup-re':    [1125],
    'ActionEvents_mowe':             [1106, 1123],
    'ActionEvents_mowe-re':          [1123],
    'ActionEvents_night-clean-up':   [1117],
    'ActionEvents_night-clean-up-re': [1127],
    'ActionEvents_tkt':              [1105, 1120],
    'ActionEvents-tktRe':            [1120],
    'ActionEvents_Ycgd':             [1104, 1116],
    'AbEvents_tkt':                  [1105, 1120],
    'AbEvents-tktRe':                [1120],
    'AbEvents_Ycgd':                 [1104, 1116],
    'AbEvents_lcbcheckup':           [1115, 1125],
    'AbEvents_lcbcheckup-re':        [1125],
    'AbEvents_mowe':                 [1106, 1123],
    'AbEvents_mowe-re':              [1123],
    'AbEvents_night-clean-up':       [1117],
    'AbEvents_night-clean-up-re':    [1127],
    'AbEvents-cultivation':          [1121],
    'AbEvents-pilgrimage':           [1122],
  }
  const FORCE_ALLOWED_EVENT_SOURCES = new Set<string>([
    'ActionEvents_night-clean-up-re',
  ])
  console.log(`  테마 eventPool: ${eventToThemes.size}개 이벤트`)

  /* ── 4. 부모-자식 관계 + 선택지별 기프트 ────────────────────────────────── */
  console.log('  부모-자식 관계 + 선택지별 기프트...')

  const childToParent = new Map<number, number>()
  const parentOptionGifts = new Map<number, number[][]>()
  const eventAllGifts = new Map<number, number[]>()

  for (const ev of actionGameList) {
    const opts = ev.actionEvent?.eachOptionList ?? []
    const allGifts = new Set<number>(extractGiftsRecursive(ev))
    const og: number[][] = []

    for (const opt of opts) {
      const optGifts = new Set<number>(extractGiftsRecursive(opt))
      const nextIds = extractNextEventIds(opt)

      for (const nid of nextIds) {
        childToParent.set(nid, ev.id)
        const child = allGameEvents.get(nid)
        if (child) {
          extractGiftsRecursive(child).forEach(g => { optGifts.add(g); allGifts.add(g) })
          for (const cnid of extractNextEventIds(child)) {
            const grandChild = allGameEvents.get(cnid)
            if (grandChild) {
              extractGiftsRecursive(grandChild).forEach(g => { optGifts.add(g); allGifts.add(g) })
            }
          }
        }
      }
      og.push([...optGifts])
    }

    if (og.some(g => g.length > 0)) parentOptionGifts.set(ev.id, og)
    if (allGifts.size > 0) eventAllGifts.set(ev.id, [...allGifts])
  }

  for (const ev of personalityGameList) {
    const allGifts = new Set<number>(extractGiftsRecursive(ev))
    const nextIds = extractNextEventIds(ev)

    for (const nid of nextIds) {
      if (!childToParent.has(nid)) childToParent.set(nid, ev.id)
      const child = allGameEvents.get(nid)
      if (child) {
        extractGiftsRecursive(child).forEach(g => allGifts.add(g))
        for (const cnid of extractNextEventIds(child)) {
          const grandChild = allGameEvents.get(cnid)
          if (grandChild) {
            extractGiftsRecursive(grandChild).forEach(g => allGifts.add(g))
          }
        }
      }
    }

    if (allGifts.size > 0) eventAllGifts.set(ev.id, [...allGifts])
  }
  console.log(`  부모-자식: ${childToParent.size}개`)

  /* ── 5. acquirable + personality 기프트 매핑 (fallback) ─────────────────── */
  const acquirableGifts = new Map<number, number[]>()

  for (const fname of [
    'acquirable-egogifts-in-event-01.txt',
    'mirrordungeon-event-acquirable-egogifts-01.txt',
    'hells-chicken-dungeon-event-acquirable-egogifts.txt',
  ]) {
    const data = safeLoadJson(join(DATA_DIR, fname))
    for (const item of extractList(data)) {
      const parsed = EventGiftMappingSchema.safeParse(item)
      if (parsed.success && parsed.data.egoGiftList.length > 0) {
        const existing = acquirableGifts.get(parsed.data.eventId) ?? []
        acquirableGifts.set(parsed.data.eventId, [...new Set([...existing, ...parsed.data.egoGiftList])])
      }
    }
  }

  // Personality events: extract EGO_GIFT rewards inline
  for (const ev of personalityGameList) {
    const str = JSON.stringify(ev)
    const gifts: number[] = []
    for (const m of str.matchAll(/"type":"EGO_GIFT","rewardId":(\d+)/g)) {
      const gid = parseInt(m[1], 10)
      if (gid < 990000) gifts.push(gid)
    }
    if (gifts.length > 0) {
      const existing = acquirableGifts.get(ev.id) ?? []
      acquirableGifts.set(ev.id, [...new Set([...existing, ...gifts])])
    }
  }
  console.log(`  acquirable + personality 매핑: ${acquirableGifts.size}개 이벤트`)

  /* ── 6. 거울 던전 등장 이벤트 필터 ─────────────────────────────────────── */
  const rootEventCount = eventToThemes.size
  const allowedEvents = new Set(
    [...eventToThemes.keys()].filter(eid => !CANONICAL_EVENT_EXCLUDE_IDS.has(eid))
  )
  let sourceForcedEventCount = 0
  for (const [eid, kr] of krTexts) {
    if (CANONICAL_EVENT_EXCLUDE_IDS.has(eid)) continue
    if (!FORCE_ALLOWED_EVENT_SOURCES.has(kr.source)) continue
    if (!allowedEvents.has(eid)) {
      allowedEvents.add(eid)
      sourceForcedEventCount++
    }
  }
  let addedChild = true
  let childEventCount = 0
  while (addedChild) {
    addedChild = false
    for (const [childId, parentId] of childToParent) {
      if (
        allowedEvents.has(parentId) &&
        !allowedEvents.has(childId) &&
        !CANONICAL_EVENT_EXCLUDE_IDS.has(childId)
      ) {
        allowedEvents.add(childId)
        childEventCount++
        addedChild = true
      }
    }
  }
  console.log(`  current pool roots: ${rootEventCount}개, source 보강: ${sourceForcedEventCount}개, nextEventID children: ${childEventCount}개`)

  /* ── 7. DB 행 구성 ──────────────────────────────────────────────────────── */
  console.log(`\n  DB 행 구성... (거던 등장 이벤트: ${allowedEvents.size}개)`)
  const rows: EventRow[] = []

  for (const [eid, kr] of krTexts) {
    if (!allowedEvents.has(eid)) continue
    const en = enTexts.get(eid)
    const jp = jpTexts.get(eid)

    // Theme IDs: tier 1 > tier 2 > tier 3 fallback
    const themeSet = eventToThemes.get(eid)
    const themeIds: number[] | null = themeSet
      ? [...themeSet]
      : nodepoolEventThemes.has(eid)
        ? nodepoolEventThemes.get(eid)!
        : (sourceToThemes[kr.source] ?? null)

    const evType: string | null = kr.source.startsWith('AbEvents')
      ? 'ab'
      : kr.source.startsWith('ActionEvents')
        ? 'action'
        : kr.source.startsWith('personality')
          ? 'personality'
          : null

    rows.push({
      id: eid,
      name: kr.name,
      desc_text: kr.desc,
      options: mergeChoiceLocales(kr.options, en?.options, jp?.options),
      gift_ids: eventAllGifts.get(eid) ?? acquirableGifts.get(eid) ?? null,
      source: kr.source,
      theme_ids: themeIds && themeIds.length > 0 ? themeIds : null,
      name_en: en?.name ?? null,
      name_jp: jp?.name ?? null,
      desc_text_en: en?.desc ?? null,
      desc_text_jp: jp?.desc ?? null,
      variant_of: null,
      event_type: evType,
      category: null,
    })
  }

  // desc_text → first event ID map (for variant image auto-mapping)
  const descToImageId = new Map<string, number>()
  const seenDesc = new Set<string>()
  let dupeCount = 0
  for (const r of rows) {
    if (!r.desc_text) continue
    if (!descToImageId.has(r.desc_text)) descToImageId.set(r.desc_text, r.id)
    if (seenDesc.has(r.desc_text)) dupeCount++
    else seenDesc.add(r.desc_text)
  }

  console.log(`  총 행: ${rows.length}개`)
  console.log(`  중복 desc: ${dupeCount}개`)
  console.log(`  테마팩 연결: ${rows.filter(r => r.theme_ids).length}개`)
  console.log(`  기프트 연결: ${rows.filter(r => r.gift_ids).length}개`)

  /* ── 8. 보상 데이터 보강 ────────────────────────────────────────────────── */
  console.log('\n  보상 데이터 보강...')

  type EnrichableGameEvent = {
    id: number
    actionEvent?: ActionEvent
    personalityEvent?: PersonalityEvent
    [k: string]: unknown
  }

  const actionGameMap = new Map<number, EnrichableGameEvent>(
    actionGameList.map(e => [e.id, e as EnrichableGameEvent])
  )
  const persGameMap = new Map<number, EnrichableGameEvent>(
    personalityGameList.map(e => [e.id, e as EnrichableGameEvent])
  )

  let enriched = 0
  for (const row of rows) {
    if (!row.options || row.options.length === 0) continue

    const actionEv = actionGameMap.get(row.id)
    const persEv = persGameMap.get(row.id)

    if (actionEv?.actionEvent) {
      const rewardsByOption = extractActionOptionRewards(actionEv.actionEvent)
      let hasReward = false
      row.options = row.options.map((opt, i) => {
        const rewards = rewardsByOption[i] ?? []
        if (rewards.length === 0) return opt
        hasReward = true
        return { ...opt, rewards }
      })
      if (hasReward) enriched++
    } else if (persEv?.personalityEvent) {
      const persRewards = extractPersonalityRewards(persEv.personalityEvent)
      const hasAny = Object.values(persRewards).some(r => r.length > 0)
      if (hasAny) {
        row.options = row.options.map(opt => {
          const msg = (opt.message ?? '').toLowerCase()
          let rewards: RewardGroup[] | null = null
          if (msg.includes('성공') || msg === 'success') rewards = persRewards['success'] ?? []
          else if (msg.includes('실패') || msg === 'failure') rewards = persRewards['failure'] ?? []
          if (!rewards || rewards.length === 0) return opt
          return { ...opt, rewards }
        })
        enriched++
      }
    }
  }
  console.log(`  보강 완료: ${enriched}개 이벤트`)

  /* ── 9. (removed) next_event inline embedding was removed — frontend uses next_event_id id-only lookup */

  /* ── 10. DB 동기화 ──────────────────────────────────────────────────────── */

  // ── Inline retry helper (no external deps) ─────────────────────────────────
  async function withRetry<T>(
    fn: () => PromiseLike<T>,
    retries = 3,
    delayMs = 500,
  ): Promise<T> {
    let lastErr: unknown
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fn()
      } catch (err: unknown) {
        lastErr = err
        const msg = err instanceof Error ? err.message : String(err)
        // Don't retry on client errors (4xx)
        if (msg.includes('violates') || msg.includes('duplicate')) throw err
        if (attempt < retries - 1) {
          console.warn(`  ⚠ 재시도 ${attempt + 1}/${retries - 1}: ${msg}`)
          await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)))
        }
      }
    }
    throw lastErr
  }

  // ── Dump mode: write rows to file and exit before any DB I/O ────────────────
  if (DUMP_EVENTS_PATH) {
    // Count choices for reporting (each option × results, mirroring FIX logic)
    const choiceRows = buildChoiceRows(rows)
    writeFileSync(DUMP_EVENTS_PATH, JSON.stringify(rows.map(toDbRow), null, 2))
    console.log(`dumped ${rows.length} event rows to ${DUMP_EVENTS_PATH}`)
    console.log(`choice rows (computed): ${choiceRows.length}`)
    console.log(`choice next_event_id rows: ${choiceRows.filter(c => c.next_event_id != null).length}`)
    return
  }

  // ── Fetch full existing state (single SELECT — shared by dry-run + fix) ─────
  const { data: existingForDiff, error: diffFetchErr } = await supabase
    .schema('limbus')
    .from('md_events')
    .select('id, name, desc_text, gift_ids, source, theme_ids, image_url, name_en, name_jp, desc_text_en, desc_text_jp, variant_of, event_type, category')
  if (diffFetchErr) throw new Error(`md_events fetch 실패: ${diffFetchErr.message}`)

  const existingByIdFull = new Map<number, NonNullable<typeof existingForDiff>[0]>()
  for (const ev of existingForDiff ?? []) existingByIdFull.set(ev.id, ev)

  const { data: eventImageFiles, error: eventImageErr } = await supabase
    .storage
    .from('limbus-assets')
    .list('icons/events', { limit: 1000 })
  if (eventImageErr) throw new Error(`event image list 실패: ${eventImageErr.message}`)
  const availableEventImageIds = new Set<number>()
  for (const file of eventImageFiles ?? []) {
    const m = file.name.match(/^(\d+)\.webp$/)
    if (m) availableEventImageIds.add(parseInt(m[1], 10))
  }
  console.log(`  Storage 이벤트 이미지: ${availableEventImageIds.size}개`)

  // ── Preserve image_url from DB ──────────────────────────────────────────────
  const existingImageMap = new Map<number, string>()
  for (const ev of existingForDiff ?? []) {
    if (ev.image_url) existingImageMap.set(ev.id, ev.image_url)
  }
  console.log(`  기존 image_url 보존: ${existingImageMap.size}개`)

  for (const r of rows) {
    if (existingImageMap.has(r.id)) {
      r.image_url = existingImageMap.get(r.id)!
    } else {
      const imageCandidates = getEventImageCandidates(r.id)
      const aliasImageUrl = imageCandidates
        .map(id => existingImageMap.get(id))
        .find((url): url is string => Boolean(url))

      if (aliasImageUrl) {
        r.image_url = aliasImageUrl
      } else if (r.desc_text && descToImageId.has(r.desc_text)) {
        const origId = descToImageId.get(r.desc_text)!
        const descImageUrl = existingImageMap.get(origId)
        if (descImageUrl) {
          r.image_url = descImageUrl
        } else {
          const storageImageId = imageCandidates.find(id => availableEventImageIds.has(id))
          r.image_url = storageImageId
            ? `${STORAGE_BASE}/icons/events/${storageImageId}.webp`
            : null
        }
      } else {
        const storageImageId = imageCandidates.find(id => availableEventImageIds.has(id))
        r.image_url = storageImageId
          ? `${STORAGE_BASE}/icons/events/${storageImageId}.webp`
          : null
      }
    }
  }
  const imageCount = rows.filter(r => r.image_url).length
  console.log(`  image_url 매핑: ${imageCount}개`)

  // ── Diff ────────────────────────────────────────────────────────────────────
  const sourceIds = new Set(rows.map(r => r.id))
  const toInsert: EventRow[] = []
  const toUpdate: EventRow[] = []
  const toDeleteIds: number[] = []

  for (const row of rows) {
    const existing = existingByIdFull.get(row.id)
    if (!existing) {
      toInsert.push(row)
    } else {
      const normalize = (v: string | null | undefined) => v ?? null
      const changed =
        existing.name !== row.name ||
        existing.desc_text !== row.desc_text ||
        existing.source !== row.source ||
        JSON.stringify((existing.gift_ids ?? []).sort()) !== JSON.stringify((row.gift_ids ?? []).sort()) ||
        JSON.stringify((existing.theme_ids ?? []).sort()) !== JSON.stringify((row.theme_ids ?? []).sort()) ||
        normalize(existing.name_en) !== normalize(row.name_en) ||
        normalize(existing.name_jp) !== normalize(row.name_jp) ||
        normalize(existing.desc_text_en) !== normalize(row.desc_text_en) ||
        normalize(existing.desc_text_jp) !== normalize(row.desc_text_jp) ||
        normalize(existing.image_url) !== normalize(row.image_url) ||
        normalize(existing.event_type) !== normalize(row.event_type) ||
        (existing.variant_of ?? null) !== (row.variant_of ?? null)
      if (changed) toUpdate.push(row)
    }
  }
  for (const ev of existingForDiff ?? []) {
    if (!sourceIds.has(ev.id)) toDeleteIds.push(ev.id)
  }

  const matchCount = rows.length - toInsert.length - toUpdate.length
  console.log(`  변경 없음: ${matchCount}, 추가: ${toInsert.length}, 업데이트: ${toUpdate.length}, 삭제: ${toDeleteIds.length}  (총 소스 ${rows.length}개, DB ${existingByIdFull.size}개)`)

  const choiceRows = buildChoiceRows(rows)
  const choiceRowsWithNext = choiceRows.filter(c => c.next_event_id != null).length
  const choiceRowsWithEffects = choiceRows.filter(c => c.effects.length > 0).length
  const choiceRowsWithEn = choiceRows.filter(c => c.message_en || c.message_desc_en || c.result_text_en).length
  const choiceRowsWithJp = choiceRows.filter(c => c.message_jp || c.message_desc_jp || c.result_text_jp).length

  const { data: existingChoiceStats, error: choiceStatsErr } = await supabase
    .schema('limbus')
    .from('md_event_choices')
    .select('event_id, next_event_id, effects')
  if (choiceStatsErr) throw new Error(`md_event_choices fetch 실패: ${choiceStatsErr.message}`)

  console.log(
    `  선택지 대상: ${choiceRows.length}개 ` +
    `(next_event_id ${choiceRowsWithNext}, effects ${choiceRowsWithEffects}, EN ${choiceRowsWithEn}, JP ${choiceRowsWithJp})`
  )
  console.log(
    `  선택지 현재 DB: ${existingChoiceStats?.length ?? 0}개 ` +
    `(next_event_id ${(existingChoiceStats ?? []).filter(c => c.next_event_id != null).length})`
  )

  if (FIX) {
    console.log('\n  DB 업데이트...')

    const allUpsert = [...toInsert, ...toUpdate]
    if (toInsert.length === 0 && toUpdate.length === 0 && toDeleteIds.length === 0) {
      console.log('  md_events 변경 없음 — choices sync 계속')
    } else {
      // ── a. DELETE orphaned events ────────────────────────────────────────────
      if (toDeleteIds.length > 0) {
        for (let i = 0; i < toDeleteIds.length; i += 500) {
          const batch = toDeleteIds.slice(i, i + 500)
          await withRetry(() =>
            supabase.schema('limbus').from('md_event_choices')
              .delete().in('event_id', batch)
              .then(({ error }) => { if (error) throw error })
          )
          await withRetry(() =>
            supabase.schema('limbus').from('md_event_choices')
              .delete().in('next_event_id', batch)
              .then(({ error }) => { if (error) throw error })
          )
        }
        await withRetry(() =>
          supabase.schema('limbus').from('md_events')
            .delete()
            .in('id', toDeleteIds)
            .then(({ error }) => { if (error) throw error })
        )
        console.log(`  고아 행 삭제: ${toDeleteIds.length}개`)
      }

      // ── b. UPSERT md_events (only valid columns via toDbRow) ─────────────────
      const BATCH = 50
      let batchNum = 0
      for (let i = 0; i < allUpsert.length; i += BATCH) {
        const batch = allUpsert.slice(i, i + BATCH).map(toDbRow)
        batchNum++
        await withRetry(() =>
          supabase.schema('limbus').from('md_events')
            .upsert(batch, { onConflict: 'id' })
            .then(({ error }) => { if (error) throw error })
        )
        if (VERBOSE) console.log(`  배치 ${batchNum}: ${i + 1}~${i + batch.length}`)
        if (i + BATCH < allUpsert.length) await new Promise(r => setTimeout(r, 50))
      }
      console.log(`  UPSERT 완료: ${allUpsert.length}개 (${batchNum}배치)`)
    }

    // ── c. Sync md_event_choices ─────────────────────────────────────────────
    // Delete existing choices for all synced events (delete-then-insert, id is SERIAL)
    const allSyncedEventIds = rows.map(r => r.id)
    for (let i = 0; i < allSyncedEventIds.length; i += 500) {
      const batch = allSyncedEventIds.slice(i, i + 500)
      await withRetry(() =>
        supabase.schema('limbus').from('md_event_choices')
          .delete().in('event_id', batch)
          .then(({ error }) => { if (error) throw error })
      )
    }

    // Insert choice rows in batches of 100 (no id field — SERIAL auto-generated)
    let insertedChoices = 0
    for (let i = 0; i < choiceRows.length; i += 100) {
      const batch = choiceRows.slice(i, i + 100)
      await withRetry(() =>
        supabase.schema('limbus').from('md_event_choices')
          .insert(batch)
          .then(({ error }) => { if (error) throw error })
      )
      insertedChoices += batch.length
      if (i + 100 < choiceRows.length) await new Promise(r => setTimeout(r, 50))
    }
    console.log(`  choices INSERT 완료: ${insertedChoices}개`)

    // Remap gift_ids to DB game_ids (event IDs may differ from DB IDs)
    console.log('\n  이벤트 gift_id → DB game_id 치환...')
    const { data: allDbGifts } = await supabase
      .schema('limbus').from('ego_gifts').select('name, game_id').not('game_id', 'is', null)
    const giftNameToDbId = new Map<string, number>()
    for (const g of allDbGifts ?? []) giftNameToDbId.set(g.name, Number(g.game_id))

    const eventGiftIdToName = new Map<number, string>()
    for (const fname of globFiles(KR_DIR, /^KR_EGOgift.*\.txt$/)) {
      const data = safeLoadJson(join(KR_DIR, fname))
      for (const item of extractList(data)) {
        const parsed = z.object({ id: z.number(), name: z.string() }).safeParse(item)
        if (parsed.success && !eventGiftIdToName.has(parsed.data.id)) {
          eventGiftIdToName.set(parsed.data.id, parsed.data.name)
        }
      }
    }

    const allEventGiftIds = new Set<number>()
    for (const r of rows) {
      for (const gid of r.gift_ids ?? []) allEventGiftIds.add(gid)
    }
    const dbGameIds = new Set<number>((allDbGifts ?? []).map(g => Number(g.game_id)))
    const giftIdRemap = new Map<number, number>()
    for (const eid of allEventGiftIds) {
      if (dbGameIds.has(eid)) continue
      const name = eventGiftIdToName.get(eid)
      if (name && giftNameToDbId.has(name)) giftIdRemap.set(eid, giftNameToDbId.get(name)!)
    }

    if (giftIdRemap.size > 0) {
      console.log(`  치환 매핑: ${giftIdRemap.size}개`)
      let remapped = 0
      for (const r of rows) {
        if (!r.gift_ids) continue
        let changed = false
        r.gift_ids = [...new Set(r.gift_ids.map(gid => {
          if (giftIdRemap.has(gid)) { changed = true; return giftIdRemap.get(gid)! }
          return gid
        }))]
        if (changed) remapped++
      }
      console.log(`  ${remapped}개 이벤트 치환`)
      for (const r of rows) {
        if (!r.gift_ids) continue
        await supabase.schema('limbus').from('md_events')
          .update({ gift_ids: r.gift_ids }).eq('id', r.id)
      }
    } else {
      console.log('  치환 필요 없음')
    }

    console.log(`\n  ✅ 동기화 완료! (이벤트: ${rows.length})`)

  } else {
    /* ── dry-run: print plan from already-computed diff ─────────────────────── */
    if (VERBOSE) {
      for (const ev of toInsert) console.log(GREEN(`  [NEW] [${ev.id}] ${ev.name ?? '(이름없음)'}`))
      for (const ev of toUpdate) {
        const existing = existingByIdFull.get(ev.id)!
        const changes: string[] = []
        if (existing.name !== ev.name) changes.push(`name: ${existing.name} → ${ev.name}`)
        if (existing.desc_text !== ev.desc_text) changes.push('desc_text 변경')
        if (existing.source !== ev.source) changes.push(`source: ${existing.source} → ${ev.source}`)
        const existGifts = JSON.stringify((existing.gift_ids ?? []).sort())
        const newGifts = JSON.stringify((ev.gift_ids ?? []).sort())
        if (existGifts !== newGifts) changes.push(`gift_ids 변경 (${(existing.gift_ids ?? []).length} → ${(ev.gift_ids ?? []).length})`)
        const existThemes = JSON.stringify((existing.theme_ids ?? []).sort())
        const newThemes = JSON.stringify((ev.theme_ids ?? []).sort())
        if (existThemes !== newThemes) changes.push('theme_ids 변경')
        console.log(YELLOW(`  [UPD] [${ev.id}] ${ev.name}: ${changes.join(', ')}`))
      }
      for (const id of toDeleteIds) console.log(GRAY(`  [DEL] id=${id}`))
    }
    if (matchCount === rows.length) {
      console.log(GRAY('  (모두 최신 상태)'))
    }
    console.log('  --dry-run 모드. DB 수정 없음. --fix 옵션으로 실행하세요.')
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(BOLD('거울 던전 데이터 동기화'))
  console.log(`모드: ${FIX ? '--fix (DB 수정)' : '--dry-run (비교만)'}`)
  console.log(`데이터: ${DATA_DIR}`)

  const sections = [
    DO_GIFTS && '기프트',
    DO_THEMES && '테마팩',
    DO_RECIPES && '레시피',
    DO_EVENTS && '이벤트',
  ].filter(Boolean)
  console.log(`대상: ${sections.join(', ')}`)

  try {
    if (DO_GIFTS) await syncGifts()
    if (DO_THEMES) await syncThemes()
    if (DO_RECIPES) await syncRecipes()
    if (DO_EVENTS) await syncEvents()
  } catch (err) {
    console.error('\n❌ 오류 발생:', (err as Error).message)
    process.exit(1)
  }

  console.log(BOLD('\n동기화 완료.'))
  if (!FIX) {
    console.log('(--fix 옵션으로 실제 DB에 반영하세요)')
  }

  // On-demand cache invalidation after successful --fix run.
  if (FIX) {
    await triggerRevalidation({ scope: 'all-game-data' })
  }
}

main()
