import { getGameUiAsset } from '@/lib/utils/game-ui'
import { getKeywordIconUrl } from '@/lib/constants/keywords'

// ── 에고 기프트 팔각형 클립패스 ─────────────────────────────────────────────
export const OCTAGON_CLIP = 'polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)'

// ── 에고 기프트 등급 ────────────────────────────────────────────────────────
export const GRADE_ROMAN: Record<string, string> = {
  'EX': 'EX',
  '5': '\u2164', '4': '\u2163', '3': '\u2162', '2': '\u2161', '1': '\u2160',
}

export const GRADE_COLORS: Record<string, string> = {
  'EX': '#c6ff2e', '5': '#c8900a', '4': '#7c4fc0', '3': '#2a7fd4', '2': '#2d9e60', '1': '#888888',
}

export const GRADE_ORDER = ['3', '2', '1']

// ── 에고 기프트 키워드 필터 ─────────────────────────────────────────────────
export const KEYWORD_FILTERS = [
  { label: '전체', slug: null },
  { label: '화상', slug: 'burn' },
  { label: '출혈', slug: 'bleed' },
  { label: '진동', slug: 'tremor' },
  { label: '파열', slug: 'rupture' },
  { label: '침잠', slug: 'sinking' },
  { label: '호흡', slug: 'breath' },
  { label: '충전', slug: 'charge' },
  { label: '참격', slug: 'slash' },
  { label: '관통', slug: 'pierce' },
  { label: '타격', slug: 'blunt' },
  { label: '공통', slug: 'general' },
] as const

export const SLUG_TO_KEYWORD: Record<string, string> = {
  burn: '화상', bleed: '출혈', tremor: '진동', rupture: '파열',
  sinking: '침잠', breath: '호흡', charge: '충전', slash: '참격',
  pierce: '관통', blunt: '타격', general: '공통/범용',
}

export const STATS_SLUGS = new Set(['slash', 'pierce', 'blunt'])

// ── 기프트 키워드 아이콘 URL 유틸 ───────────────────────────────────────────
export function getGiftKeywordIconUrl(slug: string): string | null {
  if (slug === 'general') return null
  if (STATS_SLUGS.has(slug)) return getKeywordIconUrl(slug, slug)
  return getKeywordIconUrl(SLUG_TO_KEYWORD[slug] ?? slug, slug === 'breath' ? 'poise' : slug)
}

export function getGiftKeywordSlug(keyword: string | null): string | null {
  if (!keyword) return 'general'
  for (const [slug, kw] of Object.entries(SLUG_TO_KEYWORD)) {
    if (keyword.includes(kw) || kw.includes(keyword)) return slug
  }
  return 'general'
}

// ── 기프트 키워드 색상 ──────────────────────────────────────────────────────
export const GIFT_KEYWORD_COLORS: Record<string, string> = {
  // 게임 키워드 아이콘에서 뽑은 색을 화면용으로 조금 밝힌 값
  화상: '#f0644c', 출혈: '#ee5a64', 진동: '#dca24a', 파열: '#22c4a4',
  침잠: '#5f9de8', 호흡: '#7fb3ae', 충전: '#22b8cc', 참격: '#cf8a5c',
  관통: '#cf8a5c', 타격: '#cf8a5c', 공통: '#9c8b73', '공통/범용': '#9c8b73',
}

export function getGiftKeywordColor(keyword: string | null): string {
  if (!keyword) return '#888888'
  return GIFT_KEYWORD_COLORS[keyword] ?? '#888888'
}

// ── 기프트 이미지 배경 URL ──────────────────────────────────────────────────
export const GIFT_BG_URL = getGameUiAsset('gift/background')
/** Slot of a gift enhanced to + or ++: orange stripes and a yellow inner octagon. */
export const GIFT_BG_ENHANCED_URL = getGameUiAsset('gift/background-enhanced')
