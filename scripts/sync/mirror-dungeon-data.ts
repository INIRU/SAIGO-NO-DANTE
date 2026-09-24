#!/usr/bin/env tsx
/**
 * mirror-dungeon-data.ts
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
import { createHash } from 'crypto'
import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { gameDataPaths } from './source-paths'
import { z } from 'zod'
import { config } from 'dotenv'

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
const CANONICAL_EVENT_EXCLUDE_IDS = new Set<number>([971107, 97110701])

// Known same-event variants from older event sync logic. These should remain
// reachable as event rows when present, but not appear as separate theme entries.
const MANUAL_EVENT_VARIANT_PARENT = new Map<number, number>([
  [900012, 900011], // 자판기 이벤트 (층별 동일)
  [900013, 900011],
  [971071, 971070], // 가시춘 학생의 수업 복습
  [971072, 971070],
])

// ── Data dir ──────────────────────────────────────────────────────────────────
const sourcePaths = gameDataPaths()
const DATA_DIR = sourcePaths.data
const KR_DIR = sourcePaths.kr
const EN_DIR = sourcePaths.en
const JP_DIR = sourcePaths.jp
const KR_LATEST_DIR = sourcePaths.krLatest
const EN_LATEST_DIR = sourcePaths.enLatest
const JP_LATEST_DIR = sourcePaths.jpLatest

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)
const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

async function triggerRevalidation(options: { scope?: 'all-game-data' | 'announcements' } = {}): Promise<void> {
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.REVALIDATION_SECRET
  if (!siteUrl || !secret) {
    console.warn('[sync] SITE_URL or REVALIDATION_SECRET not set — skipping revalidate')
    return
  }

  try {
    const res = await fetch(`${siteUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidation-secret': secret,
      },
      body: JSON.stringify({ scope: options.scope ?? 'all-game-data' }),
    })
    if (!res.ok) {
      console.warn(`[sync] revalidate call failed: ${res.status} ${res.statusText}`)
      return
    }
    const data = await res.json().catch(() => ({}))
    console.log('[sync] revalidated:', (data as { revalidated?: unknown }).revalidated)
  } catch (err) {
    console.warn('[sync] revalidate call threw:', err instanceof Error ? err.message : err)
  }
}

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
  mapGenOption: z.object({ bossPool: z.array(z.number()).optional() }).passthrough().optional(),
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

function getGiftImageUrl(name: string): string {
  const hash = createHash('md5').update(name).digest('hex').slice(0, 8)
  return `${STORAGE_BASE}/ego-gifts/ego-gift-${hash}.webp`
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
  // Story/Walpurgis gifts remain valid rewards when referenced by Mirror Dungeon events.
  const eventGiftIds = new Set<number>()
  for (const file of globFiles(DATA_DIR, /^mirror-dungeon-(action|personality)-choice-event\.txt$/)) {
    for (const id of extractGiftsRecursive(loadJson(join(DATA_DIR, file)))) eventGiftIds.add(id)
  }
  let recipeRefGiftCount = 0
  for (const f of globFiles(DATA_DIR, GIFT_PATTERN).filter(f => SKIP_PATTERN.test(f))) {
    const data = loadJson(join(DATA_DIR, f))
    for (const item of extractList(data)) {
      const parsed = RawGiftSchema.safeParse(item)
      if (!parsed.success) continue
      if ((!recipeGiftIds.has(parsed.data.id) && !eventGiftIds.has(parsed.data.id)) || giftMap.has(parsed.data.id)) continue
      giftMap.set(parsed.data.id, parsed.data)
      recipeRefGiftCount++
    }
  }
  if (recipeRefGiftCount > 0) {
    console.log(`  레시피/이벤트 참조 기프트 보강: ${recipeRefGiftCount}종`)
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

    // An official translation can arrive later than the game definition. Keep
    // recipe targets usable with the supplied English/Japanese source verbatim.
    const baseLoc = localizeMap.get(baseLocalizeId) ?? enLocalizeMap.get(baseLocalizeId) ?? jpLocalizeMap.get(baseLocalizeId)
    if (!localizeMap.has(baseLocalizeId) && baseLoc) {
      console.warn(`  ⚠ ID ${id}: KR 번역 없음 — 제공된 EN/JP 원문 사용`)
    }
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
      image_url: getGiftImageUrl(baseLoc.name),
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
      // Missing locale files must not replace an already verified Korean name.
      if (!/[가-힣]/.test(gift.name) && /[가-힣]/.test(existing.name)) gift.name = existing.name
      const changes: string[] = []
      if (existing.name !== gift.name) changes.push('name 변경')
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
  /** Gifts a pack always gives when its boss is cleared (extreme packs), from the boss stages' rewards. */
  fixed_reward_gift_ids: number[]
}

