'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { EgoData, IdentityData, PlannerAction, PlannerState, SinnerData } from '@/lib/planner/types'
import type { planSlotsFromTeamCode } from '@/lib/planner/team-code-import'
import { planSlotsFromDeckRows } from '@/lib/planner/formation-transfer'
import { withLcbIdentitySlots } from '@/features/planner/lib/lcb'
import { showError, showSuccess } from '@/lib/toast'

type CodeSlots = NonNullable<ReturnType<typeof planSlotsFromTeamCode>>

/**
 * Replacing the formation from a pasted code or from one of my saved decks: both ask first when the plan already has one.
 * Called where the deck tab used to declare these states, so its hook order is the same.
 */
export function useDeckFormationImport({ state, dispatch, sinners, identities, egos }: {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  sinners: SinnerData[]
  identities: IdentityData[]
  egos: EgoData[]
}) {
  const tDeck = useTranslations('planner.deckTab')
  // A pasted formation code waiting for the user to confirm replacing the current formation.
  const [pendingCode, setPendingCode] = useState<CodeSlots | null>(null)
  const applyCodeSlots = (slots: CodeSlots) => {
    dispatch({ type: 'LOAD_PLAN', state: slots })
    showSuccess(tDeck('identity.codeApplied'))
  }
  // the formation code reader (and its gzip library) loads when a code is applied, not with the planner
  const handleApplyCode = async (code: string) => {
    const { planSlotsFromTeamCode } = await import('@/lib/planner/team-code-import')
    const slots = planSlotsFromTeamCode(code, sinners, identities, egos)
    if (!slots) return false
    if (state.identitySlots.length) setPendingCode(slots)
    else applyCodeSlots(slots)
    return true
  }
  // Import from one of my saved decks: asks first when the plan already has a formation.
  const tImport = useTranslations('planner.formationImport')
  const [importOpen, setImportOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ slots: CodeSlots; title: string } | null>(null)
  const handleDeckLoaded = (record: Record<string, unknown>) => {
    const loaded = planSlotsFromDeckRows((record.deck_identities as never[]) ?? [], (record.deck_egos as never[]) ?? [], identities, egos)
    if (!loaded) { showError(tImport('loadFailed')); return }
    const slots = { ...loaded, identitySlots: withLcbIdentitySlots(identities, loaded.identitySlots) }
    setImportOpen(false)
    const title = String(record.title ?? '')
    if (state.identitySlots.some(slot => slot.slot_order < 99)) setPendingImport({ slots, title })
    else { dispatch({ type: 'LOAD_PLAN', state: slots }); showSuccess(tImport('applied')) }
  }
  return { pendingCode, setPendingCode, applyCodeSlots, handleApplyCode, tImport, importOpen, setImportOpen, pendingImport, setPendingImport, handleDeckLoaded }
}
