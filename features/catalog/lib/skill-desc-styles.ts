export const SKILL_DESC_STYLES = {
  detail: { fontSize: '0.8125rem', color: '#aaa', lineHeight: 1.8, dividerOpacity: '20' },
  compact: { fontSize: '0.75rem', color: '#999', lineHeight: 1.6, dividerOpacity: '15' },
  tooltip: { fontSize: '0.6875rem', color: '#999', lineHeight: 1.5, dividerOpacity: null },
} as const

export type SkillDescVariant = keyof typeof SKILL_DESC_STYLES
