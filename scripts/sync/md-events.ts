#!/usr/bin/env tsx
/**
 * Mirror Dungeon event sync script — complete 1-pass rewrite
 *
 * Sources:
 *   mirror-dungeon-action-choice-event.txt        (192 action events)
 *   mirror-dungeon-personality-choice-event.txt   (155 personality events)
 *   KR/KR_ActionEvents_*.txt + KR_AbEvents_*.txt  (KR text, MD-only)
 *   mirrordungeon-generatenodepool-event-*.txt    (nodepool category)
 *   hells-chicken-dungeon-generatenodepool-event-*.txt (nodepool category)
 *   mirrordungeon-theme-floor-t*.txt + hidden     (theme_ids mapping)
 *   acquirable-egogifts-in-event-01.txt           (gift mapping)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/sync/md-events.ts [--dry-run|--fix] [--verbose]
 *
 * Default: --dry-run (no DB writes). Use --fix to apply.
 */

import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const FIX     = args.includes('--fix')
const VERBOSE = args.includes('--verbose')

// ── Env / Supabase ────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Paths ─────────────────────────────────────────────────────────────────────

const TEXT_DIR        = resolve(process.env.HOME!, 'Documents/Limbus/assets/data/Json (Text)')
const KR_DIR          = join(TEXT_DIR, 'KR')
const KR_FALLBACK_DIR = resolve(process.env.HOME!, 'Documents/Limbus/assets/data/kr')

// ── DungeonId → ThemeId hardcoded mapping ─────────────────────────────────────
// Special dungeon nodepools don't appear in theme floor eventPool arrays.
// These mappings were determined by matching dungeon names in KR_MirrorDungeonTheme-1.
const DUNGEON_TO_THEMES: Record<number, number[]> = {
  910301: [1101], 910302: [1101],          // 헬스치킨 (hells-chicken)
  910701: [1104], 911501: [1104, 1116],    // 육참골단 / 육참골단 BokGak
  910901: [1105], 911801: [1105, 1120],    // 시간살인시간 / 시간살인시간 BokGak
}

// ── File loading util ─────────────────────────────────────────────────────────

function loadJson(filePath: string): unknown {
  const raw = readFileSync(filePath)
  return JSON.parse(raw.toString('utf-8').replace(/^\uFEFF/, ''))
}

function loadFromTextDir(filename: string): unknown {
  return loadJson(join(TEXT_DIR, filename))
}

function getList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data.flat(Infinity) as unknown[]
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    const arr = d['list'] ?? d['dataList']
    if (Array.isArray(arr)) return arr
  }
  return []
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChoiceEffect {
  type: string
  amount?: number
  hp?: number
  mp?: number
  gift_id?: number | null
  count?: number
  battle_id?: number | null
  effect?: string
}

interface EventRow {
  id: number
  name: string | null
  desc_text: string | null
  event_type: 'ACTION' | 'COIN_EVENT'
  source: string | null
  image_url: null  // always null on insert; restored from backup after
  theme_ids: number[] | null
  gift_ids: number[] | null
  variant_of: null
  category: string
}

interface ChoiceRow {
  event_id: number
  sort_order: number
  message: string | null
  message_desc: string | null
  result_text: string | null
  probability: string | null
  next_event_id: number | null
  effects: ChoiceEffect[] | null
}

interface KrActionEntry {
  id: number
  name?: string
  desc?: string
  options?: Array<{
    message?: string
    messageDesc?: string
    result?: string | string[]
  }>
}

interface KrAbEntry {
  id: number
  title?: string
  eventDesc?: string
  behaveDesc?: string
  successDesc?: string | string[]
  failureDesc?: string | string[]
}

// ── Sin mapping for judgement ─────────────────────────────────────────────────

const SIN_MAP: Record<string, string> = {
  CRIMSON:  '분노',
  SCARLET:  '색욕',
  ORANGE:   '색욕',
  VIOLET:   '질투',
  INDIGO:   '오만',
  AZURE:    '우울',
  GREEN:    '탐식',
  SHAMROCK: '탐식',
  YELLOW:   '나태',
  AMBER:    '나태',
}

// ── Effect parsing ────────────────────────────────────────────────────────────

function withTarget(e: ChoiceEffect, target?: string, condition?: string): ChoiceEffect {
  if (target && target !== 'EveryAlly') {
    e.effect = target
  }
  if (condition) {
    e.effect = (e.effect ? e.effect + '|' : '') + condition
  }
  return e
}