/** Stage id → its single guaranteed E.G.O gift reward. */
function loadStageGiftRewards(): Map<number, number> {
  const rewards = new Map<number, number>()
  for (const f of globFiles(DATA_DIR, /^mirrordungeon-(ab)?battle.*\.txt$/)) {
    for (const item of extractList(loadJson(join(DATA_DIR, f)))) {
      const stage = item as { id?: unknown; rewardList?: { type?: string; rewardId?: unknown; prob?: number }[] }
      const gifts = (stage.rewardList ?? []).filter(reward => reward.type === 'EGO_GIFT')
      if (typeof stage.id === 'number' && gifts.length === 1 && gifts[0].prob === 1 && typeof gifts[0].rewardId === 'number') {
        rewards.set(stage.id, gifts[0].rewardId)
      }
    }
  }
  return rewards
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
  // Boss rewards count only when they are real gifts (some stages reward a placeholder id such as 993005).
  const stageRewards = loadStageGiftRewards()
  const { data: giftRows, error: giftErr } = await supabase.schema('limbus').from('ego_gifts').select('game_id')
  if (giftErr) throw new Error(`ego_gifts fetch 실패: ${giftErr.message}`)
  const giftIds = new Set((giftRows ?? []).map(row => row.game_id as number))
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
        fixed_reward_gift_ids: [...new Set((t.mapGenOption?.bossPool ?? []).flatMap(stage => {
          const gift = stageRewards.get(stage)
          return gift !== undefined && giftIds.has(gift) ? [gift] : []
        }))],
      })
    }
  }
  console.log(`  테마팩 ${themes.length}종 로드`)

  // Compare with DB
  const { data: existingThemes, error: fetchErr } = await supabase
    .schema('limbus')
    .from('ego_gift_themes')
    .select('id, name, name_en, name_jp, unlock_code, ego_gift_ids, specific_ego_gift_ids, image_url, boss_image_url, difficulty, floor_info, is_hidden, fixed_reward_gift_ids')

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
      if (sortedNumberArrayJson(existing.fixed_reward_gift_ids) !== sortedNumberArrayJson(theme.fixed_reward_gift_ids)) {
        changes.push(`fixed_reward_gift_ids: ${JSON.stringify(existing.fixed_reward_gift_ids ?? [])} → ${JSON.stringify(theme.fixed_reward_gift_ids)}`)
      }
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
    // Match the gift catalogue fallback so recipe names still resolve to cards.
    { dir: EN_DIR, pattern: /^EN_EGOgift_.*\.(txt|json)$/ },
    { dir: JP_DIR, pattern: /^JP_EGOgift_.*\.(txt|json)$/ },
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

  // Resolve earlier EN/JP fallback names before matching recipes, so newly
  // available Korean names update the same row rather than creating duplicates.
  const { data: giftNames, error: giftNamesError } = await supabase.schema('limbus')
    .from('ego_gifts').select('name,name_en,name_jp')
  if (giftNamesError) throw new Error(`gift name lookup failed: ${giftNamesError.message}`)
  const canonicalNames = new Map<string, string>()
  for (const gift of giftNames ?? []) {
    for (const name of [gift.name, gift.name_en, gift.name_jp]) {
      if (name) canonicalNames.set(name, gift.name)
    }
  }
  const canonical = (name: string) => canonicalNames.get(name) ?? name
  const recipeKey = (resultName: string, ingredients: string[] | null | undefined): string =>
    `${canonical(resultName)}:${JSON.stringify([...(ingredients ?? [])].map(canonical).sort())}`

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
      if (existing.result_name !== recipe.result_name) changes.push('result_name 변경')
      if (JSON.stringify(existing.ingredients) !== JSON.stringify(recipe.ingredients)) changes.push('ingredients 변경')
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
        .update({ result_name: recipe.result_name, ingredients: recipe.ingredients, keyword: recipe.keyword, final_result: recipe.final_result })
        .eq('id', recipe.id!)
      if (error) console.error(`  ❌ ${recipe.result_name} 업데이트 실패: ${error.message}`)
      else if (VERBOSE) console.log(`  ✅ ${recipe.result_name} 업데이트`)
    }
  } else {
    console.log('  --dry-run 모드. DB 수정 없음.')
  }
}

// ── Section 4: Events ─────────────────────────────────────────────────────────

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

async function syncEvents(): Promise<void> {
  const { rebuildMirrorEvents } = await import('./rebuild-mirror-events')
  await rebuildMirrorEvents(FIX)
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
