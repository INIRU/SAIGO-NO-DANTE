/**
 * Reading a ? room's choice list (features/assist/hooks/useAssistCapture.ts): which OCR boxes are the game's buttons, how many
 * options an event has that can be read, and the screen region the cursor is looked for in. Pure: the hook passes in its
 * catalog, boxes and bands.
 */
import { gameTextPieces } from '@/features/assist/lib/text-normalize'
import { distinctBoxes, type ChoiceBand } from '@/features/assist/lib/event-pick'
import type { ChoiceBox } from '@/features/assist/lib/ocr-match'

/**
 * The game's list is right of the middle (its name lines start at 0.57 of the width): lines elsewhere are not its buttons
 * (a whole-screen share also holds the terminal and its PiP). `width` is the width the boxes were measured on.
 */
export function choiceListBoxes(boxes: readonly ChoiceBox[], width: number): ChoiceBox[] {
  return distinctBoxes(boxes.filter(box => box.left >= 0.45 * width && box.left <= 0.75 * width))
}

/** How many options of the event that choice belongs to can be read (a name of 4 or more glyphs): one of several alone is the one taken. */
export function readableOptionCount(choices: readonly { id: string; eventId: string; texts: string[] }[], choiceId: string | undefined): number {
  const first = choiceId === undefined ? undefined : choices.find(item => item.id === choiceId)
  return first ? new Set(choices.filter(item => item.eventId === first.eventId)
    .map(item => gameTextPieces(item.texts[0] ?? '').join('')).filter(text => [...text].length >= 4)).size : 0
}

/** The buttons and a margin around them (the cursor's hot spot is its tip; the nib hangs below and right). */
export function cursorRegion(bands: readonly ChoiceBand[], frameWidth: number, frameHeight: number) {
  const margin = 60 * Math.min(frameWidth / 1920, frameHeight / 1080)
  const left = Math.min(...bands.map(band => band.left)) - margin, top = Math.min(...bands.map(band => band.top)) - margin
  return { x: left, y: top, width: Math.max(...bands.map(band => band.right)) + margin - left, height: Math.max(...bands.map(band => band.bottom)) + margin - top }
}
