#!/usr/bin/env tsx
/**
 * sync-mirror-dungeon-data.ts
 * 거울 던전 관련 전체 데이터 동기화 (TypeScript + Zod)
 *
 * Usage:
 *   npx tsx scripts/sync-mirror-dungeon-data.ts [options]
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
import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'
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
const ANY_FILTER = GIFTS_ONLY || THEMES_ONLY || EVENTS_ONLY || RECIPES_ONLY

const DO_GIFTS = !ANY_FILTER || GIFTS_ONLY
const DO_THEMES = !ANY_FILTER || THEMES_ONLY
const DO_EVENTS = !ANY_FILTER || EVENTS_ONLY
const DO_RECIPES = !ANY_FILTER || RECIPES_ONLY

// ── Data dir ──────────────────────────────────────────────────────────────────
const DATA_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/Json (Text)'))
const KR_DIR = join(DATA_DIR, 'KR')

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

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
    abilityID: z.number(),
    simpleDesc: z.string(),
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
  unlockCondition: z.object({ unlockCode: z.number() }).optional(),
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
const KEYWORD_FALLBACK: Record<string, string> = {
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

function loadGlobList(dir: string, pattern: RegExp): unknown[] {
  const files = globFiles(dir, pattern)
  const items: unknown[] = []
  for (const f of files) {
    const data = loadJson(join(dir, f))
    const list = extractList(data)
    items.push(...list)
    if (VERBOSE) console.log(`  ${f}: ${list.length} items`)
  }
  return items
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

let _keywordMap: Map<string, string> | null = null
function getKeywordMap(): Map<string, string> {
  if (_keywordMap) return _keywordMap
  _keywordMap = new Map(Object.entries(KEYWORD_FALLBACK))
  for (const f of globFiles(KR_DIR, /^KR_BattleKeywords.*\.txt$/)) {
    const data = safeLoadJson(join(KR_DIR, f))
    for (const item of extractList(data)) {
      const parsed = z.object({ id: z.string(), name: z.string() }).safeParse(item)
      if (parsed.success && !_keywordMap.has(parsed.data.id)) {
        _keywordMap.set(parsed.data.id, parsed.data.name)
      }
    }
  }
  if (VERBOSE) console.log(`  배틀 키워드 매핑: ${_keywordMap.size}종`)
  return _keywordMap
}

function cleanDesc(desc: string | undefined): string | null {
  if (!desc) return null
  const map = getKeywordMap()
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
  is_synthesis: boolean
  convert_to: number | null
  difficulty?: string
  image_url?: string
  activation_condition?: unknown
}

async function syncGifts(): Promise<void> {
  console.log(BOLD('\n[1/4] EGO 기프트 동기화'))

  // 1a. Skip patterns: buff, story-chapter, a1c, walpu, hellschicken
  // Include: mirrordungeon variants only
  const GIFT_PATTERN = /^ego-gift-mirrordungeon.*\.txt$/
  const SKIP_PATTERN = /^ego-gift-(buff|story-|a1c|walpu|hellschicken)/

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

  // Hidden boss gift IDs
  const hiddenBossIds = new Set<number>()
  for (const f of globFiles(DATA_DIR, /^(ego-gift-mirrordungeon6-hb|hidden-ego-gift-mirrordungeon).*\.txt$/)) {
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

  const krGiftFiles = globFiles(KR_DIR, /^KR_EGOgift_MirrorDungeon.*\.txt$/)
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
  for (const f of globFiles(DATA_DIR, /^KR_EGOgift_MirrorDungeon.*\.txt$/)) {
    const data = loadJson(join(DATA_DIR, f))
    for (const item of extractList(data)) {
      const parsed = LocalizedGiftSchema.safeParse(item)
      if (parsed.success && !localizeMap.has(parsed.data.id)) {
        localizeMap.set(parsed.data.id, parsed.data)
      }
    }
  }
  console.log(`  로컬라이즈: ${localizeMap.size}개`)

  // 1c. Keyword category map
  const categoryMap = new Map<string, string>(Object.entries(KEYWORD_FALLBACK))
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
      keyword = categoryMap.get(item.keyword) ?? KEYWORD_FALLBACK[item.keyword] ?? item.keyword
    }

    const convertTo = item.convertDataList?.[0] ?? null

    let effectBase = cleanDesc(baseLoc.desc)
    if (effectBase && convertTo && effectBase.includes('{0}')) {
      const convertLoc = localizeMap.get(convertTo)
      const convertName = convertLoc?.name ?? `기프트 #${convertTo}`
      effectBase = effectBase.replace('{0}', `→ [${convertName}]`)
    }

    gifts.push({
      game_id: id,
      name: baseLoc.name,
      keyword,
      grade: parseGrade(item.tag),
      price: item.price ?? null,
      sell_price: item.sellPrice ?? null,
      buy_disabled: isBuyDisabled(item.tag),
      enhancement: upgrades.length > 1,
      effect_base: effectBase,
      effect_plus: plusLocalizeId ? cleanDesc(localizeMap.get(plusLocalizeId)?.desc) : null,
      effect_plusplus: ppLocalizeId ? cleanDesc(localizeMap.get(ppLocalizeId)?.desc) : null,
      is_synthesis: false,
      convert_to: convertTo,
    })
  }
  console.log(`  변환 완료: ${gifts.length}종 (로컬라이즈 누락: ${missingLocalize})`)

  // 1d-2. Mark is_synthesis: load recipe result IDs from common data files
  const synthesisIds = new Set<number>()
  const recipeCommonFiles = [
    'mirror-dungeon-common-data-md7.txt',
    'mirror-dungeon-common-data-md7-nextupdate.txt',
    'mirror-dungeon-common-data-md6.txt',
    'mirror-dungeon-common-data.txt',
  ]
  for (const fn of recipeCommonFiles) {
    const data = safeLoadJson(join(DATA_DIR, fn))
    if (!data) continue
    const table = (data as Record<string, unknown>).egoGiftCombineFixedTable as Record<string, unknown> | undefined
    if (!table?.combineFixed) continue
    for (const item of table.combineFixed as unknown[]) {
      const parsed = RecipeRawSchema.safeParse(item)
      if (parsed.success) synthesisIds.add(parsed.data.resultEgoGiftId)
    }
    break
  }
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
    .select('id, game_id, name, keyword, grade, effect_base, effect_plus, effect_plusplus, price, sell_price, buy_disabled, enhancement, is_synthesis, convert_to, difficulty, image_url, activation_condition')

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
      if (existing.effect_plus !== gift.effect_plus) changes.push('effect_plus 변경')
      if (existing.effect_plusplus !== gift.effect_plusplus) changes.push('effect_plusplus 변경')
      if ((existing.price ?? null) !== gift.price) changes.push(`price: ${existing.price} → ${gift.price}`)
      if ((existing.sell_price ?? null) !== gift.sell_price) changes.push(`sell_price: ${existing.sell_price} → ${gift.sell_price}`)
      if (existing.buy_disabled !== gift.buy_disabled) changes.push(`buy_disabled: ${existing.buy_disabled} → ${gift.buy_disabled}`)
      if (existing.enhancement !== gift.enhancement) changes.push(`enhancement: ${existing.enhancement} → ${gift.enhancement}`)
      if ((existing.convert_to ?? null) !== (gift.convert_to ?? null)) changes.push(`convert_to: ${existing.convert_to} → ${gift.convert_to}`)
      if (existing.is_synthesis !== gift.is_synthesis) changes.push(`is_synthesis: ${existing.is_synthesis} → ${gift.is_synthesis}`)
      if (existing.difficulty !== gift.difficulty) changes.push(`difficulty: ${existing.difficulty} → ${gift.difficulty}`)
      if (existing.game_id !== gift.game_id) changes.push(`game_id: ${existing.game_id} → ${gift.game_id}`)

      if (changes.length > 0) {
        updateCount++
        console.log(YELLOW(`  🔄 ${gift.name}: ${changes.join(', ')}`))
        // CRITICAL: preserve activation_condition and image_url — never overwrite
        toUpsert.push({
          ...gift,
          id: existing.id,
          image_url: existing.image_url ?? undefined,
          activation_condition: existing.activation_condition ?? undefined,
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
            activation_condition: existing.activation_condition ?? undefined,
          })
        }
      }
    }
  }

  console.log(`\n  신규: ${newCount}, 변경: ${updateCount}, 변경없음: ${matchCount}`)

  if (FIX && toUpsert.length > 0) {
    console.log('  DB 업데이트 중...')
    for (let i = 0; i < toUpsert.length; i += 50) {
      const batch = toUpsert.slice(i, i + 50)
      const { error } = await supabase.schema('limbus').from('ego_gifts')
        .upsert(batch, { onConflict: 'id' })
      if (error) {
        for (const item of batch) {
          if (!item.id) {
            const { error: insertErr } = await supabase.schema('limbus').from('ego_gifts').insert(item)
            if (insertErr) console.error(`  ❌ ${item.name}: ${insertErr.message}`)
            else console.log(`  ✅ 신규: ${item.name}`)
          } else {
            console.error(`  ❌ upsert 실패 (${item.name}): ${error.message}`)
          }
        }
      } else {
        console.log(`  ✅ 배치 ${i + 1}~${Math.min(i + 50, toUpsert.length)} upsert 완료`)
      }
    }
  } else if (!FIX) {
    console.log('  --dry-run 모드. DB 수정 없음.')
  }
}

// ── Section 2: Themes ─────────────────────────────────────────────────────────

interface ThemeRow {
  id: number
  name: string
  dungeon_id: null
  unlock_code: number | null
  ego_gift_ids: number[]
  specific_ego_gift_ids: number[]
  image_url?: string | null
  boss_image_url?: string | null
  difficulty?: string | null
  floor_info?: Record<string, number[]> | null
  is_hidden?: boolean
}

async function syncThemes(): Promise<void> {
  console.log(BOLD('\n[2/4] 테마팩 동기화'))

  // Theme locale
  const themeNameMap = new Map<number, string>()
  const themeLocaleData = safeLoadJson(join(KR_DIR, 'KR_MirrorDungeonTheme-1.txt'))
  for (const item of extractList(themeLocaleData)) {
    const parsed = ThemeLocaleSchema.safeParse(item)
    if (parsed.success) themeNameMap.set(parsed.data.id, parsed.data.name)
  }

  // Load all theme floor files: t1~t6 + hidden
  const themeFiles = [
    ...globFiles(DATA_DIR, /^mirrordungeon-theme-floor-t\d+\.txt$/),
    ...globFiles(DATA_DIR, /^mirrordungeon-theme-floor-hidden\.txt$/),
  ]

  const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

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
      const floorInfo: Record<string, number[]> = {}
      for (const cond of t.exceptionConditions ?? []) {
        const label = DUNGEON_LABELS[cond.dungeonIdx]
        if (label && cond.selectableFloors) {
          floorInfo[label] = cond.selectableFloors.map((f: number) => f + 1)
        } else if (label) {
          // dungeonIdx without selectableFloors (e.g. extreme) — just mark presence
          if (!floorInfo[label]) floorInfo[label] = []
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
    .select('id, name, ego_gift_ids, specific_ego_gift_ids, image_url, boss_image_url, difficulty, floor_info')

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
      const existIds = JSON.stringify((existing.ego_gift_ids ?? []).sort())
      const newIds = JSON.stringify((theme.ego_gift_ids ?? []).sort())
      if (existIds !== newIds) changes.push(`ego_gift_ids 변경 (${(existing.ego_gift_ids ?? []).length} → ${theme.ego_gift_ids.length})`)
      const existSpec = JSON.stringify((existing.specific_ego_gift_ids ?? []).sort())
      const newSpec = JSON.stringify((theme.specific_ego_gift_ids ?? []).sort())
      if (existSpec !== newSpec) changes.push('specific_ego_gift_ids 변경')
      if (existing.difficulty !== theme.difficulty) changes.push(`difficulty: ${existing.difficulty} → ${theme.difficulty}`)
      if ((existing as Record<string, unknown>).unlock_code !== theme.unlock_code) changes.push(`unlock_code: ${(existing as Record<string, unknown>).unlock_code} → ${theme.unlock_code}`)
      if ((existing as Record<string, unknown>).is_hidden !== theme.is_hidden) changes.push(`is_hidden: ${(existing as Record<string, unknown>).is_hidden} → ${theme.is_hidden}`)

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
  const commonFiles = [
    'mirror-dungeon-common-data-md7.txt',
    'mirror-dungeon-common-data-md7-nextupdate.txt',
    'mirror-dungeon-common-data-md6.txt',
    'mirror-dungeon-common-data.txt',
  ]

  let rawRecipes: z.infer<typeof RecipeRawSchema>[] = []
  for (const fn of commonFiles) {
    const fullPath = join(DATA_DIR, fn)
    const data = safeLoadJson(fullPath)
    if (!data) continue
    const d = data as Record<string, unknown>
    const table = d.egoGiftCombineFixedTable as Record<string, unknown> | undefined
    if (!table?.combineFixed) continue
    const list = table.combineFixed as unknown[]
    for (const item of list) {
      const parsed = RecipeRawSchema.safeParse(item)
      if (parsed.success) rawRecipes.push(parsed.data)
      else if (VERBOSE) console.warn('  ⚠ 레시피 파싱 실패:', parsed.error.issues[0])
    }
    console.log(`  ${fn}: ${rawRecipes.length}개 레시피 로드`)
    break // use first file that has data
  }

  if (rawRecipes.length === 0) {
    console.log('  ⚠ 레시피 데이터 없음, 건너뜀')
    return
  }

  // Build gift name lookup (game_id → name) from locale files
  const giftNameMap = new Map<number, string>()
  const localePatterns = [
    { dir: KR_DIR, pattern: /^KR_EGOgift_MirrorDungeon.*\.txt$/ },
    { dir: DATA_DIR, pattern: /^KR_EGOgift_MirrorDungeon.*\.txt$/ },
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
  const categoryMap = new Map<string, string>(Object.entries(KEYWORD_FALLBACK))

  // Build gift keyword lookup (game_id → Korean keyword) from raw gift files
  const rawGiftKeywordMap = new Map<number, string>()
  const GIFT_PATTERN_RECIPE = /^ego-gift-mirrordungeon.*\.txt$/
  const SKIP_PATTERN_RECIPE = /^ego-gift-(buff|story-|a1c|walpu|hellschicken)/
  for (const f of globFiles(DATA_DIR, GIFT_PATTERN_RECIPE).filter(f => !SKIP_PATTERN_RECIPE.test(f))) {
    const data = loadJson(join(DATA_DIR, f))
    for (const item of extractList(data)) {
      const parsed = RawGiftSchema.safeParse(item)
      if (parsed.success && parsed.data.keyword) {
        const kw = parsed.data.keyword
        if (kw !== 'None' && kw !== 'Common') {
          const krKeyword = categoryMap.get(kw) ?? KEYWORD_FALLBACK[kw] ?? kw
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

  const existingByName = new Map<string, typeof existingRecipes[0]>()
  for (const r of existingRecipes ?? []) existingByName.set(r.result_name, r)

  let newCount = 0, updateCount = 0, matchCount = 0
  const toInsert: RecipeRow[] = []
  const toUpdate: RecipeRow[] = []

  for (const recipe of recipes) {
    const existing = existingByName.get(recipe.result_name)
    if (!existing) {
      newCount++
      console.log(GREEN(`  🆕 ${recipe.result_name} (재료: ${recipe.ingredients.length}개)`))
      toInsert.push(recipe)
    } else {
      const existIngr = JSON.stringify([...(existing.ingredients ?? [])].sort())
      const newIngr = JSON.stringify([...recipe.ingredients].sort())
      const changes: string[] = []
      if (existIngr !== newIngr) changes.push('재료 변경')
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
  rewards?: RewardGroup[]
  next_event?: NestedEvent
}

interface EventRow {
  id: number
  name: string | null
  desc_text: string | null
  options: EventOption[] | null
  gift_ids: number[] | null
  option_gifts: number[][] | null
  source: string
  parent_id: number | null
  theme_ids: number[] | null
  image_url?: string | null
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
        const opts: EventOption[] = [
          ...(e.data.successDesc ?? []).map((s, i) => ({
            message: `성공${(e.data.successDesc?.length ?? 0) > 1 ? ` ${i + 1}` : ''}`,
            result: [s],
          })),
          ...(e.data.failureDesc ?? []).map((s, i) => ({
            message: `실패${(e.data.failureDesc?.length ?? 0) > 1 ? ` ${i + 1}` : ''}`,
            result: [s],
          })),
        ]
        krTexts.set(id, {
          name: e.data.title ?? null,
          desc: descParts.join('\n') || null,
          options: opts.length > 0 ? opts : null,
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

  /* ── 3. 테마팩 매핑 (3-tier) ────────────────────────────────────────────── */
  console.log('  테마팩 eventPool 매핑...')

  // Tier 1: eventPool 직접 (theme floor files)
  const eventToThemes = new Map<number, Set<number>>()
  for (let i = 1; i <= 6; i++) {
    const data = safeLoadJson(join(DATA_DIR, `mirrordungeon-theme-floor-t${i}.txt`))
    for (const item of extractList(data)) {
      const t = item as { id?: number; mapGenOption?: { eventPool?: number[] } }
      if (typeof t.id !== 'number') continue
      for (const eid of t.mapGenOption?.eventPool ?? []) {
        if (!eventToThemes.has(eid)) eventToThemes.set(eid, new Set())
        eventToThemes.get(eid)!.add(t.id)
      }
    }
  }
  try {
    const hiddenData = safeLoadJson(join(DATA_DIR, 'mirrordungeon-theme-floor-hidden.txt'))
    for (const item of extractList(hiddenData)) {
      const t = item as { id?: number; mapGenOption?: { eventPool?: number[] } }
      if (typeof t.id !== 'number') continue
      for (const eid of t.mapGenOption?.eventPool ?? []) {
        if (!eventToThemes.has(eid)) eventToThemes.set(eid, new Set())
        eventToThemes.get(eid)!.add(t.id)
      }
    }
  } catch { /* optional */ }

  // Collect theme IDs by tier
  const themeIdsByTier: Record<string | number, number[]> = {}
  const allThemeIds: number[] = []
  for (let i = 1; i <= 6; i++) {
    const data = safeLoadJson(join(DATA_DIR, `mirrordungeon-theme-floor-t${i}.txt`))
    themeIdsByTier[i] = extractList(data)
      .map(it => (it as { id?: number }).id)
      .filter((id): id is number => typeof id === 'number')
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
    1: [...themeIdsByTier[1]],
    2: [...themeIdsByTier[1], ...themeIdsByTier[2], ...themeIdsByTier[3], ...themeIdsByTier[4], ...themeIdsByTier[5]],
    3: allThemeIds,
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

  // Tier 3: source fallback
  const tier1to5 = [...themeIdsByTier[1], ...themeIdsByTier[2], ...themeIdsByTier[3], ...themeIdsByTier[4], ...themeIdsByTier[5]]
  const sourceToThemes: Record<string, number[]> = {
    'ActionEvents_Mirror':  allThemeIds,
    'ActionEvents_Mirror3': [...themeIdsByTier[1]],
    'ActionEvents_Mirror4': tier1to5,
    'ActionEvents_Mirror6': allThemeIds,
    'ActionEvents_Mirror7': allThemeIds,
    'ActionEvents':         allThemeIds,
    'AbEvents_Mirror':      allThemeIds,
    'AbEvents_Mirror3':     [...themeIdsByTier[1]],
    'AbEvents_Mirror4':     tier1to5,
    'AbEvents_Mirror6':     allThemeIds,
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
    'ActionEvents_mowe':             [1106, 1123],
    'ActionEvents_mowe-re':          [1123],
    'ActionEvents_night-clean-up':   [1117],
    'ActionEvents_tkt':              [1105, 1120],
    'ActionEvents-tktRe':            [1120],
    'ActionEvents_Ycgd':             [1104, 1116],
    'AbEvents_tkt':                  [1105, 1120],
    'AbEvents-tktRe':                [1120],
    'AbEvents_Ycgd':                 [1104, 1116],
    'AbEvents_lcbcheckup':           [1115, 1125],
    'AbEvents_mowe':                 [1106, 1123],
    'AbEvents_mowe-re':              [1123],
    'AbEvents_night-clean-up':       [1117],
    'AbEvents-cultivation':          [1121],
    'AbEvents-pilgrimage':           [1122],
  }
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
  const allNodepoolEvents = new Set<number>()
  for (const eid of eventToDungeonIds.keys()) allNodepoolEvents.add(eid)
  for (const eid of eventToThemes.keys()) allNodepoolEvents.add(eid)

  const allowedEvents = new Set<number>(allNodepoolEvents)
  // Children of allowed events
  for (const [childId, parentId] of childToParent) {
    if (allowedEvents.has(parentId)) allowedEvents.add(childId)
  }
  // All game event data entries
  for (const eid of allGameEvents.keys()) allowedEvents.add(eid)
  // 8-digit ID fallback: parent = first 5-6 digits (mirror dungeon events are 900000+)
  for (const eid of krTexts.keys()) {
    if (eid < 900000) continue // skip non-mirror-dungeon events (story dungeon 10xxx etc.)
    if (String(eid).length >= 7) {
      const p6 = Number(String(eid).slice(0, 6))
      const p5 = Number(String(eid).slice(0, 5))
      if (allowedEvents.has(p6) || allowedEvents.has(p5)) allowedEvents.add(eid)
    }
  }

  /* ── 7. DB 행 구성 ──────────────────────────────────────────────────────── */
  console.log(`\n  DB 행 구성... (거던 등장 이벤트: ${allowedEvents.size}개)`)
  const rows: EventRow[] = []

  for (const [eid, kr] of krTexts) {
    if (!allowedEvents.has(eid)) continue

    // Theme IDs: tier 1 > tier 2 > tier 3 fallback
    const themeSet = eventToThemes.get(eid)
    const themeIds: number[] | null = themeSet
      ? [...themeSet]
      : nodepoolEventThemes.has(eid)
        ? nodepoolEventThemes.get(eid)!
        : (sourceToThemes[kr.source] ?? null)

    rows.push({
      id: eid,
      name: kr.name,
      desc_text: kr.desc,
      options: kr.options,
      gift_ids: eventAllGifts.get(eid) ?? acquirableGifts.get(eid) ?? null,
      option_gifts: parentOptionGifts.get(eid) ?? null,
      source: kr.source,
      parent_id: childToParent.has(eid) && krTexts.has(childToParent.get(eid)!)
        ? childToParent.get(eid)!
        : (String(eid).length >= 8 && krTexts.has(Number(String(eid).slice(0, 6))))
          ? Number(String(eid).slice(0, 6))
          : null,
      theme_ids: themeIds && themeIds.length > 0 ? themeIds : null,
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

  /* ── 9. Embed child events as next_event objects ────────────────────────── */
  console.log('\n  자식 이벤트 next_event 병합...')
  const rowById = new Map<number, EventRow>(rows.map(r => [r.id, r]))

  function buildNestedEvent(eventId: number, depth: number = 0): NestedEvent | undefined {
    if (depth > 3) return undefined
    const child = rowById.get(eventId)
    if (!child) return undefined

    const nestedOptions = child.options?.map(opt => {
      const newOpt: EventOption = { ...opt }
      let optNextEvent: NestedEvent | undefined
      if (opt.rewards) {
        newOpt.rewards = opt.rewards.map(rg => {
          if (rg.next_event_id) {
            const grandChild = buildNestedEvent(rg.next_event_id, depth + 1)
            if (grandChild) {
              if (!optNextEvent) optNextEvent = grandChild
              return { ...rg, next_event: grandChild }
            }
          }
          return rg
        })
      }
      if (optNextEvent) newOpt.next_event = optNextEvent
      return newOpt
    })

    return {
      id: child.id,
      name: child.name,
      desc: child.desc_text,
      options: nestedOptions,
    }
  }

  let embeddedCount = 0
  for (const row of rows) {
    if (!row.options) continue
    let modified = false
    row.options = row.options.map(opt => {
      if (!opt.rewards) return opt
      // Find the first next_event_id from rewards to embed at option level
      let optNextEvent: NestedEvent | undefined
      const newRewards = opt.rewards.map(rg => {
        if (!rg.next_event_id) return rg
        const nested = buildNestedEvent(rg.next_event_id)
        if (nested) {
          modified = true
          if (!optNextEvent) optNextEvent = nested
          return { ...rg, next_event: nested }
        }
        return rg
      })
      // Set next_event at option level (frontend reads opt.next_event)
      return { ...opt, rewards: newRewards, ...(optNextEvent ? { next_event: optNextEvent } : {}) }
    })
    if (modified) embeddedCount++
  }
  console.log(`  next_event 병합: ${embeddedCount}개 이벤트`)

  /* ── 10. DB 반영 (--fix) ────────────────────────────────────────────────── */
  if (FIX) {
    console.log('\n  DB 업데이트...')

    // Preserve existing image_url
    const { data: existingRows } = await supabase
      .schema('limbus')
      .from('mirror_dungeon_events')
      .select('id, image_url')
    const existingImageMap = new Map<number, string>()
    for (const r of existingRows ?? []) {
      if (r.image_url) existingImageMap.set(r.id, r.image_url)
    }
    console.log(`  기존 image_url 보존: ${existingImageMap.size}개`)

    // Merge image_url into rows
    for (const r of rows) {
      if (existingImageMap.has(r.id)) {
        r.image_url = existingImageMap.get(r.id)!
      } else if (r.desc_text && descToImageId.has(r.desc_text)) {
        const origId = descToImageId.get(r.desc_text)!
        r.image_url = existingImageMap.get(origId) ?? null
      } else {
        r.image_url = null
      }
    }
    const imageCount = rows.filter(r => r.image_url).length
    console.log(`  image_url 매핑: ${imageCount}개`)

    // Clean sync: nullify parent_id → delete all → insert without parent_id → update parent_id
    await supabase.schema('limbus').from('mirror_dungeon_events')
      .update({ parent_id: null }).not('parent_id', 'is', null)
    const { error: delErr } = await supabase.schema('limbus').from('mirror_dungeon_events')
      .delete().not('id', 'is', null)
    if (delErr) console.error(`  ❌ 삭제 실패: ${delErr.message}`)

    // Step 1: Insert all rows WITHOUT parent_id
    const rowsNoParent = rows.map(r => ({ ...r, parent_id: null }))
    for (let i = 0; i < rowsNoParent.length; i += 50) {
      const batch = rowsNoParent.slice(i, i + 50)
      const { error } = await supabase.schema('limbus').from('mirror_dungeon_events')
        .upsert(batch, { onConflict: 'id' })
      if (error) console.error(`  ❌ 삽입 배치 ${i}: ${error.message}`)
      else if (VERBOSE) console.log(`  ✅ 삽입 ${i + 1}~${i + batch.length}`)
    }

    // Step 2: Update parent_id for child events
    const childRows = rows.filter(r => r.parent_id != null)
    let parentUpdated = 0
    for (const r of childRows) {
      const { error } = await supabase.schema('limbus').from('mirror_dungeon_events')
        .update({ parent_id: r.parent_id }).eq('id', r.id)
      if (error) console.error(`  ❌ parent_id ${r.id}: ${error.message}`)
      else parentUpdated++
    }
    console.log(`  parent_id 업데이트: ${parentUpdated}/${childRows.length}개`)

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
        r.gift_ids = r.gift_ids.map(gid => {
          if (giftIdRemap.has(gid)) { changed = true; return giftIdRemap.get(gid)! }
          return gid
        })
        if (changed) remapped++
      }
      console.log(`  ${remapped}개 이벤트 치환`)
      for (const r of rows) {
        if (!r.gift_ids) continue
        await supabase.schema('limbus').from('mirror_dungeon_events')
          .update({ gift_ids: r.gift_ids }).eq('id', r.id)
      }
    } else {
      console.log('  치환 필요 없음')
    }

    console.log(`\n  ✅ 동기화 완료! (이벤트: ${rows.length})`)

  } else {
    /* ── 8b. Dry-run: compare with DB ───────────────────────────────────────── */
    const { data: existingEvents, error: fetchErr } = await supabase
      .schema('limbus')
      .from('mirror_dungeon_events')
      .select('id, name, desc_text, options, gift_ids, source, theme_ids')

    if (fetchErr) throw new Error(`mirror_dungeon_events fetch 실패: ${fetchErr.message}`)

    const existingById = new Map<number, typeof existingEvents[0]>()
    for (const ev of existingEvents ?? []) existingById.set(ev.id, ev)

    let newCount = 0, updateCount = 0, matchCount = 0

    for (const ev of rows) {
      const existing = existingById.get(ev.id)
      if (!existing) {
        newCount++
        if (VERBOSE) console.log(GREEN(`  🆕 [${ev.id}] ${ev.name ?? '(이름없음)'}`))
      } else {
        const changes: string[] = []
        if (existing.name !== ev.name) changes.push(`name: ${existing.name} → ${ev.name}`)
        if (existing.desc_text !== ev.desc_text) changes.push('desc_text 변경')
        if (existing.source !== ev.source) changes.push(`source: ${existing.source} → ${ev.source}`)
        const existGifts = JSON.stringify((existing.gift_ids ?? []).sort())
        const newGifts = JSON.stringify((ev.gift_ids ?? []).sort())
        if (existGifts !== newGifts) changes.push(`gift_ids 변경 (${(existing.gift_ids ?? []).length} → ${(ev.gift_ids ?? []).length})`)
        if (JSON.stringify(existing.options) !== JSON.stringify(ev.options)) changes.push('options 변경')
        const existThemes = JSON.stringify((existing.theme_ids ?? []).sort())
        const newThemes = JSON.stringify((ev.theme_ids ?? []).sort())
        if (existThemes !== newThemes) changes.push('theme_ids 변경')

        if (changes.length > 0) {
          updateCount++
          if (VERBOSE) console.log(YELLOW(`  🔄 [${ev.id}] ${ev.name}: ${changes.join(', ')}`))
        } else {
          matchCount++
          if (VERBOSE) console.log(GRAY(`  ✅ [${ev.id}] ${ev.name}`))
        }
      }
    }

    console.log(`\n  신규: ${newCount}, 변경: ${updateCount}, 변경없음: ${matchCount}`)
    console.log(`  DB 기존: ${existingById.size}개, 계산된 행: ${rows.length}개`)
    if (!VERBOSE && newCount === 0 && updateCount === 0) {
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
}

main()
