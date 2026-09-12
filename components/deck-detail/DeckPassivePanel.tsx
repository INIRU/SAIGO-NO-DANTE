'use client'

import { useTranslations } from 'next-intl'
import PlannerPassivePanel from '@/components/passive/PassivePanel'
import type { PlannerPassiveIdentitySlot, PlannerPassiveLike, PlannerPassiveSinnerLike } from '@/lib/planner/passives'
import type { IdentitySlot, PassiveDetail } from '@/components/deck-detail/DeckIdentityCard'

function dedupePassives(identityId: string, passives: PassiveDetail[]): PlannerPassiveLike[] {
  const bestByKey = new Map<string, PassiveDetail>()

  for (const passive of passives) {
    const key = `${identityId}:${passive.passive_type}:${passive.passive_order}`
    const existing = bestByKey.get(key)
    if (!existing || (passive.uptie_level ?? 3) > (existing.uptie_level ?? 3)) {
      bestByKey.set(key, passive)
    }
  }

  return [...bestByKey.values()]
    .sort((a, b) => a.passive_order - b.passive_order)
    .map(passive => ({
      identity_id: identityId,
      name: passive.name,
      passive_type: passive.passive_type,
      sin_affinity: passive.sin_affinity,
      sin_count: passive.sin_count,
      active_cond: passive.active_cond,
      description: passive.description,
      passive_order: passive.passive_order,
    }))
}

export default function DeckPassivePanel({
  slots,
  deckSinCounts,
}: {
  slots: IdentitySlot[]
  deckSinCounts: Record<string, number>
}) {
  const sinnerT = useTranslations('sinner')
  const identitySlots: PlannerPassiveIdentitySlot[] = []
  const passives: PlannerPassiveLike[] = []
  const sinnerMap = new Map<string, PlannerPassiveSinnerLike>()

  for (const slot of slots) {
    const identity = slot.identities
    if (!identity) continue

    identitySlots.push({
      identity_id: identity.id,
      sinner_id: identity.sinner_id,
      name_kr: identity.name_kr,
    })
    sinnerMap.set(identity.sinner_id, {
      id: identity.sinner_id,
      name_kr: sinnerT(identity.sinner_id as Parameters<typeof sinnerT>[0]),
    })
    passives.push(...dedupePassives(identity.id, identity.passives ?? []))
  }

  return (
    <PlannerPassivePanel
      identitySlots={identitySlots}
      passives={passives}
      sinners={[...sinnerMap.values()]}
      deckSinCounts={deckSinCounts}
    />
  )
}
