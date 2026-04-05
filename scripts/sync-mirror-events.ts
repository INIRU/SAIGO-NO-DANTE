#!/usr/bin/env tsx
/**
 * 거울 던전 이벤트 동기화 v2 (TypeScript + Zod)
 *
 * 기존 parent_id 방식 → options JSONB에 next_event 직접 내장 방식으로 변경.
 * 루트 이벤트만 DB에 저장하며, 하위 이벤트는 options[].next_event에 중첩됨.
 *
 * 사용법:
 *   npx tsx --env-file=.env.local scripts/sync-mirror-events.ts [--dry-run|--fix] [--verbose]
 *
 * 데이터 소스:
 *   ~/Documents/Limbus/assets/data/Json (Text)/mirror-dungeon-action-choice-event.txt
 *   ~/Documents/Limbus/assets/data/Json (Text)/mirror-dungeon-personality-choice-event.txt
 *   ~/Documents/Limbus/assets/data/kr/KR_ActionEvents_*.json
 *   ~/Documents/Limbus/assets/data/kr/KR_AbEvents_*.json
 *   ~/Documents/Limbus/assets/data/Json-2/mirrordungeon-theme-floor-t{1-6}.json + hidden
 *   ~/Documents/Limbus/assets/data/Json-2/mirrordungeon-generatenodepool-event-*.json
 */

import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ─── Paths ───────────────────────────────────────────────────────────────────

const HOME = process.env.HOME ?? '/Users/iniru'
const TXT_DIR = resolve(HOME, 'Documents/Limbus/assets/data/Json (Text)')
const KR_DIR  = resolve(HOME, 'Documents/Limbus/assets/data/kr')
const J2_DIR  = resolve(HOME, 'Documents/Limbus/assets/data/Json-2')

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2)
const FIX    = args.includes('--fix')
const VERBOSE = args.includes('--verbose')

// ─── Supabase ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const EffectSchema = z.object({
  type:    z.string(),
  amount:  z.number().optional(),
  count:   z.number().optional(),
  gift_id: z.number().optional(),
})

const RewardBranchSchema = z.object({
  probability: z.union([z.number(), z.string()]),
  effects:     z.array(EffectSchema),
})

// Recursive next_event: use z.lazy with explicit type annotation
type NextEvent = {
  id:      number
  name:    string | null
  desc:    string | null
  options: Option[] | null
}

type Option = {
  message:     string
  messageDesc?: string
  result?:     string[]
  rewards?:    z.infer<typeof RewardBranchSchema>[]
  next_event?: NextEvent
}

const OptionSchema: z.ZodType<Option> = z.lazy(() =>
  z.object({
    message:     z.string(),
    messageDesc: z.string().optional(),
    result:      z.array(z.string()).optional(),
    rewards:     z.array(RewardBranchSchema).optional(),
    next_event:  NextEventSchema.optional(),
  })
)

const NextEventSchema: z.ZodType<NextEvent> = z.lazy(() =>
  z.object({
    id:      z.number(),
    name:    z.string().nullable(),
    desc:    z.string().nullable(),
    options: z.array(OptionSchema).nullable(),
  })
)

const EventRowSchema = z.object({
  id:         z.number(),
  name:       z.string().nullable(),
  desc_text:  z.string().nullable(),
  options:    z.array(OptionSchema).nullable(),
  gift_ids:   z.array(z.number()).nullable(),
  source:     z.string().nullable(),
  image_url:  z.string().nullable(),
  theme_ids:  z.array(z.number()).nullable(),
})

type EventRow = z.infer<typeof EventRowSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadTxt(path: string): any {
  const raw = readFileSync(path, 'utf-8').replace(/^\uFEFF/, '')
  return JSON.parse(raw)
}

function loadJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

/**
 * Parse resultCondition string into a probability value.
 * Examples: "Prob_1" → 1, "Prob_0.5" → 0.5, "MpAverage_Under0" → "MpAverage_Under0"
 */
function parseProbability(cond: string): number | string {
  if (!cond) return 1
  const probMatch = cond.match(/^Prob_(\d+(?:\.\d+)?)$/)
  if (probMatch) return parseFloat(probMatch[1])
  // ProbTimesRepeatCount, MpAverage_*, etc. — keep as string
  return cond
}

/**
 * Parse resultEffect into a structured effect object.
 * Covers all effect types seen in mirror-dungeon-action-choice-event.txt.
 */
