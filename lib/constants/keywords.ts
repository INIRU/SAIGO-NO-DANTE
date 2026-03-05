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

/**
 * 키워드 아이콘 URL을 반환.
 * iconSlug가 없으면 null.
 */
export function getKeywordIconUrl(_keyword: string, iconSlug?: string): string | null {
  if (!iconSlug) return null
  return `${STORAGE_BASE}/icons/keywords/${iconSlug}.webp`
}
