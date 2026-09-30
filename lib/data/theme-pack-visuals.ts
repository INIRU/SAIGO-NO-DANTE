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

// Name box in % of the 416x684 poster, measured from KR theme-pack selection captures (2026-09-21~25 runs, 40+ packs):
// the game prints every name at one spot under the logo (ink centre 80.6%, ink height ~6%, longest names ~72% wide),
// whatever the art. Only the attack-type/sin/keyword packs (12xx-14xx, boss badge posters) sit lower, at 82.9%.
// The box is centred on the measured ink centre; ThemePackCard centres the glyphs in it.
export const THEME_PACK_TITLE_BOX = {
  normal: { top: 76.35, height: 8.5, left: 10.5, right: 10.5 },
  boss: { top: 78.65, height: 8.5, left: 10.5, right: 10.5 },
  extreme: { top: 81, height: 10, left: 16, right: 16 },
} as const

export type ThemePackTitleBoxKind = keyof typeof THEME_PACK_TITLE_BOX

export function getThemePackTitleBoxKind(config: ThemePackVisualConfig | null): ThemePackTitleBoxKind {
  if (config?.kind === 'extreme') return 'extreme'
  return config?.bossSpriteId ? 'boss' : 'normal'
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