function parseEffect(
  resultEffect: string,
  itemReward?: { type?: string; rewardId?: number; num?: number; prob?: number } | null
): z.infer<typeof EffectSchema> {
  if (!resultEffect || resultEffect === 'Nothing') {
    return { type: 'nothing' }
  }
  if (resultEffect === 'MirrorDungeonAcquireCost') {
    return { type: 'cost', amount: itemReward?.num ?? 0 }
  }
  if (resultEffect === 'MirrorDungeonLossCost') {
    return { type: 'cost_loss', amount: itemReward?.num ?? 0 }
  }
  if (resultEffect.startsWith('GetConfirmedEgogift')) {
    return { type: 'gift', gift_id: itemReward?.rewardId, count: itemReward?.num ?? 1 }
  }
  if (resultEffect === 'LevelupPersonality') {
    return { type: 'level_up' }
  }
  if (resultEffect === 'GetCharacter') {
    return { type: 'get_character' }
  }
  if (resultEffect === 'MpAverage') {
    return { type: 'mp_average' }
  }
  if (resultEffect.startsWith('StartBattle')) {
    return { type: 'battle' }
  }

  // HP/MP patterns: RecoverHpOnly_15, LoseHpMpSameAmount_12, RecoverRatioHpOnly_20, etc.
  const hpMpMatch = resultEffect.match(
    /^(Lose|Recover)(Hp|Mp|HpMp)(Only|SameAmount|DifferentAmount|OnlyUntilMax|UntilMax|Ratio|RatioOnly)?_?(\d+)?(?:_(\d+))?$/
  )
  if (hpMpMatch) {
    const [, action, target, modifier, amountA, amountB] = hpMpMatch
    const isLoss    = action === 'Lose'
    const verb      = isLoss ? 'loss' : 'recover'
    const targetKey = target === 'HpMp' ? 'hp_mp' : target.toLowerCase()
    const isRatio   = modifier === 'Ratio' || modifier === 'RatioOnly'
    const suffix    = isRatio ? '_ratio' : ''
    const amount    = amountA ? parseInt(amountA, 10) : undefined
    const amount2   = amountB ? parseInt(amountB, 10) : undefined

    if (target === 'HpMp' && amountB !== undefined) {
      // DifferentAmount: two separate amounts
      return { type: `${targetKey}_${verb}${suffix}`, amount, count: amount2 }
    }
    return { type: `${targetKey}_${verb}${suffix}`, amount }
  }

  // Fallback: preserve raw effect string
  return { type: 'unknown', amount: undefined }
}

// Extract all EGO gift IDs recursively from any object
function extractGiftIds(obj: unknown): number[] {
  if (!obj || typeof obj !== 'object') return []
  if (Array.isArray(obj)) return obj.flatMap(extractGiftIds)
  const rec = obj as Record<string, unknown>
  const gifts: number[] = []
  const ir = rec.itemReward as { type?: string; rewardId?: number } | null | undefined
  if (ir && ir.type === 'EGO_GIFT' && typeof ir.rewardId === 'number' && ir.rewardId < 990000) {
    gifts.push(ir.rewardId)
  }
  for (const v of Object.values(rec)) gifts.push(...extractGiftIds(v))
  return gifts
}

// Load acquirable-egogifts mapping files (event → gift pool)
function loadAcquirableGifts(): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>()
  const files = [
    'acquirable-egogifts-in-event-01.json',
    'mirrordungeon-event-acquirable-egogifts-01.json',
    'hells-chicken-dungeon-event-acquirable-egogifts.json',
  ]
  for (const fn of files) {
    try {
      const data = loadJson(join(J2_DIR, fn))
      for (const item of data.list ?? []) {
        const eid = item.eventId as number
        const gifts = item.egoGiftList as number[]
        if (!map.has(eid)) map.set(eid, new Set())
        for (const gid of gifts) map.get(eid)!.add(gid)
      }
      if (VERBOSE) console.log(`  ${fn}: ${(data.list ?? []).length}개 매핑`)
    } catch {
      if (VERBOSE) console.warn(`  [skip] ${fn} not found`)
    }
  }
  return map
}

// ─── KR Text types ────────────────────────────────────────────────────────────

interface KrOption {
  message:     string
  messageDesc?: string
  result?:     string[]
}

interface KrText {
  name:    string | null
  desc:    string | null
  options: KrOption[] | null
  source:  string
}