function parseResultEffect(
  effect: string,
  itemReward?: { rewardId?: number; num?: number },
  nextBattleID?: number,
  target?: string,
  condition?: string,
): ChoiceEffect {
  // Nothing / Empty
  if (effect === 'Nothing' || effect === 'Empty') return { type: 'nothing' }

  // HP/MP numeric effects
  let m = effect.match(/^LoseHpOnly_(\d+)$/)
  if (m) return withTarget({ type: 'hp_loss', amount: parseInt(m[1]) }, target, condition)

  m = effect.match(/^LoseMpOnly_(\d+)$/)
  if (m) return withTarget({ type: 'mp_loss', amount: parseInt(m[1]) }, target, condition)

  m = effect.match(/^RecoverHpOnly_(\d+)$/)
  if (m) return withTarget({ type: 'hp_recover', amount: parseInt(m[1]) }, target, condition)

  m = effect.match(/^RecoverMpOnly_(\d+)$/)
  if (m) return withTarget({ type: 'mp_recover', amount: parseInt(m[1]) }, target, condition)

  m = effect.match(/^LoseHpMpSameAmount_(\d+)$/)
  if (m) return withTarget({ type: 'hp_mp_loss', amount: parseInt(m[1]) }, target, condition)

  m = effect.match(/^LoseHpMpDifferentAmount_(\d+)_(\d+)$/)
  if (m) return withTarget({ type: 'hp_mp_loss', hp: parseInt(m[1]), mp: parseInt(m[2]) }, target, condition)

  m = effect.match(/^RecoverHpMpSameAmount_(\d+)$/)
  if (m) return withTarget({ type: 'hp_mp_recover', amount: parseInt(m[1]) }, target, condition)

  m = effect.match(/^RecoverRatioHpOnly_(\d+)$/)
  if (m) return withTarget({ type: 'hp_recover_ratio', amount: parseInt(m[1]) }, target, condition)

  m = effect.match(/^LoseRatioHpOnly_(\d+)$/)
  if (m) return withTarget({ type: 'hp_loss_ratio', amount: parseInt(m[1]) }, target, condition)

  if (effect === 'RecoverHpOnlyUntilMax') return withTarget({ type: 'hp_recover', amount: -1 }, target, condition)
  if (effect === 'RecoverMpOnlyUntilMax') return withTarget({ type: 'mp_recover', amount: -1 }, target, condition)
  if (effect === 'ReviveOutOfBattleAndRecoverHpAll') return withTarget({ type: 'hp_recover', amount: -1 }, target, condition)

  // Cost
  if (effect === 'MirrorDungeonAcquireCost') return { type: 'cost', amount: itemReward?.num ?? 0 }
  if (effect === 'MirrorDungeonLossCost')    return { type: 'cost_loss', amount: itemReward?.num ?? 0 }

  // Gift
  if (effect === 'GetConfirmedEgogift') {
    return { type: 'gift', gift_id: itemReward?.rewardId ?? null, count: itemReward?.num ?? 1 }
  }
  if (effect === 'GetConfirmedEgogiftOnWinBattle') {
    return { type: 'gift_battle', gift_id: itemReward?.rewardId ?? null, count: itemReward?.num ?? 1 }
  }
  if (effect === 'DestroyEgogift') return { type: 'destroy_gift' }

  // Battle
  if (effect === 'StartBattle') {
    return { type: 'battle', battle_id: (nextBattleID && nextBattleID !== -1) ? nextBattleID : null }
  }
  if (effect === 'StartBattle_Abnormality') {
    return { type: 'battle_abnormality', battle_id: (nextBattleID && nextBattleID !== -1) ? nextBattleID : null }
  }

  // Character / level
  if (effect === 'LevelupPersonality') return { type: 'level_up' }
  if (effect === 'GetCharacter')       return { type: 'get_character' }

  if (VERBOSE) console.log(`  [WARN] Unknown resultEffect: ${effect}`)
  return { type: 'unknown', ...(({ type: _, ...rest }) => rest)({ type: effect, amount: 0 }) } as ChoiceEffect
}

function extractEffectsFromDataList(
  dataList: Array<{ resultForm?: {
    resultEffect?: string
    resultEffectTarget?: string
    resultEffectCondition1?: string
    nextBattleID?: number
    itemReward?: { type?: string; rewardId?: number; num?: number }
  } }>
): ChoiceEffect[] {
  const effects: ChoiceEffect[] = []
  for (const erd of dataList) {
    const rf = erd.resultForm
    if (!rf?.resultEffect) continue
    effects.push(parseResultEffect(rf.resultEffect, rf.itemReward, rf.nextBattleID, rf.resultEffectTarget, rf.resultEffectCondition1))
  }
  return effects
}

// ── KR text loading ───────────────────────────────────────────────────────────

// SD-only patterns to exclude from KR files
const KR_EXCLUDE_PATTERNS = [
  'Refraction', // Refraction Railway (separate content)
  'a1c5', 'a1c6', 'a1c7', 'a1c8', 'a1c9', // Story dungeon chapters
  'tktRe',  // Ticket Re (story)
  'tkt',    // Ticket story events
  // 'Ycgd' — removed: contains valid MD events (971049, 971050)
  'a1c971', // Empty placeholder
  'x1p1c1', // Story
]

