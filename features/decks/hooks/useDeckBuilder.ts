'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { LCB_IDS } from '@/lib/constants/game'
import { deckInitFromTeamCode, formationParamFromSearch } from '@/lib/decks/formation-init'
import {
  MANUAL_ATTACK_MAIN_KEYWORDS, computeAllGiftKeywordCounts, computeDeckKeywordCounts, computeDeckMainKeywordsFromSlots, computeFormationGiftKeywordCounts,
} from '@/lib/decks/keyword-rules'
import type { deckFormationFromPlan } from '@/lib/planner/formation-transfer'
import type { EGO, Identity, Passive, Sinner, Skill } from '@/lib/types'
import type { DeckDraft } from '@/features/notes'
import {
  buildDeckDraftState, buildDeckKeywordSlots, buildIdentityUpties, countCustomSkillsets, defaultEgoSlots, groupPassivesByIdentity, groupSkillsByIdentity,
  pickEgoSlots, pickIdentitySlots, sanitizeDeckMainKeywords, toggleFormationSlot, toggleMainKeywordIn,
  type DeckBuilderEgoSlots, type DeckBuilderSlots, type EditMode, type ForkMode,
} from '../lib/deck-builder-model'

// What the deck builder page reads beside the hooks (not exported by the entry file: that adds to every route's first JS).
export { buildDeckInsightData, buildDeckSaveRows } from '../lib/deck-builder-model'
export type { EditMode, ForkMode } from '../lib/deck-builder-model'

type DecodedDeck = { deckSlots: DeckBuilderSlots; egoSlots: DeckBuilderEgoSlots; formationOrder: string[] }

/**
 * The deck builder's editor state: slots, E.G.O, formation order, title, type, note, keywords, uptie and skill
 * distribution, started from the edit, fork or ?formation= start. Called first, so the address clean-up runs before the
 * page's other hooks; `useDeckBuilderModel` comes after them.
 */
export function useDeckBuilderState({ sinners, identities, egos, editMode, forkMode }: {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
  editMode?: EditMode
  forkMode?: ForkMode
}) {
  const builderT = useTranslations('decks.builder')
  // A new deck can start from a formation code in ?formation= (sent from the random formation page). Edit and fork keep their own start.
  // The builder is client-only (no SSR), so the address is readable on the first render; an unreadable code is ignored.
  const [urlStart] = useState<Partial<EditMode> | undefined>(() => {
    if (editMode || forkMode) return undefined
    const code = formationParamFromSearch(window.location.search)
    return (code ? deckInitFromTeamCode(code, sinners, identities, egos) : null) ?? undefined
  })
  useEffect(() => {
    if (formationParamFromSearch(window.location.search) === null) return
    const url = new URL(window.location.href)
    url.searchParams.delete('formation')
    window.history.replaceState(window.history.state, '', url)
  }, [])
  const initData: Partial<EditMode> | undefined = editMode ?? forkMode ?? urlStart
  const lcbIdentity = (sinnerId: string) => identities.find(identity => identity.sinner_id === sinnerId && identity.game_id === LCB_IDS[sinnerId])
  // 12명 모두 항상 인격을 가진다: 비어 있는 수감자는 LCB 인격으로 채운다 (바꿀 수는 있어도 비울 수는 없다)
  const withLcb = (slots: DeckBuilderSlots): DeckBuilderSlots => Object.fromEntries(sinners.map(sinner => [sinner.id, slots[sinner.id] ?? lcbIdentity(sinner.id)]))

  const [deckSlots, setDeckSlots] = useState<DeckBuilderSlots>(() => withLcb(initData?.identitySlotIds ? pickIdentitySlots(initData.identitySlotIds, identities) : {}))
  // egoSlots: sinnerId → { grade → EGO } (등급별 1개), 기본값 = ZAYIN EGO
  const [egoSlots, setEgoSlots] = useState<DeckBuilderEgoSlots>(() => initData?.egoSlotIds ? pickEgoSlots(initData.egoSlotIds, egos) : defaultEgoSlots(sinners, egos))
  const [formationOrder, setFormationOrder] = useState<string[]>(initData?.formationOrder ?? [])
  const [title, setTitle] = useState(forkMode ? builderT('forkTitle', { title: forkMode.title }) : editMode?.title ?? '')
  const [contentType, setContentType] = useState<string>(initData?.content_type && initData.content_type !== '없음' ? initData.content_type : '')
  const [description, setDescription] = useState(initData?.description ?? '')
  const [selectedMainKeywords, setSelectedMainKeywords] = useState<string[]>(() => sanitizeDeckMainKeywords(initData?.mainKeywords))
  const [mainKeywordsManual, setMainKeywordsManual] = useState(() => Array.isArray(initData?.mainKeywords))
  const [gacksungSlots, setGacksungSlots] = useState<Record<string, boolean>>(initData?.gacksungSlots ?? {})
  const [upties, setUpties] = useState<Record<string, number>>(initData?.upties ?? {})
  const [skillDistribution, setSkillDistribution] = useState<Record<string, [number, number, number]>>(initData?.skillDistribution ?? {})

  return {
    withLcb, deckSlots, setDeckSlots, egoSlots, setEgoSlots, formationOrder, setFormationOrder, title, setTitle, contentType, setContentType,
    description, setDescription, selectedMainKeywords, setSelectedMainKeywords, mainKeywordsManual, setMainKeywordsManual,
    gacksungSlots, setGacksungSlots, upties, setUpties, skillDistribution, setSkillDistribution,
  }
}

