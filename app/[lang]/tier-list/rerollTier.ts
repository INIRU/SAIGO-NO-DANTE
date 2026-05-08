export const REROLL_SOURCE_URL = 'https://gall.dcinside.com/mgallery/board/view/?id=limbuscompany&no=375877'

export const REROLL_TIERS = ['S+', 'S', 'A', 'B', 'C'] as const

export type RerollTier = typeof REROLL_TIERS[number]
export type SupportedTierLocale = 'ko' | 'en' | 'ja'

export const REROLL_TIER_SCORES: Record<RerollTier, number> = {
  'S+': 3.0,
  S: 2.5,
  A: 2.0,
  B: 1.5,
  C: 1.0,
}

export const REROLL_TIER_LABELS: Record<SupportedTierLocale, Record<RerollTier, string>> = {
  ko: {
    'S+': '개사기',
    S: '매우 좋음',
    A: '좋음',
    B: '적당함',
    C: '유효',
  },
  en: {
    'S+': 'Broken',
    S: 'Excellent',
    A: 'Good',
    B: 'Decent',
    C: 'Valid',
  },
  ja: {
    'S+': '非常に強力',
    S: 'とても良い',
    A: '良い',
    B: '適度',
    C: '有効',
  },
}

export const REROLL_TIER_COLORS: Record<RerollTier, string> = {
  'S+': '#ff5050',
  S: '#ff7a2f',
  A: '#f3c13a',
  B: '#60c860',
  C: '#60a0ff',
}

export function isRerollTier(value: string): value is RerollTier {
  return REROLL_TIERS.includes(value as RerollTier)
}