function isKrFileMd(filename: string): boolean {
  return !KR_EXCLUDE_PATTERNS.some(p => filename.includes(p))
}

function loadKrActionMap(): Map<number, KrActionEntry> {
  const map = new Map<number, KrActionEntry>()
  const files = readdirSync(KR_DIR)
    .filter(f => f.startsWith('KR_ActionEvents') && f.endsWith('.txt'))
    .filter(isKrFileMd)

  if (VERBOSE) console.log(`  Loading ${files.length} KR action files`)

  for (const filename of files) {
    try {
      const data = loadJson(join(KR_DIR, filename))
      const raw = (data as Record<string, unknown>)['dataList'] ??
                  (data as Record<string, unknown>)['list'] ??
                  data
      const entries = (Array.isArray(raw) ? raw : [raw]).flat(Infinity) as KrActionEntry[]
      let count = 0
      for (const entry of entries) {
        if (entry && typeof entry === 'object' && typeof entry.id === 'number') {
          map.set(entry.id, { ...entry, _source: filename } as KrActionEntry & { _source: string })
          count++
        }
      }
      if (VERBOSE) console.log(`    ${filename}: ${count} entries`)
    } catch (err) {
      console.warn(`  [WARN] Failed to load ${filename}: ${err}`)
    }
  }

  // Fallback: also scan kr/ directory for .json files
  try {
    const fallbackFiles = readdirSync(KR_FALLBACK_DIR)
      .filter(f => f.startsWith('KR_ActionEvents') && f.endsWith('.json'))
      .filter(isKrFileMd)
    if (VERBOSE) console.log(`  Loading ${fallbackFiles.length} KR action fallback files from kr/`)
    for (const filename of fallbackFiles) {
      try {
        const data = loadJson(join(KR_FALLBACK_DIR, filename))
        const raw = (data as Record<string, unknown>)['dataList'] ??
                    (data as Record<string, unknown>)['list'] ??
                    data
        const entries = (Array.isArray(raw) ? raw : [raw]).flat(Infinity) as KrActionEntry[]
        let count = 0
        for (const entry of entries) {
          if (entry && typeof entry === 'object' && typeof entry.id === 'number') {
            if (!map.has(entry.id)) {
              map.set(entry.id, { ...entry, _source: filename } as KrActionEntry & { _source: string })
              count++
            }
          }
        }
        if (VERBOSE) console.log(`    [fallback] ${filename}: ${count} new entries`)
      } catch { /* skip unreadable files */ }
    }
  } catch { /* kr/ directory missing — skip silently */ }

  return map
}

function loadKrAbMap(): Map<number, KrAbEntry> {
  const map = new Map<number, KrAbEntry>()
  const files = readdirSync(KR_DIR)
    .filter(f => f.startsWith('KR_AbEvents') && f.endsWith('.txt'))
    .filter(f => !f.includes('ResultLog')) // exclude result log files
    .filter(isKrFileMd)

  if (VERBOSE) console.log(`  Loading ${files.length} KR personality files`)

  for (const filename of files) {
    try {
      const data = loadJson(join(KR_DIR, filename))
      const raw = (data as Record<string, unknown>)['dataList'] ??
                  (data as Record<string, unknown>)['list'] ??
                  data
      const entries = (Array.isArray(raw) ? raw : [raw]).flat(Infinity) as KrAbEntry[]
      let count = 0
      for (const entry of entries) {
        if (entry && typeof entry === 'object') {
          // KR AbEvents IDs may be stored as string
          const id = typeof entry.id === 'string' ? parseInt(entry.id) : entry.id
          if (typeof id === 'number' && !isNaN(id)) {
            map.set(id, { ...entry, id } as KrAbEntry)
            count++
          }
        }
      }
      if (VERBOSE) console.log(`    ${filename}: ${count} entries`)
    } catch (err) {
      console.warn(`  [WARN] Failed to load ${filename}: ${err}`)
    }
  }

  // Fallback: also scan kr/ directory for .json files
  try {
    const fallbackFiles = readdirSync(KR_FALLBACK_DIR)
      .filter(f => f.startsWith('KR_AbEvents') && f.endsWith('.json'))
      .filter(f => !f.includes('ResultLog'))
      .filter(isKrFileMd)
    if (VERBOSE) console.log(`  Loading ${fallbackFiles.length} KR personality fallback files from kr/`)
    for (const filename of fallbackFiles) {
      try {
        const data = loadJson(join(KR_FALLBACK_DIR, filename))
        const raw = (data as Record<string, unknown>)['dataList'] ??
                    (data as Record<string, unknown>)['list'] ??
                    data
        const entries = (Array.isArray(raw) ? raw : [raw]).flat(Infinity) as KrAbEntry[]
        let count = 0
        for (const entry of entries) {
          if (entry && typeof entry === 'object') {
            const id = typeof entry.id === 'string' ? parseInt(entry.id) : entry.id
            if (typeof id === 'number' && !isNaN(id) && !map.has(id)) {
              map.set(id, { ...entry, id } as KrAbEntry)
              count++
            }
          }
        }
        if (VERBOSE) console.log(`    [fallback] ${filename}: ${count} new entries`)
      } catch { /* skip unreadable files */ }
    }
  } catch { /* kr/ directory missing — skip silently */ }

  return map
}

