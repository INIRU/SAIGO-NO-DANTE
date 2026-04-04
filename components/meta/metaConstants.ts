import { STORAGE_BASE } from '@/lib/data/sinners'
import { SinType, SIN_COLORS } from '@/lib/data/sinners'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'

export const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']

export const GRADE_ICON_URL: Record<string, string> = {
  ZAYIN: `${STORAGE_BASE}/icons/grade/ZAYIN.webp`,
  TETH:  `${STORAGE_BASE}/icons/grade/TETH.webp`,
  HE:    `${STORAGE_BASE}/icons/grade/HE.webp`,
  WAW:   `${STORAGE_BASE}/icons/grade/WAW.webp`,
}

export function mainKeywordColor(keywords: string[], sinMap: Record<string, string>): string {
  for (const kw of keywords) {
    const sin = sinMap[kw]
    if (sin) return SIN_COLORS[sin as SinType]
  }
  return '#888888'
}

/** Returns sin-mapped keywords (max 3), normalizing special charge → charge */
export function mainKeywords(keywords: string[], sinMap: Record<string, string>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const kw of keywords) {
    const nkw = normalizeThemeKeyword(kw)
    const target = sinMap[nkw] ? nkw : sinMap[kw] ? kw : null
    if (target && !seen.has(target)) {
      seen.add(target)
      result.push(target)
    }
    if (result.length >= 3) break
  }
  return result
}

export function identityCardUrl(
  sinnerId: string,
  folder: string | null,
  gameId: string | null,
): string {
  if (!folder || !gameId) return ''
  return `${STORAGE_BASE}/sinners/${sinnerId}/identities/${folder}/${gameId}_normal_info.webp`
}
