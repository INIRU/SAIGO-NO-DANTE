import { deleteTempSlot, loadTempSlots, saveTempSlot, type TempDraft, type TempSlot } from '@/lib/drafts/temp-slots'
import { createInitialState, getIdentitySkillDistribution, normalizePlannerThemeId, normalizeSkillDistribution, type PlannerState, type Difficulty, type SkillDistribution, type IdentityData, type EgoData } from './types'
import { getLegacyPlanFloorDifficulty, isFloorDifficulty } from './floor-difficulty'
import type { RunState } from './run-types'

interface PlanData {
  v?: number              // payload version
  d: string               // difficulty first char
  mk?: string[]           // planner-selected main keywords
  mkm?: boolean           // main keywords were manually adjusted
  i: string[]             // identity_ids
  sd?: SkillDistribution[] // S1/S2/S3 counts aligned with identity_ids
  e: string[]             // ego_ids
  f: (string | number | null)[] // floor theme_ids
  fc?: number[][]
  fg?: string[][]
  fm?: string[]
  fd?: string[]           // per-floor difficulty short codes
  g: string[]             // gift inventory game_ids
  t?: string              // title
  desc?: string           // description
}

const DIFF_SHORT: Record<Difficulty, string> = { normal: 'n', hard: 'h', overlap: 'o', extreme: 'e' }
const SHORT_DIFF: Record<string, Difficulty> = { n: 'normal', h: 'hard', o: 'overlap', e: 'extreme' }

