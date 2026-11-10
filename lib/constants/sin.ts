
import { getGameUiAsset } from '@/lib/utils/game-ui'
import type { SinType } from '@/lib/types'

// ── 죄악 색상 ────────────────────────────────────────────────────────────────
export const SIN_COLORS: Record<SinType, string> = {
  wrath:    '#c83030',
  lust:     '#d06030',
  sloth:    '#d4b830',
  gluttony: '#88b028',
  gloom:    '#4898b0',
  pride:    '#3870b0',
  envy:     '#8058a8',
}

// ── 죄악 한글 라벨 ───────────────────────────────────────────────────────────
export const SIN_LABELS_KR: Record<SinType, string> = {
  wrath:    '분노',
  lust:     '색욕',
  sloth:    '나태',
  gluttony: '탐식',
  gloom:    '우울',
  pride:    '오만',
  envy:     '질투',
}

// ── 한국어 → 영문 죄악 매핑 ─────────────────────────────────────────────────
export const SIN_KR_TO_EN: Record<string, SinType> = {
  '분노': 'wrath', '색욕': 'lust', '나태': 'sloth', '탐식': 'gluttony',
  '폭식': 'gluttony', '우울': 'gloom', '오만': 'pride', '질투': 'envy',
}

// ── 죄악 아이콘 URL ─────────────────────────────────────────────────────────

export const SIN_ICON_MAP: Record<SinType, string> = {
  wrath:    getGameUiAsset('sins/wrath'),
  lust:     getGameUiAsset('sins/lust'),
  sloth:    getGameUiAsset('sins/sloth'),
  gluttony: getGameUiAsset('sins/gluttony'),
  gloom:    getGameUiAsset('sins/gloom'),
  pride:    getGameUiAsset('sins/pride'),
  envy:     getGameUiAsset('sins/envy'),
}

export function getSinIconUrl(sin: SinType): string {
  return SIN_ICON_MAP[sin]
}

// ── 죄악 속성 정규화 (한글이든 영문이든 → SinType) ──────────────────────────
export function normalizeSin(sin: string | null): SinType | null {
  if (!sin) return null
  if (sin in SIN_COLORS) return sin as SinType
  return SIN_KR_TO_EN[sin] ?? null
}

/** The color of a sin given as Korean or English; `fallback` when it is none of the seven. */
export function sinColorOf(sin: string | null, fallback: string): string {
  const key = normalizeSin(sin)
  return key ? SIN_COLORS[key] : fallback
}

// ── 죄악 순서 (3개 파일에서 중복되던 것 통합) ────────────────────────────────
export const SIN_ORDER: SinType[] = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']

// ── 게임 데이터의 죄악 속성 코드(판정·스킬 조건) → SinType ─────────────────────
export const SIN_ATTRIBUTE_CODES: Record<string, SinType> = {
  CRIMSON: 'wrath', SCARLET: 'lust', ORANGE: 'lust', AMBER: 'sloth', YELLOW: 'sloth',
  SHAMROCK: 'gluttony', GREEN: 'gluttony', AZURE: 'gloom', INDIGO: 'pride', VIOLET: 'envy',
}
