import type { SinType, Identity } from '@/lib/types'
import { SIN_COLORS } from '@/lib/constants/sin'
import { STORAGE_BASE } from '@/lib/constants/game'

/**
 * 인격의 키워드 목록에서 메인 죄악 속성을 추론.
 * sinMap (keyword→SinType) 매핑에서 첫 번째 매칭 키워드의 죄악을 반환.
 * 매칭 없으면 null.
 */
export function getIdentityMainSin(keywords: string[] | null | undefined, sinMap: Record<string, string>): SinType | null {
  if (!keywords || keywords.length === 0) return null
  for (const kw of keywords) {
    const sin = sinMap[kw]
    if (sin) return sin as SinType
  }
  return null
}

/**
 * 인격의 표시용 죄악 색상을 결정 (키워드 기반).
 */
export function getIdentitySinColor(identity: Identity, sinMap: Record<string, string>): string {
  const sin = getIdentityMainSin(identity.keywords, sinMap)
  return sin ? SIN_COLORS[sin] : '#888888'
}

/**
 * 인격의 표시용 SinType을 결정 (키워드 기반).
 */
export function getIdentitySinType(identity: Identity, sinMap: Record<string, string>): SinType | null {
  return getIdentityMainSin(identity.keywords, sinMap)
}

// ── 테마 키워드 (덱 분류, 보유현황 그룹핑 등에서 공통 사용) ──
export const THEME_KEYWORDS = ['침잠', '출혈', '파열', '화상', '진동', '충전', '호흡'] as const

/**
 * 특수 충전 → 충전 계열로 매핑.
 * 인격 키워드에 이 키워드가 있으면 "충전" 테마로 분류.
 */
/**
 * 특수 충전 키워드 (독립적 — "충전"과 함께 태그되지 않는 것들).
 * 인격 분류/필터에서 충전으로 매핑.
 */
export const SPECIAL_CHARGE_KEYWORDS = new Set([
  '사랑/증오', '깊은 눈물', '적안', '적안적안 - 경계적안 - 포식',
  '참회', '참회참회 - 경계참회 - 고해',
  '생체 재료',
])

/**
 * 충전 관련 부속 키워드 ("충전"과 보통 함께 태그됨).
 * 필터에서는 충전으로 매핑하지만, 통계 합산에서는 중복 카운트 방지용.
 */
export const CHARGE_SUB_KEYWORDS = new Set([
  '충전 횟수', '충전 역장', '부하', '과충전', '자가 충전', '전하침',
  '광전', '고전압 외피', '초아광축전',
])

/**
 * 키워드를 테마 키워드로 정규화.
 * 특수 충전 + 충전 부속 키워드 → '충전', 그 외는 원본 그대로 반환.
 */
export function normalizeThemeKeyword(kw: string): string {
  if (SPECIAL_CHARGE_KEYWORDS.has(kw) || CHARGE_SUB_KEYWORDS.has(kw)) return '충전'
  return kw
}

/**
 * 통계 합산용: 독립적 특수 충전만 정규화 (부속 키워드는 제외하여 중복 카운트 방지).
 */
export function normalizeForStats(kw: string): string {
  if (SPECIAL_CHARGE_KEYWORDS.has(kw)) return '충전'
  return kw
}

/**
 * 키워드 아이콘 URL을 반환.
 * iconSlug가 없으면 null.
 */
export function getKeywordIconUrl(_keyword: string, iconSlug?: string): string | null {
  if (!iconSlug) return null
  return `${STORAGE_BASE}/icons/keywords/${iconSlug}.webp`
}
