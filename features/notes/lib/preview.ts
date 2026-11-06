import { placePopover } from '@/lib/utils/popover'

type Box = { left: number; top: number; right: number; bottom: number }

/** A preview card opens this long after a mouse arrives, so passing over a name on the way somewhere does not flash it. */
export const PREVIEW_DELAY_MS = 150

/** Only a mouse or a pen hovers; a touch (which also fires pointer events) never opens the card by itself. */
export const usesHover = (pointerType: string) => pointerType === 'mouse' || pointerType === 'pen'

/** The preview card's widths in rem, narrowest first. */
export const PREVIEW_WIDTHS_REM = [21, 28, 36]

/** Where the card goes: under the name from its left edge, on the roomier side when it does not fit below, wider before it grows tall. */
export const previewPlacement = (anchor: Box, measureHeight: (width: number) => number, view: { width: number; height: number }, rem = 16) =>
  placePopover({ anchor, view, widths: PREVIEW_WIDTHS_REM.map(width => width * rem), measureHeight })
