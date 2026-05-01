#!/usr/bin/env tsx
/**
 * Derive identity acquisition metadata from game client JSON.
 *
 * Source roles:
 * - personality-*.txt: rank, season, and coarse additionalAttachment.
 * - *-event.txt eventRewardDatas: event exchange/reward identities.
 * - gacha-*.txt banner pickup IDs: extraction/release pickup identities.
 * - KR_Items*.txt: event currency names.
 *
 * Usage:
 *   npx tsx scripts/sync/identity-acquisition.ts --dry-run
 *   npx tsx scripts/sync/identity-acquisition.ts --id 10715 --fix
 *   npx tsx scripts/sync/identity-acquisition.ts --sinner heathcliff --fix
 *   npx tsx scripts/sync/identity-acquisition.ts --all --fix
 *   npx tsx scripts/sync/identity-acquisition.ts --dry-run --rewrite-text
 *   npx tsx scripts/sync/identity-acquisition.ts --dry-run --no-enrich-gacha
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'
import { triggerRevalidation } from './_revalidate'

config({ path: '.env.local' })

type AcquisitionType = 'default' | 'standard' | 'event' | 'limited' | 'walpurgis' | 'attendance'
type GachaType = 'always' | 'seasonal' | 'walpurgis' | 'none' | 'pickup'

interface AcquisitionInfo {
  type: AcquisitionType
  release_season: number
  fragment_cost: number | null
  gacha: GachaType
  gacha_from_season?: number
  target_sinner?: string
  gacha_id?: number
  gacha_name?: string
  gacha_name_en?: string
  gacha_name_jp?: string
  exchange_from_season?: number
  walpurgis_edition?: number
  event_name?: string
  event_currency?: string
  event_cost?: number
}

interface DerivedAcquisition {
  acquisition: string
  acquisition_info: AcquisitionInfo
  evidence: string[]
  rewrite_acquisition?: boolean
}

interface DbIdentity {
  id: string
  game_id: string
  sinner_id: string | null
  name_kr: string | null
  rarity: number | null
  acquisition: string | null
  acquisition_info: AcquisitionInfo | null
}

export interface IdentityAcquisitionSyncOptions {
  fix?: boolean
  all?: boolean
  verbose?: boolean
  rewriteText?: boolean
  enrichGacha?: boolean
  ids?: string[]
  sinnerIds?: string[]
  revalidate?: boolean
}

export interface IdentityAcquisitionSyncResult {
  changed: number
  applied: number
}

interface Personality {
  id: number
  rank: number
  season: number | null
  updatedDate: number | null
  additionalAttachment?: string
  walpurgisType?: string
}

interface EventRewardHit {
  file: string
  startDate: string | null
  eventName: string | null
  currencyName: string | null
  eventCost: number | null
}

interface GachaPickupHit {
  file: string
  gachaId: number | null
  bannerType: string | null
  walpurgisType: string | null
  category: string | null
  festival: boolean
  startDate: string | null
  endDate: string | null
  gachaName: string | null
  gachaNameEn: string | null
  gachaNameJp: string | null
}

type JsonRecord = Record<string, unknown>

const DATA_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/Json (Text)'))
const KR_DIR = join(DATA_DIR, 'KR')
const PERSONALITY_FILE_RE = /^personality-(?:\d{2}|a\d+c\d+p\d+)\.txt$/i
const GACHA_FILE_RE = /^gacha-\d+\.txt$/i

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) as unknown
}

function extractList(data: unknown): JsonRecord[] {
  if (Array.isArray(data)) return data.map(asRecord).filter((item): item is JsonRecord => item !== null)
  const record = asRecord(data)
  if (!record) return []
  if (Array.isArray(record.eventRewardDatas)) return [record]
  const list = Array.isArray(record.list) ? record.list : record.dataList
  return asArray(list).map(asRecord).filter((item): item is JsonRecord => item !== null)
}

function listFiles(dir: string, pattern: RegExp): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(file => pattern.test(file)).sort()
}

function loadPersonalities(): Map<string, Personality> {
  const map = new Map<string, Personality>()
  for (const file of listFiles(DATA_DIR, PERSONALITY_FILE_RE)) {
    for (const item of extractList(readJson(join(DATA_DIR, file)))) {
      const id = asNumber(item.id)
      const rank = asNumber(item.rank)
      const season = asNumber(item.season)
      if (id == null || rank == null) continue
      map.set(String(id), {
        id,
        rank,
        season,
        updatedDate: asNumber(item.updatedDate),
        additionalAttachment: asString(item.additionalAttachment) ?? undefined,
        walpurgisType: asString(item.walpurgisType) ?? undefined,
      })
    }
  }
  return map
}

function loadItemNames(): Map<number, string> {
  const map = new Map<number, string>()
  for (const file of listFiles(KR_DIR, /^KR_Items.*\.txt$/i)) {
    for (const item of extractList(readJson(join(KR_DIR, file)))) {
      const id = asNumber(item.id)
      const name = asString(item.name)
      if (id != null && name) map.set(id, name)
    }
  }
  return map
}

function loadGachaTitles(): {
  ko: Map<number, string>
  en: Map<number, string>
  jp: Map<number, string>
} {
  const readTitleMap = (lang: 'KR' | 'EN' | 'JP', latestDir: string, fallbackDir: string) => {
    const map = new Map<number, string>()
    for (const { dir, ext } of [
      { dir: fallbackDir, ext: '.txt' },
      { dir: latestDir, ext: '.json' },
    ]) {
      if (!existsSync(dir)) continue
      for (const file of listFiles(dir, new RegExp(`^${lang}_GachaTitle.*\\${ext}$`, 'i'))) {
        for (const item of extractList(readJson(join(dir, file)))) {
          const rawId = asString(item.id) ?? asNumber(item.id)
          const id = rawId == null ? NaN : Number(rawId)
          const content = asString(item.content)
          if (Number.isFinite(id) && content) map.set(id, content)
        }
      }
    }
    return map
  }

  return {
    ko: readTitleMap('KR', resolve(join(homedir(), 'Documents/Limbus/assets/data/kr')), join(DATA_DIR, 'KR')),
    en: readTitleMap('EN', resolve(join(homedir(), 'Documents/Limbus/assets/data/en')), join(DATA_DIR, 'EN')),
    jp: readTitleMap('JP', resolve(join(homedir(), 'Documents/Limbus/assets/data/jp')), join(DATA_DIR, 'JP')),
  }
}

function inferEventName(file: string): string | null {
  const normalized = file.replace(/-returns-event\.txt$/i, '-event.txt')
  const names: Record<string, string> = {
    'tkt-event.txt': '시간살인시간',
    'twining-threads-event.txt': '사영 전투',
    'night-clean-up-event.txt': '심야청소 BokGak',
    'night-cleanup-returns-event.txt': '심야청소 BokGak',
    'hells-chicken-event.txt': '헬스 치킨',
    'umida-event.txt': '우.미.다',
    'mowe-event.txt': '워프특급 살인사건',
    'mowe-returns-event.txt': '워프특급 살인사건',
    'miracleofdistrict20-event.txt': '20번구의 기적',
    'miracleofdistrict20-returns-event.txt': '20번구의 기적',
    'ycgd-event.txt': '육참골단',
    'ycgd-returns-event.txt': '육참골단',
    'lcbcheckup-event.txt': 'LCB 정기검진',
    'lcbcheckup-returns-event.txt': 'LCB 정기검진',
    'cultivation-event.txt': '절차탁춘',
    'pilgrimage-event.txt': '선의의 순례',
  }
  return names[file] ?? names[normalized] ?? null
}

function loadEventRewardHits(itemNames: Map<number, string>): Map<string, EventRewardHit> {
  const map = new Map<string, EventRewardHit>()
  for (const file of listFiles(DATA_DIR, /event.*\.txt$/i)) {
    const list = extractList(readJson(join(DATA_DIR, file)))
    for (const event of list) {
      const rewards = asArray(event.eventRewardDatas)
      if (rewards.length === 0) continue
      for (const rawReward of rewards) {
        const reward = asRecord(rawReward)
        if (!reward) continue
        const rewardPrice = asRecord(reward.rewardPrice)
        const currencyId = asNumber(rewardPrice?.id)
        const eventCost = asNumber(rewardPrice?.num)
        for (const rawItem of asArray(reward.rewardItemList)) {
          const item = asRecord(rawItem)
          const type = asString(item?.type)
          const id = asNumber(item?.id)
          if (type !== 'PERSONALITY' || id == null) continue
          const hit: EventRewardHit = {
            file,
            startDate: asString(event.startDate),
            eventName: inferEventName(file),
            currencyName: currencyId != null ? itemNames.get(currencyId) ?? null : null,
            eventCost,
          }
          const key = String(id)
          const previous = map.get(key)
          if (!previous || (hit.startDate && previous.startDate && hit.startDate < previous.startDate)) {
            map.set(key, hit)
          } else if (!previous) {
            map.set(key, hit)
          }
        }
      }
    }
  }
  return map
}

function loadGachaPickupHits(gachaTitles: ReturnType<typeof loadGachaTitles>): Map<string, GachaPickupHit[]> {
  const map = new Map<string, GachaPickupHit[]>()
  for (const file of listFiles(DATA_DIR, GACHA_FILE_RE)) {
    const list = extractList(readJson(join(DATA_DIR, file)))
    for (const entry of list) {
      const banner = asRecord(entry.bannerInfo)
      const ids = new Set<number>()
      for (const id of asArray(banner?.pickupIdList)) {
        const numericId = asNumber(id)
        if (numericId != null) ids.add(numericId)
      }

      for (const id of ids) {
        const key = String(id)
        const gachaId = asNumber(entry.id)
        const hit: GachaPickupHit = {
          file,
          gachaId,
          bannerType: asString(banner?.bannerType),
          walpurgisType: asString(banner?.walpurgisType),
          category: asString(entry.category),
          festival: banner?.festival === true,
          startDate: asString(entry.startDate),
          endDate: asString(entry.endDate),
          gachaName: gachaId != null ? gachaTitles.ko.get(gachaId) ?? null : null,
          gachaNameEn: gachaId != null ? gachaTitles.en.get(gachaId) ?? null : null,
          gachaNameJp: gachaId != null ? gachaTitles.jp.get(gachaId) ?? null : null,
        }
        const current = map.get(key) ?? []
        current.push(hit)
        map.set(key, current)
      }
    }
  }
  return map
}

function gachaFields(identity: DbIdentity, hit: GachaPickupHit | null, enrichGacha: boolean): Partial<AcquisitionInfo> {
  if (!hit) return {}
  const existing = identity.acquisition_info
  const shouldInclude = enrichGacha
    || existing == null
    || existing.gacha_id != null
    || existing.gacha_name != null
    || existing.gacha_name_en != null
    || existing.gacha_name_jp != null
  if (!shouldInclude) return {}
  return {
    ...(hit.gachaId != null ? { gacha_id: hit.gachaId } : {}),
    ...(hit.gachaName ? { gacha_name: hit.gachaName } : {}),
    ...(hit.gachaNameEn ? { gacha_name_en: hit.gachaNameEn } : {}),
    ...(hit.gachaNameJp ? { gacha_name_jp: hit.gachaNameJp } : {}),
  }
}

function fragmentCost(rank: number): number | null {
  if (rank === 2) return 150
  if (rank === 3) return 400
  return null
}

function exchangeSeason(season: number): number | undefined {
  return season > 0 ? season + 2 : undefined
}

function pickReleasePickup(hits: GachaPickupHit[] | undefined): GachaPickupHit | null {
  if (!hits || hits.length === 0) return null
  const newMain = hits.filter(hit => hit.category === 'TARGET_NEW' && hit.bannerType === 'TEMPORARY_MAIN')
  const temporaryMain = hits.filter(hit => hit.bannerType === 'TEMPORARY_MAIN')
  const candidates = newMain.length > 0 ? newMain : temporaryMain.length > 0 ? temporaryMain : hits
  return [...candidates].sort((a, b) => {
    const aDate = a.startDate ?? a.endDate ?? ''
    const bDate = b.startDate ?? b.endDate ?? ''
    if (aDate !== bDate) return bDate.localeCompare(aDate)
    return (b.gachaId ?? 0) - (a.gachaId ?? 0)
  })[0] ?? null
}

function existingExchangeOverride(identity: DbIdentity): Partial<AcquisitionInfo> {
  return identity.acquisition_info?.exchange_from_season != null
    ? { exchange_from_season: identity.acquisition_info.exchange_from_season }
    : {}
}

function existingEventFields(identity: DbIdentity): Partial<AcquisitionInfo> {
  const existing = identity.acquisition_info
  if (!existing) return {}
  return {
    ...(existing.event_name ? { event_name: existing.event_name } : {}),
    ...(existing.event_currency ? { event_currency: existing.event_currency } : {}),
    ...(existing.event_cost != null ? { event_cost: existing.event_cost } : {}),
  }
}

function releaseSeason(identity: DbIdentity, personality: Personality, rank: number): number {
  if (rank === 1) return 0
  const existing = identity.acquisition_info?.release_season
  const sourceSeason = personality.season ?? 0
  if (existing && existing > 0) return existing
  if (sourceSeason >= 9000) return 0
  if (sourceSeason === 0) return 1
  return sourceSeason
}

function walpurgisEdition(identity: DbIdentity, hit: GachaPickupHit | null): number | undefined {
  const existing = identity.acquisition_info?.walpurgis_edition
  if (existing != null) return existing
  const textMatch = identity.acquisition?.match(/(\d+)\s*회차/)
  if (textMatch) return Number(textMatch[1])
  const titleMatch = hit?.gachaName?.match(/제\s*(\d+)\s*회/)
  return titleMatch ? Number(titleMatch[1]) : undefined
}

function isWalpurgis(personality: Personality, releasePickup: GachaPickupHit | null): boolean {
  return Boolean(
    personality.walpurgisType
      || (personality.season ?? 0) >= 9000
      || releasePickup?.walpurgisType
      || releasePickup?.festival,
  )
}

function deriveAcquisition(
  identity: DbIdentity,
  personality: Personality,
  eventRewards: Map<string, EventRewardHit>,
  gachaPickups: Map<string, GachaPickupHit[]>,
  enrichGacha: boolean,
): DerivedAcquisition {
  const gameId = identity.game_id
  const rank = identity.rarity ?? personality.rank
  const cost = fragmentCost(rank)
  const sourceSeason = personality.season
  const season = releaseSeason(identity, personality, rank)
  const existing = identity.acquisition_info
  const reward = eventRewards.get(gameId)
  const releasePickup = pickReleasePickup(gachaPickups.get(gameId))
  const evidence: string[] = [
    `personality: season=${sourceSeason}, releaseSeason=${season}, rank=${rank}, additionalAttachment=${personality.additionalAttachment ?? 'none'}`,
  ]
  if (reward) evidence.push(`event reward: ${reward.file}`)
  if (releasePickup) {
    evidence.push(`gacha pickup: ${releasePickup.file} type=${releasePickup.bannerType ?? 'unknown'}${releasePickup.walpurgisType ? ` walpurgis=${releasePickup.walpurgisType}` : ''}`)
  }

  if (rank === 1) {
    return {
      acquisition: '기본',
      acquisition_info: { type: 'default', release_season: 0, fragment_cost: null, gacha: 'none' },
      evidence,
    }
  }

  if (isWalpurgis(personality, releasePickup)) {
    const edition = walpurgisEdition(identity, releasePickup)
    return {
      acquisition: `발푸르기스의 밤 기간 내 추출 / 발푸르기스의 밤 기간 내 자아 파편 ${cost} 교환`,
      acquisition_info: {
        type: 'walpurgis',
        release_season: season,
        fragment_cost: cost,
        gacha: 'walpurgis',
        ...gachaFields(identity, releasePickup, enrichGacha),
        ...(edition ? { walpurgis_edition: edition } : {}),
      },
      evidence,
    }
  }

  if (reward) {
    const eventName = existing?.event_name ?? reward.eventName
    const eventCurrency = existing?.event_currency ?? reward.currencyName
    const eventCost = existing?.event_cost ?? reward.eventCost
    const info: AcquisitionInfo = {
      type: existing?.type === 'attendance' ? 'attendance' : 'event',
      release_season: season,
      fragment_cost: cost,
      gacha: 'none',
      ...existingExchangeOverride(identity),
      ...(eventName ? { event_name: eventName } : {}),
      ...(eventCurrency ? { event_currency: eventCurrency } : {}),
      ...(eventCost != null ? { event_cost: eventCost } : {}),
    }
    const eventPrefix = reward.eventName ? `${reward.eventName} ` : ''
    const rewardText = reward.currencyName && reward.eventCost
      ? `${eventPrefix}이벤트 ${reward.currencyName} ${reward.eventCost}개 교환`
      : `${eventPrefix}이벤트 교환 보상`
    const exSeason = existing?.exchange_from_season ?? exchangeSeason(season)
    const shardText = cost && exSeason ? ` / 자아 파편 ${cost} 교환(시즌 ${exSeason} 이후)` : ''
    return {
      acquisition: `${rewardText}${shardText}`,
      acquisition_info: info,
      evidence,
      rewrite_acquisition: Boolean(reward.currencyName && reward.eventCost),
    }
  }

  if (personality.additionalAttachment === 'EVENT') {
    const exSeason = existing?.exchange_from_season ?? exchangeSeason(season)
    const gacha = existing?.gacha && existing.gacha !== 'none' ? existing.gacha : releasePickup ? 'pickup' : 'none'
    return {
      acquisition: `${releasePickup?.gachaName ?? `이벤트 한정 추출(시즌 ${season})`} / 자아 파편 ${cost} 교환(시즌 ${season}${exSeason ? `, 시즌 ${exSeason} 이후` : ''})`,
      acquisition_info: {
        type: 'limited',
        release_season: season,
        fragment_cost: cost,
        gacha,
        ...(existing?.gacha_from_season != null
          ? { gacha_from_season: existing.gacha_from_season }
          : existing == null && (gacha === 'seasonal' || gacha === 'pickup')
            ? { gacha_from_season: season }
            : {}),
        ...(existing?.target_sinner ? { target_sinner: existing.target_sinner } : {}),
        ...existingEventFields(identity),
        ...(gacha !== 'none' ? gachaFields(identity, releasePickup, enrichGacha) : {}),
        ...existingExchangeOverride(identity),
      },
      evidence,
    }
  }

  if (season > 0) {
    const exSeason = existing?.exchange_from_season ?? exchangeSeason(season)
    const gacha = existing?.gacha ?? 'seasonal'
    return {
      acquisition: `${releasePickup?.gachaName ?? `추출(시즌 ${season} 이후)`} / 자아 파편 ${cost} 교환(시즌 ${season}${exSeason ? `, 시즌 ${exSeason} 이후` : ''})`,
      acquisition_info: {
        type: 'standard',
        release_season: season,
        fragment_cost: cost,
        gacha,
        ...(existing?.gacha_from_season != null
          ? { gacha_from_season: existing.gacha_from_season }
          : existing == null && (gacha === 'seasonal' || gacha === 'pickup')
            ? { gacha_from_season: season }
            : {}),
        ...(existing?.target_sinner ? { target_sinner: existing.target_sinner } : {}),
        ...existingEventFields(identity),
        ...gachaFields(identity, releasePickup, enrichGacha),
        ...existingExchangeOverride(identity),
      },
      evidence,
    }
  }

  return {
    acquisition: `추출(상시) / 자아 파편 ${cost} 교환(상시)`,
    acquisition_info: {
      type: 'standard',
      release_season: season,
      fragment_cost: cost,
      gacha: 'always',
      ...existingEventFields(identity),
      ...existingExchangeOverride(identity),
    },
    evidence,
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const record = asRecord(value)
  if (!record) return JSON.stringify(value)
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`
}

function sameInfo(left: AcquisitionInfo | null, right: AcquisitionInfo): boolean {
  return stable(left) === stable(right)
}

function parseIdentityAcquisitionArgs(args = process.argv.slice(2)): IdentityAcquisitionSyncOptions {
  const idArgIndex = args.indexOf('--id')
  const sinnerArgIndex = args.indexOf('--sinner')
  return {
    fix: args.includes('--fix'),
    all: args.includes('--all'),
    verbose: args.includes('--verbose'),
    rewriteText: args.includes('--rewrite-text'),
    enrichGacha: !args.includes('--no-enrich-gacha'),
    ids: idArgIndex >= 0 && args[idArgIndex + 1]
      ? args[idArgIndex + 1].split(',').map(id => id.trim()).filter(Boolean)
      : [],
    sinnerIds: sinnerArgIndex >= 0 && args[sinnerArgIndex + 1]
      ? args[sinnerArgIndex + 1].split(',').map(id => id.trim()).filter(Boolean)
      : [],
  }
}

export async function syncIdentityAcquisition(
  options: IdentityAcquisitionSyncOptions = {},
): Promise<IdentityAcquisitionSyncResult> {
  const fix = options.fix === true
  const dryRun = !fix
  const all = options.all === true
  const verbose = options.verbose === true
  const rewriteText = options.rewriteText === true
  const enrichGacha = options.enrichGacha !== false
  const idFilter = new Set((options.ids ?? []).map(id => id.trim()).filter(Boolean))
  const sinnerFilter = new Set((options.sinnerIds ?? []).map(id => id.trim()).filter(Boolean))

  if (fix && idFilter.size === 0 && sinnerFilter.size === 0 && !all) {
    throw new Error('--fix without --id, --sinner, or --all is blocked to prevent accidental whole-table acquisition rewrites.')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY')
  }
  const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'limbus' } })

  const personalities = loadPersonalities()
  const itemNames = loadItemNames()
  const gachaTitles = loadGachaTitles()
  const eventRewards = loadEventRewardHits(itemNames)
  const gachaPickups = loadGachaPickupHits(gachaTitles)

  let query = supabase
    .from('identities')
    .select('id, game_id, sinner_id, name_kr, rarity, acquisition, acquisition_info')
    .order('game_id')
  if (idFilter.size > 0) query = query.in('game_id', [...idFilter])
  if (sinnerFilter.size > 0) query = query.in('sinner_id', [...sinnerFilter])

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as DbIdentity[]

  let changed = 0
  let applied = 0
  for (const identity of rows) {
    const personality = personalities.get(identity.game_id)
    if (!personality) {
      console.warn(`[skip] ${identity.game_id} ${identity.name_kr ?? ''}: personality source not found`)
      continue
    }

    const derived = deriveAcquisition(identity, personality, eventRewards, gachaPickups, enrichGacha)
    const desiredAcquisition = rewriteText || derived.rewrite_acquisition || !identity.acquisition ? derived.acquisition : identity.acquisition
    const differs = identity.acquisition !== desiredAcquisition || !sameInfo(identity.acquisition_info, derived.acquisition_info)
    if (!differs) continue
    changed++

    console.log(`[diff] ${identity.game_id} ${identity.name_kr ?? ''}`)
    console.log(`  acquisition: ${identity.acquisition ?? '(null)'}`)
    console.log(`           -> ${desiredAcquisition}`)
    console.log(`  info: ${stable(identity.acquisition_info)}`)
    console.log(`    -> ${stable(derived.acquisition_info)}`)
    if (verbose) {
      for (const item of derived.evidence) console.log(`  evidence: ${item}`)
    }

    if (fix) {
      const { error: updateError } = await supabase
        .from('identities')
        .update({
          acquisition: desiredAcquisition,
          acquisition_info: derived.acquisition_info,
        })
        .eq('id', identity.id)
      if (updateError) throw updateError
      applied++
    }
  }

  console.log(dryRun ? `[dry-run] changed candidates: ${changed}` : `[fix] applied: ${applied}`)
  if (fix && applied > 0 && options.revalidate !== false) await triggerRevalidation({ scope: 'all-game-data' })
  return { changed, applied }
}

async function main() {
  await syncIdentityAcquisition(parseIdentityAcquisitionArgs())
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
