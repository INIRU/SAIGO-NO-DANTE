import { SIN_ORDER } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'

/** The seven sins a note's text can be coloured with; the colour is the game's own sin colour (`--wrath` … `--envy`). */
export const NOTE_COLOR_SINS: readonly SinType[] = SIN_ORDER
export const isNoteColorSin = (value: unknown): value is SinType => NOTE_COLOR_SINS.includes(value as SinType)

/**
 * How much of the sin colour (the rest is `--text-primary`) a coloured word keeps, and the highlight's share of
 * `--gold-light`. The tests prove these keep 4.5:1 on every dark panel token; app/globals.css uses the same numbers.
 */
export const NOTE_SIN_MIX = 70
export const NOTE_SIN_MIX_ON_HIGHLIGHT = 35
export const NOTE_HIGHLIGHT_PERCENT = 20
