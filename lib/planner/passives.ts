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
  active_cond: string | null
  description: string | null
  passive_order?: number | null
}

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

export function getPassiveCondition(passive: PlannerPassiveLike, deckSinCounts: Record<string, number>) {
  const sins = normalizePassiveSins(passive.sin_affinity)
  const required = passive.sin_count ?? 0
  const current = sins.length > 0
    ? sins.reduce((sum, sin) => sum + (deckSinCounts[sin] ?? 0), 0)
    : 0
  const met = required === 0 || current >= required
  const primarySin = sins[0] ?? null
  const color = primarySin ? (SIN_COLORS[primarySin as keyof typeof SIN_COLORS] ?? '#888') : '#888'

  return { sins, current, required, met, primarySin, color }
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
