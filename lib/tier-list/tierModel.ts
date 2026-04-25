export const TIERS = ['S+', 'S', 'S-', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'F', 'N/A'] as const

export type Tier = typeof TIERS[number]
export type ScoredTier = Exclude<Tier, 'N/A'>

export const MIN_RATINGS_FOR_TIER = 1

export const TIER_THRESHOLDS: Array<{ tier: ScoredTier; min: number }> = [
  { tier: 'S+', min: 9.2 },
  { tier: 'S', min: 8.8 },
  { tier: 'S-', min: 8.4 },
  { tier: 'A+', min: 7.8 },
  { tier: 'A', min: 7.2 },
  { tier: 'A-', min: 6.6 },
  { tier: 'B+', min: 6.0 },
  { tier: 'B', min: 5.4 },
  { tier: 'B-', min: 4.8 },
  { tier: 'C+', min: 4.2 },
  { tier: 'C', min: 3.6 },
  { tier: 'C-', min: 3.0 },
  { tier: 'F', min: 0 },
]

export const TIER_COLORS: Record<Tier, string> = {
  'S+': '#ff5050',
  S: '#ff7a2f',
  'S-': '#ff9a3f',
  'A+': '#ffd040',
  A: '#f3c13a',
  'A-': '#d9ad34',
  'B+': '#7fd66b',
  B: '#60c860',
  'B-': '#4faf57',
  'C+': '#6bb7ff',
  C: '#60a0ff',
  'C-': '#507fd8',
  F: '#75685a',
  'N/A': '#8a7855',
}

export const TIER_SCORE_LABELS: Record<Tier, string> = {
  'S+': '9.2+',
  S: '8.8+',
  'S-': '8.4+',
  'A+': '7.8+',
  A: '7.2+',
  'A-': '6.6+',
  'B+': '6.0+',
  B: '5.4+',
  'B-': '4.8+',
  'C+': '4.2+',
  C: '3.6+',
  'C-': '3.0+',
  F: '<3.0',
  'N/A': 'N/A',
}

export function createEmptyTiers<T = never>(): Record<Tier, T[]> {
  return Object.fromEntries(TIERS.map(tier => [tier, []])) as unknown as Record<Tier, T[]>
}

export function deriveTier(averageScore: number | null, ratingCount: number): Tier {
  if (averageScore === null || ratingCount < MIN_RATINGS_FOR_TIER) return 'N/A'
  return TIER_THRESHOLDS.find(item => averageScore >= item.min)?.tier ?? 'F'
}

export function getTierTextColor(tier: Tier): string {
  return tier === 'A+' || tier === 'A' || tier === 'A-' ? '#241900' : '#fff'
}

export function getTierSubtextColor(tier: Tier): string {
  if (tier === 'A+' || tier === 'A' || tier === 'A-') return '#3a2800'
  if (tier === 'N/A') return '#f0dfba'
  if (tier === 'F') return '#f4e8d1'
  return '#fff1d6'
}
