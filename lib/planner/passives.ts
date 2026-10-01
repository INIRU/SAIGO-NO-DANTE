import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import type { SinType } from '@/lib/types'

export interface PlannerPassiveIdentitySlot {
  identity_id?: string
  sinner_id?: string
  name_kr?: string
}

export interface PlannerPassiveLike {
  identity_id: string
  name: string
  passive_type: string
  sin_affinity: string | null
  sin_count: number | null
  /** Every sin of the activation condition with its own count (sin_affinity/sin_count hold only the first). */
  sin_requirements?: readonly PassiveSinRequirement[] | null
  active_cond: string | null
  description: string | null
  passive_order?: number | null
}

export type PassiveSinRequirement = { sin: string; count: number }
export type PassiveRequirement = { sin: SinType; count: number }

export interface PlannerPassiveSinnerLike {
  id: string
  name_kr: string
}

function normalizePassiveSins(sinAffinity: string | null): SinType[] {
  if (!sinAffinity) return []
  return sinAffinity
    .split(',')
    .map(sin => sin.trim())
    .map(sin => SIN_KR_TO_EN[sin] ?? sin)
    .filter((sin): sin is SinType => sin in SIN_COLORS)
}

/**
 * Every sin a passive needs with its own count, in game order: sin_requirements when the row has them, else the one
 * sin_count for each sin of sin_affinity (rows stored before the column existed).
 */
export function passiveRequirements(passive: Pick<PlannerPassiveLike, 'sin_affinity' | 'sin_count' | 'sin_requirements'>): PassiveRequirement[] {
  const stored = (passive.sin_requirements ?? [])
    .map(req => ({ sin: (SIN_KR_TO_EN[req.sin] ?? req.sin) as SinType, count: req.count }))
    .filter(req => req.sin in SIN_COLORS && req.count > 0)
  if (stored.length > 0) return stored
  const count = passive.sin_count ?? 0
  return count > 0 ? normalizePassiveSins(passive.sin_affinity).map(sin => ({ sin, count })) : []
}

/**
 * Whether the deck meets a passive's condition: each sin needs its own count. `current`/`required` are the totals over
 * the sins (the short "3/5" of the deck panels), `requirements` the per-sin state.
 */
export function getPassiveCondition(passive: PlannerPassiveLike, deckSinCounts: Record<string, number>) {
  const requirements = passiveRequirements(passive).map(req => {
    const current = deckSinCounts[req.sin] ?? 0
    return { ...req, current, met: current >= req.count }
  })
  const sins = requirements.map(req => req.sin)
  const required = requirements.reduce((sum, req) => sum + req.count, 0)
  const current = requirements.reduce((sum, req) => sum + Math.min(req.current, req.count), 0)
  const met = requirements.every(req => req.met)
  const primarySin = sins[0] ?? null
  const color = primarySin ? (SIN_COLORS[primarySin as keyof typeof SIN_COLORS] ?? '#888') : '#888'

  return { sins, requirements, current, required, met, primarySin, color }
}

export function buildPassivePanelModel(
  identitySlots: PlannerPassiveIdentitySlot[],
  passives: PlannerPassiveLike[],
  sinners: PlannerPassiveSinnerLike[],
  deckSinCounts: Record<string, number>,
) {
  const slotIds = new Set(identitySlots.map(slot => slot.identity_id).filter(Boolean))
  const sinnerNames = new Map(sinners.map(sinner => [sinner.id, sinner.name_kr]))
  const counts = { battle: 0, support: 0 }
  const byIdentity = new Map<string, { passive: PlannerPassiveLike; condition: ReturnType<typeof getPassiveCondition> }[]>()
  for (const passive of passives) {
    if (!slotIds.has(passive.identity_id)) continue
    if (passive.passive_type !== 'battle' && passive.passive_type !== 'support') continue
    counts[passive.passive_type]++
    let rows = byIdentity.get(passive.identity_id)
    if (!rows) {
      rows = []
      byIdentity.set(passive.identity_id, rows)
    }
    rows.push({ passive, condition: getPassiveCondition(passive, deckSinCounts) })
  }
  for (const rows of byIdentity.values()) {
    rows.sort((a, b) => Number(b.condition.met) - Number(a.condition.met))
  }
  return {
    counts,
    slots: identitySlots.map(slot => {
      const rows = byIdentity.get(slot.identity_id ?? '') ?? []
      return {
        slot,
        sinnerName: sinnerNames.get(slot.sinner_id ?? '') ?? slot.sinner_id ?? '',
        battle: rows.filter(row => row.passive.passive_type === 'battle'),
        support: rows.filter(row => row.passive.passive_type === 'support'),
      }
    }),
  }
}