/**
 * What the deck builder derives from its editor state (skills and passives at each uptie, keyword and gift counts,
 * the draft) and the ways a whole formation is applied (a draft, a plan, a deck code). Its keyword clean-up runs after
 * the page's own effects, as it did before the hook was split.
 */
export function useDeckBuilderModel({ sinners, identities, egos, skills, passives, state }: {
  sinners: Sinner[]
  identities: Identity[]
  egos: EGO[]
  skills: Skill[]
  passives: Passive[]
  state: ReturnType<typeof useDeckBuilderState>
}) {
  const {
    withLcb, deckSlots, setDeckSlots, egoSlots, setEgoSlots, formationOrder, setFormationOrder, title, setTitle, contentType, setContentType,
    description, setDescription, selectedMainKeywords, setSelectedMainKeywords, mainKeywordsManual, setMainKeywordsManual,
    gacksungSlots, setGacksungSlots, upties, setUpties, skillDistribution, setSkillDistribution,
  } = state

  // Skills/passives follow each slot's uptie (nearest level the data has).
  const identityUpties = useMemo(() => buildIdentityUpties(sinners, deckSlots, upties), [deckSlots, sinners, upties])
  const skillsByIdentityId = useMemo(() => groupSkillsByIdentity(skills, identityUpties), [identityUpties, skills])
  const passivesByIdentityId = useMemo(() => groupPassivesByIdentity(passives, identityUpties), [identityUpties, passives])

  const deckKeywordSlots = useMemo(() => buildDeckKeywordSlots(sinners, deckSlots, formationOrder, skillsByIdentityId), [deckSlots, formationOrder, sinners, skillsByIdentityId])
  const deckKeywordCounts = useMemo(() => computeDeckKeywordCounts(deckKeywordSlots).counts, [deckKeywordSlots])
  const autoMainKeywords = useMemo(() => computeDeckMainKeywordsFromSlots(deckKeywordSlots), [deckKeywordSlots])
  const effectiveMainKeywords = mainKeywordsManual ? selectedMainKeywords : autoMainKeywords
  const formationGiftKeywordCounts = useMemo(() => computeFormationGiftKeywordCounts(deckKeywordSlots), [deckKeywordSlots])
  const allGiftKeywordCounts = useMemo(() => computeAllGiftKeywordCounts(deckKeywordSlots), [deckKeywordSlots])

  useEffect(() => {
    if (!mainKeywordsManual) return
    setSelectedMainKeywords(prev => prev.filter(keyword => (
      MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword) || (deckKeywordCounts[keyword] ?? 0) > 0
    )))
  }, [deckKeywordCounts, mainKeywordsManual])

  const handleMainKeywordToggle = (keyword: string) => {
    const isManualAttackKeyword = MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword)
    if (!isManualAttackKeyword && (deckKeywordCounts[keyword] ?? 0) <= 0) return
    setMainKeywordsManual(true)
    setSelectedMainKeywords(prev => toggleMainKeywordIn(mainKeywordsManual ? prev : autoMainKeywords, keyword))
  }

  const identityCount = Object.values(deckSlots).filter(Boolean).length
  const egoCount = Object.values(egoSlots).reduce((s, g) => s + Object.keys(g).length, 0)
  const skillsetCustomCount = useMemo(() => countCustomSkillsets(skillDistribution, deckSlots), [skillDistribution, deckSlots])

  const handleFormationToggle = (sinnerId: string) => {
    setFormationOrder(prev => toggleFormationSlot(prev, sinnerId))
  }

  // savedAt stays 0 here so the same editor state always serializes the same (the autosave compares it with the opening state)
  const draftState = useMemo<DeckDraft>(() => buildDeckDraftState({
    title, contentType, description, deckSlots, egoSlots, formationOrder, mainKeywords: effectiveMainKeywords, mainKeywordsManual, gacksungSlots, skillDistribution, upties,
  }), [title, contentType, description, deckSlots, egoSlots, formationOrder, effectiveMainKeywords, mainKeywordsManual, gacksungSlots, skillDistribution, upties])

  const applyDraft = (draft: DeckDraft) => {
    try {
      if (draft.title) setTitle(draft.title)
      if (draft.contentType) setContentType(draft.contentType)
      if (draft.description) setDescription(draft.description)
      if (draft.formationOrder) setFormationOrder(draft.formationOrder)
      if (Array.isArray(draft.mainKeywords)) {
        setSelectedMainKeywords(sanitizeDeckMainKeywords(draft.mainKeywords))
        setMainKeywordsManual(draft.mainKeywordsManual !== false)
      } else {
        setMainKeywordsManual(false)
      }
      if (draft.deckSlotIds) setDeckSlots(withLcb(pickIdentitySlots(draft.deckSlotIds, identities)))
      if (draft.egoSlotIds) setEgoSlots(pickEgoSlots(draft.egoSlotIds as Record<string, Record<string, string>>, egos))
      if (draft.gacksungSlots) setGacksungSlots(draft.gacksungSlots)
      setUpties(draft.upties ?? {})
      if (draft.skillDistribution) setSkillDistribution(draft.skillDistribution as typeof skillDistribution)
      return true
    } catch { return false }
  }

  /** A plan's formation replaces the slots, E.G.O, order, uptie and skill distribution. */
  const applyImportedFormation = (formation: ReturnType<typeof deckFormationFromPlan>) => {
    setDeckSlots(withLcb(pickIdentitySlots(formation.deckSlotIds, identities)))
    setEgoSlots(pickEgoSlots(formation.egoSlotIds, egos, { keepEmptySinners: false }))
    setFormationOrder(formation.formationOrder)
    setUpties(formation.upties)
    setSkillDistribution(formation.skillDistribution)
    setGacksungSlots({})
  }

  /** A deck code replaces the slots, E.G.O and order (the uptie starts over). */
  const applyDecodedDeck = (result: DecodedDeck) => {
    setDeckSlots(withLcb(result.deckSlots))
    setUpties({})
    setEgoSlots(result.egoSlots)
    setFormationOrder(result.formationOrder)
  }

  return {
    skillsByIdentityId, passivesByIdentityId, deckKeywordCounts, effectiveMainKeywords, formationGiftKeywordCounts, allGiftKeywordCounts,
    handleMainKeywordToggle, handleFormationToggle, identityCount, egoCount, skillsetCustomCount, draftState,
    applyDraft, applyImportedFormation, applyDecodedDeck,
  }
}
