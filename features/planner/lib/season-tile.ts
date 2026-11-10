import type { CSSProperties } from 'react'

/** A phone tile in the season card's colours (lib/generated/season-palette.json, sampled from the card art at build time). */
export function seasonTileStyle({ top, bottom, border }: { top: string; bottom: string; border: string }): CSSProperties {
  return { background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`, borderColor: border }
}
