import { STORAGE_BASE } from '@/lib/constants/game'
import type { SupportedLang } from '@/lib/i18n/types'

export type ThemePackVisualKind = 'normal' | 'extreme'

export interface ThemePackVisualConfig {
  kind: ThemePackVisualKind
  bossSpriteId?: string
  showWarning?: boolean
  showBaton?: boolean
  hideLogo?: boolean
  /** Name overlay box in % of the 416x684 poster, for packs whose printed logo fills the usual title band. */
  title?: ThemePackTitleBox
}

export interface ThemePackTitleBox {
  top?: number
  height?: number
  left?: number
  right?: number
  /** Locales whose name is already printed legibly on the poster, so the overlay would only repeat it. */
  printedIn?: readonly SupportedLang[]
}

// Pack names in the game's selection screen sit at one spot on the card, but each pack's poster art is drawn at its own
// size there (attack-type/sin/keyword posters ~8% smaller), so relative to our 416x684 composite the name moves per pack.
// Measured from KR selection captures (2026-09-21~25 runs, cards at rest): [ink centre y %, ink centre x % or null for the
// family default, poster scale on a 1080p screen]. The name's size follows the poster scale.
export const THEME_PACK_TITLE_MEASURED: Readonly<Record<number, readonly [number, number | null, number]>> = {
  1001: [80.0, null, 0.748],
  1002: [80.6, null, 0.752],
  1003: [80.1, null, 0.758],
  1004: [80.8, null, 0.746],
  1005: [80.8, null, 0.745],
  1006: [80.8, 49.0, 0.755],
  1007: [80.4, null, 0.754],
  1008: [80.0, null, 0.748],
  1009: [80.6, null, 0.752],
  1010: [80.6, null, 0.755],
  1013: [80.7, 49.3, 0.746],
  1014: [80.9, null, 0.744],
  1015: [80.7, 48.6, 0.752],
  1016: [79.8, null, 0.75],
  1017: [81.4, null, 0.744],
  1018: [80.0, 52.3, 0.755],
  1020: [81.0, null, 0.748],
  1021: [80.7, null, 0.749],
  1022: [80.5, 48.6, 0.752],
  1024: [79.8, null, 0.762],
  1025: [80.3, null, 0.758],
  1026: [80.5, null, 0.762],
  1027: [79.6, null, 0.76],
  1101: [80.5, null, 0.757],
  1102: [80.2, null, 0.763],
  1104: [80.6, null, 0.758],
  1105: [80.5, null, 0.756],
  1106: [80.4, null, 0.753],
  1109: [80.6, null, 0.75],
  1111: [80.3, null, 0.756],
  1112: [80.3, null, 0.756],
  1113: [80.4, null, 0.754],
  1114: [80.7, null, 0.758],
  1116: [80.4, null, 0.755],
  1117: [80.4, null, 0.758],
  1118: [80.6, null, 0.756],
  1120: [80.6, null, 0.744],
  1121: [80.5, null, 0.75],
  1123: [80.4, null, 0.757],
  1124: [80.4, null, 0.752],
  1125: [80.5, null, 0.752],
  1126: [80.4, null, 0.752],
  1127: [81.1, null, 0.756],
  1128: [80.5, null, 0.756],
}

/**
 * Story (CANTO) and event packs: the centre of the empty dark band their poster leaves for the name, between the lowest
 * printed art (LIMBUS logo, CANTO watermark, event logo and subtitle, line stripe) and the torn bottom strip, in % of the
 * 416x684 poster. Measured on the composed posters (2026-10-01); it wins over the capture spot, whose size is kept.
 * CANTO packs share one frame (band 82-89%); a new event pack needs its own value here.
 */
