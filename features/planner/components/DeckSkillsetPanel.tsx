'use client'

import { useTranslations } from 'next-intl'
import { PlannerSkillBoard, type PlannerIdentityBoardSlot } from '@/features/decks/components/PlannerDeckSelection'
import { SKILL_EXCHANGE_PRESETS } from '@/components/ui/SkillExchangePanel'
import { getHighestDonorIndex } from '@/features/planner/lib/deck-tab-model'
import { getIdentitySkillDistribution, normalizeSkillDistribution } from '@/lib/planner/types'
import type { IdentitySlot, PlannerAction, SinnerData } from '@/lib/planner/types'

/** The skill-exchange tab: the cards with − / + beside each skill and the presets under them, or a hint while no identity is chosen. */
export default function DeckSkillsetPanel({ sinners, slots, identitySlots, dispatch, onSkillChange }: {
  sinners: SinnerData[]
  slots: Record<string, PlannerIdentityBoardSlot>
  identitySlots: IdentitySlot[]
  dispatch: React.Dispatch<PlannerAction>
  onSkillChange: (sinnerId: string, idx: number, delta: number) => void
}) {
  const tDeck = useTranslations('planner.deckTab')
  return (
    <div>
      {/* the counts are edited on the cards: − / + beside each skill and the presets under them (USER 2026-11-13) */}
      {identitySlots.length > 0 && (
        <PlannerSkillBoard
          sinners={sinners}
          slots={slots}
          edits={Object.fromEntries(sinners.flatMap(sinner => {
            const slot = identitySlots.find(s => s.sinner_id === sinner.id)
            if (!slot) return []
            const dist = getIdentitySkillDistribution(slot)
            return [[sinner.id, {
              canDecrease: (idx: number) => dist[idx] > 0,
              canIncrease: (idx: number) => dist[idx] < 6 && getHighestDonorIndex(dist, idx) !== null,
              onAdjust: (idx: number, delta: number) => onSkillChange(sinner.id, idx, delta),
              presets: SKILL_EXCHANGE_PRESETS,
              onPreset: (preset: [number, number, number]) => dispatch({ type: 'SET_SKILL_DISTRIBUTION', sinnerId: sinner.id, distribution: normalizeSkillDistribution(preset) }),
            }]]
          }))}
        />
      )}
      {identitySlots.length === 0 ? (
        <div className="text-center" style={{ padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {tDeck('skillset.selectIdentityFirst')}
        </div>
      ) : (
        null
      )}
    </div>
  )
}
