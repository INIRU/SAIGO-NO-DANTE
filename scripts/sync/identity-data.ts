#!/usr/bin/env tsx
/**
 * identity-data.ts
 * 게임 클라이언트 JSON → DB 인격/스킬/패시브 동기화 (TypeScript + Zod)
 *
 * Usage:
 *   npx tsx scripts/sync/identity-data.ts [options]
 *
 * Options:
 *   --dry-run          비교만, DB 수정 안 함 (기본값)
 *   --fix              DB에 변경/삽입 반영
 *   --sinner <slug>    특정 수감자만 처리 (e.g. --sinner yi-sang)
 *   --verbose          상세 로그 출력
 *   --new-only         신규 인격만 표시/처리 (기존 비교 스킵)
 *   --ego-only         EGO 스킬/패시브 로케일만 처리
 *   --no-acquisition   인격 획득 경로 동기화 스킵
 *   --keywords         기존 인격 keywords 필드도 업데이트 (기본적으로 protected)
 *
 * ⚠️ keyword_meta upsert 경로는 공통/Common/None/공용 placeholder를 반드시 필터링해야 함
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { pathToFileURL } from 'url'
import { z } from 'zod'
import { config } from 'dotenv'

config({ path: '.env.local' })

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const sinnerIdx = args.indexOf('--sinner')
const SINNER_FILTER = sinnerIdx !== -1 ? args[sinnerIdx + 1] : null
const FIX = args.includes('--fix')
const DRY_RUN = !FIX
const VERBOSE = args.includes('--verbose')
const NEW_ONLY = args.includes('--new-only')
const EGO_ONLY = args.includes('--ego-only')
const SKIP_ACQUISITION = args.includes('--no-acquisition')
const REWRITE_ACQUISITION_TEXT = args.includes('--rewrite-acquisition-text')
const ENRICH_ACQUISITION_GACHA = !args.includes('--no-enrich-gacha')
const UPDATE_KEYWORDS = args.includes('--keywords')
const REBUILD_KEYWORD_META = args.includes('--rebuild-keyword-meta')
const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false

// 실제 키워드가 아닌 placeholder 값들 — ego_gifts.keyword 기본값으로 쓰임
// DB 스키마는 nullable이 아니라 '공통'이 기본값으로 들어가므로, keyword_meta 재구축 시 반드시 필터링
const KEYWORD_PLACEHOLDERS = new Set(['공통', 'Common', 'None', '공용', ''])
const KEYWORD_ICON_SLUG_OVERRIDES: Record<string, string> = {
  '참격': 'stat:slash',
  '관통': 'stat:pierce',
  '타격': 'stat:blunt',
  '중지의 복수 대상': 'middle-finger-grudge',
  '지령 탐닉': 'directive-indulgence',
  '아이언 메이든': 'iron-maiden',
  '원호 공격': 'assist-attack',
  '원호 방어': 'assist-defense',
}
const KEYWORD_DESCRIPTION_OVERRIDES: Record<string, string> = {
  '원호 공격': '- 이 효과를 부여한 대상의 공격 스킬 종료 시, 부여 대상이 공격한 적을 스킬 1로 일방 공격 함.\n- 원호 공격 시 해당 캐릭터의 사용할 스킬 목록에 영향을 주지 않음.',
  '원호 방어': '- 최댓값 : 3\n- 아군이 적에게 일방공격 당할 때, 수치를 1 소모하여 적의 공격 대상을 자신으로 변경하고, 원호 방어 전용 스킬 사용\n- 원호 방어를 보유한 아군이 여러 명이면, 가장 높은 수치를 가진 아군이 우선 발동\n- 수비 스킬을 장착한 아군에게는 발동하지 않음\n- 턴 종료시 소멸',
}

// ── Data dirs ─────────────────────────────────────────────────────────────────
const DATA_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/Json (Text)'))
const KR_DIR = join(DATA_DIR, 'KR')
const KR_LATEST_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/kr'))
const EN_LATEST_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/en'))
const JP_LATEST_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/jp'))
const EN_DIR = join(DATA_DIR, 'EN')
const JP_DIR = join(DATA_DIR, 'JP')
const KR_PERSONALITY_VOICE_LATEST_DIR = join(KR_LATEST_DIR, 'PersonalityVoiceDlg')
const TRUE_EGO_FILE_RE = /^ego-(?:\d+|a\d+c\d+p\d+)\.txt$/i
const PERSONALITY_FILE_RE = /^personality-(?:\d{2}|a\d+c\d+p\d+)\.txt$/i
const PERSONALITY_SKILL_FILE_RE = /^personality-skill-(?:\d{2}|a\d+c\d+p\d+)\.txt$/i
const PERSONALITY_PASSIVE_FILE_RE = /^personality-passive-(?:\d{2}|a\d+c\d+p\d+)\.txt$/i

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if ((!supabaseUrl || !supabaseKey) && isDirectRun) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseKey ?? 'test-service-role-key',
  { db: { schema: 'limbus' } },
)

// ── ANSI color helpers ────────────────────────────────────────────────────────
const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`
const GRAY = (s: string) => `\x1b[90m${s}\x1b[0m`
const CYAN = (s: string) => `\x1b[36m${s}\x1b[0m`
const RED = (s: string) => `\x1b[31m${s}\x1b[0m`
const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`

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

// ── Constants ─────────────────────────────────────────────────────────────────
const SINNERS = [
  { id: 1, slug: 'yi-sang', name: 'Yi Sang' },
  { id: 2, slug: 'faust', name: 'Faust' },
  { id: 3, slug: 'don-quixote', name: 'Don Quixote' },
  { id: 4, slug: 'ryoshu', name: 'Ryoshu' },
  { id: 5, slug: 'meursault', name: 'Meursault' },
  { id: 6, slug: 'hong-lu', name: 'Hong Lu' },
  { id: 7, slug: 'heathcliff', name: 'Heathcliff' },
  { id: 8, slug: 'ishmael', name: 'Ishmael' },
  { id: 9, slug: 'rodion', name: 'Rodion' },
  { id: 10, slug: 'sinclair', name: 'Sinclair' },
  { id: 11, slug: 'outis', name: 'Outis' },
  { id: 12, slug: 'gregor', name: 'Gregor' },
] as const

const ATK_TYPE_MAP: Record<string, string> = { SLASH: 'slash', PENETRATE: 'pierce', HIT: 'blunt' }
const DEF_TYPE_MAP: Record<string, string> = { GUARD: 'defense', EVADE: 'evade', COUNTER: 'counter' }
const SIN_MAP: Record<string, string> = {
  CRIMSON: 'wrath', SCARLET: 'lust', AMBER: 'sloth', SHAMROCK: 'gluttony',
  AZURE: 'gloom', INDIGO: 'pride', VIOLET: 'envy',
}
const RES_VALUE_MAP: Record<number, string> = {
  0.5: '내성', 1: '보통', 1.5: '저항', 2: '취약', 999: '면역',
}
const ASSOCIATION_MAP: Record<string, string> = {
  LIMBUS_COMPANY: '림버스 컴퍼니', LIMBUS_COMPANY_LCB: '림버스 컴퍼니',
  SEVEN: '세븐', BLADE_LINEAGE: '검계', SHI: '시', N_CORP: 'N사', NCORP: 'N사',
  MIDDLE_FINGER: '중지', RING_FINGER: '약지', INDEX_FINGER: '검지',
  LITTLE_FINGER: '소지', THUMB_FINGER: '엄지', KUROKUMO: '흑운회',
  T_CORP: 'T사', SWORD_GROUP: '칼잡이', SPIDER_HOUSE: '거미집', LEGO: '레고',
  CINQ: '다섯손가락', CINQ_EAST: '다섯손가락', HEISHOU: '흑수',
  BLOODFIEND: '피멍울', FULLSTOP: '마침표', BLACKWATER: '흑강', XICHUN: '씻김',
  L_CORP: '로보토미 본사', FIREPUNCH_OFFICE: '불주먹 사무소',
}
const UNIT_KEYWORD_FALLBACK_MAP: Record<string, string> = {
  SMALL: '소형',
}
const BROAD_AFFILIATION_NAMES = new Set([
  '림버스 컴퍼니',
])

const CONDITION_TAG_MAP: Record<string, string> = {
  OnSucceedAttack: '적중시', OnSucceedAttackHead: '앞면 적중시',
  OnSucceedAttackTail: '뒷면 적중시', CriticalOnSucceedAttack: '크리티컬 적중시',
  CriticalOnSucceedAttackHead: '크리티컬 앞면 적중시', CriticalEnemyTargetKill: '크리티컬 적 처치시',
  WhenUse: '사용시', WhenUse_Force: '사용시', BeforeUse: '사용 전',
  WhenUseEvade: '회피 사용시', WinDuel: '합 승리시', WinDuelAttack: '합 공격 승리시',
  WinDuelAttackHead: '합 앞면 공격 승리시', DefeatDuel: '합 패배시', StartDuel: '합 시작시',
  StartBattle: '전투 시작시', StartBattle_Force: '전투 시작시', EndSkill: '공격 종료시',
  EndSkillAll: '공격 종료시', EndBattle: '전투 종료시', BeforeAttack: '공격 시작 전',
  BeforeHit: '피격 전', EnemyKill: '적 처치시', OnSucceedEvade: '회피 성공시',
  OnStartCoin: '코인 시작시', OnDirectAttack: '직접 공격시',
  ReUseOnSucceedAttack: '재사용: 적중시', ReUseOnSucceedAttackHead: '재사용: 앞면 적중시',
  UnBrokenCoinOnSucceedAttack: '파괴 불가 코인 적중시', CantDuel: '합 불가',
  CantIdentify: '피아식별불가', CantChangeTarget: '타겟 변경 불가',
  TabExplain: '설명', DuelCounter: '합 가능 반격', DuelGuard: '합 가능 가드',
  AllyKill: '아군 처치시', AllyKillFail: '아군 처치 실패시', EnemyKillFail: '적 처치 실패시',
  TargetKill: '대상 처치시', CriticalTargetKill: '크리티컬 대상 처치시',
  CriticalEnemyTargetKillFail: '크리티컬 적 처치 실패시', CriticalEndSkill: '크리티컬 공격 종료시',
  CriticalActivated: '크리티컬 발동시', EndCoin: '이 코인 공격 종료시',
  EndSkillHead: '앞면 공격 종료시', EndSkillTail: '뒷면 공격 종료시',
  OnDefeatEvade: '회피 실패시', DefeatDuelAttack: '합 공격 패배시',
  AlwaysUse: '항상', TurnStartBattle: '턴 시작시',
}

// TAG_MAP is built at runtime from KR_BattleKeywords — merged with CONDITION_TAG_MAP
let TAG_MAP: Record<string, string> = { ...CONDITION_TAG_MAP }

const TAG_PATTERN = /\[([A-Za-z_][A-Za-z0-9_]*)\]/g
const EXCLUDED_TAGS = new Set(['Target', 'Result', 'Damage', 'Attack', 'Return', 'Recover', 'Shield'])
const UPTIE_LEVELS = [3, 4] as const

// Fields compared for existing identities — only game-sourced stats, tags, and source-backed quote.
// keywords remains protected below; manual fields such as acquisition/acquisition_info are not touched.
const STAT_FIELDS = [
  'hp', 'base_hp', 'hp_per_level', 'speed_min', 'speed_max', 'def_level',
  'rarity', 'slash_res', 'pierce_res', 'blunt_res', 'break_section',
  'skill_keyword_list', 'unit_keyword_list', 'association_list', 'affiliation', 'quote',
] as const
const GAME_ARRAY_COLUMNS = ['skill_keyword_list', 'unit_keyword_list', 'association_list'] as const
type GameArrayColumn = typeof GAME_ARRAY_COLUMNS[number]

const BASE_IDENTITY_SELECT = [
  'id', 'game_id', 'sinner_id', 'name', 'name_kr', 'name_en', 'name_jp',
  'hp', 'base_hp', 'hp_per_level', 'speed_min', 'speed_max', 'def_level',
  'rarity', 'slash_res', 'pierce_res', 'blunt_res', 'break_section',
  'keywords', 'folder_name', 'affiliation', 'quote',
].join(',')

// ── Zod schemas ───────────────────────────────────────────────────────────────

const ResistEntrySchema = z.object({
  type: z.string(),
  value: z.number(),
})

const ResistInfoSchema = z.object({
  atkResistList: z.array(ResistEntrySchema).optional(),
})

const AttributeListEntrySchema = z.object({
  skillId: z.number(),
})

const PersonalitySchema = z.object({
  id: z.number(),
  characterId: z.number(),
  rank: z.number().optional(),
  season: z.number().nullable().optional(),
  updatedDate: z.number().nullable().optional(),
  additionalAttachment: z.string().optional(),
  walpurgisType: z.string().optional(),
  hp: z.object({
    defaultStat: z.number().optional(),
    incrementByLevel: z.number().optional(),
  }).optional(),
  minSpeedList: z.array(z.number()).optional(),
  maxSpeedList: z.array(z.number()).optional(),
  defCorrection: z.number().optional(),
  resistInfo: ResistInfoSchema.optional(),
  attributeList: z.array(AttributeListEntrySchema).optional(),
  defenseSkillIDList: z.array(z.number()).optional(),
  skillKeywordList: z.array(z.string()).optional(),
  unitKeywordList: z.array(z.string()).optional(),
  associationList: z.array(z.string()).optional(),
  appearance: z.string().optional(),
  breakSection: z.object({ sectionList: z.unknown() }).optional(),
})

const KrPersonalitySchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  title: z.string().optional(),
  nameWithTitle: z.string().optional(),
})

const CoinDescSchema = z.object({ desc: z.string().optional() })
const CoinListItemSchema = z.object({ coindescs: z.array(CoinDescSchema).optional() })
const LevelEntrySchema = z.object({
  level: z.number(),
  name: z.string().optional(),
  desc: z.string().optional(),
  coinlist: z.array(CoinListItemSchema).optional(),
})

const KrSkillSchema = z.object({
  id: z.number(),
  levelList: z.array(LevelEntrySchema).optional(),
})

const CoinSchema = z.object({
  operatorType: z.string().optional(),
  scale: z.number().optional(),
  abilityScriptList: z.array(z.unknown()).optional(),
})

const SkillDataLevelSchema = z.object({
  gaksungLevel: z.number().optional(),
  atkType: z.string().optional(),
  defType: z.string().optional(),
  attributeType: z.string().optional(),
  defaultValue: z.number().optional(),
  skillLevelCorrection: z.number().optional(),
  targetNum: z.number().optional(),
  coinList: z.array(CoinSchema).optional(),
}).passthrough()

const PersonalitySkillSchema = z.object({
  id: z.number(),
  skillTier: z.number().optional(),
  isHiddenForUI: z.boolean().optional(),
  requireIDList: z.array(z.union([z.number(), z.string()])).optional(),
  skillData: z.array(SkillDataLevelSchema),
})

const PassiveMappingLevelSchema = z.object({
  level: z.number(),
  passiveIDList: z.array(z.number()),
})

const PassiveMappingSchema = z.object({
  personalityID: z.number(),
  battlePassiveList: z.array(PassiveMappingLevelSchema).optional(),
  supporterPassiveList: z.array(PassiveMappingLevelSchema).optional(),
})

const PassiveDetailSchema = z.object({
  id: z.number(),
  attributeStockCondition: z.array(z.object({
    type: z.string().optional(),
    value: z.number().optional(),
  })).optional(),
  attributeResonanceCondition: z.array(z.object({
    type: z.string().optional(),
    value: z.number().optional(),
  })).optional(),
}).passthrough()

const KrPassiveSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  desc: z.string().optional(),
})

const EgoReleaseDateSourceSchema = z.object({
  id: z.union([z.number(), z.string()]),
  updatedDate: z.union([z.number(), z.string()]).optional(),
}).passthrough()

// ── TypeScript types ──────────────────────────────────────────────────────────

type Personality = z.infer<typeof PersonalitySchema>
type PersonalitySkill = z.infer<typeof PersonalitySkillSchema>
type KrSkill = z.infer<typeof KrSkillSchema>
type KrPassive = z.infer<typeof KrPassiveSchema>
type PassiveMapping = z.infer<typeof PassiveMappingSchema>
type PassiveDetail = z.infer<typeof PassiveDetailSchema>

interface EgoReleaseDateSource {
  release_date: string
  updatedDate: string
  sourceFile: string
}

interface EgoReleaseDateDbRow {
  id: string
  game_id: string | number | null
  sinner_id: string | null
  name: string | null
  name_kr: string | null
  release_date: string | null
}

interface EgoReleaseDateChange {
  id: string
  game_id: string
  sinner_id: string | null
  name: string | null
  before: string | null
  after: string
  updatedDate: string
  sourceFile: string
}

interface KrPersonality {
  name: string
  title: string
  nameWithTitle: string
}

interface ComputedIdentity {
  game_id: string
  sinner_slug: string | null
  name: string | null
  name_kr: string | null
  hp: number | null
  base_hp: number | null
  hp_per_level: number | null
  speed_min: number | null
  speed_max: number | null
  def_level: number | null
  rarity: number | null
  slash_res: string | null
  pierce_res: string | null
  blunt_res: string | null
  break_section: unknown
  skill_keyword_list: string[]
  unit_keyword_list: string[]
  association_list: string[]
  keywords: string[]
  folder_name: string | null
  affiliation: string | null
  quote?: string
}

interface SkillRow {
  identity_id: string | null
  name: string
  name_en?: string | null
  name_jp?: string | null
  skill_type: string | null
  atk_type: string | null
  sin_affinity: string | null
  base_power: number | null
  coin_power: number | null
  coins: number
  offense_level: number | null
  description: string
  description_en?: string | null
  description_jp?: string | null
  skill_order: number
  atk_weight: number
  variant_order: number
  uptie_level: number
}

type DbSkillRow = Partial<SkillRow> & {
  id?: string
  defense_level?: number | null
}

const SKILL_COMPARE_FIELDS = [
  'name',
  'skill_order',
  'uptie_level',
  'skill_type',
  'atk_type',
  'sin_affinity',
  'base_power',
  'coin_power',
  'coins',
  'atk_weight',
  'offense_level',
  'defense_level',
  'description',
  'name_en',
  'name_jp',
  'description_en',
  'description_jp',
  'variant_order',
] as const

type SkillCompareField = typeof SKILL_COMPARE_FIELDS[number]
type SkillComparable = Record<SkillCompareField, string | number | null>

const SKILL_SELECT_FIELDS = [
  'id',
  ...SKILL_COMPARE_FIELDS,
].join(',')

function normalizeSkillCompareValue(value: unknown): string | number | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  return String(value)
}

function comparePrimitive(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0
  if (a === null) return -1
  if (b === null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a) < String(b) ? -1 : 1
}

function comparableSkill(row: Partial<SkillRow> & { defense_level?: number | null }): SkillComparable {
  return SKILL_COMPARE_FIELDS.reduce((acc, field) => {
    acc[field] = normalizeSkillCompareValue(row[field])
    return acc
  }, {} as SkillComparable)
}

function sortComparableSkills(rows: SkillComparable[]): SkillComparable[] {
  return [...rows].sort((a, b) => (
    comparePrimitive(a.uptie_level, b.uptie_level)
    || comparePrimitive(a.skill_order, b.skill_order)
    || comparePrimitive(a.name, b.name)
    || comparePrimitive(a.base_power, b.base_power)
    || comparePrimitive(a.coin_power, b.coin_power)
  ))
}

export function areSkillRowsDifferent(
  generatedRows: Array<Partial<SkillRow>>,
  dbRows: Array<Partial<SkillRow> & { id?: string; defense_level?: number | null }>,
): boolean {
  if (generatedRows.length !== dbRows.length) return true

  const generatedComparable = sortComparableSkills(generatedRows.map(row => comparableSkill(row)))
  const dbComparable = sortComparableSkills(dbRows.map(row => comparableSkill(row)))
  return JSON.stringify(generatedComparable) !== JSON.stringify(dbComparable)
}

interface PassiveRow {
  identity_id: string
  name: string
  name_en?: string | null
  name_jp?: string | null
  passive_type: 'battle' | 'support'
  sin_affinity: string | null
  sin_count: number | null
  active_cond: 'stock' | 'resonance' | null
  description: string
  description_en?: string | null
  description_jp?: string | null
  passive_order: number
  uptie_level: number
}

interface KeywordContext {
  gamePerson: Personality | null
  skillMap: Map<number, PersonalitySkill>
  rawKrTexts: string[]
  passiveDetails: PassiveDetail[]
}

interface SourceKeywordHit {
  gameIds: Set<string>
}

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

interface AcquisitionIdentityRow {
  id: string
  game_id: string
  sinner_id: string | null
  name_kr: string | null
  rarity: number | null
  acquisition: string | null
  acquisition_info: AcquisitionInfo | null
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

interface IdentityAcquisitionSyncOptions {
  fix?: boolean
  verbose?: boolean
  rewriteText?: boolean
  enrichGacha?: boolean
  sinnerIds?: string[]
  revalidate?: boolean
}

// ── File I/O helpers ──────────────────────────────────────────────────────────

function readTxt(filePath: string): unknown | null {
  if (!existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '')
    return JSON.parse(raw)
  } catch (e) {
    if (VERBOSE) console.warn(YELLOW(`  [경고] 파일 파싱 실패: ${filePath} — ${(e as Error).message}`))
    return null
  }
}

function extractList(data: unknown): unknown[] {
  const d = data as { list?: unknown[]; dataList?: unknown[] }
  return d?.list ?? d?.dataList ?? []
}

function globFiles(dir: string, pattern: RegExp): string[] {
  try {
    return readdirSync(dir).filter(f => pattern.test(f)).sort()
  } catch {
    return []
  }
}

function formatGameUpdatedDate(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!/^\d{8}$/.test(raw)) return null

  const year = raw.slice(0, 4)
  const month = raw.slice(4, 6)
  const day = raw.slice(6, 8)
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`)

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return null
  }

  return `${year}-${month}-${day}`
}

function normalizeReleaseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ── KR data loaders ───────────────────────────────────────────────────────────

const LIMBUS_RICH_TEXT_TAG_RE = /<sprite\b[^>]*\/?>|<\/?(?:style|noparse|u|b|i|s|color|link|size|mark)\b[^>]*>/i

export function stripLimbusRichTextTags(value: string): string {
  return value
    .replace(/<sprite\b[^>]*\/?>/gi, '')
    .replace(/<\/?(?:style|noparse|u|b|i|s|color|link|size|mark)\b[^>]*>/gi, '')
}

export const stripGameRichText = stripLimbusRichTextTags

export function hasLimbusRichTextTags(value: string): boolean {
  return LIMBUS_RICH_TEXT_TAG_RE.test(value)
}

export function cleanLocaleContent(value: string): string {
  return stripLimbusRichTextTags(value).trim()
}

export function findStaleRichTextKeywordMetaNames(existingNames: Iterable<string>): string[] {
  return [...existingNames].filter(name => (
    hasLimbusRichTextTags(name)
    && cleanLocaleContent(name) !== name
  ))
}

function normalizeLocaleLine(value: string | undefined): string {
  return cleanLocaleContent(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeKrPersonalityDisplayName(input: {
  name?: string
  title?: string
  nameWithTitle?: string
}): string {
  const name = normalizeLocaleLine(input.name)
  const title = normalizeLocaleLine(input.title)
  const nameWithTitle = normalizeLocaleLine(input.nameWithTitle)

  if (title && (!nameWithTitle || nameWithTitle === name)) return title
  return nameWithTitle || name
}

export const resolvePersonalityDisplayName = normalizeKrPersonalityDisplayName

function loadKrTagMap(): Record<string, string> {
  const map: Record<string, string> = { ...CONDITION_TAG_MAP }

  // Latest first: kr/ (.json files) — 최신 패치 데이터 우선
  if (existsSync(KR_LATEST_DIR)) {
    const latestFiles = globFiles(KR_LATEST_DIR, /^KR_(BattleKeywords|Bufs|BuffAbilities)/i)
      .filter(f => f.endsWith('.json'))
    for (const f of latestFiles) {
      const data = readTxt(join(KR_LATEST_DIR, f))
      for (const item of extractList(data)) {
        const parsed = z.object({ id: z.string(), name: z.string() }).safeParse(item)
        if (parsed.success && !map[parsed.data.id]) {
          map[parsed.data.id] = cleanLocaleContent(parsed.data.name)
        }
      }
    }
  }

  // Fallback: Json (Text)/KR/ (.txt files) — 구버전, 최신에 없는 것만
  if (existsSync(KR_DIR)) {
    const kwFiles = globFiles(KR_DIR, /^KR_(BattleKeywords|Bufs|BuffAbilities)/i)
      .filter(f => f.endsWith('.txt'))
    for (const f of kwFiles) {
      const data = readTxt(join(KR_DIR, f))
      for (const item of extractList(data)) {
        const parsed = z.object({ id: z.string(), name: z.string() }).safeParse(item)
        if (parsed.success && !map[parsed.data.id]) {
          map[parsed.data.id] = cleanLocaleContent(parsed.data.name)
        }
      }
    }
  }

  return map
}

function loadKrContentMap(filePattern: RegExp, idPrefix: string): Record<string, string> {
  const map: Record<string, string> = {}

  for (const { dir, ext } of [
    { dir: KR_LATEST_DIR, ext: '.json' },
    { dir: KR_DIR, ext: '.txt' },
  ]) {
    if (!existsSync(dir)) continue
    const files = globFiles(dir, filePattern).filter(f => f.endsWith(ext))
    for (const f of files) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const parsed = z.object({ id: z.string(), content: z.string() }).safeParse(item)
        if (!parsed.success) continue
        const key = parsed.data.id.startsWith(idPrefix)
          ? parsed.data.id.slice(idPrefix.length)
          : parsed.data.id
        if (!map[key]) map[key] = cleanLocaleContent(parsed.data.content)
      }
    }
  }

  return map
}

function loadKrPersonalityGetQuotes(): Map<string, string> {
  const map = new Map<string, string>()
  const entrySchema = z.object({
    id: z.string(),
    dlg: z.string().optional(),
  })

  for (const { dir, pattern } of [
    { dir: KR_PERSONALITY_VOICE_LATEST_DIR, pattern: /^KR_Voice_.*\.json$/i },
    { dir: KR_DIR, pattern: /^KR_Voice_.*\.txt$/i },
  ]) {
    if (!existsSync(dir)) continue
    for (const f of globFiles(dir, pattern)) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const parsed = entrySchema.safeParse(item)
        if (!parsed.success) continue
        const match = /^get_(\d+)_\d+$/.exec(parsed.data.id)
        const quote = parsed.data.dlg ? cleanLocaleContent(parsed.data.dlg) : ''
        if (match?.[1] && quote && !map.has(match[1])) {
          map.set(match[1], quote)
        }
      }
    }
  }

  return map
}

function loadKrUnitKeywordMap(): Record<string, string> {
  return {
    ...UNIT_KEYWORD_FALLBACK_MAP,
    ...loadKrContentMap(/^KR_UnitKeyword/i, 'UnitKeyword_'),
  }
}

function loadKrAssociationMap(unitKeywordMap: Record<string, string>): Record<string, string> {
  return {
    ...ASSOCIATION_MAP,
    ...unitKeywordMap,
    ...loadKrContentMap(/^KR_AssociationName/i, 'associationName_'),
  }
}

let UNIT_KEYWORD_MAP: Record<string, string> = { ...UNIT_KEYWORD_FALLBACK_MAP }
let ASSOCIATION_NAME_MAP: Record<string, string> = { ...ASSOCIATION_MAP }

function loadKrKeywordDescriptions(): Map<string, { id: string; description: string | null }> {
  const map = new Map<string, { id: string; description: string | null }>()
  const dirs: Array<{ dir: string; ext: string }> = []
  if (existsSync(KR_LATEST_DIR)) dirs.push({ dir: KR_LATEST_DIR, ext: '.json' })
  if (existsSync(KR_DIR)) dirs.push({ dir: KR_DIR, ext: '.txt' })

  for (const { dir, ext } of dirs) {
    const files = globFiles(dir, /^KR_(BattleKeywords|Bufs|BuffAbilities)/i).filter(f => f.endsWith(ext))
    for (const f of files) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const parsed = z.object({ id: z.string(), name: z.string(), desc: z.string().optional() }).safeParse(item)
        if (!parsed.success) continue
        const name = cleanLocaleContent(parsed.data.name)
        const current = map.get(name)
        const shouldPreferYisangDirective = name === '지령 탐닉' && parsed.data.id === 'BlackNightmareYisang'
        if (!current || shouldPreferYisangDirective) {
          map.set(name, { id: parsed.data.id, description: parsed.data.desc ? cleanLocaleContent(parsed.data.desc) : null })
        }
      }
    }
  }
  return map
}

function loadLangKeywordDescriptions(lang: 'en' | 'jp'): Map<string, { name: string; description: string | null }> {
  const prefix = lang.toUpperCase()
  const latestDir = lang === 'en' ? EN_LATEST_DIR : JP_LATEST_DIR
  const fallbackDir = lang === 'en' ? EN_DIR : JP_DIR
  const map = new Map<string, { name: string; description: string | null }>()

  for (const { dir, ext } of [
    { dir: latestDir, ext: '.json' },
    { dir: fallbackDir, ext: '.txt' },
  ]) {
    if (!existsSync(dir)) continue
    const files = globFiles(dir, new RegExp(`^${prefix}_(BattleKeywords|Bufs|BuffAbilities)`, 'i'))
      .filter(f => f.endsWith(ext))
    for (const f of files) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const parsed = z.object({ id: z.string(), name: z.string(), desc: z.string().optional() }).safeParse(item)
        if (parsed.success && !map.has(parsed.data.id)) {
          map.set(parsed.data.id, {
            name: cleanLocaleContent(parsed.data.name),
            description: parsed.data.desc ? cleanLocaleContent(parsed.data.desc) : null,
          })
        }
      }
    }
  }

  return map
}

function loadKrPersonalities(): Map<string, KrPersonality> {
  const map = new Map<string, KrPersonality>()
  if (!existsSync(KR_DIR)) return map

  const files = globFiles(KR_DIR, /^KR_Personalities.*\.txt$/)
    .filter(f => !f.includes('x1p1c1'))

  for (const f of files) {
    const data = readTxt(join(KR_DIR, f))
    for (const item of extractList(data)) {
      const parsed = KrPersonalitySchema.safeParse(item)
      if (!parsed.success) continue
      const { id, name = '', title = '', nameWithTitle } = parsed.data
      map.set(String(id), {
        name: normalizeLocaleLine(name),
        title: normalizeLocaleLine(title),
        nameWithTitle: normalizeKrPersonalityDisplayName({ name, title, nameWithTitle }),
      })
    }
  }

  // Latest KR patch overrides
  if (existsSync(KR_LATEST_DIR)) {
    for (const f of globFiles(KR_LATEST_DIR, /^KR_Personalities.*\.(json|txt)$/)) {
      const data = readTxt(join(KR_LATEST_DIR, f))
      for (const item of extractList(data)) {
        const parsed = KrPersonalitySchema.safeParse(item)
        if (!parsed.success) continue
        const { id, name = '', title = '', nameWithTitle } = parsed.data
        map.set(String(id), {
          name: normalizeLocaleLine(name),
          title: normalizeLocaleLine(title),
          nameWithTitle: normalizeKrPersonalityDisplayName({ name, title, nameWithTitle }),
        })
      }
    }
  }
  return map
}

/**
 * Load EN or JP personality title map: game_id (string) → cleaned title
 * Searches latest dir first (.json/.txt), then fallback dir (.txt)
 */