// ── Normalise KR text helpers ─────────────────────────────────────────────────

function joinText(val: string | string[] | null | undefined): string | null {
  if (!val) return null
  if (Array.isArray(val)) return val.join('\n') || null
  // Sometimes result is stored as JSON-stringified array
  if (typeof val === 'string' && val.startsWith('[')) {
    try {
      const parsed = JSON.parse(val.replace(/'/g, '"'))
      if (Array.isArray(parsed)) return parsed.join('\n') || null
    } catch {
      // not JSON
    }
  }
  return val || null
}

// ── Nodepool loading ──────────────────────────────────────────────────────────

interface NodepoolEntry {
  id: number
  category: string
  dungeonEventList: number[]
}

function loadNodepoolInfo(): {
  nodepoolIds: Set<number>
  healIds: Set<number>
  categoryMap: Map<number, string>
  dungeonEventThemes: Map<number, Set<number>>
} {
  const nodepoolIds       = new Set<number>()
  const healIds           = new Set<number>()
  const categoryMap       = new Map<number, string>()
  // Maps eventId → Set<themeId> derived from dungeonId mappings
  const dungeonEventThemes = new Map<number, Set<number>>()

  // Find all nodepool-event files: mirrordungeon-, hells-chicken-, ycgd-, tkt- prefixes
  const files = readdirSync(TEXT_DIR).filter(f =>
    f.match(/^(mirrordungeon|hells-chicken-dungeon|ycgd-dungeon|tkt-dungeon)-generatenodepool-event-/) && f.endsWith('.txt')
  )

  if (VERBOSE) console.log(`  Loading ${files.length} nodepool files`)

  for (const filename of files) {
    try {
      const data = loadFromTextDir(filename)
      const entries = getList(data) as (NodepoolEntry & { dungeonId?: number })[]
      for (const entry of entries) {
        if (!entry || typeof entry.id !== 'number') continue
        const ids = Array.isArray(entry.dungeonEventList) ? entry.dungeonEventList : [entry.id]
        for (const id of ids) {
          nodepoolIds.add(id)
          if (entry.category === 'GLOBAL_EVENT_HEAL') {
            healIds.add(id)
          }
          categoryMap.set(id, entry.category ?? 'NORMAL')

          // Map event to themes via dungeonId
          const dungeonId = entry.dungeonId
          if (dungeonId !== undefined && DUNGEON_TO_THEMES[dungeonId]) {
            if (!dungeonEventThemes.has(id)) dungeonEventThemes.set(id, new Set())
            for (const tid of DUNGEON_TO_THEMES[dungeonId]) {
              dungeonEventThemes.get(id)!.add(tid)
            }
          }
        }
      }
    } catch (err) {
      console.warn(`  [WARN] Failed to load nodepool ${filename}: ${err}`)
    }
  }

  if (VERBOSE) console.log(`  Nodepool: ${nodepoolIds.size} unique IDs, ${healIds.size} heal IDs, ${dungeonEventThemes.size} with dungeon-theme mappings`)
  return { nodepoolIds, healIds, categoryMap, dungeonEventThemes }
}

// ── Theme floor loading ───────────────────────────────────────────────────────

function loadThemeMap(): Map<number, number[]> {
  // Map<eventId, themeId[]>
  const themeMap = new Map<number, number[]>()

  const files = readdirSync(TEXT_DIR).filter(f =>
    f.match(/^mirrordungeon-theme-floor-(t\d+|hidden)\.txt$/)
  )

  if (VERBOSE) console.log(`  Loading ${files.length} theme floor files`)

  for (const filename of files) {
    try {
      const data = loadFromTextDir(filename)
      const entries = getList(data) as Array<{ id?: number; mapGenOption?: { eventPool?: number[]; specialEventPool?: number[] } }>
      for (const entry of entries) {
        const themeId  = entry.id
        const eventPool = [
          ...(entry.mapGenOption?.eventPool ?? []),
          ...(entry.mapGenOption?.specialEventPool ?? []),
        ]
        if (typeof themeId !== 'number') continue
        for (const eventId of eventPool) {
          const existing = themeMap.get(eventId) ?? []
          if (!existing.includes(themeId)) {
            themeMap.set(eventId, [...existing, themeId])
          }
        }
      }
    } catch (err) {
      console.warn(`  [WARN] Failed to load theme file ${filename}: ${err}`)
    }
  }

  if (VERBOSE) {
    const total = Array.from(themeMap.values()).reduce((s, a) => s + a.length, 0)
    console.log(`  Theme map: ${themeMap.size} event IDs with theme references (${total} total refs)`)
  }
  return themeMap
}

// ── Gift mapping loading ──────────────────────────────────────────────────────

function loadGiftMap(): Map<number, number[]> {
  // Map<eventId, giftId[]>
  const giftMap = new Map<number, number[]>()

  try {
    const data = loadFromTextDir('acquirable-egogifts-in-event-01.txt')
    const entries = getList(data) as Array<{ eventId?: number; egoGiftList?: number[] }>
    for (const entry of entries) {
      if (typeof entry.eventId !== 'number') continue
      giftMap.set(entry.eventId, entry.egoGiftList ?? [])
    }
  } catch (err) {
    console.warn(`  [WARN] Failed to load gift map: ${err}`)
  }

  if (VERBOSE) console.log(`  Gift map: ${giftMap.size} event → gift mappings`)
  return giftMap
}

// ── Category classification ───────────────────────────────────────────────────

function classifyCategory(
  id: number,
  nodepoolIds: Set<number>,
  healIds: Set<number>,
): string {
  if (healIds.has(id))      return 'GLOBAL_EVENT_HEAL'
  if (nodepoolIds.has(id))  return 'NORMAL'
  if (id >= 971000 && id < 972000) return 'SEASONAL'
  return 'NORMAL'
}

// ── Judgement → probability hint ─────────────────────────────────────────────

interface JudgementData {
  upDownType?: number
  inclusiveValue?: number
  exclusiveValue?: number
  judgementDataList?: Array<{ attributeType?: string }>
}

function formatJudgementHint(j: JudgementData): string {
  const sins = (j.judgementDataList ?? [])
    .map(d => SIN_MAP[d.attributeType ?? ''] ?? d.attributeType ?? '')
    .filter(Boolean)
    .join('/')
  const dir  = j.upDownType === 1 ? '높을수록 유리' : '낮을수록 유리'
  const low  = j.inclusiveValue  ?? '?'
  const high = j.exclusiveValue  ?? '?'
  return `[${sins} 판정 ${low}~${high}] ${dir}`
}

// ── adderInfo hint ────────────────────────────────────────────────────────────

interface AdderEntry {
  correctionCase?: string
  adder?: number
}

function formatAdderHint(adderInfo: AdderEntry[]): string {
  if (!adderInfo || adderInfo.length === 0) return ''
  return adderInfo
    .map(a => {
      const sign   = (a.adder ?? 0) >= 0 ? '+' : ''
      const prefix = a.correctionCase ?? ''
      return `[${prefix}: ${sign}${a.adder}]`
    })
    .join(' ')
}

// ── Build choice rows from ACTION event ──────────────────────────────────────

interface ActionOption {
  index?: number
  cantSelectInThisCase?: string
  resultList?: Array<{
    resultIndex?: number
    resultCondition?: string
    nextEventID?: number
    eventResultDataList?: Array<{ resultForm?: {
      resultEffect?: string
      nextBattleID?: number
      itemReward?: { type?: string; rewardId?: number; num?: number }
    } }>
  }>
}

function buildActionChoices(
  eventId: number,
  options: ActionOption[],
  krEntry: KrActionEntry | undefined,
): ChoiceRow[] {
  const rows: ChoiceRow[] = []
  const krOpts = krEntry?.options ?? []

  for (let i = 0; i < options.length; i++) {
    const opt    = options[i]
    const krOpt  = krOpts[i]
    const results = opt.resultList ?? []

    // cantSelectInThisCase hint
    const cantSelect = opt.cantSelectInThisCase
    const cantHint   = (cantSelect && cantSelect !== 'None')
      ? `[조건: ${cantSelect}]`
      : null

    const baseMessage     = joinText(krOpt?.message) ?? null
    const baseMessageDesc = [joinText(krOpt?.messageDesc), cantHint].filter(Boolean).join(' ') || null

    if (results.length === 0) {
      // Option with no results — still create a row
      rows.push({
        event_id:     eventId,
        sort_order:   i * 100,
        message:      baseMessage,
        message_desc: baseMessageDesc,
        result_text:  null,
        probability:  null,
        next_event_id: null,
        effects:      null,
      })
      continue
    }

    for (let j = 0; j < results.length; j++) {
      const result     = results[j]
      const nextId     = (result.nextEventID && result.nextEventID !== -1)
        ? result.nextEventID
        : null
      const prob       = result.resultCondition ?? null
      const effects    = extractEffectsFromDataList(result.eventResultDataList ?? [])

      // For multi-branch: result text only on branch 0 (or single)
      const resultText = j === 0 ? joinText(krOpt?.result) : null

      rows.push({
        event_id:      eventId,
        sort_order:    i * 100 + j,
        message:       baseMessage,
        message_desc:  baseMessageDesc,
        result_text:   resultText,
        probability:   prob,
        next_event_id: nextId,
        effects:       effects.length > 0 ? effects : null,
      })
    }
  }

  return rows
}

// ── Build choice rows from COIN_EVENT ─────────────────────────────────────────

interface PersonalityEvent {
  adderInfo?: AdderEntry[]
  judgement?: JudgementData
  eventResults?: Array<{
    eventResult?: string
    eventResultDataList?: Array<{
      resultIndex?: number
      resultCondition?: string
      nextEventID?: number
      eventResultDataList?: Array<{ resultForm?: {
        resultEffect?: string
        nextBattleID?: number
        itemReward?: { type?: string; rewardId?: number; num?: number }
      } }>
    }>
  }>
}

function buildPersonalityChoices(
  eventId: number,
  pe: PersonalityEvent,
  krEntry: KrAbEntry | undefined,
): ChoiceRow[] {
  const rows: ChoiceRow[] = []
  const eventResults = pe.eventResults ?? []

  const judgementHint = pe.judgement ? formatJudgementHint(pe.judgement) : ''
  const adderHint     = formatAdderHint(pe.adderInfo ?? [])
  const messageDesc   = [judgementHint, adderHint].filter(Boolean).join(' ') || null

  // behaveDesc as base message_desc
  const behaveDesc = joinText(krEntry?.behaveDesc) ?? null

  let sortOrder = 0
  for (const er of eventResults) {
    const label     = er.eventResult ?? 'UNKNOWN'
    const isSuccess = label === 'SUCCESS'
    const resultList = er.eventResultDataList ?? []

    const krText = isSuccess
      ? joinText(krEntry?.successDesc)
      : joinText(krEntry?.failureDesc)

    if (resultList.length === 0) {
      rows.push({
        event_id:      eventId,
        sort_order:    sortOrder++,
        message:       krText,
        message_desc:  isSuccess ? (messageDesc ?? behaveDesc) : null,
        result_text:   null,
        probability:   null,
        next_event_id: null,
        effects:       null,
      })
      continue
    }

    for (let j = 0; j < resultList.length; j++) {
      const result  = resultList[j]
      const nextId  = (result.nextEventID && result.nextEventID !== -1)
        ? result.nextEventID
        : null
      const prob    = result.resultCondition ?? null
      const effects = extractEffectsFromDataList(result.eventResultDataList ?? [])

      rows.push({
        event_id:      eventId,
        sort_order:    sortOrder++,
        message:       j === 0 ? krText : null,
        message_desc:  isSuccess && j === 0 ? (messageDesc ?? behaveDesc) : null,
        result_text:   null,
        probability:   prob,
        next_event_id: nextId,
        effects:       effects.length > 0 ? effects : null,
      })
    }
  }

  return rows
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Mirror Dungeon Event Sync ===')
  console.log(`Mode: ${FIX ? '--fix (DB write)' : '--dry-run (no DB writes)'}`)
  console.log()

  // ── Step 1: Load game events ──────────────────────────────────────────────

  console.log('[1/6] Loading game event data...')
  const actionRaw = getList(loadFromTextDir('mirror-dungeon-action-choice-event.txt')) as Array<{
    id: number
    eventType: string
    actionEvent?: { eachOptionList?: ActionOption[] }
  }>
  const persRaw   = getList(loadFromTextDir('mirror-dungeon-personality-choice-event.txt')) as Array<{
    id: number
    eventType: string
    personalityEvent?: PersonalityEvent
  }>

  console.log(`  Action events:      ${actionRaw.length}`)
  console.log(`  Personality events: ${persRaw.length}`)

  // ── Step 2: Load KR text ──────────────────────────────────────────────────

  console.log('[2/6] Loading KR text files...')
  const krActionMap = loadKrActionMap()
  const krAbMap     = loadKrAbMap()
  console.log(`  KR action entries:      ${krActionMap.size}`)
  console.log(`  KR personality entries: ${krAbMap.size}`)

  // ── Step 3: Build theme mapping ───────────────────────────────────────────

  console.log('[3/6] Building theme mapping...')
  const themeMap = loadThemeMap()

  // ── Step 4: Build nodepool info ───────────────────────────────────────────

  console.log('[4/6] Building nodepool info...')
  const { nodepoolIds, healIds, dungeonEventThemes } = loadNodepoolInfo()

  // Merge dungeon-based theme mappings into themeMap
  for (const [eventId, themeSet] of dungeonEventThemes) {
    const existing = themeMap.get(eventId) ?? []
    const merged = new Set(existing)
    for (const tid of themeSet) merged.add(tid)
    themeMap.set(eventId, [...merged].sort((a, b) => a - b))
  }
  if (VERBOSE) console.log(`  After dungeon merge: ${themeMap.size} events with theme mappings`)

  // ── Step 5: Build gift mapping ────────────────────────────────────────────

  console.log('[5/6] Building gift mapping...')
  const giftMap = loadGiftMap()

  // ── Step 6: Assemble rows ─────────────────────────────────────────────────

  console.log('[6/6] Assembling event and choice rows...')

  const eventRows:  EventRow[]  = []
  const choiceRows: ChoiceRow[] = []
  const missingKr:  number[]    = []

  // --- Action events ---
  for (const ev of actionRaw) {
    const krEntry = krActionMap.get(ev.id)
    if (!krEntry) missingKr.push(ev.id)

    const sourceFile = krEntry
      ? ((krEntry as unknown as Record<string, string>)['_source'] ?? null)
      : null

    const category = classifyCategory(ev.id, nodepoolIds, healIds)

    eventRows.push({
      id:         ev.id,
      name:       krEntry?.name?.trim() || null,
      desc_text:  krEntry?.desc?.trim() || null,
      event_type: 'ACTION',
      source:     sourceFile,
      image_url:  null,
      theme_ids:  themeMap.get(ev.id) ?? null,
      gift_ids:   giftMap.get(ev.id) ?? null,
      variant_of: null,
      category,
    })

    const options = ev.actionEvent?.eachOptionList ?? []
    const choices = buildActionChoices(ev.id, options, krEntry)
    choiceRows.push(...choices)
  }

  // --- Personality events ---
  for (const ev of persRaw) {
    const krEntry = krAbMap.get(ev.id)
    if (!krEntry) missingKr.push(ev.id)

    const category = classifyCategory(ev.id, nodepoolIds, healIds)

    // desc_text = eventDesc + behaveDesc for personality events
    const eventDesc  = joinText(krEntry?.eventDesc)
    const behaveDesc = joinText(krEntry?.behaveDesc)
    const descParts  = [eventDesc, behaveDesc].filter(Boolean)
    const descText   = descParts.length > 0 ? descParts.join('\n') : null

    // name = title if non-empty, else null
    const name = krEntry?.title?.trim() || null

    eventRows.push({
      id:         ev.id,
      name,
      desc_text:  descText,
      event_type: 'COIN_EVENT',
      source:     null,
      image_url:  null,
      theme_ids:  themeMap.get(ev.id) ?? null,
      gift_ids:   giftMap.get(ev.id) ?? null,
      variant_of: null,
      category,
    })

    const pe      = ev.personalityEvent ?? {}
    const choices = buildPersonalityChoices(ev.id, pe, krEntry)
    choiceRows.push(...choices)
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const actionCount    = eventRows.filter(r => r.event_type === 'ACTION').length
  const coinCount      = eventRows.filter(r => r.event_type === 'COIN_EVENT').length
  const normalCount    = eventRows.filter(r => r.category === 'NORMAL').length
  const healCount      = eventRows.filter(r => r.category === 'GLOBAL_EVENT_HEAL').length
  const seasonalCount  = eventRows.filter(r => r.category === 'SEASONAL').length

  console.log()
  console.log('=== Summary ===')
  console.log(`Total events:    ${eventRows.length} (expected: 347)`)
  console.log(`  ACTION:        ${actionCount} (expected: 192)`)
  console.log(`  COIN_EVENT:    ${coinCount} (expected: 155)`)
  console.log(`Category:`)
  console.log(`  NORMAL:        ${normalCount}`)
  console.log(`  HEAL:          ${healCount} (expected: 3)`)
  console.log(`  SEASONAL:      ${seasonalCount}`)
  console.log(`Total choices:   ${choiceRows.length}`)
  console.log(`Missing KR:      ${missingKr.length}`)
  if (missingKr.length > 0 && (VERBOSE || missingKr.length <= 20)) {
    console.log(`  IDs: ${missingKr.join(', ')}`)
  }

  // Verify next_event_id chains
  const allEventIds = new Set(eventRows.map(r => r.id))
  const brokenChains = choiceRows.filter(
    r => r.next_event_id !== null && !allEventIds.has(r.next_event_id)
  )
  if (brokenChains.length > 0) {
    console.log(`[WARN] Broken chains: ${brokenChains.length}`)
    for (const b of brokenChains.slice(0, 10)) {
      console.log(`  event_id=${b.event_id} next_event_id=${b.next_event_id} (missing)`)
    }
  } else {
    console.log('Chain integrity:  OK (0 broken chains)')
  }

  if (!FIX) {
    console.log()
    console.log('Dry-run complete. Re-run with --fix to write to DB.')
    return
  }

  // ── DB Write ──────────────────────────────────────────────────────────────

  console.log()
  console.log('=== Writing to DB ===')

  // Backup existing image_urls
  console.log('Backing up existing image_urls...')
  const { data: imgBackup, error: imgErr } = await supabase
    .schema('limbus')
    .from('md_events')
    .select('id, image_url')
    .not('image_url', 'is', null)

  if (imgErr) {
    console.error('Failed to backup image_urls:', imgErr.message)
    process.exit(1)
  }
  const imgBackupMap = new Map<number, string>()
  for (const row of imgBackup ?? []) {
    if (row.image_url) imgBackupMap.set(row.id, row.image_url)
  }
  console.log(`  Backed up ${imgBackupMap.size} image_urls`)

  // Upsert events in batches
  console.log('Upserting md_events...')
  const BATCH = 100
  let upsertedEvents = 0
  for (let i = 0; i < eventRows.length; i += BATCH) {
    const batch = eventRows.slice(i, i + BATCH)
    const { error } = await supabase
      .schema('limbus')
      .from('md_events')
      .upsert(batch, { onConflict: 'id' })
    if (error) {
      console.error(`  Upsert error (batch ${i}):`, error.message)
      process.exit(1)
    }
    upsertedEvents += batch.length
    process.stdout.write(`\r  Upserted ${upsertedEvents}/${eventRows.length} events`)
  }
  console.log()

  // Restore image_urls
  if (imgBackupMap.size > 0) {
    console.log('Restoring image_urls...')
    let restored = 0
    const imgUpdates = Array.from(imgBackupMap.entries())
    for (let i = 0; i < imgUpdates.length; i += BATCH) {
      const batchUpdates = imgUpdates.slice(i, i + BATCH)
      for (const [id, imageUrl] of batchUpdates) {
        const { error } = await supabase
          .schema('limbus')
          .from('md_events')
          .update({ image_url: imageUrl })
          .eq('id', id)
          .is('image_url', null)
        if (error) {
          console.warn(`  [WARN] Failed to restore image_url for id=${id}: ${error.message}`)
        } else {
          restored++
        }
      }
    }
    console.log(`  Restored ${restored}/${imgBackupMap.size} image_urls`)
  }

  // Delete existing choices for these events, then bulk insert
  console.log('Replacing md_event_choices...')
  const eventIds = eventRows.map(r => r.id)

  // Delete in batches to avoid query size limits
  for (let i = 0; i < eventIds.length; i += 500) {
    const batch = eventIds.slice(i, i + 500)
    const { error } = await supabase
      .schema('limbus')
      .from('md_event_choices')
      .delete()
      .in('event_id', batch)
    if (error) {
      console.error(`  Delete error (batch ${i}):`, error.message)
      process.exit(1)
    }
  }

  // Insert choices in batches
  let insertedChoices = 0
  for (let i = 0; i < choiceRows.length; i += BATCH) {
    const batch = choiceRows.slice(i, i + BATCH)
    const { error } = await supabase
      .schema('limbus')
      .from('md_event_choices')
      .insert(batch)
    if (error) {
      console.error(`  Insert choices error (batch ${i}):`, error.message)
      process.exit(1)
    }
    insertedChoices += batch.length
    process.stdout.write(`\r  Inserted ${insertedChoices}/${choiceRows.length} choices`)
  }
  console.log()

  // ── Post-write verification ───────────────────────────────────────────────

  console.log()
  console.log('=== Verification ===')

  const { count: evCount } = await supabase
    .schema('limbus')
    .from('md_events')
    .select('*', { count: 'exact', head: true })
  console.log(`md_events count:         ${evCount}  (expected: 347)`)

  const { count: choiceCount } = await supabase
    .schema('limbus')
    .from('md_event_choices')
    .select('*', { count: 'exact', head: true })
  console.log(`md_event_choices count:  ${choiceCount}`)

  const { count: imgRestoredCount } = await supabase
    .schema('limbus')
    .from('md_events')
    .select('*', { count: 'exact', head: true })
    .not('image_url', 'is', null)
  console.log(`image_url restored:      ${imgRestoredCount} (backed up: ${imgBackupMap.size})`)

  // ── Post-sync: set variant_of for known duplicates ──────────────────────
  const VARIANTS: Record<number, number[]> = {
    900011: [900012, 900013],       // 자판기 이벤트 (층별 동일)
    971070: [971071, 971072],       // 가시춘 학생의 수업 복습
  }
  for (const [parentId, childIds] of Object.entries(VARIANTS)) {
    const { error: vErr } = await supabase
      .schema('limbus')
      .from('md_events')
      .update({ variant_of: Number(parentId) })
      .in('id', childIds)
    if (vErr) console.warn(`  variant_of update failed for ${parentId}:`, vErr.message)
  }
  console.log('variant_of set for known duplicates')

  // ── Post-sync: set theme_ids for events not in any nodepool ────────────
  const MANUAL_THEMES: Record<number, number[]> = {
    971089: [3001],   // 닭의 기억 → 뽕.황
  }
  for (const [eid, tids] of Object.entries(MANUAL_THEMES)) {
    const { error: tErr } = await supabase
      .schema('limbus')
      .from('md_events')
      .update({ theme_ids: tids })
      .eq('id', Number(eid))
      .is('theme_ids', null)
    if (tErr) console.warn(`  theme_ids update failed for ${eid}:`, tErr.message)
  }
  console.log('manual theme_ids set for non-nodepool events')

  console.log()
  console.log('Done.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
