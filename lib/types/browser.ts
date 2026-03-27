// Design Ref: §3 — 브라우저 전용 타입 (서버 가공 데이터 + 필터 상태)
import type { SinType } from '@/lib/types'

// ── 인격 브라우저용 타입 ──────────────────────────────────────────────

/** 서버에서 가공하여 클라이언트로 전달하는 인격 데이터 */
export type IdentityBrowserItem = {
  id: string
  sinner_id: string
  name: string
  name_kr: string
  rarity: number
  keywords: string[]
  folder_name: string | null
  game_id: string | null
  // 스탯
  hp: number
  speed_min: number
  speed_max: number
  def_level: number
  // 수감자 정보
  sinner_name_kr: string
  sinner_slug: string
  sinner_order: number
  // 스킬 요약 (서버에서 가공, 필터용)
  skill_sins: SinType[]
  skill_types: string[]
  atk_weights: number[]
  coin_counts: number[]
}

// ── EGO 브라우저용 타입 ──────────────────────────────────────────────

/** 서버에서 가공하여 클라이언트로 전달하는 EGO 데이터 */
export type EGOBrowserItem = {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  grade: string
  sin_affinity: SinType | null
  keywords: string[] | null
  folder_name: string | null
  image_url: string | null
  game_id: string | null
  // 수감자 정보
  sinner_name_kr: string
  sinner_slug: string
  sinner_order: number
}

// ── 필터 상태 타입 ──────────────────────────────────────────────────

export type IdentityFilterState = {
  sinners: Set<string>
  keywords: Set<string>
  sins: Set<SinType>
  rarities: Set<number>
  atkTypes: Set<string>
  atkWeights: Set<number>
  coinCounts: Set<number>
}

export type EGOFilterState = {
  sinners: Set<string>
  keywords: Set<string>
  sins: Set<SinType>
  grades: Set<string>
}

export type SortOption = 'default' | 'name' | 'rarity' | 'grade'

// ── 상수 ────────────────────────────────────────────────────────────

export const EGO_GRADES = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const
export const EGO_GRADE_LABELS: Record<string, string> = {
  ZAYIN: 'ZAYIN', TETH: 'TETH', HE: 'HE', WAW: 'WAW', ALEPH: 'ALEPH',
}
export const ATK_TYPES = ['slash', 'pierce', 'blunt', 'evade', 'defense', 'counter'] as const
export const ATK_TYPE_LABELS: Record<string, string> = {
  slash: '참격', pierce: '관통', blunt: '타격',
  evade: '회피', defense: '수비', counter: '반격',
}
export const RARITIES = [1, 2, 3] as const