function loadPersonalityNames(lang: 'en' | 'jp'): Map<string, string> {
  const map = new Map<string, string>()
  const prefix = lang === 'en' ? 'EN' : 'JP'
  const latestDir = lang === 'en' ? EN_LATEST_DIR : JP_LATEST_DIR
  const fallbackDir = lang === 'en' ? EN_DIR : JP_DIR

  const loadFromDir = (dir: string, pattern: RegExp) => {
    if (!existsSync(dir)) return
    for (const f of globFiles(dir, pattern)) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const parsed = KrPersonalitySchema.safeParse(item)
        if (!parsed.success) continue
        const { id, title } = parsed.data
        if (title) map.set(String(id), normalizeLocaleLine(title))
      }
    }
  }

  // Fallback dir first, latest overrides
  loadFromDir(fallbackDir, new RegExp(`^${prefix}_Personalities.*\\.txt$`))
  loadFromDir(latestDir, new RegExp(`^${prefix}_Personalities.*\\.(json|txt)$`))

  return map
}

function cleanCoinList(coinlist: z.infer<typeof CoinListItemSchema>[] | undefined): z.infer<typeof CoinListItemSchema>[] | undefined {
  return coinlist?.map(coin => ({
    ...coin,
    coindescs: coin.coindescs?.map(desc => ({
      ...desc,
      desc: desc.desc ? cleanLocaleContent(desc.desc) : desc.desc,
    })),
  }))
}

function cleanKrSkill(skill: KrSkill): KrSkill {
  return {
    ...skill,
    levelList: skill.levelList?.map(level => ({
      ...level,
      name: level.name ? cleanLocaleContent(level.name) : level.name,
      desc: level.desc ? cleanLocaleContent(level.desc) : level.desc,
      coinlist: cleanCoinList(level.coinlist),
    })),
  }
}

function loadKrSkills(): Map<number, KrSkill> {
  const map = new Map<number, KrSkill>()
  if (!existsSync(KR_DIR)) return map

  for (const f of globFiles(KR_DIR, /^KR_Skills(?!_Ego).*\.(json|txt)$/)) {
    const data = readTxt(join(KR_DIR, f))
    for (const item of extractList(data)) {
      const parsed = KrSkillSchema.safeParse(item)
      if (parsed.success) map.set(parsed.data.id, cleanKrSkill(parsed.data))
    }
  }

  // Latest KR patch overrides
  if (existsSync(KR_LATEST_DIR)) {
    for (const f of globFiles(KR_LATEST_DIR, /^KR_Skills(?!_Ego).*\.(json|txt)$/)) {
      const data = readTxt(join(KR_LATEST_DIR, f))
      for (const item of extractList(data)) {
        const parsed = KrSkillSchema.safeParse(item)
        if (parsed.success) map.set(parsed.data.id, cleanKrSkill(parsed.data))
      }
    }
  }
  return map
}

function loadPersonalities(): Map<string, Personality> {
  const map = new Map<string, Personality>()
  for (const sourceFile of globFiles(DATA_DIR, PERSONALITY_FILE_RE).sort()) {
    const data = readTxt(join(DATA_DIR, sourceFile))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = PersonalitySchema.safeParse(item)
      if (parsed.success) map.set(String(parsed.data.id), parsed.data)
    }
  }
  return map
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function toNumberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function extractRecordList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.map(toRecord).filter((item): item is Record<string, unknown> => item !== null)
  const record = toRecord(data)
  if (!record) return []
  if (Array.isArray(record.eventRewardDatas)) return [record]
  const list = Array.isArray(record.list) ? record.list : record.dataList
  return toArray(list).map(toRecord).filter((item): item is Record<string, unknown> => item !== null)
}

