import pako from 'pako'
import type { PlannerState, Difficulty } from './types'

interface PlanData {
  d: string               // difficulty first char
  i: string[]             // identity_ids
  e: string[]             // ego_ids
  f: (string | null)[]    // floor theme_ids
  g: string[]             // gift inventory game_ids
  t?: string              // title
  desc?: string           // description
}

const DIFF_SHORT: Record<Difficulty, string> = { normal: 'n', hard: 'h', overlap: 'o', extreme: 'e' }
const SHORT_DIFF: Record<string, Difficulty> = { n: 'normal', h: 'hard', o: 'overlap', e: 'extreme' }

export function encodePlan(state: PlannerState): string {
  const data: PlanData = {
    d: DIFF_SHORT[state.difficulty],
    i: state.identitySlots.map(s => s.identity_id),
    e: state.egoSlots.map(s => s.ego_id),
    f: state.floorPlan.map(f => f.theme_id),
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

export function decodePlan(encoded: string): {
  difficulty: Difficulty
  identityIds: string[]
  egoIds: string[]
  floorThemeIds: (string | null)[]
  giftIds: string[]
  title: string
  description: string
} {
  // URL-safe base64 복원
  let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='

  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const json = new TextDecoder().decode(pako.inflate(bytes))
  const data: PlanData = JSON.parse(json)

  return {
    difficulty: SHORT_DIFF[data.d] ?? 'hard',
    identityIds: data.i ?? [],
    egoIds: data.e ?? [],
    floorThemeIds: data.f ?? [],
    giftIds: data.g ?? [],
    title: data.t ?? '',
    description: data.desc ?? '',
  }
}

// localStorage 키
const LS_KEY = 'md-planner-draft'

export function saveDraftToLocal(state: PlannerState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      difficulty: state.difficulty,
      identitySlots: state.identitySlots,
      egoSlots: state.egoSlots,
      floorPlan: state.floorPlan,
      giftInventory: state.giftInventory,
      title: state.title,
      description: state.description,
    }))
  } catch { /* quota exceeded 등 무시 */ }
}

export function loadDraftFromLocal(): Partial<PlannerState> | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearDraftFromLocal(): void {
  try { localStorage.removeItem(LS_KEY) } catch { /* */ }
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

import type { RunState } from './run-types'

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
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearRunDraft(): void {
  try { localStorage.removeItem(RUN_DRAFT_KEY) } catch { /* */ }
}

export function saveRunToHistory(state: RunState): void {
  try {
    const history: RunDraft[] = JSON.parse(localStorage.getItem(RUN_HISTORY_KEY) ?? '[]')
    history.unshift({
      state,
      savedAt: new Date().toISOString(),
      label: makeRunLabel(state),
    })
    if (history.length > MAX_RUN_HISTORY) history.length = MAX_RUN_HISTORY
    localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(history))
  } catch { /* */ }
}

export function loadRunHistory(): RunDraft[] {
  try {
    return JSON.parse(localStorage.getItem(RUN_HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}
