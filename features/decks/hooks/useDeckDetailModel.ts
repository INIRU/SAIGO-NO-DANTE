'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { IdentitySlot } from '@/lib/decks/identity-types'
import type { GiftData } from '@/lib/planner/types'
import {
  buildBoardSlots, buildEgoGiftConditionLookup, buildFormationEgos, buildInsightIdentities, buildInsightSlots, buildNoteLookups,
  findCustomSkillSlots, groupEgosBySinner, pickDeployedIdentityIds, resolveDeckKeywords, sortDeckSlots, type EgoSlot, type SinnerEgo,
} from '../lib/deck-detail-model'

// What the deck detail page reads beside the model (not exported by the entry file: that adds to every route's first JS).
export { buildSkillExchangeRow, computeDeckAnalysis, slotUptie } from '../lib/deck-detail-model'

type DeckDetailModelInput = {
  deckIdentities: IdentitySlot[] | undefined
  deckEgos: EgoSlot[] | undefined
  mainKeywords: string[] | null | undefined
  allSinnerEgos: SinnerEgo[] | undefined
  locale: string
  /** The note's gift list by name, to check each gift's activation condition against the formation. */
  egoGiftLookup: Record<string, { name: string; activation_condition?: GiftData['activation_condition'] }>
}

/** Everything the deck detail page derives from the loaded deck: the sorted formation, E.G.O groups, note lookups, gift conditions and the insight panels' data. */
export function useDeckDetailModel({ deckIdentities, deckEgos, mainKeywords, allSinnerEgos, locale, egoGiftLookup }: DeckDetailModelInput) {
  const rootT = useTranslations()
  // 정렬
  const sorted = useMemo(() => {
    if (!deckIdentities) return []
    return sortDeckSlots(deckIdentities)
  }, [deckIdentities])
  const boardSlots = useMemo(() => buildBoardSlots(sorted), [sorted])
  const formationEgos = useMemo(() => buildFormationEgos(deckEgos ?? [], locale), [deckEgos, locale])
  const keywords = useMemo(() => resolveDeckKeywords(mainKeywords, sorted), [mainKeywords, sorted])
  const filledSlots = useMemo(() => sorted.filter(s => s.identities), [sorted])
  const formedSlots = useMemo(() => filledSlots.filter(s => s.slot_order < 99), [filledSlots])
  const customSkillSlots = useMemo(() => findCustomSkillSlots(formedSlots), [formedSlots])
  const egoGrouped = useMemo(() => groupEgosBySinner(deckEgos ?? []), [deckEgos])
  const noteLookups = useMemo(
    () => buildNoteLookups(sorted, allSinnerEgos ?? [], locale, (sinnerId) => rootT(`sinner.${sinnerId}`)),
    [allSinnerEgos, locale, rootT, sorted],
  )
  const egoGiftConditionLookup = useMemo(() => buildEgoGiftConditionLookup(filledSlots, Object.values(egoGiftLookup)), [egoGiftLookup, filledSlots])

  // Planner deck panels: keyword distribution, passives, attack types and sin resources (each slot at its own uptie).
  const insightSlots = useMemo(() => buildInsightSlots(filledSlots), [filledSlots])
  const deployedIdentityIds = useMemo(() => pickDeployedIdentityIds(insightSlots), [insightSlots])
  const insightIdentities = useMemo(() => buildInsightIdentities(insightSlots, locale, sinnerId => rootT(`sinner.${sinnerId}`)), [insightSlots, locale, rootT])

  return { sorted, boardSlots, formationEgos, keywords, filledSlots, formedSlots, customSkillSlots, egoGrouped, noteLookups, egoGiftConditionLookup, insightSlots, deployedIdentityIds, insightIdentities }
}
