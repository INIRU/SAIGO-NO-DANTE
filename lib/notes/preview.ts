type Box = { left: number; top: number; right: number; bottom: number }

/** A preview card opens this long after a mouse arrives, so passing over a name on the way somewhere does not flash it. */
export const PREVIEW_DELAY_MS = 150

/** Only a mouse or a pen hovers; a touch (which also fires pointer events) never opens the card by itself. */
export const usesHover = (pointerType: string) => pointerType === 'mouse' || pointerType === 'pen'

/** Where the card goes: under the name from its left edge, above it when the screen has no room below, kept inside the screen. */
export function previewPlacement(anchor: Box, card: { width: number; height: number }, view: { width: number; height: number }, gap = 8) {
  const left = Math.max(gap, Math.min(anchor.left, view.width - gap - card.width))
  const above = anchor.bottom + gap + card.height + gap > view.height && anchor.top - gap - card.height >= 0
  return { left, top: above ? anchor.top - gap : anchor.bottom + gap, above }
}
