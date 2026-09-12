type IdentityRef = { id: string; sinner_id: string; game_id?: string | number | null }
type EgoRef = { id: string; sinner_id: string; grade: string; name_kr: string | null }

/** Saved planner JSON survives catalog restoration; only accept unique source matches. */
export function resolvePlannerIdentity<T extends IdentityRef>(slot: { identity_id?: unknown; sinner_id?: unknown; game_id?: unknown }, catalog: T[]): T | undefined {
  const current = catalog.find(row => row.id === slot.identity_id)
  if (current) return current
  if (slot.game_id == null || slot.game_id === '') return undefined
  const matches = catalog.filter(row => row.game_id != null && String(row.game_id) === String(slot.game_id) && row.sinner_id === slot.sinner_id)
  return matches.length === 1 ? matches[0] : undefined
}
export function resolvePlannerEgo<T extends EgoRef>(slot: { ego_id?: unknown; sinner_id?: unknown; grade?: unknown; name_kr?: unknown }, catalog: T[]): T | undefined {
  const current = catalog.find(row => row.id === slot.ego_id)
  if (current) return current
  const matches = catalog.filter(row => row.sinner_id === slot.sinner_id && row.grade === slot.grade && row.name_kr === slot.name_kr)
  return matches.length === 1 ? matches[0] : undefined
}