function loadAcquisitionItemNames(): Map<number, string> {
  const map = new Map<number, string>()
  for (const file of globFiles(KR_DIR, /^KR_Items.*\.txt$/i)) {
    for (const item of extractRecordList(readTxt(join(KR_DIR, file)))) {
      const id = toNumberValue(item.id)
      const name = toStringValue(item.name)
      if (id != null && name) map.set(id, name)
    }
  }
  return map
}

function loadAcquisitionGachaTitles(): {
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
      for (const file of globFiles(dir, new RegExp(`^${lang}_GachaTitle.*\\${ext}$`, 'i'))) {
        for (const item of extractRecordList(readTxt(join(dir, file)))) {
          const rawId = toStringValue(item.id) ?? toNumberValue(item.id)
          const id = rawId == null ? NaN : Number(rawId)
          const content = toStringValue(item.content)
          if (Number.isFinite(id) && content) map.set(id, content)
        }
      }
    }
    return map
  }

  return {
    ko: readTitleMap('KR', KR_LATEST_DIR, KR_DIR),
    en: readTitleMap('EN', EN_LATEST_DIR, EN_DIR),
    jp: readTitleMap('JP', JP_LATEST_DIR, JP_DIR),
  }
}

function inferAcquisitionEventName(file: string): string | null {
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

function loadAcquisitionEventRewardHits(itemNames: Map<number, string>): Map<string, EventRewardHit> {
  const map = new Map<string, EventRewardHit>()
  for (const file of globFiles(DATA_DIR, /event.*\.txt$/i)) {
    for (const event of extractRecordList(readTxt(join(DATA_DIR, file)))) {
      const rewards = toArray(event.eventRewardDatas)
      if (rewards.length === 0) continue
      for (const rawReward of rewards) {
        const reward = toRecord(rawReward)
        if (!reward) continue
        const rewardPrice = toRecord(reward.rewardPrice)
        const currencyId = toNumberValue(rewardPrice?.id)
        const eventCost = toNumberValue(rewardPrice?.num)
        for (const rawItem of toArray(reward.rewardItemList)) {
          const item = toRecord(rawItem)
          const type = toStringValue(item?.type)
          const id = toNumberValue(item?.id)
          if (type !== 'PERSONALITY' || id == null) continue
          const hit: EventRewardHit = {
            file,
            startDate: toStringValue(event.startDate),
            eventName: inferAcquisitionEventName(file),
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

function loadAcquisitionGachaPickupHits(gachaTitles: ReturnType<typeof loadAcquisitionGachaTitles>): Map<string, GachaPickupHit[]> {
  const map = new Map<string, GachaPickupHit[]>()
  for (const file of globFiles(DATA_DIR, /^gacha-\d+\.txt$/i)) {
    for (const entry of extractRecordList(readTxt(join(DATA_DIR, file)))) {
      const banner = toRecord(entry.bannerInfo)
      const ids = new Set<number>()
      for (const id of toArray(banner?.pickupIdList)) {
        const numericId = toNumberValue(id)
        if (numericId != null) ids.add(numericId)
      }

      for (const id of ids) {
        const gameId = String(id)
        const gachaId = toNumberValue(entry.id)
        const hit: GachaPickupHit = {
          file,
          gachaId,
          bannerType: toStringValue(banner?.bannerType),
          walpurgisType: toStringValue(banner?.walpurgisType),
          category: toStringValue(entry.category),
          festival: banner?.festival === true,
          startDate: toStringValue(entry.startDate),
          endDate: toStringValue(entry.endDate),
          gachaName: gachaId != null ? gachaTitles.ko.get(gachaId) ?? null : null,
          gachaNameEn: gachaId != null ? gachaTitles.en.get(gachaId) ?? null : null,
          gachaNameJp: gachaId != null ? gachaTitles.jp.get(gachaId) ?? null : null,
        }
        const current = map.get(gameId) ?? []
        current.push(hit)
        map.set(gameId, current)
      }
    }
  }
  return map
}

function acquisitionGachaFields(identity: AcquisitionIdentityRow, hit: GachaPickupHit | null, enrichGacha: boolean): Partial<AcquisitionInfo> {
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

function acquisitionFragmentCost(rank: number): number | null {
  if (rank === 2) return 150
  if (rank === 3) return 400
  return null
}

function acquisitionExchangeSeason(season: number): number | undefined {
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

function existingAcquisitionExchangeOverride(identity: AcquisitionIdentityRow): Partial<AcquisitionInfo> {
  return identity.acquisition_info?.exchange_from_season != null
    ? { exchange_from_season: identity.acquisition_info.exchange_from_season }
    : {}
}

function existingAcquisitionEventFields(identity: AcquisitionIdentityRow): Partial<AcquisitionInfo> {
  const existing = identity.acquisition_info
  if (!existing) return {}
  return {
    ...(existing.event_name ? { event_name: existing.event_name } : {}),
    ...(existing.event_currency ? { event_currency: existing.event_currency } : {}),
    ...(existing.event_cost != null ? { event_cost: existing.event_cost } : {}),
  }
}

function acquisitionReleaseSeason(identity: AcquisitionIdentityRow, personality: Personality, rank: number): number {
  if (rank === 1) return 0
  const existing = identity.acquisition_info?.release_season
  const sourceSeason = personality.season ?? 0
  if (existing && existing > 0) return existing
  if (sourceSeason >= 9000) return 0
  if (sourceSeason === 0) return 1
  return sourceSeason
}

function acquisitionWalpurgisEdition(identity: AcquisitionIdentityRow, hit: GachaPickupHit | null): number | undefined {
  const existing = identity.acquisition_info?.walpurgis_edition
  if (existing != null) return existing
  const textMatch = identity.acquisition?.match(/(\d+)\s*회차/)
  if (textMatch) return Number(textMatch[1])
  const titleMatch = hit?.gachaName?.match(/제\s*(\d+)\s*회/)
  return titleMatch ? Number(titleMatch[1]) : undefined
}

function isAcquisitionWalpurgis(personality: Personality, releasePickup: GachaPickupHit | null): boolean {
  return Boolean(
    personality.walpurgisType
      || (personality.season ?? 0) >= 9000
      || releasePickup?.walpurgisType
      || releasePickup?.festival,
  )
}

function deriveIdentityAcquisition(
  identity: AcquisitionIdentityRow,
  personality: Personality,
  eventRewards: Map<string, EventRewardHit>,
  gachaPickups: Map<string, GachaPickupHit[]>,
  enrichGacha: boolean,
): DerivedAcquisition {
  const gameId = identity.game_id
  const rank = identity.rarity ?? personality.rank ?? 0
  const cost = acquisitionFragmentCost(rank)
  const sourceSeason = personality.season ?? null
  const season = acquisitionReleaseSeason(identity, personality, rank)
  const existing = identity.acquisition_info
  const reward = eventRewards.get(gameId)
  const releasePickup = pickReleasePickup(gachaPickups.get(gameId))
  const evidence = [
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

  if (isAcquisitionWalpurgis(personality, releasePickup)) {
    const edition = acquisitionWalpurgisEdition(identity, releasePickup)
    return {
      acquisition: `발푸르기스의 밤 기간 내 추출 / 발푸르기스의 밤 기간 내 자아 파편 ${cost} 교환`,
      acquisition_info: {
        type: 'walpurgis',
        release_season: season,
        fragment_cost: cost,
        gacha: 'walpurgis',
        ...acquisitionGachaFields(identity, releasePickup, enrichGacha),
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
      ...existingAcquisitionExchangeOverride(identity),
      ...(eventName ? { event_name: eventName } : {}),
      ...(eventCurrency ? { event_currency: eventCurrency } : {}),
      ...(eventCost != null ? { event_cost: eventCost } : {}),
    }
    const eventPrefix = reward.eventName ? `${reward.eventName} ` : ''
    const rewardText = reward.currencyName && reward.eventCost
      ? `${eventPrefix}이벤트 ${reward.currencyName} ${reward.eventCost}개 교환`
      : `${eventPrefix}이벤트 교환 보상`
    const exSeason = existing?.exchange_from_season ?? acquisitionExchangeSeason(season)
    const shardText = cost && exSeason ? ` / 자아 파편 ${cost} 교환(시즌 ${exSeason} 이후)` : ''
    return {
      acquisition: `${rewardText}${shardText}`,
      acquisition_info: info,
      evidence,
      rewrite_acquisition: Boolean(reward.currencyName && reward.eventCost),
    }
  }

  if (personality.additionalAttachment === 'EVENT') {
    const exSeason = existing?.exchange_from_season ?? acquisitionExchangeSeason(season)
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
        ...existingAcquisitionEventFields(identity),
        ...(gacha !== 'none' ? acquisitionGachaFields(identity, releasePickup, enrichGacha) : {}),
        ...existingAcquisitionExchangeOverride(identity),
      },
      evidence,
    }
  }

  if (season > 0) {
    const exSeason = existing?.exchange_from_season ?? acquisitionExchangeSeason(season)
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
        ...existingAcquisitionEventFields(identity),
        ...acquisitionGachaFields(identity, releasePickup, enrichGacha),
        ...existingAcquisitionExchangeOverride(identity),
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
      ...existingAcquisitionEventFields(identity),
      ...existingAcquisitionExchangeOverride(identity),
    },
    evidence,
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const record = toRecord(value)
  if (!record) return JSON.stringify(value)
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`
}

function sameAcquisitionInfo(left: AcquisitionInfo | null, right: AcquisitionInfo): boolean {
  return stableJson(left) === stableJson(right)
}

async function syncIdentityAcquisition(options: IdentityAcquisitionSyncOptions = {}): Promise<{ changed: number; applied: number }> {
  const fix = options.fix === true
  const dryRun = !fix
  const verbose = options.verbose === true
  const rewriteText = options.rewriteText === true
  const enrichGacha = options.enrichGacha !== false
  const sinnerFilter = new Set((options.sinnerIds ?? []).map(id => id.trim()).filter(Boolean))

  const personalities = loadPersonalities()
  const itemNames = loadAcquisitionItemNames()
  const gachaTitles = loadAcquisitionGachaTitles()
  const eventRewards = loadAcquisitionEventRewardHits(itemNames)
  const gachaPickups = loadAcquisitionGachaPickupHits(gachaTitles)

  let query = supabase
    .from('identities')
    .select('id, game_id, sinner_id, name_kr, rarity, acquisition, acquisition_info')
    .order('game_id')
  if (sinnerFilter.size > 0) query = query.in('sinner_id', [...sinnerFilter])

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as AcquisitionIdentityRow[]

  let changed = 0
  let applied = 0
  for (const identity of rows) {
    const personality = personalities.get(identity.game_id)
    if (!personality) {
      console.warn(`[skip] ${identity.game_id} ${identity.name_kr ?? ''}: personality source not found`)
      continue
    }

    const derived = deriveIdentityAcquisition(identity, personality, eventRewards, gachaPickups, enrichGacha)
    const desiredAcquisition = rewriteText || derived.rewrite_acquisition || !identity.acquisition
      ? derived.acquisition
      : identity.acquisition
    const differs = identity.acquisition !== desiredAcquisition || !sameAcquisitionInfo(identity.acquisition_info, derived.acquisition_info)
    if (!differs) continue
    changed++

    console.log(`[diff] ${identity.game_id} ${identity.name_kr ?? ''}`)
    console.log(`  acquisition: ${identity.acquisition ?? '(null)'}`)
    console.log(`           -> ${desiredAcquisition}`)
    console.log(`  info: ${stableJson(identity.acquisition_info)}`)
    console.log(`    -> ${stableJson(derived.acquisition_info)}`)
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

function loadPersonalitySkills(): Map<number, PersonalitySkill> {
  const map = new Map<number, PersonalitySkill>()
  for (const sourceFile of globFiles(DATA_DIR, PERSONALITY_SKILL_FILE_RE).sort()) {
    const data = readTxt(join(DATA_DIR, sourceFile))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = PersonalitySkillSchema.safeParse(item)
      if (parsed.success && !map.has(parsed.data.id)) {
        map.set(parsed.data.id, parsed.data)
      }
    }
  }
  return map
}

function loadPassiveMappings(): PassiveMapping[] {
  const all: PassiveMapping[] = []
  for (const sourceFile of globFiles(DATA_DIR, PERSONALITY_PASSIVE_FILE_RE).sort()) {
    const data = readTxt(join(DATA_DIR, sourceFile))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = PassiveMappingSchema.safeParse(item)
      if (parsed.success) all.push(parsed.data)
    }
  }
  return all
}

function loadPassiveDetails(): Map<number, PassiveDetail> {
  const map = new Map<number, PassiveDetail>()
  for (const txtFile of ['passive.txt', 'passive_check4.txt']) {
    const data = readTxt(join(DATA_DIR, txtFile))
    if (!data) continue
    for (const item of extractList(data)) {
      const parsed = PassiveDetailSchema.safeParse(item)
      if (parsed.success && !map.has(parsed.data.id)) {
        map.set(parsed.data.id, parsed.data)
      }
    }
  }
  return map
}

function cleanKrPassive(passive: KrPassive): KrPassive {
  return {
    ...passive,
    name: passive.name ? cleanLocaleContent(passive.name) : passive.name,
    desc: passive.desc ? cleanLocaleContent(passive.desc) : passive.desc,
  }
}

function loadKrPassives(): Map<number, KrPassive> {
  const map = new Map<number, KrPassive>()
  // KR_DIR passive files
  for (const f of globFiles(KR_DIR, /^KR_Passives.*\.txt$/i)) {
    if (/_Abnormality/i.test(f) || /_Enemy/i.test(f) || /_Assist/i.test(f)) continue
    const data = readTxt(join(KR_DIR, f))
    for (const item of extractList(data)) {
      const parsed = KrPassiveSchema.safeParse(item)
      if (parsed.success && !map.has(parsed.data.id)) map.set(parsed.data.id, cleanKrPassive(parsed.data))
    }
  }
  // Latest KR patch overrides
  if (existsSync(KR_LATEST_DIR)) {
    for (const f of globFiles(KR_LATEST_DIR, /^KR_Passives.*\.(json|txt)$/i)) {
      if (/_Abnormality/i.test(f) || /_Enemy/i.test(f) || /_Assist/i.test(f)) continue
      const data = readTxt(join(KR_LATEST_DIR, f))
      for (const item of extractList(data)) {
        const parsed = KrPassiveSchema.safeParse(item)
        if (parsed.success) map.set(parsed.data.id, cleanKrPassive(parsed.data))
      }
    }
  }
  return map
}

// ── EN/JP locale helpers ──────────────────────────────────────────────────────

const CONDITION_TAG_EN: Record<string, string> = {
  OnSucceedAttack: 'On Hit', OnSucceedAttackHead: 'Heads Hit', OnSucceedAttackTail: 'Tails Hit',
  WhenUse: 'On Use', WhenUse_Force: 'On Use', BeforeUse: 'Before Use',
  WinDuel: 'On Clash Win', WinDuelAttack: 'On Clash Win (Attack)', DefeatDuel: 'On Clash Lose',
  StartBattle: 'Combat Start', StartBattle_Force: 'Combat Start',
  EndSkill: 'After Attack', EndSkillAll: 'After Attack', BeforeAttack: 'Before Attack',
  EnemyKill: 'On Kill', OnSucceedEvade: 'On Evade', CriticalOnSucceedAttack: 'On Crit',
  TurnStartBattle: 'Turn Start', UnBrokenCoinOnSucceedAttack: 'Unbreakable Coin Hit',
  AlwaysUse: 'Always', BeforeHit: 'Before Hit', OnStartCoin: 'Coin Start',
  OnDirectAttack: 'On Direct Attack', StartDuel: 'Clash Start',
  EndBattle: 'Combat End', AllyKill: 'On Ally Kill', TargetKill: 'On Target Kill',
  CantDuel: 'Cannot Clash', CantIdentify: 'Unidentifiable', TabExplain: 'Info',
  DuelCounter: 'Counter (Clashable)', DuelGuard: 'Guard (Clashable)',
  ReUseOnSucceedAttack: 'Reuse: On Hit', ReUseOnSucceedAttackHead: 'Reuse: Heads Hit',
  EndCoin: 'After Coin', EndSkillHead: 'After Heads Attack', EndSkillTail: 'After Tails Attack',
  OnDefeatEvade: 'On Evade Fail', DefeatDuelAttack: 'On Clash Loss (Attack)',
  WhenUseEvade: 'On Evade Use', CriticalEndSkill: 'On Crit: After Attack',
  CriticalActivated: 'On Crit', CriticalTargetKill: 'On Crit: Target Kill',
  CriticalEnemyTargetKill: 'On Crit: Kill', CantChangeTarget: 'Cannot Retarget',
}

const CONDITION_TAG_JP: Record<string, string> = {
  OnSucceedAttack: '的中時', OnSucceedAttackHead: '表面的中時', OnSucceedAttackTail: '裏面的中時',
  WhenUse: '使用時', WhenUse_Force: '使用時', BeforeUse: '使用前',
  WinDuel: 'マッチ勝利時', WinDuelAttack: 'マッチ攻撃勝利時', DefeatDuel: 'マッチ敗北時',
  StartBattle: '戦闘開始時', StartBattle_Force: '戦闘開始時',
  EndSkill: '攻撃終了時', EndSkillAll: '攻撃終了時', BeforeAttack: '攻撃開始前',
  EnemyKill: '敵処置時', OnSucceedEvade: '回避成功時', CriticalOnSucceedAttack: 'クリティカル的中時',
  TurnStartBattle: 'ターン開始時', UnBrokenCoinOnSucceedAttack: '破壊不可コイン的中時',
  AlwaysUse: '常時', BeforeHit: '被撃前', OnStartCoin: 'コイン開始時',
  OnDirectAttack: '直接攻撃時', StartDuel: 'マッチ開始時',
  EndBattle: '戦闘終了時', AllyKill: '味方処置時', TargetKill: '対象処置時',
  CantDuel: 'マッチ不可', CantIdentify: '敵味方識別不可', TabExplain: '説明',
  DuelCounter: 'マッチ可能カウンター', DuelGuard: 'マッチ可能ガード',
  ReUseOnSucceedAttack: '再使用:的中時', ReUseOnSucceedAttackHead: '再使用:表面的中時',
  EndCoin: 'コイン攻撃終了時', EndSkillHead: '表面攻撃終了時', EndSkillTail: '裏面攻撃終了時',
  OnDefeatEvade: '回避失敗時', DefeatDuelAttack: 'マッチ攻撃敗北時',
  WhenUseEvade: '回避使用時', CriticalEndSkill: 'クリティカル攻撃終了時',
  CriticalActivated: 'クリティカル発動時', CriticalTargetKill: 'クリティカル対象処置時',
  CriticalEnemyTargetKill: 'クリティカル敵処置時', CantChangeTarget: 'ターゲット変更不可',
}

function loadLangTagMap(lang: 'en' | 'jp'): Record<string, string> {
  const prefix = lang.toUpperCase()
  const condTags = lang === 'en' ? CONDITION_TAG_EN : CONDITION_TAG_JP
  const map: Record<string, string> = { ...condTags }
  const latestDir = lang === 'en' ? EN_LATEST_DIR : JP_LATEST_DIR
  const fallbackDir = lang === 'en' ? EN_DIR : JP_DIR

  // Latest dir (.json files)
  if (existsSync(latestDir)) {
    const latestFiles = globFiles(latestDir, new RegExp(`^${prefix}_(BattleKeywords|Bufs|BuffAbilities)`, 'i'))
      .filter(f => f.endsWith('.json'))
    for (const f of latestFiles) {
      const data = readTxt(join(latestDir, f))
      for (const item of extractList(data)) {
        const parsed = z.object({ id: z.string(), name: z.string() }).safeParse(item)
        if (!parsed.success) continue
        if (!map[parsed.data.id]) map[parsed.data.id] = cleanLocaleContent(parsed.data.name)
      }
    }
  }

  // Fallback dir (.txt files)
  if (existsSync(fallbackDir)) {
    const fallbackFiles = globFiles(fallbackDir, new RegExp(`^${prefix}_(BattleKeywords|Bufs|BuffAbilities)`, 'i'))
      .filter(f => f.endsWith('.txt'))
    for (const f of fallbackFiles) {
      const data = readTxt(join(fallbackDir, f))
      for (const item of extractList(data)) {
        const parsed = z.object({ id: z.string(), name: z.string() }).safeParse(item)
        if (!parsed.success) continue
        if (!map[parsed.data.id]) map[parsed.data.id] = cleanLocaleContent(parsed.data.name)
      }
    }
  }

  console.log(`  ${prefix} 태그 맵: ${Object.keys(map).length}개`)
  return map
}

type LangSkillLevelEntry = { level: number; name: string; desc: string; coinlist?: any[] }

type LangLocaleData = {
  skillMap: Map<number, { levelList: LangSkillLevelEntry[] }>
  passiveMap: Map<number, { name: string; desc: string }>
}

function cleanLangCoinList(coinlist: any[] | undefined): any[] | undefined {
  return coinlist?.map(coin => ({
    ...coin,
    coindescs: coin.coindescs?.map((desc: any) => ({
      ...desc,
      desc: cleanLocaleContent(desc.desc ?? ''),
    })),
  }))
}

function loadLangLocale(lang: 'en' | 'jp'): LangLocaleData {
  const prefix = lang.toUpperCase()
  const latestDir = lang === 'en' ? EN_LATEST_DIR : JP_LATEST_DIR
  const fallbackDir = lang === 'en' ? EN_DIR : JP_DIR

  const skillMap = new Map<number, { levelList: LangSkillLevelEntry[] }>()
  const passiveMap = new Map<number, { name: string; desc: string }>()

  // Load skills — pattern: {LANG}_Skills*.{json|txt}
  for (const dir of [latestDir, fallbackDir]) {
    if (!existsSync(dir)) continue
    const files = globFiles(dir, new RegExp(`^${prefix}_Skills`, 'i'))
    for (const f of files) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const id = (item as any)?.id as number
        if (!id) continue
        const levelList: LangSkillLevelEntry[] = ((item as any).levelList ?? []).map((lv: any) => ({
          level: lv.level ?? lv.gaksungLevel ?? 0,
          name: cleanLocaleContent(lv.name ?? ''),
          desc: cleanLocaleContent(lv.desc ?? ''),
          coinlist: cleanLangCoinList(lv.coinlist),
        }))
        if (levelList.length === 0) continue
        const existing = skillMap.get(id)
        if (existing) {
          // Merge levels from fallback dir that aren't already present
          for (const lv of levelList) {
            if (!existing.levelList.some(e => e.level === lv.level)) {
              existing.levelList.push(lv)
            }
          }
        } else {
          skillMap.set(id, { levelList })
        }
      }
    }
  }

  // Load passives — pattern: {LANG}_Passives*.{json|txt}
  for (const dir of [latestDir, fallbackDir]) {
    if (!existsSync(dir)) continue
    const files = globFiles(dir, new RegExp(`^${prefix}_Passive`, 'i'))
    for (const f of files) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const id = (item as any)?.id as number
        if (!id || passiveMap.has(id)) continue
        passiveMap.set(id, {
          name: cleanLocaleContent((item as any).name ?? ''),
          desc: cleanLocaleContent((item as any).desc ?? ''),
        })
      }
    }
  }

  console.log(`  ${prefix} locale: ${skillMap.size} skills, ${passiveMap.size} passives`)
  return { skillMap, passiveMap }
}

type EgoSkillLocaleEntry = { name: string; desc: string; coinlist?: any[] }

function loadKrEgoSkillLocale(): Map<string, EgoSkillLocaleEntry> {
  const map = new Map<string, EgoSkillLocaleEntry>()

  for (const { dir, ext } of [
    { dir: KR_LATEST_DIR, ext: '.json' },
    { dir: KR_DIR, ext: '.txt' },
  ]) {
    if (!existsSync(dir)) continue
    const files = globFiles(dir, /^KR_Skills_Ego/i).filter(f => f.endsWith(ext))
    for (const f of files) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const id = (item as any)?.id as number
        if (!id) continue
        const levelList = (item as any).levelList ?? []
        for (const lvl of levelList) {
          const level = lvl.level ?? lvl.gaksungLevel
          if (!level) continue
          const key = `${id}_${level}`
          if (map.has(key)) continue
          map.set(key, {
            name: cleanLocaleContent(lvl.name ?? ''),
            desc: cleanLocaleContent(lvl.desc ?? ''),
            coinlist: cleanLangCoinList(lvl.coinlist),
          })
        }
      }
    }
  }

  return map
}

function loadEgoSkillLocale(lang: 'en' | 'jp'): Map<string, EgoSkillLocaleEntry> {
  // Key: `${skillGameId}_${level}` e.g. "2010111_3"
  // Only ego skill files — exclude EN_Skills_Ego_Personality-* (those are identity skills)
  const prefix = lang.toUpperCase()
  const latestDir = lang === 'en' ? EN_LATEST_DIR : JP_LATEST_DIR
  const fallbackDir = lang === 'en' ? EN_DIR : JP_DIR
  const map = new Map<string, EgoSkillLocaleEntry>()

  for (const dir of [latestDir, fallbackDir]) {
    if (!existsSync(dir)) continue
    const files = globFiles(dir, new RegExp(`^${prefix}_Skills_Ego`, 'i'))
    for (const f of files) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const id = (item as any)?.id as number
        if (!id) continue
        const levelList = (item as any).levelList ?? []
        for (const lvl of levelList) {
          const level = lvl.level ?? lvl.gaksungLevel
          if (!level) continue
          const key = `${id}_${level}`
          if (map.has(key)) continue
          map.set(key, {
            name: cleanLocaleContent(lvl.name ?? ''),
            desc: cleanLocaleContent(lvl.desc ?? ''),
            coinlist: cleanLangCoinList(lvl.coinlist),
          })
        }
      }
    }
  }
  return map
}

function loadEgoPassiveLocale(lang: 'en' | 'jp'): Map<number, { name: string; desc: string }> {
  // Only ego passive files — exclude EN_Passive_Personalities-* etc.
  const prefix = lang.toUpperCase()
  const latestDir = lang === 'en' ? EN_LATEST_DIR : JP_LATEST_DIR
  const fallbackDir = lang === 'en' ? EN_DIR : JP_DIR
  const map = new Map<number, { name: string; desc: string }>()

  for (const dir of [latestDir, fallbackDir]) {
    if (!existsSync(dir)) continue
    const files = globFiles(dir, new RegExp(`^${prefix}_Passive_Ego`, 'i'))
    for (const f of files) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const id = (item as any)?.id as number
        if (!id || map.has(id)) continue
        map.set(id, {
          name: cleanLocaleContent((item as any).name ?? ''),
          desc: cleanLocaleContent((item as any).desc ?? ''),
        })
      }
    }
  }
  return map
}

function translateDescLang(
  desc: string | undefined,
  tagMap: Record<string, string>,
  conditionTags: Record<string, string>,
  lang: 'en' | 'jp' = 'en',
): string {
  if (!desc) return ''
  // {0} → Potency/威力, {1} → Count/回数
  const potency = lang === 'jp' ? '威力' : 'Potency'
  const count = lang === 'jp' ? '回数' : 'Count'
  return stripLimbusRichTextTags(desc)
    .replace(/\{0\}/g, potency)
    .replace(/\{1\}/g, count)
    .replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (match, tag) => {
      const name = cleanLocaleContent(tagMap[tag] ?? '')
      if (!name) return match
      if (conditionTags[tag]) return `[${name}]`
      return name
    })
    .trim()
}

function buildDescriptionLang(
  langSkillEntry: { name: string; desc: string; coinlist?: any[] } | undefined,
  tagMap: Record<string, string>,
  conditionTags: Record<string, string>,
  lang: 'en' | 'jp',
): string {
  if (!langSkillEntry) return ''
  const parts: string[] = []
  const globalDesc = translateDescLang(langSkillEntry.desc, tagMap, conditionTags, lang).trim()
  if (globalDesc) parts.push(globalDesc)

  for (let i = 0; i < (langSkillEntry.coinlist ?? []).length; i++) {
    const coin = langSkillEntry.coinlist![i]
    const descs = (coin.coindescs ?? [])
      .map((cd: any) => translateDescLang(cd.desc ?? '', tagMap, conditionTags, lang).trim())
      .filter(Boolean)
    if (descs.length > 0) {
      const coinLabel = lang === 'en' ? `[Coin ${i + 1}]` : `[コイン ${i + 1}]`
      parts.push(`${coinLabel} ${descs[0]}`)
      for (let j = 1; j < descs.length; j++) parts.push(descs[j])
    }
  }
  return parts.join('\n')
}

function buildDescriptionKr(langSkillEntry: EgoSkillLocaleEntry | undefined): string {
  if (!langSkillEntry) return ''
  const parts: string[] = []
  const globalDesc = translateDesc(langSkillEntry.desc).trim()
  if (globalDesc) parts.push(globalDesc)

  for (let i = 0; i < (langSkillEntry.coinlist ?? []).length; i++) {
    const coin = langSkillEntry.coinlist![i]
    const descs = (coin.coindescs ?? [])
      .map((cd: any) => translateDesc(cd.desc ?? '').trim())
      .filter(Boolean)
    if (descs.length > 0) {
      parts.push(`[코인 ${i + 1}] ${descs[0]}`)
      for (let j = 1; j < descs.length; j++) parts.push(descs[j])
    }
  }
  return parts.join('\n')
}

// ── Stat computation ──────────────────────────────────────────────────────────

function getResistance(p: Personality, atkType: string): string | null {
  const entry = p.resistInfo?.atkResistList?.find(r => r.type === atkType)
  if (!entry) return null
  return RES_VALUE_MAP[entry.value] ?? null
}

function translateKeywords(keywordList: string[] | undefined): string[] {
  const result: string[] = []
  for (const kw of keywordList ?? []) {
    const kr = TAG_MAP[kw]
    if (kr && !CONDITION_TAG_MAP[kw] && !KEYWORD_PLACEHOLDERS.has(kr)) result.push(kr)
  }
  return result
}

function translateUnitKeywords(keywordList: string[] | undefined): string[] {
  const result: string[] = []
  for (const kw of keywordList ?? []) {
    const kr = UNIT_KEYWORD_MAP[kw]
    if (kr) result.push(kr)
  }
  return result
}

function translateAssociations(associationList: string[] | undefined): string[] {
  const result: string[] = []
  for (const association of associationList ?? []) {
    const kr = ASSOCIATION_NAME_MAP[association]
    if (kr) result.push(kr)
  }
  return result
}

function pickRepresentativeAffiliation(associationList: string[]): string | null {
  if (associationList.length === 0) return null

  for (const association of associationList) {
    if (BROAD_AFFILIATION_NAMES.has(association) && associationList.length > 1) continue
    return association
  }

  return associationList[0] ?? null
}

function calcIdentityStats(
  p: Personality,
  krName: KrPersonality | undefined,
  quoteMap: Map<string, string>,
): ComputedIdentity {
  const base_hp = p.hp?.defaultStat ?? null
  const hp = base_hp != null ? Math.round(base_hp + (p.hp?.incrementByLevel ?? 0) * 60) : null
  const hp_per_level = p.hp?.incrementByLevel ?? null
  const speed_min = p.minSpeedList?.[3] ?? null
  const speed_max = p.maxSpeedList?.[3] ?? null
  const def_level = p.defCorrection != null ? 60 + p.defCorrection : null
  const rarity = p.rank ?? null
  const slash_res = getResistance(p, 'SLASH')
  const pierce_res = getResistance(p, 'PENETRATE')
  const blunt_res = getResistance(p, 'HIT')
  const break_section = (p.breakSection as { sectionList: unknown } | undefined)?.sectionList ?? null
  const skill_keyword_list = translateKeywords(p.skillKeywordList)
  const unit_keyword_list = translateUnitKeywords(p.unitKeywordList)
  const association_list = translateAssociations(p.associationList)
  const keywords = [...skill_keyword_list]

  const folder_name = p.appearance ? p.appearance.replace(/^\d+_/, '') : null
  const name_kr = krName?.nameWithTitle ?? krName?.name ?? null
  const name = name_kr

  const sinner = SINNERS.find(s => s.id === p.characterId)
  const sinner_slug = sinner?.slug ?? null

  const affiliation = pickRepresentativeAffiliation(association_list)
  const quote = quoteMap.get(String(p.id))

  const identity: ComputedIdentity = {
    game_id: String(p.id),
    sinner_slug,
    name,
    name_kr,
    hp,
    base_hp,
    hp_per_level,
    speed_min,
    speed_max,
    def_level,
    rarity,
    slash_res,
    pierce_res,
    blunt_res,
    break_section,
    skill_keyword_list,
    unit_keyword_list,
    association_list,
    keywords,
    folder_name,
    affiliation,
  }
  if (quote) identity.quote = quote
  return identity
}

// ── Skill building ────────────────────────────────────────────────────────────

type SkillDataLevel = z.infer<typeof SkillDataLevelSchema>

function resolveToLevel(skill: PersonalitySkill, targetLevel: number): SkillDataLevel {
  const merged: Record<string, unknown> = {}
  const sorted = [...skill.skillData].sort((a, b) => (a.gaksungLevel ?? 0) - (b.gaksungLevel ?? 0))
  for (const sd of sorted) {
    if ((sd.gaksungLevel ?? 0) > targetLevel) break
    for (const [k, v] of Object.entries(sd)) {
      if (k === 'gaksungLevel') continue
      if (k === 'coinList' && Array.isArray(v) && v.length === 0) continue
      if (v === null || v === undefined) continue
      merged[k] = v
    }
  }
  return merged as SkillDataLevel
}

function getBestLevelEntry<T extends { level: number }>(
  levelList: T[] = [],
  targetLevel = Infinity,
): T | null {
  return levelList
    .filter(l => l.level <= targetLevel)
    .sort((a, b) => b.level - a.level)[0] ?? levelList[0] ?? null
}

export function hasLocalizedSkillContent(skill: KrSkill | undefined, targetLevel = Infinity): boolean {
  const best = getBestLevelEntry(skill?.levelList ?? [], targetLevel)
  return Boolean(cleanLocaleContent(best?.name ?? ''))
}

function translateDescWithTagMap(
  desc: string | undefined,
  tagMap: Record<string, string>,
  conditionTags: Record<string, string>,
): string {
  if (!desc) return ''
  return stripLimbusRichTextTags(desc)
    .replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (match, tag, offset, str) => {
      const kr = cleanLocaleContent(tagMap[tag] ?? '')
      if (!kr) return match
      if (conditionTags[tag]) return `[${kr}]`
      const before = offset > 0 ? (str as string)[offset - 1] : ''
      const needSpaceBefore = before && /[가-힣0-9]/.test(before)
      return (needSpaceBefore ? ' ' : '') + kr
    })
    .trim()
}

export function translateDesc(desc: string | undefined): string {
  return translateDescWithTagMap(desc, TAG_MAP, CONDITION_TAG_MAP)
}

export function translateDescriptionForSyncTest(desc: string | undefined, tagMap: Record<string, string>): string {
  return translateDescWithTagMap(desc, tagMap, CONDITION_TAG_MAP)
}

function buildDescription(krSkillItem: KrSkill | undefined, targetLevel: number): string {
  if (!krSkillItem) return ''
  const best = getBestLevelEntry(krSkillItem.levelList ?? [], targetLevel)
  if (!best) return ''

  const parts: string[] = []
  const globalDesc = translateDesc(best.desc ?? '').trim()
  if (globalDesc) parts.push(globalDesc)

  for (let i = 0; i < (best.coinlist ?? []).length; i++) {
    const coin = best.coinlist![i]
    const descs = (coin.coindescs ?? [])
      .map(cd => translateDesc(cd.desc ?? '').trim())
      .filter(Boolean)
    if (descs.length > 0) {
      parts.push(`[코인 ${i + 1}] ${descs[0]}`)
      for (let j = 1; j < descs.length; j++) parts.push(descs[j])
    }
  }
  return parts.join('\n')
}

export function buildSkillRows(
  gamePerson: Personality,
  skillMap: Map<number, PersonalitySkill>,
  krSkillMap: Map<number, KrSkill>,
  identityId: string | null,
  enLocale?: LangLocaleData,
  jpLocale?: LangLocaleData,
  enTagMap?: Record<string, string>,
  jpTagMap?: Record<string, string>,
): SkillRow[] {
  const attackSkillIds = (gamePerson.attributeList ?? []).map(a => a.skillId)
  const defenseSkillIds = gamePerson.defenseSkillIDList ?? []
  const rows: SkillRow[] = []

  for (const uptie of UPTIE_LEVELS) {
    let variantIdx = 0

    // Attack skills
    for (const sid of attackSkillIds) {
      const gs = skillMap.get(sid)
      if (!gs) continue
      const r = resolveToLevel(gs, uptie)
      const coinList = r.coinList ?? []
      const krItem = krSkillMap.get(sid)
      if (!hasLocalizedSkillContent(krItem, uptie)) continue
      const best = getBestLevelEntry(krItem?.levelList ?? [], uptie)
      const skillOrder = gs.skillTier ?? 1
      const name = cleanLocaleContent(best?.name ?? '')
      if (!name) continue
      const description = buildDescription(krItem, uptie)
      const isDefense = r.defType && r.defType !== 'ATTACK'

      const enSkillLvl = enLocale ? getBestLevelEntry(enLocale.skillMap.get(sid)?.levelList ?? [], uptie) : null
      const jpSkillLvl = jpLocale ? getBestLevelEntry(jpLocale.skillMap.get(sid)?.levelList ?? [], uptie) : null
      rows.push({
        identity_id: identityId,
        name,
        name_en: enSkillLvl?.name ?? null,
        name_jp: jpSkillLvl?.name ?? null,
        skill_type: isDefense ? (DEF_TYPE_MAP[r.defType!] ?? null) : (ATK_TYPE_MAP[r.atkType ?? ''] ?? null),
        atk_type: ATK_TYPE_MAP[r.atkType ?? ''] ?? null,
        sin_affinity: SIN_MAP[r.attributeType ?? ''] ?? null,
        base_power: r.defaultValue ?? null,
        coin_power: coinList.length > 0
          ? (coinList[0].operatorType === 'SUB' ? -(coinList[0].scale ?? 0) : (coinList[0].scale ?? null))
          : null,
        coins: coinList.length || 1,
        offense_level: r.skillLevelCorrection != null ? 60 + r.skillLevelCorrection : null,
        description,
        description_en: enSkillLvl ? buildDescriptionLang(enSkillLvl, enTagMap!, CONDITION_TAG_EN, 'en') || null : null,
        description_jp: jpSkillLvl ? buildDescriptionLang(jpSkillLvl, jpTagMap!, CONDITION_TAG_JP, 'jp') || null : null,
        skill_order: skillOrder,
        atk_weight: r.targetNum ?? 1,
        variant_order: ++variantIdx,
        uptie_level: uptie,
      })
    }

    // Defense skills (exclude variants with requireIDList)
    const defSkills = defenseSkillIds
      .map(sid => skillMap.get(sid))
      .filter((gs): gs is PersonalitySkill => !!gs && !gs.isHiddenForUI && !(gs.requireIDList && gs.requireIDList.length > 0))

    for (const gs of defSkills) {
      const r = resolveToLevel(gs, uptie)
      const coinList = r.coinList ?? []
      const krItem = krSkillMap.get(gs.id)
      if (!hasLocalizedSkillContent(krItem, uptie)) continue
      const best = getBestLevelEntry(krItem?.levelList ?? [], uptie)
      const name = cleanLocaleContent(best?.name ?? '')
      if (!name) continue
      const description = buildDescription(krItem, uptie)
      const isDefense = r.defType && r.defType !== 'ATTACK'

      const enDefLvl = enLocale ? getBestLevelEntry(enLocale.skillMap.get(gs.id)?.levelList ?? [], uptie) : null
      const jpDefLvl = jpLocale ? getBestLevelEntry(jpLocale.skillMap.get(gs.id)?.levelList ?? [], uptie) : null
      rows.push({
        identity_id: identityId,
        name,
        name_en: enDefLvl?.name ?? null,
        name_jp: jpDefLvl?.name ?? null,
        skill_type: isDefense ? (DEF_TYPE_MAP[r.defType!] ?? null) : (ATK_TYPE_MAP[r.atkType ?? ''] ?? null),
        atk_type: ATK_TYPE_MAP[r.atkType ?? ''] ?? null,
        sin_affinity: SIN_MAP[r.attributeType ?? ''] ?? null,
        base_power: r.defaultValue ?? null,
        coin_power: coinList.length > 0
          ? (coinList[0].operatorType === 'SUB' ? -(coinList[0].scale ?? 0) : (coinList[0].scale ?? null))
          : null,
        coins: coinList.length || 1,
        offense_level: r.skillLevelCorrection != null ? 60 + r.skillLevelCorrection : null,
        description,
        description_en: enDefLvl ? buildDescriptionLang(enDefLvl, enTagMap!, CONDITION_TAG_EN, 'en') || null : null,
        description_jp: jpDefLvl ? buildDescriptionLang(jpDefLvl, jpTagMap!, CONDITION_TAG_JP, 'jp') || null : null,
        skill_order: 4,
        atk_weight: r.targetNum ?? 1,
        variant_order: ++variantIdx,
        uptie_level: uptie,
      })
    }
  }
  return rows
}

// ── Passive building ──────────────────────────────────────────────────────────

function buildPassiveRows(
  pm: PassiveMapping,
  identityId: string,
  krPassiveMap: Map<number, KrPassive>,
  passiveDetailMap: Map<number, PassiveDetail>,
  enLocale?: LangLocaleData,
  jpLocale?: LangLocaleData,
  enTagMap?: Record<string, string>,
  jpTagMap?: Record<string, string>,
): PassiveRow[] {
  const rows: PassiveRow[] = []

  for (const uptie of UPTIE_LEVELS) {
    let passiveOrder = 0

    // Battle passive: highest level <= uptie
    const battleLevel = (pm.battlePassiveList ?? [])
      .filter(l => l.level <= uptie)
      .sort((a, b) => b.level - a.level)[0]
    if (battleLevel) {
      for (const pid of battleLevel.passiveIDList) {
        const kr = krPassiveMap.get(pid)
        const detail = passiveDetailMap.get(pid)
        // Skip placeholder passives with no KR name (game data incomplete)
        if (!kr?.name) continue
        const hasStock = (detail?.attributeStockCondition?.length ?? 0) > 0
        const hasResonance = (detail?.attributeResonanceCondition?.length ?? 0) > 0
        const conds = detail?.attributeStockCondition ?? detail?.attributeResonanceCondition ?? []
        const sinCond = conds[0]
        rows.push({
          identity_id: identityId,
          name: kr.name,
          name_en: enLocale?.passiveMap.get(pid)?.name ?? null,
          name_jp: jpLocale?.passiveMap.get(pid)?.name ?? null,
          passive_type: 'battle',
          sin_affinity: sinCond ? (SIN_MAP[sinCond.type ?? ''] ?? null) : null,
          sin_count: sinCond?.value ?? null,
          active_cond: hasStock ? 'stock' : hasResonance ? 'resonance' : null,
          description: translateDesc(kr?.desc ?? ''),
          description_en: enLocale ? translateDescLang(enLocale.passiveMap.get(pid)?.desc, enTagMap!, CONDITION_TAG_EN, 'en') || null : null,
          description_jp: jpLocale ? translateDescLang(jpLocale.passiveMap.get(pid)?.desc, jpTagMap!, CONDITION_TAG_JP, 'jp') || null : null,
          passive_order: ++passiveOrder,
          uptie_level: uptie,
        })
      }
    }

    // Support passive: highest level <= uptie
    const supportLevel = (pm.supporterPassiveList ?? [])
      .filter(l => l.level <= uptie)
      .sort((a, b) => b.level - a.level)[0]
    if (supportLevel) {
      for (const pid of supportLevel.passiveIDList) {
        const kr = krPassiveMap.get(pid)
        const detail = passiveDetailMap.get(pid)
        // Skip placeholder passives with no KR name (game data incomplete)
        if (!kr?.name) continue
        const hasStock = (detail?.attributeStockCondition?.length ?? 0) > 0
        const hasResonance = (detail?.attributeResonanceCondition?.length ?? 0) > 0
        const conds = detail?.attributeStockCondition ?? detail?.attributeResonanceCondition ?? []
        const sinCond = conds[0]
        rows.push({
          identity_id: identityId,
          name: kr.name,
          name_en: enLocale?.passiveMap.get(pid)?.name ?? null,
          name_jp: jpLocale?.passiveMap.get(pid)?.name ?? null,
          passive_type: 'support',
          sin_affinity: sinCond ? (SIN_MAP[sinCond.type ?? ''] ?? null) : null,
          sin_count: sinCond?.value ?? null,
          active_cond: hasStock ? 'stock' : hasResonance ? 'resonance' : null,
          description: translateDesc(kr?.desc ?? ''),
          description_en: enLocale ? translateDescLang(enLocale.passiveMap.get(pid)?.desc, enTagMap!, CONDITION_TAG_EN, 'en') || null : null,
          description_jp: jpLocale ? translateDescLang(jpLocale.passiveMap.get(pid)?.desc, jpTagMap!, CONDITION_TAG_JP, 'jp') || null : null,
          passive_order: ++passiveOrder,
          uptie_level: uptie,
        })
      }
    }
  }
  return rows
}

// ── Four-source keyword extraction ───────────────────────────────────────────

function addMappedKeyword(keywords: Set<string>, tag: string): void {
  const keyword = TAG_MAP[tag] ?? UNIT_KEYWORD_MAP[tag]
  if (keyword && !KEYWORD_PLACEHOLDERS.has(keyword)) keywords.add(keyword)
}

function collectBuffKeywords(value: unknown, keywords: Set<string>): void {
  if (!value) return
  if (Array.isArray(value)) {
    for (const item of value) collectBuffKeywords(item, keywords)
    return
  }
  if (typeof value !== 'object') return
  const obj = value as Record<string, unknown>
  if (typeof obj.buffKeyword === 'string') addMappedKeyword(keywords, obj.buffKeyword)
  if (typeof obj.scriptName === 'string') {
    const sn = obj.scriptName
    for (const tag of Object.keys(TAG_MAP)) {
      if (CONDITION_TAG_MAP[tag]) continue
      if (tag.length < 6) continue
      if (EXCLUDED_TAGS.has(tag)) continue
      if (sn.includes(tag)) addMappedKeyword(keywords, tag)
    }
  }
  for (const child of Object.values(obj)) collectBuffKeywords(child, keywords)
}

function collectBracketKeywords(rawTexts: string[], keywords: Set<string>): void {
  const rawText = rawTexts.join('\n')
  for (const match of rawText.matchAll(TAG_PATTERN)) {
    const tag = match[1]
    if (CONDITION_TAG_MAP[tag]) continue
    if (EXCLUDED_TAGS.has(tag)) continue
    addMappedKeyword(keywords, tag)
  }
}

function collectKrDescriptions(target: string[], krText: KrSkill | KrPassive | null | undefined): void {
  if (!krText) return
  // KrPassive has top-level desc
  const textObj = krText as { desc?: string; levelList?: Array<{ desc?: string; coinlist?: Array<{ coindescs?: Array<{ desc?: string }> }> }>; coindescs?: Array<{ desc?: string }> }
  if (textObj.desc) target.push(textObj.desc)
  for (const coinDesc of textObj.coindescs ?? []) {
    if (coinDesc?.desc) target.push(coinDesc.desc)
  }
  for (const level of textObj.levelList ?? []) {
    if (level?.desc) target.push(level.desc)
    for (const coin of level.coinlist ?? []) {
      for (const coinDesc of coin.coindescs ?? []) {
        if (coinDesc?.desc) target.push(coinDesc.desc)
      }
    }
  }
}

function populateIdentityKeywordContext(
  ctx: KeywordContext,
  gamePerson: Personality,
  skillMap: Map<number, PersonalitySkill>,
  krSkillMap: Map<number, KrSkill>,
  passiveMappings: PassiveMapping[],
  passiveDetailMap: Map<number, PassiveDetail>,
  krPassiveMap: Map<number, KrPassive>,
): void {
  const skillIds = [
    ...(gamePerson.attributeList ?? []).map(a => a.skillId),
    ...(gamePerson.defenseSkillIDList ?? []),
  ]

  ctx.gamePerson = gamePerson
  ctx.skillMap = new Map(
    skillIds
      .map(sid => [sid, skillMap.get(sid)] as const)
      .filter((entry): entry is [number, PersonalitySkill] => entry[1] !== undefined),
  )
  ctx.rawKrTexts = []
  ctx.passiveDetails = []

  for (const sid of skillIds) {
    collectKrDescriptions(ctx.rawKrTexts, krSkillMap.get(sid))
  }

  const passiveMapping = passiveMappings.find(pm => String(pm.personalityID) === String(gamePerson.id))
  const passiveIds = [
    ...(passiveMapping?.battlePassiveList ?? []).flatMap(level => level.passiveIDList),
    ...(passiveMapping?.supporterPassiveList ?? []).flatMap(level => level.passiveIDList),
  ]
  for (const pid of passiveIds) {
    collectKrDescriptions(ctx.rawKrTexts, krPassiveMap.get(pid))
    const detail = passiveDetailMap.get(pid)
    if (detail) ctx.passiveDetails.push(detail)
  }
}

function addSkillKeywords(keywords: Set<string>, keywordList: string[] | undefined): void {
  for (const keyword of keywordList ?? []) {
    const mapped = TAG_MAP[keyword]
    if (mapped && !CONDITION_TAG_MAP[keyword] && !KEYWORD_PLACEHOLDERS.has(mapped)) {
      keywords.add(mapped)
    }
  }
}

function extractKeywords(ctx: KeywordContext): string[] {
  if (!ctx.gamePerson) return []
  const keywords = new Set<string>()

  // Source 1: official representative/main skill keywords only.
  addSkillKeywords(keywords, ctx.gamePerson.skillKeywordList)

  // Source 2: buffKeyword from skill coinList abilityScriptList
  const skillIds = [
    ...(ctx.gamePerson.attributeList ?? []).map(a => a.skillId),
    ...(ctx.gamePerson.defenseSkillIDList ?? []),
  ]
  for (const sid of skillIds) {
    collectBuffKeywords(ctx.skillMap.get(sid)?.skillData, keywords)
  }

  // Source 3: buffKeyword from passive details
  for (const detail of ctx.passiveDetails) {
    collectBuffKeywords(detail, keywords)
  }

  // Source 4: [EnglishTag] patterns in raw KR texts
  collectBracketKeywords(ctx.rawKrTexts, keywords)

  return [...keywords].sort()
}

function extractSourceIdentityKeywords(): Map<string, SourceKeywordHit> {
  const gamePersonMap = loadPersonalities()
  const gameSkillMap = loadPersonalitySkills()
  const krSkillMap = loadKrSkills()
  const passiveMappings = loadPassiveMappings()
  const passiveDetailMap = loadPassiveDetails()
  const krPassiveMap = loadKrPassives()
  const targetSinnerIds: Set<number> | null = SINNER_FILTER
    ? new Set<number>(SINNERS.filter(s => s.slug === SINNER_FILTER).map(s => s.id))
    : null

  if (SINNER_FILTER && (!targetSinnerIds || targetSinnerIds.size === 0)) {
    throw new Error(`알 수 없는 sinner slug: ${SINNER_FILTER}`)
  }

  const keywords = new Map<string, SourceKeywordHit>()
  for (const gamePerson of gamePersonMap.values()) {
    if (targetSinnerIds && !targetSinnerIds.has(gamePerson.characterId)) continue

    const ctx: KeywordContext = {
      gamePerson: null,
      skillMap: new Map(),
      rawKrTexts: [],
      passiveDetails: [],
    }
    populateIdentityKeywordContext(ctx, gamePerson, gameSkillMap, krSkillMap, passiveMappings, passiveDetailMap, krPassiveMap)

    for (const keyword of extractKeywords(ctx)) {
      if (KEYWORD_PLACEHOLDERS.has(keyword)) continue
      const hit = keywords.get(keyword) ?? { gameIds: new Set<string>() }
      hit.gameIds.add(String(gamePerson.id))
      keywords.set(keyword, hit)
    }
  }

  return keywords
}

function slugifyKeywordIconPart(value: string | null | undefined): string | null {
  const slug = value
    ?.normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase()

  return slug || null
}

function deriveKeywordIconSlug(options: {
  name: string
  existingIconSlug?: string | null
  nameEn?: string | null
  tag?: string
}): string | null {
  const override = KEYWORD_ICON_SLUG_OVERRIDES[options.name]
  if (override) return override

  const existingIconSlug = options.existingIconSlug?.trim()
  if (existingIconSlug) return existingIconSlug

  const nameSlug = slugifyKeywordIconPart(options.nameEn)
  if (nameSlug) return nameSlug

  return slugifyKeywordIconPart(options.tag?.replace(/ID$/, ''))
}

// ── Diff helpers ──────────────────────────────────────────────────────────────

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b)
  return a === b
}

type StatField = typeof STAT_FIELDS[number]

function diffIdentity(
  computed: ComputedIdentity,
  dbRow: Record<string, unknown>,
): Partial<Record<StatField, { from: unknown; to: unknown }>> {
  const changes: Partial<Record<StatField, { from: unknown; to: unknown }>> = {}
  for (const field of STAT_FIELDS) {
    const newVal = computed[field as keyof ComputedIdentity]
    if (field === 'quote' && newVal === undefined) continue
    const oldVal = dbRow[field]
    if (!valuesEqual(newVal, oldVal)) {
      changes[field] = { from: oldVal, to: newVal }
    }
  }
  return changes
}

function isMissingColumnError(error: { code?: string; message?: string }, column: string): boolean {
  return error.code === '42703' || (error.message ?? '').includes(column)
}

async function loadIdentityRows(): Promise<{
  rows: Record<string, unknown>[]
  availableGameArrayColumns: Set<GameArrayColumn>
}> {
  const available = new Set<GameArrayColumn>(GAME_ARRAY_COLUMNS)
  const missing = new Set<GameArrayColumn>()

  while (true) {
    const selectedColumns = GAME_ARRAY_COLUMNS.filter(column => available.has(column))
    const select = selectedColumns.length > 0
      ? `${BASE_IDENTITY_SELECT},${selectedColumns.join(',')}`
      : BASE_IDENTITY_SELECT

    const result = await supabase
      .from('identities')
      .select(select)
      .limit(2000)

    if (!result.error) {
      return {
        rows: ((result.data ?? []) as unknown as Record<string, unknown>[])
          .map(row => {
            const filled = { ...row }
            for (const column of missing) filled[column] = []
            return filled
          }),
        availableGameArrayColumns: available,
      }
    }

    const missingColumn = selectedColumns.find(column => isMissingColumnError(result.error!, column))
    if (!missingColumn) throw new Error(`DB 인격 로드 실패: ${result.error.message}`)

    console.warn(YELLOW(`  [경고] identities.${missingColumn} 컬럼이 없어 해당 필드를 제외하고 재시도합니다. migration 적용 전 dry-run 호환 경로입니다.`))
    available.delete(missingColumn)
    missing.add(missingColumn)
  }
}

// ── Supabase batch helpers ────────────────────────────────────────────────────

async function supaInsertBatch(table: string, rows: unknown[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error } = await supabase.from(table).insert(batch as object[])
    if (error) {
      if (error.code === '429' || error.message.includes('502')) {
        console.log(YELLOW('    rate limit, 3초 대기 후 재시도...'))
        await sleep(3000)
        const { error: retryErr } = await supabase.from(table).insert(batch as object[])
        if (retryErr) throw new Error(`INSERT ${table} retry: ${retryErr.message}`)
      } else {
        throw new Error(`INSERT ${table}: ${error.message}`)
      }
    }
    if (rows.length > 50) await sleep(200)
  }
}

async function loadSkillRowsForIdentity(identityId: string): Promise<DbSkillRow[] | null> {
  const { data, error } = await supabase
    .from('skills')
    .select(SKILL_SELECT_FIELDS)
    .eq('identity_id', identityId)
    .limit(300)

  if (error) {
    console.error(RED(`    [ERROR] 스킬 로드 실패: ${error.message}`))
    return null
  }

  return (data ?? []) as DbSkillRow[]
}

async function syncExistingIdentitySkills(
  identityId: string,
  identityName: string,
  gameId: string,
  generatedRows: SkillRow[],
): Promise<{ changed: boolean; deleted: number; inserted: number }> {
  const dbRows = await loadSkillRowsForIdentity(identityId)
  if (!dbRows) return { changed: false, deleted: 0, inserted: 0 }

  if (!areSkillRowsDifferent(generatedRows, dbRows)) {
    return { changed: false, deleted: 0, inserted: 0 }
  }

  if (generatedRows.length === 0 && dbRows.length > 0) {
    console.warn(YELLOW(`  [경고] ${identityName} (${gameId}): 게임 스킬 0개라 DB ${dbRows.length}개 삭제를 건너뜁니다.`))
    return { changed: true, deleted: 0, inserted: 0 }
  }

  console.log(CYAN(`  [스킬 diff] ${identityName} (${gameId}): DB ${dbRows.length}개 → 게임 ${generatedRows.length}개`))

  if (DRY_RUN) {
    return { changed: true, deleted: 0, inserted: 0 }
  }

  if (dbRows.length > 0) {
    const { error: delErr } = await supabase
      .from('skills')
      .delete()
      .eq('identity_id', identityId)
    if (delErr) {
      console.error(RED(`    [ERROR] 스킬 삭제 실패 (${identityName}): ${delErr.message}`))
      return { changed: true, deleted: 0, inserted: 0 }
    }
  }

  if (generatedRows.length > 0) {
    await supaInsertBatch('skills', generatedRows)
  }

  console.log(GREEN(`    스킬 재구축: 삭제 ${dbRows.length}개 / 삽입 ${generatedRows.length}개`))
  await sleep(100)
  return { changed: true, deleted: dbRows.length, inserted: generatedRows.length }
}

// ── EGO release_date sync ────────────────────────────────────────────────────

function loadEgoReleaseDateSources(): {
  sourceFiles: string[]
  sourceByGameId: Map<string, EgoReleaseDateSource>
  ambiguousSource: Map<string, EgoReleaseDateSource[]>
  sourceEntries: number
  skippedEntries: number
} {
  const sourceFiles = globFiles(DATA_DIR, TRUE_EGO_FILE_RE)
  const sourceByGameId = new Map<string, EgoReleaseDateSource>()
  const ambiguousSource = new Map<string, EgoReleaseDateSource[]>()
  let sourceEntries = 0
  let skippedEntries = 0

  for (const sourceFile of sourceFiles) {
    const data = readTxt(join(DATA_DIR, sourceFile))
    for (const entry of extractList(data)) {
      const parsed = EgoReleaseDateSourceSchema.safeParse(entry)
      if (!parsed.success) {
        skippedEntries++
        continue
      }

      const gameId = String(parsed.data.id).trim()
      const releaseDate = formatGameUpdatedDate(parsed.data.updatedDate)
      if (!gameId || !releaseDate) {
        skippedEntries++
        continue
      }

      sourceEntries++
      const next: EgoReleaseDateSource = {
        release_date: releaseDate,
        updatedDate: String(parsed.data.updatedDate),
        sourceFile,
      }
      const current = sourceByGameId.get(gameId)

      if (!current) {
        sourceByGameId.set(gameId, next)
        continue
      }

      if (current.release_date !== next.release_date) {
        const records = ambiguousSource.get(gameId) ?? [current]
        records.push(next)
        ambiguousSource.set(gameId, records)
      }
    }
  }

  for (const gameId of ambiguousSource.keys()) {
    sourceByGameId.delete(gameId)
  }

  return { sourceFiles, sourceByGameId, ambiguousSource, sourceEntries, skippedEntries }
}

function isMissingReleaseDateColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null
  return err?.code === '42703' && String(err?.message ?? '').includes('release_date')
}

function filterEgoRowsBySinners(
  rows: EgoReleaseDateDbRow[],
  targetSinners: typeof SINNERS[number][],
): EgoReleaseDateDbRow[] {
  const targetSlugs = new Set<string>(targetSinners.map(s => s.slug))
  return rows.filter(row => targetSlugs.has(String(row.sinner_id ?? '')))
}

async function loadEgoRowsForReleaseDate(
  targetSinners: typeof SINNERS[number][],
): Promise<{ rows: EgoReleaseDateDbRow[]; columnMissing: boolean }> {
  const withReleaseDate = await supabase
    .from('ego')
    .select('id, game_id, sinner_id, name, name_kr, release_date')
    .limit(1000)

  if (!withReleaseDate.error) {
    return {
      rows: filterEgoRowsBySinners((withReleaseDate.data ?? []) as EgoReleaseDateDbRow[], targetSinners),
      columnMissing: false,
    }
  }

  if (!isMissingReleaseDateColumn(withReleaseDate.error)) {
    throw new Error(`EGO release_date 로드 실패: ${withReleaseDate.error.message}`)
  }

  const withoutReleaseDate = await supabase
    .from('ego')
    .select('id, game_id, sinner_id, name, name_kr')
    .limit(1000)

  if (withoutReleaseDate.error) {
    throw new Error(`EGO release_date fallback 로드 실패: ${withoutReleaseDate.error.message}`)
  }

  return {
    rows: filterEgoRowsBySinners(
      ((withoutReleaseDate.data ?? []) as Array<Omit<EgoReleaseDateDbRow, 'release_date'>>)
        .map(row => ({ ...row, release_date: null })),
      targetSinners,
    ),
    columnMissing: true,
  }
}

function buildEgoReleaseDatePlan(
  rows: EgoReleaseDateDbRow[],
  sourceByGameId: Map<string, EgoReleaseDateSource>,
  ambiguousSource: Map<string, EgoReleaseDateSource[]>,
  columnMissing: boolean,
): {
  changes: EgoReleaseDateChange[]
  summary: {
    dbRows: number
    matched: number
    changed: number
    unchanged: number
    missingSource: number
    missingGameId: number
    ambiguousSource: number
    columnMissing: boolean
  }
} {
  const changes: EgoReleaseDateChange[] = []
  let matched = 0
  let unchanged = 0
  let missingSource = 0
  let missingGameId = 0
  let ambiguousSourceRows = 0

  for (const row of rows) {
    const gameId = String(row.game_id ?? '').trim()
    if (!gameId) {
      missingGameId++
      continue
    }

    if (ambiguousSource.has(gameId)) {
      ambiguousSourceRows++
      continue
    }

    const source = sourceByGameId.get(gameId)
    if (!source) {
      missingSource++
      continue
    }

    matched++
    const before = columnMissing ? null : normalizeReleaseDate(row.release_date)
    const after = source.release_date

    if (before === after) {
      unchanged++
      continue
    }

    changes.push({
      id: row.id,
      game_id: gameId,
      sinner_id: row.sinner_id,
      name: row.name_kr || row.name || null,
      before,
      after,
      updatedDate: source.updatedDate,
      sourceFile: source.sourceFile,
    })
  }

  return {
    changes,
    summary: {
      dbRows: rows.length,
      matched,
      changed: changes.length,
      unchanged,
      missingSource,
      missingGameId,
      ambiguousSource: ambiguousSourceRows,
      columnMissing,
    },
  }
}

function printEgoReleaseDateReport(params: {
  targetSinners: typeof SINNERS[number][]
  sourceFiles: string[]
  sourceEntries: number
  skippedEntries: number
  summary: ReturnType<typeof buildEgoReleaseDatePlan>['summary']
  changes: EgoReleaseDateChange[]
}): void {
  const { targetSinners, sourceFiles, sourceEntries, skippedEntries, summary, changes } = params
  console.log(`\n${'═'.repeat(60)}`)
  console.log(BOLD('  EGO release_date 동기화'))
  console.log('═'.repeat(60))
  console.log(`  sourceDir: ${DATA_DIR}`)
  console.log(`  sourceFiles: ${sourceFiles.length}`)
  console.log(`  sourceEntries: ${sourceEntries}`)
  console.log(`  skippedEntries: ${skippedEntries}`)
  console.log(`  targetSinners: ${targetSinners.map(s => s.slug).join(', ')}`)
  console.log('')
  console.log('  Summary:')
  console.log(`    dbRows: ${summary.dbRows}`)
  console.log(`    matched: ${summary.matched}`)
  console.log(`    changed: ${summary.changed}`)
  console.log(`    unchanged: ${summary.unchanged}`)
  console.log(`    missingSource: ${summary.missingSource}`)
  console.log(`    missingGameId: ${summary.missingGameId}`)
  console.log(`    ambiguousSource: ${summary.ambiguousSource}`)
  console.log(`    columnMissing: ${summary.columnMissing}`)

  if (changes.length > 0) {
    console.log('')
    console.log('  Sample changes:')
    for (const change of changes.slice(0, 10)) {
      console.log(
        `    ${change.game_id} ${change.name ?? '(unnamed)'}: ` +
        `${change.before ?? '(null)'} -> ${change.after} ` +
        `(${change.sourceFile}, updatedDate=${change.updatedDate})`,
      )
    }
  }
}

async function syncEgoReleaseDates(targetSinners: typeof SINNERS[number][]): Promise<void> {
  const { sourceFiles, sourceByGameId, ambiguousSource, sourceEntries, skippedEntries } =
    loadEgoReleaseDateSources()
  const { rows, columnMissing } = await loadEgoRowsForReleaseDate(targetSinners)
  const { changes, summary } = buildEgoReleaseDatePlan(rows, sourceByGameId, ambiguousSource, columnMissing)

  printEgoReleaseDateReport({
    targetSinners,
    sourceFiles,
    sourceEntries,
    skippedEntries,
    summary,
    changes,
  })

  if (DRY_RUN) return

  if (columnMissing) {
    throw new Error('Abort: limbus.ego.release_date column is missing. Apply the migration before --fix.')
  }

  let updated = 0
  for (const change of changes) {
    const { error } = await supabase
      .from('ego')
      .update({ release_date: change.after })
      .eq('id', change.id)

    if (error) throw new Error(`EGO release_date 업데이트 실패 (${change.game_id}): ${error.message}`)
    updated++
  }

  console.log(GREEN(`  EGO release_date 업데이트: ${updated}개`))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function rebuildKeywordMeta(): Promise<void> {
  console.log(BOLD('\n══════════════════════════════════════════════════════════════'))
  console.log(BOLD('  keyword_meta 재구축 (게임 데이터 기준)'))
  console.log('══════════════════════════════════════════════════════════════\n')

  // Load KR keyword data with descriptions
  const krKeywords = loadKrKeywordDescriptions()
  console.log(`  KR 키워드/버프 데이터: ${krKeywords.size}개`)

  // Fetch actually used keywords from DB (identities, ego, ego_gifts)
  console.log('  DB에서 실제 사용 키워드 수집 중...')
  const dbUsedKeywords = new Set<string>()

  // Identity keywords (paginated)
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('identities').select('keywords').range(from, from + 999)
    if (error) throw new Error(`identities keywords 로드 실패: ${error.message}`)
    if (!data?.length) break
    for (const r of data) { if (r.keywords) (r.keywords as string[]).forEach(k => dbUsedKeywords.add(k.normalize('NFC'))) }
    if (data.length < 1000) break
    from += 1000
  }

  // EGO keywords (paginated)
  from = 0
  while (true) {
    const { data, error } = await supabase.from('ego').select('keywords').range(from, from + 999)
    if (error) throw new Error(`ego keywords 로드 실패: ${error.message}`)
    if (!data?.length) break
    for (const r of data) { if (r.keywords) (r.keywords as string[]).forEach(k => dbUsedKeywords.add(k.normalize('NFC'))) }
    if (data.length < 1000) break
    from += 1000
  }

  // EGO gift keywords (paginated)
  from = 0
  while (true) {
    const { data, error } = await supabase.from('ego_gifts').select('keyword').range(from, from + 999)
    if (error) throw new Error(`ego_gifts keyword 로드 실패: ${error.message}`)
    if (!data?.length) break
    for (const r of data) { if (r.keyword) dbUsedKeywords.add((r.keyword as string).normalize('NFC')) }
    if (data.length < 1000) break
    from += 1000
  }

  console.log('  source 인격 키워드 재추출 중...')
  const sourceIdentityKeywords = extractSourceIdentityKeywords()
  const usedKeywords = new Set([...dbUsedKeywords, ...sourceIdentityKeywords.keys()])

  // Filter out placeholder values that aren't real keywords
  for (const placeholder of KEYWORD_PLACEHOLDERS) {
    dbUsedKeywords.delete(placeholder)
    sourceIdentityKeywords.delete(placeholder)
    usedKeywords.delete(placeholder)
  }

  const sourceOnlyCount = [...sourceIdentityKeywords.keys()].filter(k => !dbUsedKeywords.has(k)).length
  console.log(`  실제 사용 키워드: ${usedKeywords.size}개 (DB ${dbUsedKeywords.size}개 + source 인격 ${sourceIdentityKeywords.size}개, source-only ${sourceOnlyCount}개)`)

  // Build reverse map: KR name → tag ID (from TAG_MAP which is tag → KR)
  const krNameToTag: Record<string, string> = {}
  for (const [tag, krName] of Object.entries(TAG_MAP)) {
    if (!krNameToTag[krName]) krNameToTag[krName] = tag
  }

  // Load EN/JP tag maps: tag ID → localized name
  const enTagMap = loadLangTagMap('en')
  const jpTagMap = loadLangTagMap('jp')
  const enKeywordData = loadLangKeywordDescriptions('en')
  const jpKeywordData = loadLangKeywordDescriptions('jp')

  const { data: existingMeta, error: existingMetaError } = await supabase
    .from('keyword_meta')
    .select('name, description, name_en, name_jp, description_en, description_jp, icon_slug')
    .limit(5000)

  if (existingMetaError) {
    throw new Error(`keyword_meta 기존 메타데이터 로드 실패: ${existingMetaError.message}`)
  }

  const existingMetaMap = new Map(
    (existingMeta ?? []).map(row => [
      String(row.name),
      row as {
        name: string
        description: string | null
        name_en: string | null
        name_jp: string | null
        description_en: string | null
        description_jp: string | null
        icon_slug: string | null
      },
    ]),
  )

  // Build insert rows
  const rows: Array<{
    name: string
    description: string | null
    name_en: string | null
    name_jp: string | null
    description_en: string | null
    description_jp: string | null
    icon_slug: string | null
    tag: string | null
    in_db: boolean
    in_source: boolean
  }> = []
  for (const name of usedKeywords) {
    const krData = krKeywords.get(name)
    const tag = krData?.id ?? krNameToTag[name]
    const existing = existingMetaMap.get(name)
    const enData = tag ? enKeywordData.get(tag) : undefined
    const jpData = tag ? jpKeywordData.get(tag) : undefined
    const name_en = tag ? (enData?.name ?? enTagMap[tag] ?? existing?.name_en ?? null) : existing?.name_en ?? null
    const name_jp = tag ? (jpData?.name ?? jpTagMap[tag] ?? existing?.name_jp ?? null) : existing?.name_jp ?? null
    const icon_slug = deriveKeywordIconSlug({
      name,
      existingIconSlug: existing?.icon_slug,
      nameEn: name_en,
      tag,
    })
    rows.push({
      name,
      description: KEYWORD_DESCRIPTION_OVERRIDES[name] ?? krData?.description ?? existing?.description ?? null,
      name_en,
      name_jp,
      description_en: enData?.description ?? existing?.description_en ?? null,
      description_jp: jpData?.description ?? existing?.description_jp ?? null,
      icon_slug,
      tag: tag ?? null,
      in_db: dbUsedKeywords.has(name),
      in_source: sourceIdentityKeywords.has(name),
    })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  const staleRichTextKeywordMetaNames = findStaleRichTextKeywordMetaNames(
    (existingMeta ?? []).map(row => String(row.name)),
  )

  console.log(`  삽입 예정: ${rows.length}개\n`)

  if (DRY_RUN) {
    console.log(`  raw tag keyword_meta 삭제 후보: ${staleRichTextKeywordMetaNames.length}개`)
    for (const name of staleRichTextKeywordMetaNames.slice(0, 5)) {
      console.log(`  ${RED('-')} ${name}`)
    }
    if (staleRichTextKeywordMetaNames.length > 5) {
      console.log(GRAY(`  ... 외 ${staleRichTextKeywordMetaNames.length - 5}개`))
    }
    if (staleRichTextKeywordMetaNames.length > 0) console.log('')

    // Show sample
    for (const row of rows.slice(0, 20)) {
      const desc = row.description ? GRAY(` — ${row.description.slice(0, 40)}...`) : ''
      console.log(`  ${GREEN('+')} ${row.name}${desc}`)
    }
    if (rows.length > 20) console.log(GRAY(`  ... 외 ${rows.length - 20}개`))
    const traceTags = [
      'VengeanceBookHeathcliff',
      'VengeanceBookSinclair',
      'MiddleFingerBook',
      'VendettaMark',
      'MiddleFingerTattooID',
      'RetaliationBook',
      'RetaliationBookFamily',
    ]
    const rowsByTag = new Map(rows.filter(row => row.tag).map(row => [row.tag, row]))
    const rowsByName = new Map(rows.map(row => [row.name, row]))
    console.log(CYAN('\n  대상 태그 icon_slug 확인:'))
    for (const tag of traceTags) {
      const mappedName = TAG_MAP[tag] ?? null
      const row = rowsByTag.get(tag) ?? (mappedName ? rowsByName.get(mappedName) : undefined)
      const name = row?.name ?? mappedName
      const existing = name ? existingMetaMap.get(name) : undefined
      const enData = enKeywordData.get(tag)
      const nameEn = row?.name_en ?? enData?.name ?? enTagMap[tag] ?? existing?.name_en ?? null
      const iconSlug = row?.icon_slug ?? (name
        ? deriveKeywordIconSlug({
          name,
          existingIconSlug: existing?.icon_slug,
          nameEn,
          tag,
        })
        : slugifyKeywordIconPart(tag.replace(/ID$/, '')))
      const origins = [
        row?.in_db || (name ? dbUsedKeywords.has(name) : false) ? 'DB' : null,
        row?.in_source || (name ? sourceIdentityKeywords.has(name) : false) ? 'source' : null,
      ].filter(Boolean).join('+') || 'none'
      console.log(`    ${tag}: ${name ?? '-'} / ${nameEn ?? '-'} / icon_slug=${iconSlug ?? '-'} / meta=${row ? 'included' : 'not-in-used-keywords'} / 포함=${origins}`)
    }
    console.log(CYAN('\n  (DRY RUN — DB 미변경. 반영하려면 --fix 옵션 사용)'))
    return
  }

  // Insert in batches of 100
  let inserted = 0
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100).map(row => ({
      name: row.name,
      description: row.description,
      name_en: row.name_en,
      name_jp: row.name_jp,
      description_en: row.description_en,
      description_jp: row.description_jp,
      icon_slug: row.icon_slug,
    }))
    const { error } = await supabase
      .from('keyword_meta')
      .upsert(batch, { onConflict: 'name' })

    if (error) {
      console.error(RED(`  [ERROR] Batch ${i}-${i + batch.length}: ${error.message}`))
    } else {
      inserted += batch.length
      console.log(GREEN(`  ✓ Batch ${i + 1}-${i + batch.length} 삽입`))
    }
  }
  if (staleRichTextKeywordMetaNames.length > 0) {
    let deleted = 0
    for (const name of staleRichTextKeywordMetaNames) {
      const { error } = await supabase
        .from('keyword_meta')
        .delete()
        .eq('name', name)

      if (error) {
        throw new Error(`raw tag keyword_meta 삭제 실패 (${name}): ${error.message}`)
      }
      deleted++
    }
    console.log(GREEN(`  raw tag keyword_meta 삭제: ${deleted}개`))
  }
  console.log(GREEN(`\n  keyword_meta 재구축 완료: ${inserted}개 삽입`))
}

async function main(): Promise<void> {
  console.log(BOLD('╔══════════════════════════════════════════════════════════╗'))
  console.log(BOLD('║  인격/스킬/패시브 게임 데이터 → DB 동기화                ║'))
  console.log(BOLD('╠══════════════════════════════════════════════════════════╣'))
  console.log(BOLD(`║  모드: ${DRY_RUN ? '  DRY RUN (비교만)' : RED('  FIX (DB 반영)')}                         `))
  console.log(BOLD(`║  대상: ${SINNER_FILTER ? `  ${SINNER_FILTER}` : '  전체 12명'}                              `))
  if (EGO_ONLY) console.log(BOLD('║  범위:   EGO 스킬/패시브 로케일만 처리                 ║'))
  console.log(BOLD(`║  키워드: ${UPDATE_KEYWORDS ? YELLOW('  --keywords 활성 (기존 인격 키워드 업데이트)') : '  protected (기존 인격 키워드 보호)'}  `))
  console.log(BOLD('║  대표/유닛/소속 배열: --fix에서 공식 JSON 기준 자동 동기화 ║'))
  console.log(BOLD('╚══════════════════════════════════════════════════════════╝\n'))

  // ── Load game data ────────────────────────────────────────────────────────
  console.log('  게임 데이터 로드 중...')

  TAG_MAP = loadKrTagMap()
  console.log(`  KR 태그 맵: ${Object.keys(TAG_MAP).length}개`)
  UNIT_KEYWORD_MAP = loadKrUnitKeywordMap()
  ASSOCIATION_NAME_MAP = loadKrAssociationMap(UNIT_KEYWORD_MAP)
  console.log(`  KR 유닛 태그 맵: ${Object.keys(UNIT_KEYWORD_MAP).length}개`)
  console.log(`  KR 소속 맵: ${Object.keys(ASSOCIATION_NAME_MAP).length}개`)

  if (REBUILD_KEYWORD_META) {
    await rebuildKeywordMeta()
    return
  }

  const krPersonMap = loadKrPersonalities()
  console.log(`  KR 인격 이름: ${krPersonMap.size}개`)

  const krQuoteMap = loadKrPersonalityGetQuotes()
  console.log(`  KR 인격 획득 대사(get_*): ${krQuoteMap.size}개`)

  const krSkillMap = loadKrSkills()
  console.log(`  KR 스킬 텍스트: ${krSkillMap.size}개`)

  const gamePersonMap = loadPersonalities()
  console.log(`  게임 인격 JSON: ${gamePersonMap.size}개`)

  const gameSkillMap = loadPersonalitySkills()
  console.log(`  게임 스킬 JSON: ${gameSkillMap.size}개`)

  const passiveMappings = loadPassiveMappings()
  console.log(`  패시브 매핑: ${passiveMappings.length}개`)

  const passiveDetailMap = loadPassiveDetails()
  console.log(`  패시브 상세: ${passiveDetailMap.size}개`)

  const krPassiveMap = loadKrPassives()
  console.log(`  KR 패시브: ${krPassiveMap.size}개`)

  // Load EN/JP locale data
  const enTagMap = loadLangTagMap('en')
  const jpTagMap = loadLangTagMap('jp')
  const enLocale = loadLangLocale('en')
  const jpLocale = loadLangLocale('jp')
  const enPersonNameMap = loadPersonalityNames('en')
  const jpPersonNameMap = loadPersonalityNames('jp')
  console.log(`  EN 인격명: ${enPersonNameMap.size}개, JP 인격명: ${jpPersonNameMap.size}개`)
  console.log('')

  // ── Load DB data ──────────────────────────────────────────────────────────
  console.log('  DB 데이터 로드 중...')
  const { rows: dbIdentityRows, availableGameArrayColumns } = await loadIdentityRows()

  const dbIdentityMap = new Map<string, Record<string, unknown>>()
  for (const row of dbIdentityRows ?? []) {
    if (row.game_id) dbIdentityMap.set(String(row.game_id), row as Record<string, unknown>)
  }
  console.log(`  DB 인격: ${dbIdentityMap.size}개 로드`)
  console.log(`  skill_keyword_list: ${availableGameArrayColumns.has('skill_keyword_list') ? '동기화 가능' : 'migration 미적용 (dry-run diff만 표시)'}`)
  console.log(`  unit_keyword_list: ${availableGameArrayColumns.has('unit_keyword_list') ? '동기화 가능' : 'migration 미적용 (dry-run diff만 표시)'}`)
  console.log(`  association_list: ${availableGameArrayColumns.has('association_list') ? '동기화 가능' : 'migration 미적용 (dry-run diff만 표시)'}\n`)

  // ── Filter sinners ────────────────────────────────────────────────────────
  const targetSinners = SINNER_FILTER
    ? SINNERS.filter(s => s.slug === SINNER_FILTER)
    : [...SINNERS]

  if (SINNER_FILTER && targetSinners.length === 0) {
    console.error(RED(`[ERROR] 알 수 없는 sinner slug: ${SINNER_FILTER}`))
    console.error(`유효한 slug: ${SINNERS.map(s => s.slug).join(', ')}`)
    process.exit(1)
  }

  // Run before any mutating sync stages so --fix cannot partially update other
  // tables when the release_date migration is missing.
  if (!EGO_ONLY) await syncEgoReleaseDates(targetSinners)

  // ── Keyword context store (gameId → context) ──────────────────────────────
  const keywordContexts = new Map<string, KeywordContext>()
  const getKeywordCtx = (gameId: string): KeywordContext => {
    if (!keywordContexts.has(gameId)) {
      keywordContexts.set(gameId, { gamePerson: null, skillMap: new Map(), rawKrTexts: [], passiveDetails: [] })
    }
    return keywordContexts.get(gameId)!
  }

  // Counters
  let totalNew = 0, totalChanged = 0, totalUnchanged = 0, totalSkipped = 0
  let totalSkillsInserted = 0
  let totalSkillDiffs = 0, totalSkillsDeleted = 0, totalSkillsRebuiltInserted = 0
  const missingQuoteSourceCases: Array<{ gameId: string; name: string }> = []

  // ── Per-sinner processing: identities + skills ────────────────────────────
  if (!EGO_ONLY) {
    for (const sinner of targetSinners) {
      console.log(`${'═'.repeat(60)}`)
      console.log(BOLD(`  ${sinner.name.toUpperCase()} (${sinner.slug})`))
      console.log('═'.repeat(60))

    const sinnerPersonalities = [...gamePersonMap.values()]
      .filter(p => p.characterId === sinner.id)

    if (sinnerPersonalities.length === 0) {
      console.log(GRAY(`  [스킵] 게임 데이터 없음`))
      totalSkipped++
      continue
    }
    console.log(GRAY(`  게임 인격 ${sinnerPersonalities.length}개`))

    // Get DB sinner UUID (sinners.id is the slug itself)
    const { data: sinnerRows } = await supabase
      .from('sinners')
      .select('id')
      .eq('id', sinner.slug)
      .limit(1)
    if (!sinnerRows?.length) {
      console.warn(YELLOW(`  [경고] DB에 수감자 없음: ${sinner.slug} — 스킵`))
      continue
    }
    const sinnerUuid = sinnerRows[0].id as string

    for (let i = 0; i < sinnerPersonalities.length; i++) {
      const p = sinnerPersonalities[i]
      const gameId = String(p.id)
      const krName = krPersonMap.get(gameId)
      const computed = calcIdentityStats(p, krName, krQuoteMap)
      const displayName = krName?.nameWithTitle ?? krName?.name ?? gameId
      if (!computed.quote) {
        missingQuoteSourceCases.push({ gameId, name: displayName })
      }

      const dbRow = dbIdentityMap.get(gameId)
      if (!dbRow || !NEW_ONLY) {
        const ctx = getKeywordCtx(gameId)
        populateIdentityKeywordContext(ctx, p, gameSkillMap, krSkillMap, passiveMappings, passiveDetailMap, krPassiveMap)
        computed.keywords = extractKeywords(ctx)
      }

      // ── New identity ──────────────────────────────────────────────────────
      if (!dbRow) {
        totalNew++
        console.log(GREEN(`  [${i + 1}/${sinnerPersonalities.length}] [NEW] ${displayName} (game_id: ${gameId})`))
        console.log(GREEN(`    rank=${computed.rarity} hp=${computed.hp} spd=${computed.speed_min}~${computed.speed_max}`))
        console.log(GREEN(`    folder: ${computed.folder_name}`))
        console.log(GREEN(`    affiliation: ${computed.affiliation ?? '(없음)'}`))
        console.log(GREEN(`    skill_keyword_list: [${computed.skill_keyword_list.join(', ')}]`))
        console.log(GREEN(`    unit_keyword_list: [${computed.unit_keyword_list.join(', ')}]`))
        console.log(GREEN(`    association_list: [${computed.association_list.join(', ')}]`))
        if (computed.quote) console.log(GREEN(`    quote: ${computed.quote}`))
        console.log(GREEN(`    keywords: [${computed.keywords.join(', ')}]`))

        if (!DRY_RUN) {
          const identityRow: Record<string, unknown> = {
            sinner_id: sinnerUuid,
            name: computed.name,
            name_kr: computed.name_kr,
            name_en: enPersonNameMap.get(gameId) ?? null,
            name_jp: jpPersonNameMap.get(gameId) ?? null,
            tier: computed.rarity ?? 1,
            hp: computed.hp,
            base_hp: computed.base_hp,
            hp_per_level: computed.hp_per_level,
            speed_min: computed.speed_min,
            speed_max: computed.speed_max,
            def_level: computed.def_level,
            rarity: computed.rarity,
            game_id: computed.game_id,
            folder_name: computed.folder_name,
            affiliation: computed.affiliation,
            slash_res: computed.slash_res,
            pierce_res: computed.pierce_res,
            blunt_res: computed.blunt_res,
            break_section: computed.break_section,
            keywords: computed.keywords,
          }
          if (computed.quote) identityRow.quote = computed.quote
          for (const column of GAME_ARRAY_COLUMNS) {
            if (availableGameArrayColumns.has(column)) {
              identityRow[column] = computed[column]
            } else {
              console.warn(YELLOW(`    [경고] ${column} 컬럼이 없어 신규 삽입 payload에서 제외합니다. migration 적용 후 재실행하세요.`))
            }
          }

          const { data: inserted, error: insertErr } = await supabase
            .from('identities')
            .insert([identityRow])
            .select('id')
          if (insertErr) {
            console.error(RED(`    [ERROR] 인격 삽입 실패: ${insertErr.message}`))
            continue
          }
          const newIdentityId = (inserted as Array<{ id: string }>)[0]?.id
          if (!newIdentityId) {
            console.error(RED(`    [ERROR] 삽입된 identity id 반환 없음`))
            continue
          }
          console.log(GREEN(`    인격 삽입 완료: ${newIdentityId}`))

          // Insert skills
          if (!NEW_ONLY) {
            const skillRows = buildSkillRows(p, gameSkillMap, krSkillMap, newIdentityId, enLocale, jpLocale, enTagMap, jpTagMap)
            if (skillRows.length > 0) {
              await supaInsertBatch('skills', skillRows)
              totalSkillsInserted += skillRows.length
              console.log(GREEN(`    스킬 삽입: ${skillRows.length}개 (uptie 3+4)`))
            }
          }

          dbIdentityMap.set(gameId, { ...identityRow, id: newIdentityId })
          await sleep(150)
        } else {
          // Dry-run: skill preview
          if (!NEW_ONLY) {
            const skillRows = buildSkillRows(p, gameSkillMap, krSkillMap, null, enLocale, jpLocale, enTagMap, jpTagMap)
            console.log(GREEN(`    스킬 예정: ${skillRows.length}개 (uptie 3+4)`))
            if (VERBOSE) {
              for (const s of skillRows.filter(r => r.uptie_level === 4)) {
                console.log(GREEN(`      S${s.skill_order} uptie${s.uptie_level} "${s.name}" [${s.skill_type}/${s.sin_affinity}] 위력${s.base_power}+${s.coin_power}×${s.coins}`))
              }
            }
          }
        }
        continue
      }

      // ── Existing identity: stat diff ──────────────────────────────────────
      if (NEW_ONLY) continue

      const changes = diffIdentity(computed, dbRow)
      const changeCount = Object.keys(changes).length
      const dbTyped = dbRow as { id: string; name_en?: string | null; name_jp?: string | null }
      const generatedSkillRows = buildSkillRows(p, gameSkillMap, krSkillMap, dbTyped.id, enLocale, jpLocale, enTagMap, jpTagMap)
      const skillSync = await syncExistingIdentitySkills(dbTyped.id, displayName, gameId, generatedSkillRows)
      if (skillSync.changed) totalSkillDiffs++
      totalSkillsDeleted += skillSync.deleted
      totalSkillsRebuiltInserted += skillSync.inserted

      if (changeCount === 0) {
        totalUnchanged++
        // Backfill EN/JP identity names if missing
        if (!DRY_RUN) {
          const identityNameUpdate: Record<string, string> = {}
          const enName = enPersonNameMap.get(gameId)
          const jpName = jpPersonNameMap.get(gameId)
          if (enName && !dbTyped.name_en) identityNameUpdate.name_en = enName
          if (jpName && !dbTyped.name_jp) identityNameUpdate.name_jp = jpName
          if (Object.keys(identityNameUpdate).length > 0) {
            const { error: nameErr } = await supabase
              .from('identities')
              .update(identityNameUpdate)
              .eq('id', dbTyped.id)
            if (nameErr) console.error(RED(`  [ERR] identity name backfill: ${nameErr.message}`))
          }
        }
        if (VERBOSE) console.log(GRAY(`  [${i + 1}/${sinnerPersonalities.length}] [OK] ${displayName} (변경 없음)`))
        continue
      }

      totalChanged++
      console.log(YELLOW(`  [${i + 1}/${sinnerPersonalities.length}] [CHANGED] ${displayName} (game_id: ${gameId})`))
      for (const [field, { from, to }] of Object.entries(changes)) {
        const fromStr = Array.isArray(from) ? JSON.stringify(from) : String(from ?? 'null')
        const toStr = Array.isArray(to) ? JSON.stringify(to) : String(to ?? 'null')
        console.log(YELLOW(`    ${field}: ${fromStr} → ${toStr}`))
      }

      if (!DRY_RUN) {
        const updatePayload: Record<string, unknown> = {}
        for (const [field, { to }] of Object.entries(changes)) {
          if (GAME_ARRAY_COLUMNS.includes(field as GameArrayColumn) && !availableGameArrayColumns.has(field as GameArrayColumn)) continue
          updatePayload[field] = to
        }
        if (Object.keys(updatePayload).length === 0) {
          console.warn(YELLOW(`    [경고] 새 게임 배열 컬럼이 없어 업데이트를 건너뜁니다. migration 적용 후 재실행하세요.`))
        } else {
          const { error: patchErr } = await supabase
            .from('identities')
            .update(updatePayload)
            .eq('id', dbTyped.id)
          if (patchErr) console.error(RED(`    [ERROR] 업데이트 실패: ${patchErr.message}`))
          else console.log(YELLOW(`    업데이트 완료`))
          await sleep(80)
        }
      }
    }
    }
  }

  let passiveInserted = 0, passiveDeleted = 0

  if (!EGO_ONLY) {
    // ══════════════════════════════════════════════════════════
    //  Passive sync
    // ══════════════════════════════════════════════════════════
    console.log(`\n${'═'.repeat(60)}`)
    console.log(BOLD('  패시브 동기화'))
    console.log('═'.repeat(60))

    for (const sinner of targetSinners) {
    const { data: dbIdentities } = await supabase
      .from('identities')
      .select('id,game_id,name')
      .eq('sinner_id', sinner.slug)
    if (!dbIdentities?.length) continue

    for (const identity of dbIdentities) {
      const gameId = String(identity.game_id)
      if (!gameId) continue

      const pm = passiveMappings.find(p => String(p.personalityID) === gameId)
      if (!pm) continue

      const newPassives = buildPassiveRows(pm, identity.id as string, krPassiveMap, passiveDetailMap, enLocale, jpLocale, enTagMap, jpTagMap)
      if (newPassives.length === 0) continue

      const { data: dbPassives } = await supabase
        .from('passives')
        .select('id')
        .eq('identity_id', identity.id)
        .limit(100)

      if (DRY_RUN) {
        console.log(GRAY(`  ${identity.name}: DB ${dbPassives?.length ?? 0}개 → 게임 ${newPassives.length}개`))
      } else {
        if ((dbPassives?.length ?? 0) > 0) {
          const { error: delErr } = await supabase
            .from('passives')
            .delete()
            .eq('identity_id', identity.id)
          if (delErr) {
            console.error(RED(`  [ERROR] 패시브 삭제 실패 (${identity.name}): ${delErr.message}`))
            continue
          }
          passiveDeleted += dbPassives!.length
        }
        await supaInsertBatch('passives', newPassives)
        passiveInserted += newPassives.length
        await sleep(100)
      }
    }
  }

    if (!DRY_RUN) {
      console.log(GREEN(`  패시브 삭제: ${passiveDeleted}개 / 삽입: ${passiveInserted}개`))
    }

    // ══════════════════════════════════════════════════════════
    //  Keyword extraction + diff/update
    // ══════════════════════════════════════════════════════════
    console.log(`\n${'═'.repeat(60)}`)
    console.log(BOLD('  키워드 추출 (스킬 + 패시브 + 텍스트 태그)'))
    console.log('═'.repeat(60))

    let kwUpdated = 0
    let kwDiffCount = 0

    for (const [gameId, ctx] of keywordContexts) {
    if (!ctx.gamePerson) continue

    const extracted = extractKeywords(ctx)
    if (extracted.length === 0) continue

    const dbRow = dbIdentityMap.get(gameId)
    if (!dbRow) continue

    const dbKeywords: string[] = (dbRow.keywords as string[] | null) ?? []
    const identityName = (dbRow.name ?? gameId) as string

    const dbSet = new Set(dbKeywords)
    const extractedSet = new Set(extracted)
    const same = dbSet.size === extractedSet.size && [...dbSet].every(k => extractedSet.has(k))

    if (!same) {
      kwDiffCount++
      // Always report the diff
      console.log(CYAN(`  [키워드 diff] ${identityName} (${gameId})`))
      console.log(CYAN(`    DB:   [${dbKeywords.join(', ')}]`))
      console.log(CYAN(`    추출: [${extracted.join(', ')}]`))
      if (!UPDATE_KEYWORDS) {
        console.log(GRAY(`    → 수동 확인 필요 (업데이트하려면 --keywords 옵션 사용)`))
      }
    }

    if (UPDATE_KEYWORDS) {
      if (DRY_RUN) {
        if (!same) console.log(CYAN(`    [DRY-RUN] 키워드 업데이트 예정`))
      } else {
        const { error: kwErr } = await supabase
          .from('identities')
          .update({ keywords: extracted })
          .eq('game_id', gameId)
        if (kwErr) {
          console.error(RED(`  [ERROR] 키워드 업데이트 실패 (${identityName}): ${kwErr.message}`))
        } else {
          kwUpdated++
        }
      }
    }
  }

    if (kwDiffCount === 0) {
      console.log(GRAY(`  키워드 diff 없음 (${keywordContexts.size}개 인격)`))
    } else {
      console.log(YELLOW(`  키워드 차이 발견: ${kwDiffCount}개`))
      if (!UPDATE_KEYWORDS) {
        console.log(YELLOW(`  --keywords 플래그로 재실행하면 키워드 필드도 업데이트됩니다.`))
      }
    }
    if (UPDATE_KEYWORDS && !DRY_RUN && kwUpdated > 0) {
      console.log(GREEN(`  키워드 업데이트: ${kwUpdated}개`))
    }
  } else {
    console.log(GRAY('  --ego-only: 인격/패시브/키워드 동기화 단계 스킵'))
  }

  // ── EGO skill/passive locale sync ──────────────────────────────────────────
  console.log('\n── EGO 스킬/패시브 로케일 동기화 ──')

  const krEgoSkills = loadKrEgoSkillLocale()
  const enEgoSkills = loadEgoSkillLocale('en')
  const jpEgoSkills = loadEgoSkillLocale('jp')
  const enEgoPassives = loadEgoPassiveLocale('en')
  const jpEgoPassives = loadEgoPassiveLocale('jp')
  console.log(`  KR ego skills: ${krEgoSkills.size}`)
  console.log(`  EN ego skills: ${enEgoSkills.size}, JP: ${jpEgoSkills.size}`)
  console.log(`  EN ego passives: ${enEgoPassives.size}, JP: ${jpEgoPassives.size}`)

  // Get egos with game_id
  const { data: egoRows, error: egoErr } = await supabase
    .from('ego')
    .select('id, game_id, sinner_id, passive_name, passive_content, passive_name_en, passive_name_jp, passive_content_en, passive_content_jp')
    .in('sinner_id', targetSinners.map(s => s.slug))
    .limit(500)
  if (egoErr) console.error(RED(`  ego 로드 실패: ${egoErr.message}`))

  // Get ego_skills
  const { data: egoSkillRows, error: esErr } = await supabase
    .from('ego_skills')
    .select('id, ego_id, name, category, construe_level, name_en, name_jp, description, description_en, description_jp')
    .limit(2000)
  if (esErr) console.error(RED(`  ego_skills 로드 실패: ${esErr.message}`))

  if (egoRows && egoSkillRows) {
    // Build ego.id → game_id map
    const egoGameIdMap = new Map<string, string>()
    for (const ego of egoRows) {
      if (ego.game_id) egoGameIdMap.set(ego.id, String(ego.game_id))
    }

    let egoSkillUpdated = 0
    for (const skill of egoSkillRows) {
      const egoGameId = egoGameIdMap.get(skill.ego_id)
      if (!egoGameId) continue

      // Derive skill game_id: awakening = ego_game_id * 100 + 11, corrosion = + 21
      const suffix = skill.category === 'corrosion' ? 21 : 11
      const skillGameId = Number(egoGameId) * 100 + suffix
      const level = skill.construe_level ?? 3
      const key = `${skillGameId}_${level}`
      const fallbackKey = level === 4 ? `${skillGameId}_3` : key

      const krEntry = krEgoSkills.get(key) ?? krEgoSkills.get(fallbackKey)
      const enEntry = enEgoSkills.get(key) ?? enEgoSkills.get(fallbackKey)
      const jpEntry = jpEgoSkills.get(key) ?? jpEgoSkills.get(fallbackKey)

      const updates: Record<string, string> = {}

      // Name
      if (enEntry?.name && !skill.name_en) updates.name_en = enEntry.name
      if (jpEntry?.name && !skill.name_jp) updates.name_jp = jpEntry.name

      // Description — rebuild from locale source for consistent tag formatting.
      const krDesc = krEntry ? buildDescriptionKr(krEntry) : ''
      const enDesc = enEntry ? buildDescriptionLang(enEntry, enTagMap, CONDITION_TAG_EN, 'en') : ''
      const jpDesc = jpEntry ? buildDescriptionLang(jpEntry, jpTagMap, CONDITION_TAG_JP, 'jp') : ''
      if (krDesc && skill.description !== krDesc) updates.description = krDesc
      if (enDesc && !skill.description_en) updates.description_en = enDesc
      if (jpDesc && !skill.description_jp) updates.description_jp = jpDesc

      if (Object.keys(updates).length === 0) continue

      if (DRY_RUN) {
        if (VERBOSE || egoSkillUpdated < 3) {
          console.log(`  ${CYAN(skill.name)} (${skill.category} L${level}): +${Object.keys(updates).join(', ')}`)
          if (updates.name_en) console.log(`    EN: ${updates.name_en}`)
          if (updates.name_jp) console.log(`    JP: ${updates.name_jp}`)
        }
        egoSkillUpdated++
      } else {
        const { error: upErr } = await supabase
          .from('ego_skills')
          .update(updates)
          .eq('id', skill.id)
        if (upErr) console.error(RED(`    ✗ ${skill.name}: ${upErr.message}`))
        else egoSkillUpdated++
      }
    }

    console.log(egoSkillUpdated > 0
      ? GREEN(`  ✓ ego_skills ${DRY_RUN ? '업데이트 대상' : '업데이트'}: ${egoSkillUpdated}개`)
      : GRAY(`  ego_skills: 변경 없음`)
    )
  }

  // ── EGO passive locale sync ──
  if (egoRows) {
    const enEgoPassives = loadEgoPassiveLocale('en')
    const jpEgoPassives = loadEgoPassiveLocale('jp')
    console.log(`  EN ego passives: ${enEgoPassives.size}, JP: ${jpEgoPassives.size}`)

    let passiveUpdated = 0
    for (const ego of egoRows) {
      if (!ego.game_id || !ego.passive_name) continue

      const gid = Number(ego.game_id)
      // Find passive by ego_game_id prefix match in locale data
      let enPassive: { name: string; desc: string } | undefined
      let jpPassive: { name: string; desc: string } | undefined

      for (const [pid, val] of enEgoPassives) {
        if (String(pid).startsWith(String(gid))) { enPassive = val; break }
      }
      for (const [pid, val] of jpEgoPassives) {
        if (String(pid).startsWith(String(gid))) { jpPassive = val; break }
      }

      const updates: Record<string, string> = {}
      if (enPassive?.name && !ego.passive_name_en) updates.passive_name_en = enPassive.name
      if (enPassive?.desc && !ego.passive_content_en) updates.passive_content_en = translateDescLang(enPassive.desc, enTagMap!, CONDITION_TAG_EN, 'en')
      if (jpPassive?.name && !ego.passive_name_jp) updates.passive_name_jp = jpPassive.name
      if (jpPassive?.desc && !ego.passive_content_jp) updates.passive_content_jp = translateDescLang(jpPassive.desc, jpTagMap!, CONDITION_TAG_JP, 'jp')

      if (Object.keys(updates).length === 0) continue

      if (DRY_RUN) {
        if (VERBOSE || passiveUpdated < 3) {
          console.log(`  ${CYAN(ego.passive_name)}: EN=${enPassive?.name}, JP=${jpPassive?.name}`)
        }
        passiveUpdated++
      } else {
        const { error: upErr } = await supabase.from('ego').update(updates).eq('id', ego.id)
        if (upErr) console.error(RED(`    ✗ ${ego.passive_name}: ${upErr.message}`))
        else passiveUpdated++
      }
    }

    console.log(passiveUpdated > 0
      ? GREEN(`  ✓ ego passive ${DRY_RUN ? '업데이트 대상' : '업데이트'}: ${passiveUpdated}개`)
      : GRAY(`  ego passive: 변경 없음`)
    )
  }

  // ── Identity acquisition sync ─────────────────────────────────────────────
  let acquisitionChanged = 0
  let acquisitionApplied = 0
  if (!EGO_ONLY && !SKIP_ACQUISITION) {
    console.log('\n── 인격 획득 경로 동기화 ──')
    const result = await syncIdentityAcquisition({
      fix: FIX,
      verbose: VERBOSE,
      rewriteText: REWRITE_ACQUISITION_TEXT,
      enrichGacha: ENRICH_ACQUISITION_GACHA,
      sinnerIds: targetSinners.map(s => s.slug),
      revalidate: false,
    })
    acquisitionChanged = result.changed
    acquisitionApplied = result.applied
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log(BOLD('  요약'))
  console.log('═'.repeat(60))
  console.log(GREEN(`  신규 인격:     ${totalNew}개`))
  console.log(YELLOW(`  변경된 인격:   ${totalChanged}개`))
  console.log(GRAY(`  변경 없음:     ${totalUnchanged}개`))
  if (totalSkipped > 0) console.log(GRAY(`  스킵:          ${totalSkipped}개`))
  if (totalSkillDiffs > 0) console.log(CYAN(`  스킬 diff:     ${totalSkillDiffs}개 인격`))
  if (!DRY_RUN && totalSkillsInserted > 0) console.log(GREEN(`  삽입된 스킬:   ${totalSkillsInserted}개`))
  if (!DRY_RUN && totalSkillsRebuiltInserted > 0) {
    console.log(GREEN(`  재구축 스킬:   삭제 ${totalSkillsDeleted}개 / 삽입 ${totalSkillsRebuiltInserted}개`))
  }
  if (!DRY_RUN && passiveInserted > 0) console.log(GREEN(`  삽입된 패시브: ${passiveInserted}개`))
  if (!EGO_ONLY && !SKIP_ACQUISITION) {
    console.log(CYAN(`  획득 경로 ${DRY_RUN ? '변경 후보' : '반영'}: ${DRY_RUN ? acquisitionChanged : acquisitionApplied}개`))
  }
  if (DRY_RUN) {
    console.log(CYAN('\n  (DRY RUN — DB 미변경. 반영하려면 --fix 옵션 사용)'))
  } else {
    console.log(CYAN('\n  DB 반영 완료'))
  }

  if (missingQuoteSourceCases.length > 0) {
    console.log(YELLOW('\n  [quote 소스 확인 필요]'))
    console.log(YELLOW('  KR PersonalityVoiceDlg get_* 대사를 찾지 못한 인격:'))
    for (const item of missingQuoteSourceCases) {
      console.log(YELLOW(`    • ${item.gameId} ${item.name}`))
    }
  }

  if (totalNew > 0 && !DRY_RUN) {
    console.log(YELLOW('\n  [수동 입력 필요 필드]'))
    console.log(YELLOW('  다음 필드는 자동으로 채워지지 않습니다:'))
    console.log(YELLOW('    • keywords         — 추출 키워드 확인 및 보완 필요 (--keywords로 확인)'))
    console.log(YELLOW('  획득 경로와 quote는 소스가 있을 때 자동 동기화되며, 소스가 없는 항목만 확인하세요.'))
  }

  // On-demand cache invalidation after successful --fix run.
  if (!DRY_RUN) {
    await triggerRevalidation({ scope: 'all-game-data' })
  }
}

if (isDirectRun) {
  main().catch(err => {
    console.error(RED(`\n[FATAL] ${(err as Error).message}`))
    if (VERBOSE) console.error((err as Error).stack)
    process.exit(1)
  })
}