// ─── Mirror dungeon KR source filter ─────────────────────────────────────────
// Files to exclude (story chapters, refraction railway, etc.)
function isExcludedKrFile(fname: string): boolean {
  return (
    fname.includes('Refraction') ||
    fname.includes('a1c5') ||
    fname.includes('a1c6') ||
    fname.includes('a1c7') ||
    fname.includes('a1c8') ||
    fname.includes('a1c9') ||
    fname.includes('a1c971') ||
    fname.includes('x1p1c1') ||
    fname.includes('ResultLog')
  )
}

// ─── Build option tree (recursive) ────────────────────────────────────────────

function buildOptionTree(
  gameEvent: any,
  krTexts: Map<number, KrText>,
  allGameEvents: Map<number, any>,
  visited: Set<number> = new Set()
): Option[] {
  const eventId: number = gameEvent.id
  if (visited.has(eventId)) return [] // cycle guard
  visited.add(eventId)

  const ae   = gameEvent.actionEvent ?? gameEvent.personalityEvent ?? {}
  const opts = ae.eachOptionList ?? []
  const kr   = krTexts.get(eventId)

  return opts.map((opt: any, i: number): Option => {
    const rewardBranches: z.infer<typeof RewardBranchSchema>[] = []
    let nextEvent: NextEvent | undefined

    for (const r of opt.resultList ?? []) {
      const prob    = parseProbability(r.resultCondition ?? 'Prob_1')
      const effects = (r.eventResultDataList ?? [])
        .map((rd: any) => {
          const rf = rd.resultForm ?? {}
          return parseEffect(rf.resultEffect ?? '', rf.itemReward)
        })
        .filter((e: z.infer<typeof EffectSchema>) => e.type !== 'nothing')

      if (effects.length > 0) {
        rewardBranches.push({ probability: prob, effects })
      }

      // Follow nextEventID chain — embed child event inline
      const nextId: number = r.nextEventID ?? -1
      if (nextId > 0 && allGameEvents.has(nextId) && !visited.has(nextId)) {
        const childGame = allGameEvents.get(nextId)
        const childKr   = krTexts.get(nextId)
        const isPersonalityEvent = !!childGame.personalityEvent
        nextEvent = {
          id:      nextId,
          name:    childKr?.name ?? null,
          desc:    childKr?.desc ?? null,
          options: isPersonalityEvent
            ? buildPersonalityOptions(childGame, krTexts)
            : buildOptionTree(childGame, krTexts, allGameEvents, new Set(visited)),
        }
      }
    }

    const krOpt = kr?.options?.[i]

    // If parent option has no result text but links to an AbEvent, pull successDesc[0]
    // as the result text so narrative appears under the option in the UI.
    let resultText: string[] | undefined =
      krOpt?.result && krOpt.result.length > 0 && krOpt.result.some(r => r.trim().length > 0)
        ? krOpt.result
        : undefined
    if (!resultText && nextEvent !== undefined) {
      const childKr = krTexts.get(nextEvent.id)
      const successResult = childKr?.options?.[0]?.result
      if (successResult && successResult.length > 0) {
        resultText = successResult
      }
    }

    return {
      message:     krOpt?.message ?? `선택지 ${i + 1}`,
      ...(krOpt?.messageDesc ? { messageDesc: krOpt.messageDesc } : {}),
      ...(resultText ? { result: resultText } : {}),
      ...(rewardBranches.length > 0 ? { rewards: rewardBranches } : {}),
      ...(nextEvent !== undefined ? { next_event: nextEvent } : {}),
    }
  })
}

