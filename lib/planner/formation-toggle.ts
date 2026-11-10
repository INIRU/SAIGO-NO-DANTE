import type { IdentitySlot } from '@/lib/planner/types'

/** Moves a slot between the formation (slot_order < 99) and the bench (99). Leaving the formation pulls the later numbers up so none repeat; joining takes the next number. */
export function toggleFormationSlot(slots: IdentitySlot[], sinnerId: string): IdentitySlot[] {
  const slot = slots.find(item => item.sinner_id === sinnerId)
  if (!slot) return slots
  if (slot.slot_order >= 99) {
    const nextOrder = slots.filter(item => item.slot_order < 99).length
    return slots.map(item => item === slot ? { ...item, slot_order: nextOrder } : item)
  }
  const removed = slot.slot_order
  return slots.map(item => {
    if (item === slot) return { ...item, slot_order: 99 }
    if (item.slot_order < 99 && item.slot_order > removed) return { ...item, slot_order: item.slot_order - 1 }
    return item
  })
}
