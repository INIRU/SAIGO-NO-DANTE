import { STORAGE_BASE } from '@/lib/constants/game'

// ── 에고 기프트 팔각형 클립패스 ─────────────────────────────────────────────
export const OCTAGON_CLIP = 'polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)'

// ── 에고 기프트 등급 ────────────────────────────────────────────────────────
export const GRADE_ROMAN: Record<string, string> = {
  'EX': 'EX',
  '5': '\u2164', '4': '\u2163', '3': '\u2162', '2': '\u2161', '1': '\u2160',
}

export const GRADE_COLORS: Record<string, string> = {
  'EX': '#c6ff2e', '5': '#c8900a', '4': '#7c4fc0', '3': '#2a7fd4', '2': '#2d9e60', '1': '#888',
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
  if (STATS_SLUGS.has(slug)) return `${STORAGE_BASE}/icons/stats/${slug}.webp`
  return `${STORAGE_BASE}/icons/keywords/${slug}.webp`
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
  화상: '#e85830', 출혈: '#c83030', 진동: '#d0a020', 파열: '#8040c0',
  침잠: '#3060b0', 호흡: '#40a060', 충전: '#e0c020', 참격: '#cc4444',
  관통: '#dd8833', 타격: '#cc8822', 공통: '#888888', '공통/범용': '#888888',
}

export function getGiftKeywordColor(keyword: string | null): string {
  if (!keyword) return '#888'
  return GIFT_KEYWORD_COLORS[keyword] ?? '#888'
}

// ── 기프트 이미지 배경 URL ──────────────────────────────────────────────────
export const GIFT_BG_URL = `${STORAGE_BASE}/icons/ego-gift-bg.webp`