// personality events have a different structure: eventResults[] with SUCCESS/FAILURE branches
function buildPersonalityOptions(
  gameEvent: any,
  krTexts: Map<number, KrText>
): Option[] {
  const eventId: number = gameEvent.id
  const pe  = gameEvent.personalityEvent ?? {}
  const kr  = krTexts.get(eventId)
  const ers = pe.eventResults ?? []

  if (ers.length === 0) return []

  return ers.map((er: any, i: number): Option => {
    const label = er.eventResult === 'SUCCESS' ? '성공' : er.eventResult === 'FAILURE' ? '실패' : `결과 ${i + 1}`
    const rewardBranches: z.infer<typeof RewardBranchSchema>[] = []

    for (const rd of er.eventResultDataList ?? []) {
      const prob    = parseProbability(rd.resultCondition ?? 'Prob_1')
      const effects = (rd.eventResultDataList ?? [])
        .map((inner: any) => {
          const rf = inner.resultForm ?? {}
          return parseEffect(rf.resultEffect ?? '', rf.itemReward)
        })
        .filter((e: z.infer<typeof EffectSchema>) => e.type !== 'nothing')

      if (effects.length > 0) {
        rewardBranches.push({ probability: prob, effects })
      }
    }

    // KR result text comes from successDesc/failureDesc arrays
    const krOpts = kr?.options ?? []
    const krOpt  = krOpts[i]

    return {
      message:     krOpt?.message ?? label,
      ...(krOpt?.result && krOpt.result.length > 0 ? { result: krOpt.result } : {}),
      ...(rewardBranches.length > 0 ? { rewards: rewardBranches } : {}),
    }
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('거울 던전 이벤트 동기화 (v2)')
  console.log(`  모드: ${FIX ? '--fix (DB 반영)' : '--dry-run (비교만)'}`)

  // ── 1. Load game event data (BOM-safe .txt files) ──────────────────────────

  const actionData      = loadTxt(join(TXT_DIR, 'mirror-dungeon-action-choice-event.txt'))
  const personalityData = loadTxt(join(TXT_DIR, 'mirror-dungeon-personality-choice-event.txt'))

  const allGameEvents = new Map<number, any>()
  for (const ev of [...(actionData.list ?? []), ...(personalityData.list ?? [])]) {
    allGameEvents.set(ev.id, ev)
  }

  const actionCount      = (actionData.list ?? []).length
  const personalityCount = (personalityData.list ?? []).length
  console.log(`\n  게임 이벤트: action ${actionCount}, personality ${personalityCount}`)

  // ── 2. Load KR locale text ─────────────────────────────────────────────────

  const krTexts = new Map<number, KrText>()

  for (const fname of readdirSync(KR_DIR).sort()) {
    if (!fname.endsWith('.json')) continue
    const isAction = fname.startsWith('KR_ActionEvents')
    const isAb     = fname.startsWith('KR_AbEvents')
    if (!isAction && !isAb) continue
    if (isExcludedKrFile(fname)) continue

    try {
      const data = loadJson(join(KR_DIR, fname))
      const source = fname.replace(/^KR_/, '').replace(/\.json$/, '')

      for (const item of data.dataList ?? []) {
        const id: number = item.id
        if (typeof id !== 'number') continue
        // Filter to mirror dungeon ID ranges (9xxxxx, 1xxxxx child events)
        const idStr = String(id)
        if (idStr.length < 5) continue

        if (isAb) {
          // AbEvents: title, behaveDesc (main desc), successDesc[], failureDesc[] (option results)
          const successOpts: KrOption[] = (item.successDesc ?? []).map((s: string, i: number) => ({
            message: (item.successDesc?.length ?? 0) > 1 ? `성공 ${i + 1}` : '성공',
            result: [s],
          }))
          const failureOpts: KrOption[] = (item.failureDesc ?? []).map((s: string, i: number) => ({
            message: (item.failureDesc?.length ?? 0) > 1 ? `실패 ${i + 1}` : '실패',
            result: [s],
          }))
          const allOpts = [...successOpts, ...failureOpts]

          krTexts.set(id, {
            name:    item.title || null,
            desc:    item.behaveDesc || item.eventDesc || null,
            options: allOpts.length > 0 ? allOpts : null,
            source,
          })
        } else {
          // ActionEvents: name, desc, options[]
          const rawOpts: any[] = item.options ?? []
          const krOpts: KrOption[] = rawOpts.map((o: any) => ({
            message:     o.message ?? '',
            ...(o.messageDesc ? { messageDesc: o.messageDesc } : {}),
            ...(o.result ? { result: o.result } : {}),
          }))

          krTexts.set(id, {
            name:    item.name || null,
            desc:    item.desc || item.eventDesc || null,
            options: krOpts.length > 0 ? krOpts : null,
            source,
          })
        }
      }
    } catch (err) {
      if (VERBOSE) console.warn(`  [warn] KR load failed: ${fname}`, err)
    }
  }

  console.log(`  KR 텍스트: ${krTexts.size}개`)

  // ── 3. Build theme floor data ───────────────────────────────────────────────

  const eventToThemes      = new Map<number, Set<number>>() // eventId → Set<themeId>
  const themeIdsByTier: Record<string | number, number[]> = {}
  const allThemeIds: number[] = []

  for (let t = 1; t <= 6; t++) {
    const data = loadJson(join(J2_DIR, `mirrordungeon-theme-floor-t${t}.json`))
    themeIdsByTier[t] = (data.list ?? []).map((item: any) => item.id as number)
    allThemeIds.push(...themeIdsByTier[t])
    for (const item of data.list ?? []) {
      for (const eid of [...(item.mapGenOption?.eventPool ?? []), ...(item.mapGenOption?.specialEventPool ?? [])]) {
        if (!eventToThemes.has(eid)) eventToThemes.set(eid, new Set())
        eventToThemes.get(eid)!.add(item.id)
      }
    }
  }

  // Hidden theme pack (optional)
  try {
    const hidden = loadJson(join(J2_DIR, 'mirrordungeon-theme-floor-hidden.json'))
    themeIdsByTier['hidden'] = (hidden.list ?? []).map((item: any) => item.id as number)
    allThemeIds.push(...themeIdsByTier['hidden'])
    for (const item of hidden.list ?? []) {
      for (const eid of [...(item.mapGenOption?.eventPool ?? []), ...(item.mapGenOption?.specialEventPool ?? [])]) {
        if (!eventToThemes.has(eid)) eventToThemes.set(eid, new Set())
        eventToThemes.get(eid)!.add(item.id)
      }
    }
  } catch { /* hidden pack may not exist */ }

  // ── 4. Build nodepool event → theme mapping ────────────────────────────────

  // dungeonId → theme IDs
  const dungeonIdToThemes: Record<number, number[]> = {
    1: [...themeIdsByTier[1]],
    2: [...themeIdsByTier[1], ...themeIdsByTier[2], ...themeIdsByTier[3], ...themeIdsByTier[4], ...themeIdsByTier[5]],
    3: [...(themeIdsByTier[6] ?? []), ...(themeIdsByTier['hidden'] ?? [])],  // extreme + hidden only
    // Special dungeons
    910301: [1101], 910302: [1101],           // 헬스치킨
    910701: [1104], 911501: [1104, 1116],     // 육참골단 / BokGak
    910901: [1105], 911801: [1105, 1120],     // 시간살인시간 / BokGak
  }

  const eventToDungeonIds = new Map<number, Set<number>>()
  for (const fname of readdirSync(J2_DIR).sort()) {
    if (!fname.includes('generatenodepool-event') || !fname.endsWith('.json')) continue
    // Also pick up special dungeon nodepools (hells-chicken, tkt, ycgd)
    try {
      const data = loadJson(join(J2_DIR, fname))
      for (const item of data.list ?? []) {
        const did: number = item.dungeonId
        for (const eid of item.dungeonEventList ?? []) {
          if (!eventToDungeonIds.has(eid)) eventToDungeonIds.set(eid, new Set())
          eventToDungeonIds.get(eid)!.add(did)
        }
      }
    } catch { /* skip unreadable files */ }
  }

  const nodepoolEventThemes = new Map<number, number[]>()
  for (const [eid, dids] of eventToDungeonIds) {
    const themes = new Set<number>()
    for (const did of dids) {
      const mapped = dungeonIdToThemes[did]
      if (mapped) mapped.forEach(t => themes.add(t))
    }
    if (themes.size > 0) nodepoolEventThemes.set(eid, [...themes])
  }

  console.log(`  nodepool 자동 매핑: ${nodepoolEventThemes.size}개 이벤트`)

  const acquirableGifts = loadAcquirableGifts()
  console.log(`  획득가능 기프트 매핑: ${acquirableGifts.size}개 이벤트`)

  // ── 5. Identify child events (have a parent that references them via nextEventID) ──

  const childEventIds = new Set<number>()
  for (const ev of allGameEvents.values()) {
    const ae = ev.actionEvent ?? ev.personalityEvent ?? {}
    for (const opt of ae.eachOptionList ?? []) {
      for (const r of opt.resultList ?? []) {
        const nextId: number = r.nextEventID ?? -1
        if (nextId > 0) childEventIds.add(nextId)
      }
    }
    // personality events embed nextEventID inside eventResults
    for (const er of (ev.personalityEvent?.eventResults ?? [])) {
      for (const rd of er.eventResultDataList ?? []) {
        const nextId: number = rd.nextEventID ?? -1
        if (nextId > 0) childEventIds.add(nextId)
      }
    }
  }

  // ── 6. Determine root events: appear in nodepool/eventPool and are NOT children ──

  const nodepoolEventIds = new Set<number>()
  for (const eid of eventToDungeonIds.keys()) nodepoolEventIds.add(eid)
  for (const eid of eventToThemes.keys()) nodepoolEventIds.add(eid)

  // Include all game events that are referenced in nodepool (regardless of KR text)
  const rootEventIds = new Set<number>()
  for (const eid of allGameEvents.keys()) {
    // Root = in nodepool OR in eventPool, AND not a child of another event
    const inPool = nodepoolEventIds.has(eid) || eventToThemes.has(eid)
    // Also include events that have KR text and aren't pure children
    const hasKr  = krTexts.has(eid)
    if ((inPool || hasKr) && !childEventIds.has(eid)) {
      rootEventIds.add(eid)
    }
  }

  console.log(`  루트 이벤트: ${rootEventIds.size}개`)

  // ── 7. Build DB rows ────────────────────────────────────────────────────────

  const rows: EventRow[] = []
  let validationErrors = 0

  for (const eid of rootEventIds) {
    const gameEvent = allGameEvents.get(eid)
    if (!gameEvent) continue

    const kr     = krTexts.get(eid)
    const isPersonality = Boolean(gameEvent.personalityEvent)

    // Build option tree (with embedded next_event)
    const options: Option[] = isPersonality
      ? buildPersonalityOptions(gameEvent, krTexts)
      : buildOptionTree(gameEvent, krTexts, allGameEvents)

    // Extract all gift IDs from this event tree
    const rawGifts = extractGiftIds(gameEvent)
    // Merge acquirable-egogifts mapping (pools where player can choose/get random gifts)
    const acquirable = acquirableGifts.get(eid)
    if (acquirable) {
      for (const gid of acquirable) rawGifts.push(gid)
    }
    const giftIds = rawGifts.length > 0 ? [...new Set(rawGifts)] : null

    // Theme ID resolution:
    // 1. Direct mapping from theme floor eventPool/specialEventPool (most accurate)
    // 2. Fallback: nodepool mapping ONLY if no direct mapping exists
    //    (nodepool dungeonId is too broad — assigns dozens of themes)
    // 3. Skip SOURCE_TO_THEMES entirely (assigns allThemeIds)
    let themeIds: number[] | null = null
    if (eventToThemes.has(eid)) {
      themeIds = [...eventToThemes.get(eid)!]
    } else if (nodepoolEventThemes.has(eid)) {
      themeIds = nodepoolEventThemes.get(eid)!
    }

    const row: EventRow = {
      id:        eid,
      name:      kr?.name ?? null,
      desc_text: kr?.desc ?? null,
      options:   options.length > 0 ? options : null,
      gift_ids:  giftIds,
      source:    kr?.source ?? null,
      image_url: null, // preserved from DB in --fix mode
      theme_ids: themeIds && themeIds.length > 0 ? themeIds : null,
    }

    // Zod validation
    const parsed = EventRowSchema.safeParse(row)
    if (!parsed.success) {
      validationErrors++
      if (VERBOSE) {
        console.warn(`  [warn] validation failed for event ${eid}:`, parsed.error.issues)
      }
      continue
    }

    rows.push(parsed.data)

    if (VERBOSE) {
      console.log(`  [${rows.length}] id=${eid} name=${kr?.name ?? '(없음)'} options=${options.length} gifts=${giftIds?.length ?? 0} themes=${themeIds?.length ?? 0}`)
    }
  }

  // Stats
  const withThemes = rows.filter(r => r.theme_ids).length
  const withGifts  = rows.filter(r => r.gift_ids).length
  const withOpts   = rows.filter(r => r.options).length

  console.log(`\n  루트 이벤트: ${rows.length}개 (하위 이벤트 내장)`)
  console.log(`  테마팩 연결: ${withThemes}개`)
  console.log(`  기프트 연결: ${withGifts}개`)
  console.log(`  선택지 보유: ${withOpts}개`)
  if (validationErrors > 0) {
    console.warn(`  [warn] Zod 유효성 오류: ${validationErrors}개 이벤트 제외됨`)
  }

  // ── 8. DB upsert (--fix only) ───────────────────────────────────────────────

  if (!FIX) {
    console.log('\n  --dry-run 모드. DB 수정 없음. --fix 옵션으로 실행하세요.')
    return
  }

  console.log('\n  DB 업데이트...')

  // Step 1: Preserve existing image_urls
  const { data: existingRows, error: fetchErr } = await supabase
    .schema('limbus')
    .from('mirror_dungeon_events')
    .select('id, image_url')

  if (fetchErr) {
    console.error('  기존 데이터 조회 실패:', fetchErr.message)
    process.exit(1)
  }

  const existingImageMap = new Map<number, string>()
  for (const r of existingRows ?? []) {
    if (r.image_url) existingImageMap.set(Number(r.id), r.image_url as string)
  }
  console.log(`  기존 image_url 보존: ${existingImageMap.size}개`)

  // Apply preserved image_urls to rows
  for (const r of rows) {
    r.image_url = existingImageMap.get(r.id) ?? null
  }

  // Step 2: Delete all existing rows (clean sync — no FK constraints since no parent_id)
  const { error: delErr } = await supabase
    .schema('limbus')
    .from('mirror_dungeon_events')
    .delete()
    .not('id', 'is', null)

  if (delErr) {
    console.error('  삭제 실패:', delErr.message)
    process.exit(1)
  }
  console.log(`  기존 데이터 삭제 완료`)

  // Step 3: Insert in batches of 50
  const BATCH = 50
  let inserted = 0
  let failed   = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase
      .schema('limbus')
      .from('mirror_dungeon_events')
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      console.error(`  삽입 배치 ${i}~${i + batch.length - 1} 실패: ${error.message}`)
      failed += batch.length
    } else {
      inserted += batch.length
      if (VERBOSE) console.log(`  삽입 ${i + 1}~${i + batch.length} 완료`)
      else process.stdout.write(`\r  삽입 중... ${i + batch.length}/${rows.length}`)
    }
  }
  if (!VERBOSE) console.log() // newline after progress

  // Step 4: Remap event gift_ids to DB game_ids (event IDs vs DB IDs may differ)
  console.log('\n  이벤트 gift_id → DB game_id 치환...')

  const { data: allDbGifts } = await supabase
    .schema('limbus')
    .from('ego_gifts')
    .select('name, game_id')
    .not('game_id', 'is', null)

  const giftNameToDbId = new Map<string, number>()
  const dbGameIds      = new Set<number>()
  for (const g of allDbGifts ?? []) {
    if (g.name)    giftNameToDbId.set(g.name, Number(g.game_id))
    if (g.game_id) dbGameIds.add(Number(g.game_id))
  }

  // Load KR gift name → id mapping from event gift files
  const eventGiftIdToName = new Map<number, string>()
  for (const fname of readdirSync(KR_DIR)) {
    if (!fname.startsWith('KR_EGOgift') || !fname.endsWith('.json')) continue
    try {
      const data = loadJson(join(KR_DIR, fname))
      for (const item of data.dataList ?? []) {
        if (item.id && item.name) eventGiftIdToName.set(item.id as number, item.name as string)
      }
    } catch { /* skip */ }
  }

  // Build remap: event gift_id → DB game_id
  const giftIdRemap = new Map<number, number>()
  const allEventGiftIds = new Set<number>()
  for (const r of rows) {
    for (const gid of r.gift_ids ?? []) allEventGiftIds.add(gid)
  }
  for (const eid of allEventGiftIds) {
    if (dbGameIds.has(eid)) continue
    const name = eventGiftIdToName.get(eid)
    if (name && giftNameToDbId.has(name)) {
      giftIdRemap.set(eid, giftNameToDbId.get(name)!)
    }
  }

  if (giftIdRemap.size > 0) {
    console.log(`  gift_id 치환 매핑: ${giftIdRemap.size}개`)
    let remapped = 0
    for (const r of rows) {
      if (!r.gift_ids) continue
      const original = r.gift_ids.slice()
      r.gift_ids = r.gift_ids.map(gid => giftIdRemap.get(gid) ?? gid)
      const changed = r.gift_ids.some((g, i) => g !== original[i])
      if (changed) {
        remapped++
        await supabase
          .schema('limbus')
          .from('mirror_dungeon_events')
          .update({ gift_ids: r.gift_ids })
          .eq('id', r.id)
      }
    }
    console.log(`  ${remapped}개 이벤트 gift_id 치환 완료`)
  } else {
    console.log('  gift_id 치환 필요 없음')
  }

  console.log(`\n  동기화 완료! (삽입: ${inserted}, 실패: ${failed}, 유효성 오류: ${validationErrors})`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
