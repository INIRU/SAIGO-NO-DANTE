import { resolvePlannerIdentity } from '@/lib/planner/catalog-references'
import { getIdentitySkillDistribution } from '@/lib/planner/types'
import { updateWeekStart } from '@/lib/discovery/update-window'
import type { MetaIdentity, MetaPeriod, MetaPost } from './types'

// Post helpers shared by the meta feature, lib/db/meta.ts and the community recommenders (features/community/server/rec-data.ts).

/** Final inventory entries look like 'final_9765', 'start_9029', 'observe_9191'; blessings are not gifts. */
export function planGiftIds(inventory: unknown): string[] {
  if (!Array.isArray(inventory)) return []
  return [...new Set(inventory.flatMap(entry => {
    const match = typeof entry === 'string' ? /^(?:final|start|observe)_(\d+)$/.exec(entry) : null
    return match ? [match[1]] : []
  }))]
}

export function planThemeIds(floorPlan: unknown): string[] {
  if (!Array.isArray(floorPlan)) return []
  return [...new Set(floorPlan.flatMap(floor => {
    const id = floor && typeof floor === 'object' ? (floor as { theme_id?: unknown }).theme_id : null
    return (typeof id === 'string' || typeof id === 'number') && String(id) ? [String(id)] : []
  }))]
}

export function objectRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
    : []
}

const WEEK_MS = 7 * 86_400_000

export function metaPeriodStart(period: MetaPeriod, now: number): string | null {
  if (period === 'all') return null
  return new Date(updateWeekStart(new Date(now)).getTime() - (period === 'month' ? 3 * WEEK_MS : 0)).toISOString()
}

/**
 * Persisted planner slots are JSON. Resolve metadata through the current catalog, discard deleted/unknown IDs,
 * and keep at most one identity per sinner, in slot order. Order 99 = not in the battle formation (support).
 */
export function fieldedSlots(post: Pick<MetaPost, 'source' | 'identities'>, identities: MetaIdentity[], identityCatalog: Map<string, MetaIdentity> = new Map(identities.map(identity => [identity.id, identity]))) {
  const slots = objectRows(post.identities).flatMap(slot => {
    const identity = (typeof slot.identity_id === 'string' ? identityCatalog.get(slot.identity_id) : undefined)
      ?? (post.source === 'planner' ? resolvePlannerIdentity(slot, identities) : undefined)
    if (!identity) return []
    const order = typeof slot.slot_order === 'number' && Number.isInteger(slot.slot_order) && slot.slot_order >= 0 && slot.slot_order < 99
      ? slot.slot_order : 99
    return [{ identity, order, skills: getIdentitySkillDistribution(slot as Parameters<typeof getIdentitySkillDistribution>[0]).join('-') }]
  }).sort((a, b) => a.order - b.order || a.identity.id.localeCompare(b.identity.id))
  const seenSinners = new Set<string>()
  return slots.filter(({ identity }) => {
    if (seenSinners.has(identity.sinner_id)) return false
    seenSinners.add(identity.sinner_id)
    return true
  })
}
