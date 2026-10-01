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
  1304: [83.1, 53.6, 0.693],
  1307: [82.7, 54.3, 0.7],
  1309: [82.5, 54.0, 0.7],
  1310: [83.0, 54.7, 0.698],
  1317: [82.9, 53.3, 0.696],
  1405: [82.7, 54.0, 0.701],
  1406: [83.1, 54.2, 0.69],
}

// Families for packs without captures: base/story packs, and attack-type/sin/keyword packs (boss badge posters).
const TITLE_FAMILY = {
  normal: { cy: 80.5, cx: 50.8, scale: 0.755 },
  boss: { cy: 82.9, cx: 54.0, scale: 0.698 },
} as const
const TITLE_REFERENCE_SCALE = TITLE_FAMILY.normal.scale
const TITLE_BOX_HEIGHT = 8.5
// Fit width at the reference scale: the longest names fill ~72% of the poster; the auto-size keeps a margin.
const TITLE_FIT_WIDTH = 79

// Extreme posters print a dark panel under the bottom stripe for the name (no capture of extreme packs yet).
export const THEME_PACK_EXTREME_TITLE_BOX = { top: 81, height: 10, left: 16, right: 16 } as const

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
  if (kind === 'extreme') return { ...THEME_PACK_EXTREME_TITLE_BOX, scale: 1, ...config?.title }
  const family = TITLE_FAMILY[kind]
  const measured = THEME_PACK_TITLE_MEASURED[id]
  const cy = measured?.[0] ?? family.cy
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
