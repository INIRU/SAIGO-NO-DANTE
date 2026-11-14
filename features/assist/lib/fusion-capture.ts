/**
 * The fusion reading's pure decisions (features/assist/hooks/useAssistCapture.ts): which gifts a slot read is measured against,
 * which materials of a seen dialog a popup may lean on, and the shop capacity (3 or 5 slots) a result is read with.
 * No React and no refs: the hook passes in what it reads from its refs at the moment of the call.
 */
import { AUTO_ACQUIRE_EXCLUDED_GIFT_IDS } from '@/features/assist/lib/popup-evidence'
import { fusionMaterials, type FusionRead } from '@/features/assist/lib/fusion-evidence'
import { CAPACITY_KEEP_MS } from '@/features/assist/lib/capture-helpers'

/** Gifts a fusion can use: held ones by catalog id (enhancement suffixes dropped) and the vestiges, never auto-recorded. */
export function fusionCandidateIds(held: readonly string[]): string[] {
  return [...new Set([...held.map(key => String(parseInt(key, 10))).filter(id => id !== 'NaN'), ...AUTO_ACQUIRE_EXCLUDED_GIFT_IDS])]
}

/** What the dialog on screen (or last) has read: its slot reads and the capture times it was first and last seen. */
export interface DialogReads { firstAt: number; lastSeenAt: number; reads: FusionRead[]; count: number; capacity: number }

/** The dialog a popup captured at `capturedAt` follows: opened before it and seen within 4 s of it. */
const followedBy = (dialog: DialogReads, capturedAt: number) => dialog.firstAt <= capturedAt && capturedAt - dialog.lastSeenAt <= 4000

/** Materials read so far on the confirmation dialog a popup follows, for telling look-alike recipe results apart. */
export function popupDialogMaterials(dialog: DialogReads | null, capturedAt: number): string[] {
  return dialog && followedBy(dialog, capturedAt) ? fusionMaterials(dialog.reads, dialog.count, dialog.capacity) : []
}

/** How many materials the dialog a popup follows is about to consume (undefined when it follows none). */
export function popupDialogCount(dialog: DialogReads | null, capturedAt: number): number | undefined {
  return dialog && followedBy(dialog, capturedAt) ? dialog.count : undefined
}

/** A wheel state's reads by layout (3 or 5 slots). */
type WheelReads = Partial<Record<number, FusionRead>>

/**
 * The shop capacity of a result without a seen dialog before any dialog this session: the layout whose reads name more
 * materials (the 3- and 5-slot positions nearly coincide, so both name the same icons when both find them). Decided as soon
 * as the states read so far name two materials, or with whatever was read (`force`); null while undecided.
 */
export function wheelCapacityChoice(wheel: readonly { reads: WheelReads }[], force: boolean): 3 | 5 | null {
  const named = (size: number) => fusionMaterials(wheel.flatMap(item => item.reads[size] ? [item.reads[size]!] : []), size, size).length
  const three = named(3), five = named(5)
  if (!force && Math.max(three, five) < 2) return null
  return five > three ? 5 : 3
}

/** The shop capacity of this session's latest dialog while it is recent, else null (unknown). */
export function knownCapacity(last: { capacity: number; at: number } | null, now: number): number | null {
  return last && now - last.at < CAPACITY_KEEP_MS ? last.capacity : null
}