export async function encodePlan(state: PlannerState): Promise<string> {
  const pako = await import('pako')
  const data: PlanData = {
    v: 3,
    fc: state.floorPlan.map(f => f.constraints ?? []),
    fg: state.floorPlan.map(f => f.gift_ids),
    fm: state.floorPlan.map(f => f.memo),
    d: DIFF_SHORT[state.difficulty],
    mk: state.mainKeywords,
    mkm: state.mainKeywordsManual,
    i: state.identitySlots.map(s => s.identity_id),
    sd: state.identitySlots.map(s => getIdentitySkillDistribution(s)),
    e: state.egoSlots.map(s => s.ego_id),
    f: state.floorPlan.map(f => f.theme_id),
    fd: state.floorPlan.map(f => DIFF_SHORT[f.difficulty] ?? DIFF_SHORT[getLegacyPlanFloorDifficulty(state.difficulty, f.floor)]),
    g: state.giftInventory,
  }
  if (state.title) data.t = state.title
  if (state.description) data.desc = state.description

  const json = JSON.stringify(data)
  const compressed = pako.deflate(new TextEncoder().encode(json))
  // Uint8Array → base64
  let binary = ''
  for (let i = 0; i < compressed.length; i++) binary += String.fromCharCode(compressed[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function decodePlan(encoded: string): Promise<{
  difficulty: Difficulty
  identityIds: string[]
  skillDistributions: SkillDistribution[]
  egoIds: string[]
  floorThemeIds: (string | null)[]
  floorConstraints: number[][]
  floorGifts: string[][]
  floorMemos: string[]
  floorDifficulties: Difficulty[]
  giftIds: string[]
  mainKeywords: string[]
  mainKeywordsManual: boolean
  title: string
  description: string
}> {
  const pako = await import('pako')
  // URL-safe base64 복원
  let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='

  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const json = new TextDecoder().decode(pako.inflate(bytes))
  const data: PlanData = JSON.parse(json)
  const difficulty = SHORT_DIFF[data.d] ?? 'hard'
  const floorThemeIds = (data.f ?? []).map(themeId => normalizePlannerThemeId(themeId))
  const floorDifficulties = floorThemeIds.map((_, index) => {
    const decodedDifficulty = data.fd?.[index] ? SHORT_DIFF[data.fd[index]] : null
    return isFloorDifficulty(decodedDifficulty)
      ? decodedDifficulty
      : getLegacyPlanFloorDifficulty(difficulty, index + 1)
  })

  return {
    difficulty,
    identityIds: data.i ?? [],
    skillDistributions: (data.i ?? []).map((_, index) => normalizeSkillDistribution(data.sd?.[index])),
    egoIds: data.e ?? [],
    floorThemeIds,
    floorDifficulties,
    floorConstraints: floorThemeIds.map((_, i) => Array.isArray(data.fc?.[i]) ? data.fc[i].filter(Number.isInteger) : []),
    floorGifts: floorThemeIds.map((_, i) => Array.isArray(data.fg?.[i]) ? data.fg[i].filter(x => typeof x === "string") : []),
    floorMemos: floorThemeIds.map((_, i) => typeof data.fm?.[i] === "string" ? data.fm[i] : ""),
    giftIds: data.g ?? [],
    mainKeywords: Array.isArray(data.mk) ? data.mk.filter((item): item is string => typeof item === 'string') : [],
    mainKeywordsManual: typeof data.mkm === 'boolean' ? data.mkm : Array.isArray(data.mk) && data.mk.length > 0,
    title: data.t ?? '',
    description: data.desc ?? '',
  }
}

export type DecodedPlan = Awaited<ReturnType<typeof decodePlan>>

export function decodedPlanToPlannerState(decoded: DecodedPlan, identities: IdentityData[], egos: EgoData[]): PlannerState {
  const initial = createInitialState(decoded.difficulty)
  const identityById = new Map(identities.map(identity => [identity.id, identity]))
  const egoById = new Map(egos.map(ego => [ego.id, ego]))
  return {
    ...initial,
    title: decoded.title,
    description: decoded.description,
    mainKeywords: decoded.mainKeywords,
    mainKeywordsManual: decoded.mainKeywordsManual,
    identitySlots: decoded.identityIds.flatMap((id, index) => {
      const identity = identityById.get(id)
      if (!identity) return []
      const [s1_count, s2_count, s3_count] = normalizeSkillDistribution(decoded.skillDistributions[index])
      return [{
        identity_id: id, sinner_id: identity.sinner_id, name_kr: identity.name_kr,
        rarity: identity.rarity, keywords: identity.keywords ?? [], skill_keyword_list: identity.skill_keyword_list,
        affiliation: identity.affiliation, association_list: identity.association_list,
        game_id: identity.game_id, folder_name: identity.folder_name, slot_order: index,
        s1_count, s2_count, s3_count,
      }]
    }),
    egoSlots: decoded.egoIds.flatMap(id => {
      const ego = egoById.get(id)
      return ego ? [{ ego_id: id, sinner_id: ego.sinner_id, name_kr: ego.name_kr ?? ego.name, grade: ego.grade, sin_affinity: ego.sin_affinity }] : []
    }),
    floorPlan: Array.from({ length: Math.max(initial.floorPlan.length, decoded.floorThemeIds.length) }, (_, index) => {
      const floor = initial.floorPlan[index] ?? {
        floor: index + 1, difficulty: getLegacyPlanFloorDifficulty(decoded.difficulty, index + 1),
        theme_id: null, gift_ids: [], memo: '',
      }
      return {
        ...floor,
        difficulty: decoded.floorDifficulties[index] ?? floor.difficulty,
        theme_id: decoded.floorThemeIds[index] ?? null,
        gift_ids: decoded.floorGifts[index] ?? [],
        memo: decoded.floorMemos[index] ?? '',
        constraints: decoded.floorConstraints[index] ?? [],
      }
    }),
    giftInventory: decoded.giftIds,
  }
}

/** Build a reviewable planner draft from observations; the source plan remains untouched. */
/**
 * The plan's gift inventory after a run: the source plan's start and observed gifts as they were, then every gift still
 * held at the end (fusions and sales already applied) as a final gift, keeping the enhancement the plan gave that gift.
 * The floors keep what was taken on them; only this list is the end state.
 */
function exportedGiftInventory(run: RunState): string[] {
  const planned = run.sourcePlanSnapshot?.giftInventory ?? []
  const auto = planned.filter(key => /^(start|observe)_/.test(key))
  const autoIds = new Set(auto.map(key => key.replace(/^(start|observe)_/, '').replace(/_plus(plus)?$/, '')))
  const plannedFinal = new Map(planned.flatMap(key => { const match = /^final_(.+?)(_plus|_plusplus)?$/.exec(key); return match ? [[match[1], key] as const] : [] }))
  const held = [...new Set(run.giftInventory)].filter(id => !autoIds.has(id))
  return [...auto, ...held.map(id => plannedFinal.get(id) ?? `final_${id}`)]
}

export function runStateToPlannerState(run: RunState): PlannerState {
  const initial = createInitialState(run.difficulty)
  const source = run.sourcePlanSnapshot
  return {
    ...initial,
    title: source?.title ?? '',
    description: source?.description ?? '',
    mainKeywords: [...(source?.mainKeywords ?? [])],
    mainKeywordsManual: source?.mainKeywordsManual ?? false,
    identitySlots: structuredClone(run.identitySlots),
    egoSlots: structuredClone(run.egoSlots),
    giftInventory: exportedGiftInventory(run),
    floorPlan: initial.floorPlan.map((entry, index) => {
      const observed = run.floorLogs[index]
      const planned = source?.floorPlan?.find(floor => floor.floor === index + 1)
      const constraints = observed?.themeId && observed.themeId === planned?.theme_id
        ? [...(planned.constraints ?? [])] : []
      return {
        ...entry,
        difficulty: observed?.difficulty ?? entry.difficulty,
        theme_id: observed?.themeId ?? null,
        gift_ids: [...(observed?.acquiredGifts ?? [])],
        memo: observed?.memo ?? '',
        constraints,
      }
    }),
  }
}

// localStorage 키
const PLANNER_HANDOFF_KEY = 'md-planner-handoff'
const PLANNER_TEMP_DRAFTS_KEY = 'md-planner-temp-drafts'
export type PlannerTempDraft = TempDraft<PlannerState>
export type PlannerTempSlot = TempSlot<PlannerState>

export function snapshotPlannerState(state: PlannerState): PlannerState {
  return {
    difficulty: state.difficulty,
    identitySlots: state.identitySlots,
    egoSlots: state.egoSlots,
    mainKeywords: state.mainKeywords ?? [],
    mainKeywordsManual: state.mainKeywordsManual ?? false,
    floorPlan: state.floorPlan,
    giftInventory: state.giftInventory,
    title: state.title,
    description: state.description,
    activeTab: state.activeTab ?? 'deck',
  }
}

export function isPlannerState(value: unknown): value is PlannerState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<PlannerState>
  return (
    typeof state.difficulty === 'string' &&
    typeof state.title === 'string' &&
    typeof state.description === 'string' &&
    Array.isArray(state.identitySlots) &&
    Array.isArray(state.egoSlots) &&
    (state.mainKeywords === undefined || Array.isArray(state.mainKeywords)) &&
    (state.mainKeywordsManual === undefined || typeof state.mainKeywordsManual === 'boolean') &&
    Array.isArray(state.floorPlan) &&
    Array.isArray(state.giftInventory) &&
    typeof state.activeTab === 'string'
  )
}

function makePlannerTempLabel(state: PlannerState, fallbackLabel?: string): string {
  const title = state.title.trim()
  if (title) return title
  return fallbackLabel?.trim() || 'Untitled'
}

export function saveDraftToLocal(state: PlannerState): boolean {
  try {
    localStorage.setItem(PLANNER_HANDOFF_KEY, JSON.stringify(snapshotPlannerState(state)))
    return true
  } catch { return false }
}

export function loadDraftFromLocal(): Partial<PlannerState> | null {
  try {
    const raw = localStorage.getItem(PLANNER_HANDOFF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isPlannerState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function clearDraftFromLocal(): void {
  try { localStorage.removeItem(PLANNER_HANDOFF_KEY) } catch { /* */ }
}

export function loadPlannerTempSlots(): PlannerTempSlot[] {
  return loadTempSlots(PLANNER_TEMP_DRAFTS_KEY, isPlannerState)
}

/** Null when the browser refused to store it. */
export function savePlannerTempSlot(slotNumber: number, state: PlannerState, fallbackLabel?: string): PlannerTempSlot[] | null {
  return saveTempSlot(PLANNER_TEMP_DRAFTS_KEY, slotNumber, snapshotPlannerState(state), makePlannerTempLabel(state, fallbackLabel), isPlannerState)
}

export function deletePlannerTempSlot(slotNumber: number): PlannerTempSlot[] {
  return deleteTempSlot(PLANNER_TEMP_DRAFTS_KEY, slotNumber, isPlannerState)
}

// ── Plan → Trigger Mode 전환용 (slot_order 보존) ──────────────────────────

const PLAN_TO_RUN_KEY = 'md-plan-to-run'

export function savePlanForRun(state: PlannerState): void {
  try {
    localStorage.setItem(PLAN_TO_RUN_KEY, JSON.stringify({
      difficulty: state.difficulty,
      identitySlots: state.identitySlots,
      egoSlots: state.egoSlots,
      floorPlan: state.floorPlan,
      giftInventory: state.giftInventory,
      mainKeywords: state.mainKeywords ?? [],
      mainKeywordsManual: state.mainKeywordsManual ?? false,
      title: state.title,
      description: state.description,
    }))
  } catch { /* */ }
}

export function loadPlanForRun(): Partial<PlannerState> | null {
  try {
    const raw = localStorage.getItem(PLAN_TO_RUN_KEY)
    if (!raw) return null
    localStorage.removeItem(PLAN_TO_RUN_KEY) // 일회용
    return JSON.parse(raw)
  } catch { return null }
}

// ── 트리거 모드 런 저장/복원 ──────────────────────────────────────────────────

import { normalizeRunState } from './run-types'

const RUN_DRAFT_KEY = 'md-run-draft'
const RUN_HISTORY_KEY = 'md-run-history'
const MAX_RUN_HISTORY = 5

interface RunDraft {
  state: RunState
  savedAt: string
  label: string
}

function makeRunLabel(state: RunState): string {
  const diff = DIFF_LABELS[state.difficulty] ?? state.difficulty
  const gifts = state.giftInventory.length
  return `${diff} ${state.currentFloor}/${state.maxFloors}층 기프트 ${gifts}개`
}

const DIFF_LABELS: Record<string, string> = {
  normal: '노말', hard: '하드', overlap: '평행중첩', extreme: '익스트림',
}

export function saveRunDraft(state: RunState): void {
  try {
    const draft: RunDraft = {
      state,
      savedAt: new Date().toISOString(),
      label: makeRunLabel(state),
    }
    localStorage.setItem(RUN_DRAFT_KEY, JSON.stringify(draft))
  } catch { /* quota exceeded */ }
}

export function loadRunDraft(): RunDraft | null {
  try {
    const raw = localStorage.getItem(RUN_DRAFT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) return null
    const state = normalizeRunState(parsed.state)
    return {
      state,
      savedAt: 'savedAt' in parsed && typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
      label: 'label' in parsed && typeof parsed.label === 'string' ? parsed.label : makeRunLabel(state),
    }
  } catch {
    return null
  }
}

export function clearRunDraft(): void {
  try { localStorage.removeItem(RUN_DRAFT_KEY) } catch { /* */ }
}

export function saveRunToHistory(state: RunState): boolean {
  try {
    const history = loadRunHistory()
    history.unshift({
      state,
      savedAt: new Date().toISOString(),
      label: makeRunLabel(state),
    })
    if (history.length > MAX_RUN_HISTORY) history.length = MAX_RUN_HISTORY
    localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(history))
    return true
  } catch { return false }
}

export function loadRunHistory(): RunDraft[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RUN_HISTORY_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap(entry => {
      if (!entry || typeof entry !== 'object' || !('state' in entry)) return []
      const state = normalizeRunState(entry.state)
      return [{
        state,
        savedAt: 'savedAt' in entry && typeof entry.savedAt === 'string' ? entry.savedAt : '',
        label: 'label' in entry && typeof entry.label === 'string' ? entry.label : makeRunLabel(state),
      }]
    })
  } catch {
    return []
  }
}
