/** A copy of the gifts planned on the floor before this one; empty when there is none. */
export function previousFloorGifts(floorPlan: { floor: number; gift_ids: string[] }[], floor: number): string[] {
  return [...(floorPlan.find(entry => entry.floor === floor - 1)?.gift_ids ?? [])]
}
