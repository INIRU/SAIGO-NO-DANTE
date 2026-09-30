import type { SupportedLang } from '@/lib/i18n/types'

// Theme pack name text colors: game theme data uiConfigs.textColor (mirrordungeon-theme-floor-*.txt)
// 10xx: grouped by dungeon chapter, 11xx: unique per story, 12xx+: default beige

export interface ThemePackNameSegment {
  text: string
  color?: string
}

export const THEME_PACK_NAME_COLORS: Record<number, string> = {
  // 10xx — Mirror Dungeon base packs
  1001: '#AF241C', 1002: '#AF241C',
  1003: '#5CE6FF', 1004: '#5CE6FF', 1005: '#5CE6FF',
  1006: '#F37A22', 1007: '#F37A22', 1008: '#F37A22',
  1009: '#D8E9F4', 1010: '#D8E9F4', 1011: '#D8E9F4', 1012: '#D8E9F4',
  1013: '#27C0C4', 1014: '#27C0C4', 1015: '#27C0C4',
  1016: '#7E57A8', 1017: '#7E57A8', 1018: '#7E57A8', 1019: '#7E57A8', 1020: '#7E57A8',
  1021: '#FFEF23',
  1022: '#5BFFDE', 1023: '#5BFFDE',
  1024: '#B60000', 1025: '#B60000', 1026: '#B60000', 1027: '#B60000',

  // 11xx — Story/Event dungeon packs
  1101: '#C72E1F',
  1102: '#CAF027',
  1103: '#B60000',
  1104: '#5CE6FF',
  1105: '#E7B03B',
  1106: '#2C9AF7',
  1107: '#9378D9',
  1108: '#002FF8',
  1109: '#4DEA00',
  1110: '#FF6600',
  1111: '#00A2E1', 1112: '#00A2E1',
  1113: '#B60000',
  1114: '#EFC281',
  1115: '#990000',
  1116: '#5CE6FF',
  1117: '#625AFF',
  1118: '#7F2AB0',
  1119: '#EE4893',
  1120: '#E7B03B',
  1121: '#C92F32',
  1122: '#B1BEFF',
  1123: '#2C9AF7',
  1124: '#EB9010',
  1125: '#990000',
  1126: '#BEBAF7',
  1127: '#625AFF',
  1128: '#DADCE0',

  // 15xx exception
  1503: '#FF6600',
}

// 12xx-15xx default color (warm beige)
export const THEME_PACK_DEFAULT_COLOR = '#E5C6A0'

export function getThemePackNameColor(id: number): string {
  return THEME_PACK_NAME_COLORS[id] ?? THEME_PACK_DEFAULT_COLOR
}

// Extract source: KR/EN/JP_MirrorDungeonTheme-1 specialName.
export const THEME_PACK_SPECIAL_NAME_SEGMENTS: Partial<Record<number, Record<SupportedLang, ThemePackNameSegment[]>>> = {
  1119: {
    ko: [
      { text: '증오와', color: '#ee4893' },
      { text: ' ' },
      { text: '절망', color: '#0060c5' },
    ],
    en: [
      { text: 'Hatred', color: '#ee4893' },
      { text: ' and ' },
      { text: 'Despair', color: '#0060c5' },
    ],
    ja: [
      { text: '憎悪と', color: '#ee4893' },
      { text: '絶望', color: '#0060c5' },
    ],
  },
  1126: {
    ko: [
      { text: '타래', color: '#d9dcff' },
      { text: ' ' },
      { text: '엮기', color: '#c65348' },
    ],
    en: [
      { text: 'Twining', color: '#d9dcff' },
      { text: ' ' },
      { text: 'Threads', color: '#c65348' },
    ],
    ja: [
      { text: '縒り', color: '#d9dcff' },
      { text: '合せ', color: '#c65348' },
    ],
  },
}

export function getThemePackNameSegments(id: number, lang: SupportedLang): ThemePackNameSegment[] | null {
  return THEME_PACK_SPECIAL_NAME_SEGMENTS[id]?.[lang] ?? THEME_PACK_SPECIAL_NAME_SEGMENTS[id]?.ko ?? null
}
