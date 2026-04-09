#!/usr/bin/env tsx
/**
 * sync-identity-data.ts
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
 *   --keywords         기존 인격 keywords 필드도 업데이트 (기본적으로 protected)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'
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
const UPDATE_KEYWORDS = args.includes('--keywords')
const REBUILD_KEYWORD_META = args.includes('--rebuild-keyword-meta')

// ── Data dirs ─────────────────────────────────────────────────────────────────
const DATA_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/Json (Text)'))
const KR_DIR = join(DATA_DIR, 'KR')
const KR_LATEST_DIR = resolve(join(homedir(), 'Documents/Limbus/assets/data/kr'))

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'limbus' } })

// ── ANSI color helpers ────────────────────────────────────────────────────────
const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`
const GRAY = (s: string) => `\x1b[90m${s}\x1b[0m`
const CYAN = (s: string) => `\x1b[36m${s}\x1b[0m`
const RED = (s: string) => `\x1b[31m${s}\x1b[0m`
const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`

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
}
const AFFILIATION_KEYS = new Set(Object.keys(ASSOCIATION_MAP))

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

// Fields compared for existing identities — only game-sourced stats.
// name_kr, folder_name, keywords, affiliation are hand-curated and must NOT be overwritten.
const STAT_FIELDS = [
  'hp', 'base_hp', 'hp_per_level', 'speed_min', 'speed_max', 'def_level',
  'rarity', 'slash_res', 'pierce_res', 'blunt_res', 'break_section',
] as const

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

// ── TypeScript types ──────────────────────────────────────────────────────────

type Personality = z.infer<typeof PersonalitySchema>
type PersonalitySkill = z.infer<typeof PersonalitySkillSchema>
type KrSkill = z.infer<typeof KrSkillSchema>
type KrPassive = z.infer<typeof KrPassiveSchema>
type PassiveMapping = z.infer<typeof PassiveMappingSchema>
type PassiveDetail = z.infer<typeof PassiveDetailSchema>

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
  keywords: string[]
  folder_name: string | null
  affiliation: string | null
}

interface SkillRow {
  identity_id: string | null
  name: string
  skill_type: string | null
  sin_affinity: string | null
  base_power: number | null
  coin_power: number | null
  coins: number
  offense_level: number | null
  description: string
  skill_order: number
  atk_weight: number
  variant_order: number
  uptie_level: number
}

interface PassiveRow {
  identity_id: string
  name: string
  passive_type: 'battle' | 'support'
  sin_affinity: string | null
  sin_count: number | null
  active_cond: 'stock' | 'resonance' | null
  description: string
  passive_order: number
  uptie_level: number
}

interface KeywordContext {
  gamePerson: Personality | null
  skillMap: Map<number, PersonalitySkill>
  rawKrTexts: string[]
  passiveDetails: PassiveDetail[]
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

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

// ── KR data loaders ───────────────────────────────────────────────────────────

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
          map[parsed.data.id] = parsed.data.name
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
          map[parsed.data.id] = parsed.data.name
        }
      }
    }
  }

  return map
}

function loadKrKeywordDescriptions(): Map<string, { id: string; description: string | null }> {
  const map = new Map<string, { id: string; description: string | null }>()
  const dirs: Array<{ dir: string; ext: string }> = []
  if (existsSync(KR_LATEST_DIR)) dirs.push({ dir: KR_LATEST_DIR, ext: '.json' })
  if (existsSync(KR_DIR)) dirs.push({ dir: KR_DIR, ext: '.txt' })

  for (const { dir, ext } of dirs) {
    const files = globFiles(dir, /^KR_(BattleKeywords|Bufs)/i).filter(f => f.endsWith(ext))
    for (const f of files) {
      const data = readTxt(join(dir, f))
      for (const item of extractList(data)) {
        const parsed = z.object({ id: z.string(), name: z.string(), desc: z.string().optional() }).safeParse(item)
        if (parsed.success && !map.has(parsed.data.name)) {
          map.set(parsed.data.name, { id: parsed.data.id, description: parsed.data.desc ?? null })
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
        name,
        title,
        nameWithTitle: nameWithTitle ?? name,
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
        map.set(String(id), { name, title, nameWithTitle: nameWithTitle ?? name })
      }
    }
  }
  return map
}

function loadKrSkills(): Map<number, KrSkill> {
  const map = new Map<number, KrSkill>()
  if (!existsSync(KR_DIR)) return map

  for (const f of globFiles(KR_DIR, /^KR_Skills_personality.*\.txt$/)) {
    const data = readTxt(join(KR_DIR, f))
    for (const item of extractList(data)) {
      const parsed = KrSkillSchema.safeParse(item)
      if (parsed.success) map.set(parsed.data.id, parsed.data)
    }
  }

  // Latest KR patch overrides
  if (existsSync(KR_LATEST_DIR)) {
    for (const f of globFiles(KR_LATEST_DIR, /^KR_Skills_personality.*\.(json|txt)$/)) {
      const data = readTxt(join(KR_LATEST_DIR, f))
      for (const item of extractList(data)) {
        const parsed = KrSkillSchema.safeParse(item)
        if (parsed.success) map.set(parsed.data.id, parsed.data)
      }
    }
  }
  return map
}

function loadPersonalities(): Map<string, Personality> {
  const map = new Map<string, Personality>()
  for (const sinner of SINNERS) {
    const pad = String(sinner.id).padStart(2, '0')
    const data = readTxt(join(DATA_DIR, `personality-${pad}.txt`))
    if (!data) {
      console.warn(YELLOW(`  [경고] personality-${pad}.txt 없음`))
      continue
    }
    for (const item of extractList(data)) {
      const parsed = PersonalitySchema.safeParse(item)
      if (parsed.success) map.set(String(parsed.data.id), parsed.data)
    }
  }
  return map
}

function loadPersonalitySkills(): Map<number, PersonalitySkill> {
  const map = new Map<number, PersonalitySkill>()
  for (const sinner of SINNERS) {
    const pad = String(sinner.id).padStart(2, '0')
    const data = readTxt(join(DATA_DIR, `personality-skill-${pad}.txt`))
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
  for (const sinner of SINNERS) {
    const pad = String(sinner.id).padStart(2, '0')
    const data = readTxt(join(DATA_DIR, `personality-passive-${pad}.txt`))
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

function loadKrPassives(): Map<number, KrPassive> {
  const map = new Map<number, KrPassive>()
  // KR_DIR passive files
  for (const f of globFiles(KR_DIR, /^KR_Passives.*\.txt$/i)) {
    if (/_Abnormality/i.test(f) || /_Enemy/i.test(f) || /_Assist/i.test(f)) continue
    const data = readTxt(join(KR_DIR, f))
    for (const item of extractList(data)) {
      const parsed = KrPassiveSchema.safeParse(item)
      if (parsed.success && !map.has(parsed.data.id)) map.set(parsed.data.id, parsed.data)
    }
  }
  // Latest KR patch overrides
  if (existsSync(KR_LATEST_DIR)) {
    for (const f of globFiles(KR_LATEST_DIR, /^KR_Passives.*\.(json|txt)$/i)) {
      if (/_Abnormality/i.test(f) || /_Enemy/i.test(f) || /_Assist/i.test(f)) continue
      const data = readTxt(join(KR_LATEST_DIR, f))
      for (const item of extractList(data)) {
        const parsed = KrPassiveSchema.safeParse(item)
        if (parsed.success) map.set(parsed.data.id, parsed.data)
      }
    }
  }
  return map
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
    if (kr && !CONDITION_TAG_MAP[kw]) result.push(kr)
  }
  return result
}

function calcIdentityStats(p: Personality, krName: KrPersonality | undefined): ComputedIdentity {
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
  const keywords = translateKeywords(p.skillKeywordList)

  const folder_name = p.appearance ? p.appearance.replace(/^\d+_/, '') : null
  const name_kr = krName?.nameWithTitle ?? krName?.name ?? null
  const name = name_kr

  const sinner = SINNERS.find(s => s.id === p.characterId)
  const sinner_slug = sinner?.slug ?? null

  const affiliationEntry = (p.associationList ?? []).find(a => AFFILIATION_KEYS.has(a))
  const affiliation = affiliationEntry ? (ASSOCIATION_MAP[affiliationEntry] ?? null) : null

  return {
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
    keywords,
    folder_name,
    affiliation,
  }
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

function translateDesc(desc: string | undefined): string {
  if (!desc) return ''
  return desc
    .replace(/<style="[^"]*">/g, '').replace(/<\/style>/g, '')
    .replace(/<\/?noparse>/g, '')
    .replace(/<\/?u>/g, '')
    .replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '')
    .replace(/<link=[^>]*>/g, '').replace(/<\/link>/g, '')
    .replace(/<sprite[^>]*\/?>/g, '')
    .replace(/<size=[^>]*>/g, '').replace(/<\/size>/g, '')
    .replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (match, tag, offset, str) => {
      const kr = TAG_MAP[tag]
      if (!kr) return match
      if (CONDITION_TAG_MAP[tag]) return `[${kr}]`
      const before = offset > 0 ? (str as string)[offset - 1] : ''
      const needSpaceBefore = before && /[가-힣0-9]/.test(before)
      return (needSpaceBefore ? ' ' : '') + kr
    })
    .trim()
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

function buildSkillRows(
  gamePerson: Personality,
  skillMap: Map<number, PersonalitySkill>,
  krSkillMap: Map<number, KrSkill>,
  identityId: string | null,
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
      const best = getBestLevelEntry(krItem?.levelList ?? [], uptie)
      const skillOrder = gs.skillTier ?? 1
      const name = best?.name ?? `스킬${skillOrder}`
      const description = buildDescription(krItem, uptie)
      const isDefense = r.defType && r.defType !== 'ATTACK'

      rows.push({
        identity_id: identityId,
        name,
        skill_type: isDefense ? (DEF_TYPE_MAP[r.defType!] ?? null) : (ATK_TYPE_MAP[r.atkType ?? ''] ?? null),
        sin_affinity: SIN_MAP[r.attributeType ?? ''] ?? null,
        base_power: r.defaultValue ?? null,
        coin_power: coinList.length > 0
          ? (coinList[0].operatorType === 'SUB' ? -(coinList[0].scale ?? 0) : (coinList[0].scale ?? null))
          : null,
        coins: coinList.length || 1,
        offense_level: r.skillLevelCorrection != null ? 60 + r.skillLevelCorrection : null,
        description,
        skill_order: skillOrder,
        atk_weight: r.targetNum ?? 1,
        variant_order: ++variantIdx,
        uptie_level: uptie,
      })
    }

    // Defense skills (exclude variants with requireIDList)
    const defSkills = defenseSkillIds
      .map(sid => skillMap.get(sid))
      .filter((gs): gs is PersonalitySkill => !!gs && !(gs.requireIDList && gs.requireIDList.length > 0))

    for (const gs of defSkills) {
      const r = resolveToLevel(gs, uptie)
      const coinList = r.coinList ?? []
      const krItem = krSkillMap.get(gs.id)
      const best = getBestLevelEntry(krItem?.levelList ?? [], uptie)
      const name = best?.name ?? '수비'
      const description = buildDescription(krItem, uptie)
      const isDefense = r.defType && r.defType !== 'ATTACK'

      rows.push({
        identity_id: identityId,
        name,
        skill_type: isDefense ? (DEF_TYPE_MAP[r.defType!] ?? null) : (ATK_TYPE_MAP[r.atkType ?? ''] ?? null),
        sin_affinity: SIN_MAP[r.attributeType ?? ''] ?? null,
        base_power: r.defaultValue ?? null,
        coin_power: coinList.length > 0
          ? (coinList[0].operatorType === 'SUB' ? -(coinList[0].scale ?? 0) : (coinList[0].scale ?? null))
          : null,
        coins: coinList.length || 1,
        offense_level: r.skillLevelCorrection != null ? 60 + r.skillLevelCorrection : null,
        description,
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
        const hasStock = (detail?.attributeStockCondition?.length ?? 0) > 0
        const hasResonance = (detail?.attributeResonanceCondition?.length ?? 0) > 0
        const conds = detail?.attributeStockCondition ?? detail?.attributeResonanceCondition ?? []
        const sinCond = conds[0]
        rows.push({
          identity_id: identityId,
          name: kr?.name ?? `패시브${pid}`,
          passive_type: 'battle',
          sin_affinity: sinCond ? (SIN_MAP[sinCond.type ?? ''] ?? null) : null,
          sin_count: sinCond?.value ?? null,
          active_cond: hasStock ? 'stock' : hasResonance ? 'resonance' : null,
          description: translateDesc(kr?.desc ?? ''),
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
        const hasStock = (detail?.attributeStockCondition?.length ?? 0) > 0
        const hasResonance = (detail?.attributeResonanceCondition?.length ?? 0) > 0
        const conds = detail?.attributeStockCondition ?? detail?.attributeResonanceCondition ?? []
        const sinCond = conds[0]
        rows.push({
          identity_id: identityId,
          name: kr?.name ?? `패시브${pid}`,
          passive_type: 'support',
          sin_affinity: sinCond ? (SIN_MAP[sinCond.type ?? ''] ?? null) : null,
          sin_count: sinCond?.value ?? null,
          active_cond: hasStock ? 'stock' : hasResonance ? 'resonance' : null,
          description: translateDesc(kr?.desc ?? ''),
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
  const keyword = TAG_MAP[tag]
  if (keyword) keywords.add(keyword)
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

function extractKeywords(ctx: KeywordContext): string[] {
  if (!ctx.gamePerson) return []
  const keywords = new Set<string>()

  // Source 1: skillKeywordList + unitKeywordList
  for (const keyword of [
    ...(ctx.gamePerson.skillKeywordList ?? []),
    ...(ctx.gamePerson.unitKeywordList ?? []),
  ]) {
    addMappedKeyword(keywords, keyword)
  }

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
    const oldVal = dbRow[field]
    if (!valuesEqual(newVal, oldVal)) {
      changes[field] = { from: oldVal, to: newVal }
    }
  }
  return changes
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
  const usedKeywords = new Set<string>()

  // Identity keywords (paginated)
  let from = 0
  while (true) {
    const { data } = await supabase.from('identities').select('keywords').range(from, from + 999)
    if (!data?.length) break
    for (const r of data) { if (r.keywords) (r.keywords as string[]).forEach(k => usedKeywords.add(k.normalize('NFC'))) }
    if (data.length < 1000) break
    from += 1000
  }

  // EGO keywords (paginated)
  from = 0
  while (true) {
    const { data } = await supabase.from('ego').select('keywords').range(from, from + 999)
    if (!data?.length) break
    for (const r of data) { if (r.keywords) (r.keywords as string[]).forEach(k => usedKeywords.add(k.normalize('NFC'))) }
    if (data.length < 1000) break
    from += 1000
  }

  // EGO gift keywords (paginated)
  from = 0
  while (true) {
    const { data } = await supabase.from('ego_gifts').select('keyword').range(from, from + 999)
    if (!data?.length) break
    for (const r of data) { if (r.keyword) usedKeywords.add((r.keyword as string).normalize('NFC')) }
    if (data.length < 1000) break
    from += 1000
  }

  console.log(`  실제 사용 키워드: ${usedKeywords.size}개 (인격+EGO+기프트)`)

  // Build insert rows
  const rows: Array<{ name: string; description: string | null }> = []
  for (const name of usedKeywords) {
    const krData = krKeywords.get(name)
    rows.push({ name, description: krData?.description ?? null })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  console.log(`  삽입 예정: ${rows.length}개\n`)

  if (DRY_RUN) {
    // Show sample
    for (const row of rows.slice(0, 20)) {
      const desc = row.description ? GRAY(` — ${row.description.slice(0, 40)}...`) : ''
      console.log(`  ${GREEN('+')} ${row.name}${desc}`)
    }
    if (rows.length > 20) console.log(GRAY(`  ... 외 ${rows.length - 20}개`))
    console.log(CYAN('\n  (DRY RUN — DB 미변경. 반영하려면 --fix 옵션 사용)'))
    return
  }

  // Insert in batches of 100
  let inserted = 0
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
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
  console.log(GREEN(`\n  keyword_meta 재구축 완료: ${inserted}개 삽입`))
}

async function main(): Promise<void> {
  console.log(BOLD('╔══════════════════════════════════════════════════════════╗'))
  console.log(BOLD('║  인격/스킬/패시브 게임 데이터 → DB 동기화                ║'))
  console.log(BOLD('╠══════════════════════════════════════════════════════════╣'))
  console.log(BOLD(`║  모드: ${DRY_RUN ? '  DRY RUN (비교만)' : RED('  FIX (DB 반영)')}                         `))
  console.log(BOLD(`║  대상: ${SINNER_FILTER ? `  ${SINNER_FILTER}` : '  전체 12명'}                              `))
  console.log(BOLD(`║  키워드: ${UPDATE_KEYWORDS ? YELLOW('  --keywords 활성 (기존 인격 키워드 업데이트)') : '  protected (기존 인격 키워드 보호)'}  `))
  console.log(BOLD('╚══════════════════════════════════════════════════════════╝\n'))

  // ── Load game data ────────────────────────────────────────────────────────
  console.log('  게임 데이터 로드 중...')

  TAG_MAP = loadKrTagMap()
  console.log(`  KR 태그 맵: ${Object.keys(TAG_MAP).length}개`)

  if (REBUILD_KEYWORD_META) {
    await rebuildKeywordMeta()
    return
  }

  const krPersonMap = loadKrPersonalities()
  console.log(`  KR 인격 이름: ${krPersonMap.size}개`)

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
  console.log(`  KR 패시브: ${krPassiveMap.size}개\n`)

  // ── Load DB data ──────────────────────────────────────────────────────────
  console.log('  DB 데이터 로드 중...')
  const { data: dbIdentityRows, error: dbErr } = await supabase
    .from('identities')
    .select('id,game_id,sinner_id,name,name_kr,hp,base_hp,hp_per_level,speed_min,speed_max,def_level,rarity,slash_res,pierce_res,blunt_res,break_section,keywords,folder_name,affiliation')
    .limit(2000)
  if (dbErr) throw new Error(`DB 인격 로드 실패: ${dbErr.message}`)

  const dbIdentityMap = new Map<string, Record<string, unknown>>()
  for (const row of dbIdentityRows ?? []) {
    if (row.game_id) dbIdentityMap.set(String(row.game_id), row as Record<string, unknown>)
  }
  console.log(`  DB 인격: ${dbIdentityMap.size}개 로드\n`)

  // ── Filter sinners ────────────────────────────────────────────────────────
  const targetSinners = SINNER_FILTER
    ? SINNERS.filter(s => s.slug === SINNER_FILTER)
    : [...SINNERS]

  if (SINNER_FILTER && targetSinners.length === 0) {
    console.error(RED(`[ERROR] 알 수 없는 sinner slug: ${SINNER_FILTER}`))
    console.error(`유효한 slug: ${SINNERS.map(s => s.slug).join(', ')}`)
    process.exit(1)
  }

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

  // ── Per-sinner processing: identities + skills ────────────────────────────
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
      const computed = calcIdentityStats(p, krName)
      const displayName = krName?.nameWithTitle ?? krName?.name ?? gameId

      const dbRow = dbIdentityMap.get(gameId)

      // ── New identity ──────────────────────────────────────────────────────
      if (!dbRow) {
        totalNew++
        console.log(GREEN(`  [${i + 1}/${sinnerPersonalities.length}] [NEW] ${displayName} (game_id: ${gameId})`))
        console.log(GREEN(`    rank=${computed.rarity} hp=${computed.hp} spd=${computed.speed_min}~${computed.speed_max}`))
        console.log(GREEN(`    folder: ${computed.folder_name}`))
        console.log(GREEN(`    affiliation: ${computed.affiliation ?? '(없음)'}`))
        console.log(GREEN(`    keywords: [${computed.keywords.join(', ')}]`))

        if (!DRY_RUN) {
          const identityRow = {
            sinner_id: sinnerUuid,
            name: computed.name,
            name_kr: computed.name_kr,
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
            const skillRows = buildSkillRows(p, gameSkillMap, krSkillMap, newIdentityId)
            if (skillRows.length > 0) {
              await supaInsertBatch('skills', skillRows)
              totalSkillsInserted += skillRows.length
              console.log(GREEN(`    스킬 삽입: ${skillRows.length}개 (uptie 3+4)`))
            }
          }

          // Keyword context for new identity
          const ctx = getKeywordCtx(gameId)
          ctx.gamePerson = p
          ctx.skillMap = new Map(
            [...(p.attributeList ?? []).map(a => a.skillId), ...(p.defenseSkillIDList ?? [])]
              .map(sid => [sid, gameSkillMap.get(sid)] as const)
              .filter((entry): entry is [number, PersonalitySkill] => entry[1] !== undefined),
          )
          for (const sid of [...(p.attributeList ?? []).map(a => a.skillId), ...(p.defenseSkillIDList ?? [])]) {
            collectKrDescriptions(ctx.rawKrTexts, krSkillMap.get(sid))
          }

          dbIdentityMap.set(gameId, { ...identityRow, id: newIdentityId })
          await sleep(150)
        } else {
          // Dry-run: skill preview
          if (!NEW_ONLY) {
            const skillRows = buildSkillRows(p, gameSkillMap, krSkillMap, null)
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

      // Build keyword context for existing identities (used later)
      const ctx = getKeywordCtx(gameId)
      ctx.gamePerson = p
      ctx.skillMap = new Map(
        [...(p.attributeList ?? []).map(a => a.skillId), ...(p.defenseSkillIDList ?? [])]
          .map(sid => [sid, gameSkillMap.get(sid)] as const)
          .filter((entry): entry is [number, PersonalitySkill] => entry[1] !== undefined),
      )
      for (const sid of [...(p.attributeList ?? []).map(a => a.skillId), ...(p.defenseSkillIDList ?? [])]) {
        collectKrDescriptions(ctx.rawKrTexts, krSkillMap.get(sid))
      }

      const changes = diffIdentity(computed, dbRow)
      const changeCount = Object.keys(changes).length

      if (changeCount === 0) {
        totalUnchanged++
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
        for (const [field, { to }] of Object.entries(changes)) updatePayload[field] = to
        const { error: patchErr } = await supabase
          .from('identities')
          .update(updatePayload)
          .eq('id', (dbRow as { id: string }).id)
        if (patchErr) console.error(RED(`    [ERROR] 업데이트 실패: ${patchErr.message}`))
        else console.log(YELLOW(`    업데이트 완료`))
        await sleep(80)
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  //  Passive sync
  // ══════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`)
  console.log(BOLD('  패시브 동기화'))
  console.log('═'.repeat(60))

  let passiveInserted = 0, passiveDeleted = 0

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

      const newPassives = buildPassiveRows(pm, identity.id as string, krPassiveMap, passiveDetailMap)
      if (newPassives.length === 0) continue

      // Collect passive KR texts for keyword extraction
      const ctx = getKeywordCtx(gameId)
      const allPassiveIds = [
        ...(pm.battlePassiveList ?? []).flatMap(l => l.passiveIDList),
        ...(pm.supporterPassiveList ?? []).flatMap(l => l.passiveIDList),
      ]
      for (const pid of allPassiveIds) {
        collectKrDescriptions(ctx.rawKrTexts, krPassiveMap.get(pid))
        const detail = passiveDetailMap.get(pid)
        if (detail) ctx.passiveDetails.push(detail)
      }

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

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`)
  console.log(BOLD('  요약'))
  console.log('═'.repeat(60))
  console.log(GREEN(`  신규 인격:     ${totalNew}개`))
  console.log(YELLOW(`  변경된 인격:   ${totalChanged}개`))
  console.log(GRAY(`  변경 없음:     ${totalUnchanged}개`))
  if (totalSkipped > 0) console.log(GRAY(`  스킵:          ${totalSkipped}개`))
  if (!DRY_RUN && totalSkillsInserted > 0) console.log(GREEN(`  삽입된 스킬:   ${totalSkillsInserted}개`))
  if (!DRY_RUN && passiveInserted > 0) console.log(GREEN(`  삽입된 패시브: ${passiveInserted}개`))
  if (DRY_RUN) {
    console.log(CYAN('\n  (DRY RUN — DB 미변경. 반영하려면 --fix 옵션 사용)'))
  } else {
    console.log(CYAN('\n  DB 반영 완료'))
  }

  if (totalNew > 0 && !DRY_RUN) {
    console.log(YELLOW('\n  [수동 입력 필요 필드]'))
    console.log(YELLOW('  다음 필드는 자동으로 채워지지 않습니다:'))
    console.log(YELLOW('    • acquisition      — 획득 방법 (가챠/파편 교환)'))
    console.log(YELLOW('    • acquisition_info — JSONB (type, gacha, fragment_cost, release_season)'))
    console.log(YELLOW('    • quote            — 특색 있는 대사 (KR_Voice_*.json → smalltalk)'))
    console.log(YELLOW('    • keywords         — 추출 키워드 확인 및 보완 필요 (--keywords로 확인)'))
  }
}

main().catch(err => {
  console.error(RED(`\n[FATAL] ${(err as Error).message}`))
  if (VERBOSE) console.error((err as Error).stack)
  process.exit(1)
})
