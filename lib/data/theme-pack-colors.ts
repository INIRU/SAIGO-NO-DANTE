import type { SupportedLang } from '@/lib/i18n/types'

// Theme pack title colours come from the DB (ego_gift_themes.name_color / name_segments), which the sync fills from the
// game's uiConfigs.textColor and specialName (limbus-asset-extractor/site-sync/scripts/sync/mirror-dungeon-rules.ts).

export interface ThemePackNameSegment {
  text: string
  color?: string
}

export interface ThemePackNameStyle {
  name_color?: string | null
  name_segments?: Partial<Record<SupportedLang, ThemePackNameSegment[]>> | null
}

/** Packs without a textColor (12xx-15xx mostly) use the warm beige of the game's selection screen. */
export const THEME_PACK_DEFAULT_COLOR = '#E5C6A0'

export function getThemePackNameColor(theme: ThemePackNameStyle): string {
  return theme.name_color ?? THEME_PACK_DEFAULT_COLOR
}

export function getThemePackNameSegments(theme: ThemePackNameStyle, lang: SupportedLang): ThemePackNameSegment[] | null {
  return theme.name_segments?.[lang] ?? theme.name_segments?.ko ?? null
}