export const THEME_PACK_TITLE_BAND: Readonly<Record<number, number>> = {
  1001: 85.5,
  1002: 85.5,
  1003: 85.5,
  1004: 85.5,
  1005: 85.5,
  1006: 85.5,
  1007: 85.5,
  1008: 85.5,
  1009: 85.5,
  1010: 85.5,
  1011: 85.5,
  1012: 85.5,
  1013: 85.5,
  1014: 85.5,
  1015: 85.5,
  1016: 85.5,
  1017: 85.5,
  1018: 85.5,
  1019: 85.5,
  1020: 85.5,
  1021: 85.5,
  1022: 85.5,
  1023: 85.5,
  1024: 85.5,
  1025: 85.5,
  1026: 85.5,
  1027: 85.5,
  1101: 84,
  1102: 85,
  1103: 85,
  1104: 82,
  1105: 83,
  1106: 83,
  1107: 83.5,
  1108: 81,
  1109: 81,
  1110: 80,
  1111: 80.5,
  1112: 80.5,
  1113: 80.5,
  1114: 82.5,
  1115: 84,
  1116: 82,
  1117: 82.5,
  1118: 82,
  1119: 83.5,
  1120: 83,
  1121: 83.5,
  1122: 81,
  1123: 83,
  1124: 83,
  1125: 84.5,
  1126: 83.5,
  1127: 82.5,
  1128: 83.5,
}

// Families for packs without captures. Attack-type/sin/keyword posters (boss badge, 12xx-14xx) all print a dark name
// band at 75.3%-84.4%, darkest in the middle; the name is centred in it rather than on the game capture spot.
const TITLE_FAMILY = {
  normal: { cy: 80.5, cx: 50.8, scale: 0.755 },
  boss: { cy: 79.85, cx: 50, scale: 0.755 },
} as const
const TITLE_REFERENCE_SCALE = TITLE_FAMILY.normal.scale
const TITLE_BOX_HEIGHT = 8.5
// Fit width at the reference scale: the longest names fill ~72% of the poster; the auto-size keeps a margin.
const TITLE_FIT_WIDTH = 79

// Extreme posters print a black panel under the teal stripe for the name: rows 84.6%-91.5%, columns 12.6%-87.7%.
export const THEME_PACK_EXTREME_TITLE_BOX = { top: 84.6, height: 6.9, left: 14, right: 14 } as const
const EXTREME_TITLE_SCALE = 0.95

export interface ThemePackTitleLayout {
  top: number
  height: number
  left: number
  right: number
  /** Font size multiplier against a base/story pack at the reference poster scale. */
  scale: number
  printedIn?: readonly SupportedLang[]
}

export type ThemePackTitleBoxKind = 'normal' | 'boss' | 'extreme'

export function getThemePackTitleBoxKind(config: ThemePackVisualConfig | null): ThemePackTitleBoxKind {
  if (config?.kind === 'extreme') return 'extreme'
  return config?.bossSpriteId ? 'boss' : 'normal'
}

/** Where ThemePackCard draws a pack's name, in % of the poster. */
export function getThemePackTitleLayout(id: number): ThemePackTitleLayout {
  const config = getThemePackVisualConfig(id)
  const kind = getThemePackTitleBoxKind(config)
  if (kind === 'extreme') return { ...THEME_PACK_EXTREME_TITLE_BOX, scale: EXTREME_TITLE_SCALE, ...config?.title }
  const family = TITLE_FAMILY[kind]
  const measured = THEME_PACK_TITLE_MEASURED[id]
  const cy = THEME_PACK_TITLE_BAND[id] ?? measured?.[0] ?? family.cy
  const cx = measured?.[1] ?? family.cx
  const scale = TITLE_REFERENCE_SCALE / (measured?.[2] ?? family.scale)
  const half = (TITLE_FIT_WIDTH * scale) / 2
  const box = {
    top: cy - TITLE_BOX_HEIGHT / 2,
    height: TITLE_BOX_HEIGHT,
    left: Math.max(2, cx - half),
    right: Math.max(2, 100 - cx - half),
    scale,
  }
  return config?.title ? { ...box, scale: 1, ...config.title } : box
}

