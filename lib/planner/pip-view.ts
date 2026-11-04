/**
 * The Assist PiP's layout rules, kept apart from the React code so they can change (and be tested) on their own:
 * which view the window shows, how big gift icons get in a given box, how dense the window is, and which marks a gift
 * carries. Components only draw what these return.
 */

/** What the PiP shows; one at a time, picked by PIP_MODES. */
export type PipMode = 'event' | 'skill-exchange' | 'formation' | 'start' | 'pack-choice' | 'fusion' | 'floor'

export interface PipModeContext {
  /** A ? room's choices are being read on the current floor. */
  event: boolean
  /** A pack selection screen is on, for a floor still waiting for its pack. */
  selectingPack: boolean
  /** The shop's skill replacement window is open (and the run has a plan to compare with). */
  skillExchange: boolean
  /** A formation screen is on (and there are Identities to show). */
  formation: boolean
  /** The run start, before the first pack selection screen. */
  start: boolean
  /** The floor shown has its pack. */
  packChosen: boolean
  /** The fusion screen (or its result popups) is on. */
  fusion: boolean
}

/**
 * Highest first; the first rule that holds is the view. A pack selection beats a ? room still on record (the room is
 * over once packs are offered); a window that opens over the shop (skill replacement, formation) beats the floor.
 */
export const PIP_MODES: readonly { mode: PipMode; when: (context: PipModeContext) => boolean }[] = [
  { mode: 'event', when: context => context.event && !context.selectingPack },
  { mode: 'skill-exchange', when: context => context.skillExchange },
  { mode: 'formation', when: context => context.formation },
  { mode: 'start', when: context => context.start },
  { mode: 'pack-choice', when: context => !context.packChosen },
  { mode: 'fusion', when: context => context.fusion },
  { mode: 'floor', when: () => true },
]

export function pickPipMode(context: PipModeContext): PipMode {
  return PIP_MODES.find(rule => rule.when(context))!.mode
}

/**
 * How roomy the window is. compact: narrow or short (one column of sections, smaller icons); wide: room for two
 * columns side by side (at least 560 wide and 1.25 times as wide as tall); regular otherwise.
 */
export type PipDensity = 'compact' | 'regular' | 'wide'
export function pipDensity(width: number, height: number): PipDensity {
  if (width < 360 || height < 340) return 'compact'
  if (width >= 560 && width >= height * 1.25) return 'wide'
  return 'regular'
}

/**
 * The floor and fusion views' arrangement for a density. compact: the gift list matters most in a small window, so the
 * memo keeps two lines and tips draw small; wide: the memo and tips go in a left column beside the gift list (2:3), so
 * nothing above the list pushes it down; regular: one column. `hasSide`: there is a memo or a tip to put aside.
 */
export interface FloorLayout { side: boolean; memoLines: number; compactTips: boolean; cell: { min: number; max: number } }
export function floorLayout(density: PipDensity, hasSide: boolean): FloorLayout {
  if (density === 'compact') return { side: false, memoLines: 2, compactTips: true, cell: { min: 46, max: 60 } }
  if (density === 'wide' && hasSide) return { side: true, memoLines: 8, compactTips: false, cell: { min: 52, max: 72 } }
  return { side: false, memoLines: 3, compactTips: false, cell: { min: 52, max: 72 } }
}

export interface GridFit { columns: number; size: number }

/**
 * Icon size and columns for `count` icons in a box `width` wide. With a `height` the whole set must fit, so the largest
 * size that does wins (more columns on a tie). Without one the list scrolls, so the row fills: as many columns as fit
 * at `min`, then the size grows to fill the width up to `max`. Below `min` it stays at `min` and the box scrolls.
 */
export function fitGrid({ count, width, height, gap = 4, min, max, maxColumns = Infinity }: { count: number; width: number; height?: number;
  gap?: number; min: number; max: number; maxColumns?: number }): GridFit {
  const n = Math.max(1, count)
  const fitting = Math.max(1, Math.min(n, maxColumns, Math.floor((width + gap) / (min + gap))))
  const across = (columns: number) => Math.floor((width - (columns - 1) * gap) / columns)
  if (height === undefined || !Number.isFinite(height)) return { columns: fitting, size: Math.max(min, Math.min(max, across(fitting))) }
  let best: GridFit | null = null
  for (let columns = 1; columns <= Math.min(n, maxColumns); columns++) {
    const rows = Math.ceil(n / columns)
    const size = Math.min(max, across(columns), Math.floor((height - (rows - 1) * gap) / rows))
    if (size < min) continue
    if (!best || size > best.size || (size === best.size && columns > best.columns)) best = { columns, size }
  }
  return best ?? { columns: fitting, size: min }
}

/** A mark on a gift cell. `tone`: plan = gold, warn = red corner mark, info = a word on the art's lower edge (`short` there). */
export interface GiftBadge { key: string; label: string; short?: string; tone: 'plan' | 'warn' | 'info' }

/**
 * The marks a gift carries, in a fixed order (first is the strongest): in the plan, only on this floor, part of the
 * floor's clear bonus. Each entry is (set of gift ids, badge); add a mark by adding a row.
 */
export function giftBadges(id: number, rows: readonly { ids: ReadonlySet<number>; badge: GiftBadge }[]): GiftBadge[] {
  return rows.filter(row => row.ids.has(id)).map(row => row.badge)
}
