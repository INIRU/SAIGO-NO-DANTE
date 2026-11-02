import type { SinType, Identity } from '@/lib/types'
import { SIN_COLORS } from '@/lib/constants/sin'
import { STORAGE_BASE } from '@/lib/constants/game'
import { getGameUiAsset } from '@/lib/utils/game-ui'

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
 * 인격의 원본 uniqueAttribute 죄악 색상. 구 데이터에서만 키워드 매핑으로 대체.
 */
export function getIdentitySinColor(identity: Identity, sinMap: Record<string, string>): string {
  const sin = getIdentitySinType(identity, sinMap)
  return sin ? SIN_COLORS[sin] : '#888888'
}

/**
 * 인격의 원본 uniqueAttribute를 개별 스킬 및 키워드 테마보다 우선.
 */
export function getIdentitySinType(identity: Identity, sinMap: Record<string, string>): SinType | null {
  return identity.sin_affinity ?? getIdentityMainSin(identity.keywords, sinMap)
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
const BASE_ATTACK_KEYWORD_ICON_PATHS: Record<string, string> = {
  '참격': 'stats/slash',
  '관통': 'stats/pierce',
  '타격': 'stats/blunt',
  slash: 'stats/slash',
  pierce: 'stats/pierce',
  blunt: 'stats/blunt',
}

const BASE_ATTACK_ICON_SLUG_PATHS: Record<string, string> = {
  'stat:slash': 'stats/slash',
  'stat:pierce': 'stats/pierce',
  'stat:blunt': 'stats/blunt',
}

const ATLAS_KEYWORD_SLUGS = new Set(['tiantui-star', 'shin-tiantui-star', 'tremor-burst', 'shimmering-bloodfiend'])

export function getKeywordIconUrl(keyword: string, iconSlug?: string): string | null {
  if (['파괴 불가 코인', 'Unbreakable Coin', '破壊不可コイン'].includes(keyword) || iconSlug === 'unbreakable-coin') {
    return getGameUiAsset('coins/unbreakable')
  }
  const statIconPath = BASE_ATTACK_KEYWORD_ICON_PATHS[keyword] ?? (iconSlug ? BASE_ATTACK_ICON_SLUG_PATHS[iconSlug] ?? BASE_ATTACK_KEYWORD_ICON_PATHS[iconSlug] : undefined)
  if (statIconPath) return getGameUiAsset(statIconPath)
  if (!iconSlug) return null
  if (ATLAS_KEYWORD_SLUGS.has(iconSlug)) return getGameUiAsset(`keywords/${iconSlug}`)
  return `${STORAGE_BASE}/icons/keywords/${iconSlug}.webp`
}
