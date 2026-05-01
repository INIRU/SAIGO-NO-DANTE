'use client'

import { useLocale, useTranslations } from 'next-intl'
import PlannerPassivePanel, {
  type PlannerPassiveIdentitySlot,
  type PlannerPassiveLike,
  type PlannerPassiveSinnerLike,
} from '@/components/planner/PlannerPassivePanel'
import {
  localizeIdentityName,
  localizePassiveDescription,
  localizePassiveName,
} from '@/components/deck-detail/DeckIdentityCard'
import type { Passive, Identity, Sinner } from '@/lib/types'

interface PassivePanelProps {
  deckSlots: Record<string, Identity | undefined>
  sinners: Sinner[]
  passivesByIdentityId: Record<string, Passive[]>
  deckSinCounts: Record<string, number>
}

function toPlannerPassive(passive: Passive, locale: string): PlannerPassiveLike {
  return {
    identity_id: passive.identity_id,
    name: localizePassiveName(passive, locale),
    passive_type: passive.passive_type,
    sin_affinity: passive.sin_affinity,
    sin_count: passive.sin_count,
    active_cond: passive.active_cond,
    description: localizePassiveDescription(passive, locale),
    passive_order: passive.passive_order,
  }
}

export default function PassivePanel({
  deckSlots,
  sinners,
  passivesByIdentityId,
  deckSinCounts,
}: PassivePanelProps) {
  const locale = useLocale()
  const sinnerT = useTranslations('sinner')
  const identitySlots: PlannerPassiveIdentitySlot[] = []
  const passives: PlannerPassiveLike[] = []
  const plannerSinners: PlannerPassiveSinnerLike[] = []

  for (const sinner of sinners) {
    const identity = deckSlots[sinner.id]
    if (!identity) continue

    identitySlots.push({
      identity_id: identity.id,
      sinner_id: identity.sinner_id,
      name_kr: localizeIdentityName(identity, locale),
    })
    plannerSinners.push({
      id: sinner.id,
      name_kr: sinnerT(sinner.id as Parameters<typeof sinnerT>[0]),
    })
    passives.push(...(passivesByIdentityId[identity.id] ?? []).map(passive => toPlannerPassive(passive, locale)))
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <PlannerPassivePanel
        identitySlots={identitySlots}
        passives={passives}
        sinners={plannerSinners}
        deckSinCounts={deckSinCounts}
      />
    </div>
  )
}