export const THEME_PACK_VISUALS: Record<number, ThemePackVisualConfig> = {
  1001: { kind: 'normal' },
  1002: { kind: 'normal', showWarning: true },
  1003: { kind: 'normal' },
  1004: { kind: 'normal' },
  1005: { kind: 'normal', showWarning: true },
  1006: { kind: 'normal' },
  1007: { kind: 'normal' },
  1008: { kind: 'normal', showWarning: true },
  1009: { kind: 'normal' },
  1010: { kind: 'normal' },
  1011: { kind: 'normal' },
  1012: { kind: 'normal', showWarning: true },
  1013: { kind: 'normal' },
  1014: { kind: 'normal' },
  1015: { kind: 'normal', showWarning: true },
  1016: { kind: 'normal' },
  1017: { kind: 'normal' },
  1018: { kind: 'normal', showWarning: true },
  1019: { kind: 'normal', showWarning: true },
  1020: { kind: 'normal', showWarning: true },
  1021: { kind: 'normal', showWarning: true },
  1022: { kind: 'normal' },
  1023: { kind: 'normal', showWarning: true },
  1024: { kind: 'normal', showWarning: true },
  1025: { kind: 'normal', showWarning: true },
  1026: { kind: 'normal', showWarning: true },
  1027: { kind: 'normal', showWarning: true },
  1101: { kind: 'normal', hideLogo: true },
  1102: { kind: 'normal', hideLogo: true },
  1103: { kind: 'normal', hideLogo: true },
  1104: { kind: 'normal', hideLogo: true },
  1105: { kind: 'normal', hideLogo: true },
  1106: { kind: 'normal', hideLogo: true },
  1107: { kind: 'normal', hideLogo: true },
  1108: { kind: 'normal', showBaton: true, hideLogo: true },
  1109: { kind: 'normal', showBaton: true, hideLogo: true },
  1110: { kind: 'normal', showBaton: true, hideLogo: true },
  1111: { kind: 'normal', showBaton: true, hideLogo: true },
  1112: { kind: 'normal', showBaton: true, hideLogo: true },
  1113: { kind: 'normal', showBaton: true, hideLogo: true },
  1114: { kind: 'normal', hideLogo: true },
  1115: { kind: 'normal', hideLogo: true },
  1116: { kind: 'normal', hideLogo: true },
  1117: { kind: 'normal', hideLogo: true },
  1118: { kind: 'normal', showBaton: true, hideLogo: true },
  1119: { kind: 'normal', hideLogo: true },
  1120: { kind: 'normal', hideLogo: true },
  1121: { kind: 'normal', hideLogo: true },
  1122: { kind: 'normal', hideLogo: true },
  1123: { kind: 'normal', hideLogo: true },
  1124: { kind: 'normal', hideLogo: true },
  1125: { kind: 'normal', hideLogo: true },
  1126: { kind: 'normal', hideLogo: true },
  1127: { kind: 'normal', hideLogo: true },
  1128: { kind: 'normal', hideLogo: true },
  // The hidden pack prints a dark name band (rows 76.3%-85.9%, darkest 29%-73% across); the name sits in its middle.
  3001: { kind: 'normal', hideLogo: true, title: { top: 76.85, height: 8.5, left: 25, right: 25 } },
  1201: { kind: 'normal', bossSpriteId: 'AttackTypeSlash_hard_boss' },
  1202: { kind: 'normal', bossSpriteId: 'AttackTypeSlash_effective_boss' },
  1203: { kind: 'normal', bossSpriteId: 'AttackTypePierce_hard_boss' },
  1204: { kind: 'normal', bossSpriteId: 'AttackTypePierce_effective_boss' },
  1205: { kind: 'normal', bossSpriteId: 'AttackTypeBlunt_hard_boss' },
  1206: { kind: 'normal', bossSpriteId: 'AttackTypeBlunt_effective_boss' },
  1301: { kind: 'normal', bossSpriteId: 'Crimson_normal_boss' },
  1302: { kind: 'normal', bossSpriteId: 'Crimson_normal_boss', showWarning: true },
  1303: { kind: 'normal', bossSpriteId: 'Crimson_effective_boss' },
  1304: { kind: 'normal', bossSpriteId: 'Scarlet_normal_boss' },
  1305: { kind: 'normal', bossSpriteId: 'Scarlet_hard_boss', showWarning: true },
  1306: { kind: 'normal', bossSpriteId: 'Scarlet_effective_boss' },
  1307: { kind: 'normal', bossSpriteId: 'Amber_normal_boss' },
  1308: { kind: 'normal', bossSpriteId: 'Amber_hard_boss', showWarning: true },
  1309: { kind: 'normal', bossSpriteId: 'Amber_effective_boss' },
  1310: { kind: 'normal', bossSpriteId: 'Shamrock_normal_boss' },
  1311: { kind: 'normal', bossSpriteId: 'Shamrock_hard_boss', showWarning: true },
  1312: { kind: 'normal', bossSpriteId: 'Shamrock_effective_boss' },
  1313: { kind: 'normal', bossSpriteId: 'Azure_normal_boss' },
  1314: { kind: 'normal', bossSpriteId: 'Azure_hard_boss', showWarning: true },
  1315: { kind: 'normal', bossSpriteId: 'Azure_effective_boss' },
  1316: { kind: 'normal', bossSpriteId: 'Indigo_normal_boss' },
  1317: { kind: 'normal', bossSpriteId: 'Indigo_hard_boss', showWarning: true },
  1318: { kind: 'normal', bossSpriteId: 'Indigo_effective_boss' },
  1319: { kind: 'normal', bossSpriteId: 'Violet_normal_boss' },
  1320: { kind: 'normal', bossSpriteId: 'Violet_hard_boss', showWarning: true },
  1321: { kind: 'normal', bossSpriteId: 'Violet_effective_boss' },
  1401: { kind: 'normal', bossSpriteId: 'Burn_normal_boss' },
  1402: { kind: 'normal', bossSpriteId: 'Burn_hard_boss', showWarning: true },
  1403: { kind: 'normal', bossSpriteId: 'Bleed_normal_boss' },
  1404: { kind: 'normal', bossSpriteId: 'Bleed_hard_boss', showWarning: true },
  1405: { kind: 'normal', bossSpriteId: 'Tremor_normal_boss' },
  1406: { kind: 'normal', bossSpriteId: 'Tremor_hard_boss', showWarning: true },
  1407: { kind: 'normal', bossSpriteId: 'Rupture_normal_boss' },
  1408: { kind: 'normal', bossSpriteId: 'Rupture_hard_boss', showWarning: true },
  1409: { kind: 'normal', bossSpriteId: 'Sinking_normal_boss' },
  1410: { kind: 'normal', bossSpriteId: 'Sinking_hard_boss', showWarning: true },
  1411: { kind: 'normal', bossSpriteId: 'Poise_normal_boss' },
  1412: { kind: 'normal', bossSpriteId: 'Poise_hard_boss', showWarning: true },
  1413: { kind: 'normal', bossSpriteId: 'Charge_normal_boss' },
  1414: { kind: 'normal', bossSpriteId: 'Charge_hard_boss', showWarning: true },
  1501: { kind: 'extreme', showBaton: true },
  1502: { kind: 'extreme', showBaton: true },
  1503: { kind: 'extreme', showBaton: true, hideLogo: true },
  1504: { kind: 'extreme', showBaton: true },
  1505: { kind: 'extreme', showBaton: true, hideLogo: true },
  1506: { kind: 'extreme', showBaton: true, hideLogo: true },
  1507: { kind: 'extreme', showBaton: true },
  1508: { kind: 'extreme', showBaton: true },
  1509: { kind: 'extreme', showBaton: true, hideLogo: true },
  1510: { kind: 'extreme', showBaton: true, hideLogo: true },
  1511: { kind: 'extreme', showBaton: true },
  1512: { kind: 'extreme', showBaton: true },
  1513: { kind: 'extreme', showBaton: true, hideLogo: true },
  1514: { kind: 'extreme', showBaton: true },
  1515: { kind: 'extreme', showBaton: true },
  1516: { kind: 'extreme', showBaton: true },
  1517: { kind: 'extreme', showBaton: true },
  1518: { kind: 'extreme', showBaton: true, hideLogo: true },
  1519: { kind: 'extreme', showBaton: true },
  1520: { kind: 'extreme', showBaton: true, hideLogo: true },
}

const THEME_PACK_BASE = `${STORAGE_BASE}/icons/theme-packs`

export function getThemePackVisualConfig(id: number): ThemePackVisualConfig | null {
  return THEME_PACK_VISUALS[id] ?? null
}

export function getThemePackCompositeImageUrl(id: number): string {
  return `${THEME_PACK_BASE}/${id}.webp`
}
