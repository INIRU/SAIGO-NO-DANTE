'use client'

import { useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import {
  getIdentitySkillDistribution,
  type PlannerState,
  type PlannerAction,
  type IdentityData,
  type SinnerData,
  type ThemeData,
  type GiftData,
  type PassiveData,
  type SkillSummary,
  type EgoData,
} from '@/lib/planner/types'
import { rowsAtUptie, computeSinProduction } from '@/features/decks'
import { getIdentityImageUrl } from '@/lib/utils/images'
import DeckInsights, { type DeckInsightIdentity } from '@/features/decks/components/DeckInsights'
import DeckResourceSummary from '@/features/decks/components/DeckResourceSummary'
import { localizeIdentityName, localizePassiveDescription, localizePassiveName } from '@/lib/decks/localize'
import { useLocale, useTranslations } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { showSuccess } from '@/lib/toast'
import { useDeckFormationImport } from '@/features/planner/hooks/useDeckFormationImport'
import { toggleFormationSlot } from '@/features/planner/lib/formation-toggle'
import FormationSourceModal from './FormationSourceModal'
import DeckMainKeywords from './DeckMainKeywords'
import DeckSkillsetPanel from './DeckSkillsetPanel'
import DeckSubTabs, { type DeckSubTab } from './DeckSubTabs'
import { buildStripSkills, toEgoSlotItems } from '@/features/decks'
import {
  deckAnalysisFor,
  deckKeywordSlotsFor,
  defaultEgoForSinner,
  egosByGradeFor,
  groupEgosBySinner,
  groupIdentitiesBySinner,
  groupSkillsByIdentity,
  pickedIdentitySlot,
  pruneManualMainKeywords,
  rosterFromKey,
  rosterKeyOf,
  sameKeywordList,
  skillDistributionAfter,
  toggledMainKeywords,
  type RosterSlot,
} from '@/features/planner/lib/deck-tab-model'
import {
  PLANNER_EGO_GRADE_ORDER,
  PlannerEgoBoard,
  PlannerEgoSelectModal,
  PlannerIdentityBoard,
  PlannerIdentitySelectModal,
  type PlannerDeckEgo,
  type PlannerEgoBoardSlot,
  type PlannerIdentityBoardSlot,
} from '@/features/decks/components/PlannerDeckSelection'
import { LCB_IDS, isDeployedSlot } from '@/lib/constants/game'
import { useSuggestionState } from '@/hooks/useSuggestions'
import { identitySuggestUrl, plannerSuggestionContext, type SuggestionResponse } from '@/lib/community/suggestion-types'
import {
  computeDeckMainKeywordsFromSlots,
  computeDeckKeywordCounts,
  type DeckKeywordSlot,
} from '@/lib/decks/keyword-rules'

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  identities: IdentityData[]
  sinners: SinnerData[]
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  passives: PassiveData[]
  skills: SkillSummary[]
  egos: EgoData[]
}

export default function DeckTab({ state, dispatch, identities, sinners, passives: allPassives, skills: allSkills, egos }: Props) {
  // Formation toggles only change slot_order. Roster-derived data (skills, passives, keyword chart,
  // passive panel) keys on this content key so it survives formation clicks untouched.
  const rosterKey = useMemo(() => rosterKeyOf(state.identitySlots, sinners), [sinners, state.identitySlots])
  const roster = useMemo<RosterSlot[]>(() => rosterFromKey(rosterKey), [rosterKey])
  const rosterBySinner = useMemo(() => new Map(roster.map(slot => [slot.sinner_id, slot])), [roster])
  // Skills/passives follow each slot's uptie (nearest level the data has).
  const slotUpties = useMemo(() => new Map(roster.map(slot => [slot.identity_id, slot.uptie])), [roster])
  const skills = useMemo(() => rowsAtUptie(allSkills, slotUpties), [allSkills, slotUpties])
  const passives = useMemo(() => rowsAtUptie(allPassives, slotUpties), [allPassives, slotUpties])
  const tDeck = useTranslations('planner.deckTab')
  const {
    pendingCode, setPendingCode, applyCodeSlots, handleApplyCode, tImport,
    importOpen, setImportOpen, pendingImport, setPendingImport, handleDeckLoaded,
  } = useDeckFormationImport({ state, dispatch, sinners, identities, egos })
  const tSinner = useTranslations('sinner')
  const locale = useLocale() as SupportedLang
  const [subTab, setSubTab] = useState<DeckSubTab>('identity')

  // Modal state
  const [identityModalSinner, setIdentityModalSinner] = useState<string | null>(null)
  const [egoModalSinner, setEgoModalSinner] = useState<string | null>(null)

  // 수감자별 인격 그룹 (rarity 내림차순 정렬)
  const sinnerIdentities = useMemo(() => groupIdentitiesBySinner(identities), [identities])

  // 현재 수감자에 선택된 인격 찾기
  const getSelectedIdentity = useCallback(
    (sinnerId: string) => state.identitySlots.find(s => s.sinner_id === sinnerId),
    [state.identitySlots],
  )

  // identities map by id for quick lookup
  const identityById = useMemo(() => {
    const map = new Map<string, IdentityData>()
    for (const ident of identities) map.set(ident.id, ident)
    return map
  }, [identities])

  // 선택된 인격들의 스킬 키워드 분포
  const skillsByIdentity = useMemo(() => groupSkillsByIdentity(skills), [skills])

  const deckKeywordSlots = useMemo<DeckKeywordSlot[]>(
    () => deckKeywordSlotsFor(state.identitySlots, identityById, skillsByIdentity),
    [identityById, skillsByIdentity, state.identitySlots],
  )

  const mainKeywordCounts = useMemo(() => computeDeckKeywordCounts(deckKeywordSlots).counts, [deckKeywordSlots])
  const autoMainKeywords = useMemo(() => computeDeckMainKeywordsFromSlots(deckKeywordSlots), [deckKeywordSlots])
  const selectedMainKeywords = state.mainKeywords ?? []
  const mainKeywordsManual = state.mainKeywordsManual ?? false
  const effectiveMainKeywords = mainKeywordsManual ? selectedMainKeywords : autoMainKeywords

  useEffect(() => {
    if (mainKeywordsManual) return
    const same = sameKeywordList(selectedMainKeywords, autoMainKeywords)
    if (!same) {
      dispatch({ type: 'SET_MAIN_KEYWORDS', keywords: autoMainKeywords, manual: false })
    }
  }, [autoMainKeywords, dispatch, mainKeywordsManual, selectedMainKeywords])

  useEffect(() => {
    if (!mainKeywordsManual) return
    const next = pruneManualMainKeywords(selectedMainKeywords, mainKeywordCounts)
    if (next.length !== selectedMainKeywords.length) {
      dispatch({ type: 'SET_MAIN_KEYWORDS', keywords: next, manual: true })
    }
  }, [dispatch, mainKeywordCounts, mainKeywordsManual, selectedMainKeywords])

  const egoById = useMemo(() => {
    const map = new Map<string, EgoData>()
    for (const ego of egos) map.set(ego.id, ego)
    return map
  }, [egos])

  const getLocalizedSinnerName = useCallback(
    (sinner: SinnerData | null | undefined) => sinner ? tSinner(sinner.id as Parameters<typeof tSinner>[0]) : '',
    [tSinner],
  )

  const getIdentitySlotName = useCallback(
    (slot: Pick<RosterSlot, 'identity_id' | 'name_kr'>) => {
      const identity = identityById.get(slot.identity_id)
      return identity ? localizeIdentityName(identity, locale) : slot.name_kr
    },
    [identityById, locale],
  )

  // EGO grouped by sinner (grade order within each group)
  const sinnerEgosMap = useMemo(() => groupEgosBySinner(egos, PLANNER_EGO_GRADE_ORDER), [egos])

  const egoBoardSlots = useMemo<Record<string, PlannerEgoBoardSlot>>(() => {
    const slots: Record<string, PlannerEgoBoardSlot> = {}
    for (const sinner of sinners) {
      const selectedIdentity = getSelectedIdentity(sinner.id)
      const egosByGrade = egosByGradeFor(state.egoSlots, sinner.id, egoById)
      slots[sinner.id] = {
        sinnerId: sinner.id,
        enabled: !!selectedIdentity,
        identityName: selectedIdentity ? getIdentitySlotName(selectedIdentity) : undefined,
        egosByGrade,
      }
    }
    return slots
  }, [egoById, getIdentitySlotName, getSelectedIdentity, sinners, state.egoSlots])

  const identityBoardSlots = useMemo<Record<string, PlannerIdentityBoardSlot>>(() => {
    const slots: Record<string, PlannerIdentityBoardSlot> = {}
    for (const sinner of sinners) {
      const slot = getSelectedIdentity(sinner.id)
      const identity = slot ? identityById.get(slot.identity_id) : undefined
      slots[sinner.id] = {
        sinnerId: sinner.id,
        identity: identity ?? null,
        identityName: slot ? getIdentitySlotName(slot) : undefined,
        slotOrder: slot?.slot_order ?? null,
        uptie: slot?.uptie,
        skills: slot && identity ? buildStripSkills(identity, skills.filter((skill): skill is SkillSummary & { id: string } => skill.identity_id === slot.identity_id && !!skill.id), getIdentitySkillDistribution(slot)) : undefined,
        egos: toEgoSlotItems(egoBoardSlots[sinner.id]?.egosByGrade ?? {}, locale),
      }
    }
    return slots
  }, [egoBoardSlots, getIdentitySlotName, getSelectedIdentity, identityById, locale, sinners, skills])

  const egoModalSelectedByGrade = useMemo<Record<string, PlannerDeckEgo | undefined>>(() => {
    if (!egoModalSinner) return {}
    return egosByGradeFor(state.egoSlots, egoModalSinner, egoById)
  }, [egoById, egoModalSinner, state.egoSlots])

  const getDefaultEgoForSinner = useCallback((sinnerId: string) => defaultEgoForSinner(egos, sinners, sinnerId), [egos, sinners])

  const defaultEgoSlots = useMemo(() => sinners.flatMap(sinner => {
    const ego = getDefaultEgoForSinner(sinner.id)
    return ego ? [{ ego_id: ego.id, sinner_id: sinner.id, name_kr: ego.name_kr, grade: ego.grade, sin_affinity: ego.sin_affinity }] : []
  }), [getDefaultEgoForSinner, sinners])

  useEffect(() => {
    if (defaultEgoSlots.length === 0) return
    const missingDefaults = defaultEgoSlots.filter(defaultSlot =>
      !state.egoSlots.some(slot => slot.sinner_id === defaultSlot.sinner_id && slot.grade === 'ZAYIN')
    )
    if (missingDefaults.length === 0) return
    dispatch({ type: 'LOAD_PLAN', state: { egoSlots: [...state.egoSlots, ...missingDefaults] } })
  }, [defaultEgoSlots, dispatch, state.egoSlots])

  // 인격 이미지 URL (info 이미지)
  const getIdentityInfoImageUrl = useCallback((ident: Pick<IdentityData, 'sinner_id' | 'game_id' | 'folder_name'>) => {
    if (!ident.game_id || !ident.folder_name) return ''
    return getIdentityImageUrl(ident.sinner_id, ident.folder_name, `${ident.game_id}_normal_info`)
  }, [])

  // 키워드 분포·패시브 패널 입력 (수감자 순서)
  // Only this set follows formation clicks: the identity list above stays keyed on the roster.
  const deployedIdentityIds = useMemo(() => new Set(state.identitySlots.filter(slot => isDeployedSlot(slot.slot_order)).map(slot => slot.identity_id)), [state.identitySlots])
  // Attack types and sin resources under the keyword chart, split the way the chart is: deployed over the whole roster.
  const deckAnalysis = useMemo(
    () => deckAnalysisFor(roster, state.identitySlots, state.egoSlots, skillsByIdentity, egoById),
    [egoById, roster, skillsByIdentity, state.egoSlots, state.identitySlots],
  )
  const insightIdentities = useMemo<DeckInsightIdentity[]>(() => sinners.flatMap(sinner => {
    const slot = rosterBySinner.get(sinner.id)
    if (!slot) return []
    const source = identityById.get(slot.identity_id)
    return [{
      id: slot.identity_id,
      name: getIdentitySlotName(slot),
      sinnerName: getLocalizedSinnerName(sinner),
      imageUrl: getIdentityInfoImageUrl(source ?? slot),
      keywords: slot.skill_keyword_list ?? source?.skill_keyword_list ?? slot.keywords ?? [],
      passives: passives
        .filter(passive => passive.identity_id === slot.identity_id)
        .map(passive => ({ ...passive, name: localizePassiveName(passive, locale), description: localizePassiveDescription(passive, locale) ?? null })),
      deck: computeSinProduction([{ skills: skillsByIdentity.get(slot.identity_id) ?? [], distribution: getIdentitySkillDistribution(slot) }]),
    }]
  }), [getIdentityInfoImageUrl, getIdentitySlotName, getLocalizedSinnerName, identityById, locale, passives, rosterBySinner, sinners, skillsByIdentity])

  const handleFormationToggle = (sinnerId: string) => {
    const slot = state.identitySlots.find(item => item.sinner_id === sinnerId)
    if (!slot) return

    const updated = toggleFormationSlot(state.identitySlots, sinnerId)
    if (slot.slot_order < 99) {
      dispatch({ type: 'LOAD_PLAN', state: { identitySlots: updated } })
      return
    }

    dispatch({ type: 'ADD_IDENTITY', slot: updated.find(item => item.sinner_id === sinnerId)! })
  }

  const handleSkillChange = (sinnerId: string, idx: number, delta: number) => {
    const slot = state.identitySlots.find(item => item.sinner_id === sinnerId)
    if (!slot) return
    const next = skillDistributionAfter(getIdentitySkillDistribution(slot), idx, delta)
    if (!next) return

    dispatch({ type: 'SET_SKILL_DISTRIBUTION', sinnerId, distribution: next })
  }

  const handleMainKeywordToggle = (keyword: string) => {
    const baseKeywords = mainKeywordsManual ? selectedMainKeywords : effectiveMainKeywords
    const next = toggledMainKeywords(keyword, mainKeywordCounts, baseKeywords)
    if (!next) return

    dispatch({ type: 'SET_MAIN_KEYWORDS', keywords: next, manual: true })
  }
  const mainKeywordToggleRef = useRef(handleMainKeywordToggle)
  useLayoutEffect(() => { mainKeywordToggleRef.current = handleMainKeywordToggle })
  const onMainKeywordToggle = useCallback((keyword: string) => mainKeywordToggleRef.current(keyword), [])

  const handleSelectIdentity = (ident: IdentityData, uptie: number) => {
    // 같은 수감자의 인격을 바꿔도 편성 순서는 유지하고, 같은 인격이면 스킬 배분도 유지한다
    const previous = getSelectedIdentity(ident.sinner_id)
    dispatch({ type: 'ADD_IDENTITY', slot: pickedIdentitySlot(ident, uptie, previous) })
    const hasZayin = state.egoSlots.some(e => e.sinner_id === ident.sinner_id && e.grade === 'ZAYIN')
    const defaultEgo = getDefaultEgoForSinner(ident.sinner_id)
    if (!hasZayin && defaultEgo) {
      dispatch({
        type: 'ADD_EGO',
        slot: { ego_id: defaultEgo.id, sinner_id: ident.sinner_id, name_kr: defaultEgo.name_kr, grade: defaultEgo.grade, sin_affinity: defaultEgo.sin_affinity },
      })
    }
    setIdentityModalSinner(null)
  }

  // Picker suggestions, as in the deck builder: the identity picker reads the other sinners' choices (an empty board still asks),
  // the E.G.O picker the identity chosen for that sinner.
  const lcbIdentityIds = useMemo(() => new Set(identities.filter(identity => identity.game_id === LCB_IDS[identity.sinner_id]).map(identity => identity.id)), [identities])
  const identitySuggestionUrl = identityModalSinner ? identitySuggestUrl(identityModalSinner, plannerSuggestionContext(state.identitySlots, identityModalSinner, id => lcbIdentityIds.has(id))) : null
  const { data: identitySuggestion, loading: identitySuggestionLoading } = useSuggestionState<SuggestionResponse>(identitySuggestionUrl)
  const egoModalIdentityId = egoModalSinner ? getSelectedIdentity(egoModalSinner)?.identity_id : undefined
  const { data: egoSuggestion, loading: egoSuggestionLoading } = useSuggestionState<SuggestionResponse>(egoModalIdentityId ? `/api/discovery/suggest?type=ego&identity=${egoModalIdentityId}` : null)

  // --- Modal sinner data ---
  const modalSinner = identityModalSinner ? sinners.find(s => s.id === identityModalSinner) ?? null : null
  const modalIdentities = identityModalSinner ? (sinnerIdentities.get(identityModalSinner) ?? []) : []
  const modalSlot = identityModalSinner ? getSelectedIdentity(identityModalSinner) : undefined

  return (
    <div>
      {/* 서브 탭 헤더 */}
      <DeckSubTabs subTab={subTab} onChange={setSubTab} formationCount={state.identitySlots.filter(slot => slot.slot_order < 99).length} />

      {subTab === 'identity' && (
        <DeckMainKeywords counts={mainKeywordCounts} effectiveKeywords={effectiveMainKeywords} onToggle={onMainKeywordToggle} />
      )}

      {/* ── 인격 탭 ── */}
      {subTab === 'identity' && (
        <PlannerIdentityBoard
          sinners={sinners}
          slots={identityBoardSlots}
          onOpenIdentityModal={setIdentityModalSinner}
          onFormationToggle={handleFormationToggle}
          onResetOrder={() => dispatch({ type: 'LOAD_PLAN', state: { identitySlots: state.identitySlots.map(slot => ({ ...slot, slot_order: 99 })) } })}
          onApplyCode={handleApplyCode}
          onImport={{ label: tImport('fromDeck'), open: () => setImportOpen(true) }}
        />
      )}

      <ConfirmModal
        open={pendingCode !== null}
        title={tDeck('identity.codeReplaceTitle')}
        message={tDeck('identity.codeReplaceMessage')}
        confirmLabel={tDeck('identity.codeReplaceConfirm')}
        cancelLabel={tDeck('identity.codeCancel')}
        variant="warning"
        onConfirm={() => { if (pendingCode) applyCodeSlots(pendingCode); setPendingCode(null) }}
        onCancel={() => setPendingCode(null)}
      />

      <FormationSourceModal kind="deck" open={importOpen} onClose={() => setImportOpen(false)} onLoaded={handleDeckLoaded} />
      <ConfirmModal
        open={pendingImport !== null}
        title={tImport('replaceTitle')}
        message={pendingImport?.title || tImport('untitled')}
        confirmLabel={tImport('replaceConfirm')}
        cancelLabel={tDeck('identity.codeCancel')}
        variant="warning"
        onConfirm={() => { if (pendingImport) { dispatch({ type: 'LOAD_PLAN', state: pendingImport.slots }); showSuccess(tImport('applied')) } setPendingImport(null) }}
        onCancel={() => setPendingImport(null)}
      />

      {/* ── 인격 선택 모달 ── */}
      <PlannerIdentitySelectModal
        open={!!identityModalSinner}
        sinner={modalSinner}
        identities={modalIdentities}
        selectedIdentityId={modalSlot?.identity_id ?? null}
        selectedUptie={modalSlot?.uptie ?? 4}
        suggestions={identitySuggestion?.items}
        archetype={identitySuggestion?.archetype}
        suggestionsLoading={identitySuggestionLoading}
        partnerIdentity={id => identityById.get(id)}
        onClose={() => setIdentityModalSinner(null)}
        onSelect={(identity, uptie) => handleSelectIdentity(identity as IdentityData, uptie)}
      />

      {/* ── EGO 탭 ── */}
      {subTab === 'ego' && (
        <PlannerEgoBoard
          sinners={sinners}
          slots={egoBoardSlots}
          onOpenEgoModal={setEgoModalSinner}
        />
      )}

      {/* ── EGO 선택 모달 ── */}
      <PlannerEgoSelectModal
        open={!!egoModalSinner}
        sinner={egoModalSinner ? sinners.find(s => s.id === egoModalSinner) ?? null : null}
        egos={egoModalSinner ? (sinnerEgosMap.get(egoModalSinner) ?? []) : []}
        selectedEgosByGrade={egoModalSelectedByGrade}
        suggestions={egoSuggestion?.items}
        archetype={egoSuggestion?.archetype}
        suggestionsLoading={egoSuggestionLoading}
        partnerIdentity={id => identityById.get(id)}
        onClose={() => setEgoModalSinner(null)}
        onSelect={ego => {
          dispatch({
            type: 'ADD_EGO',
            slot: {
              ego_id: ego.id,
              sinner_id: ego.sinner_id,
              name_kr: ego.name_kr,
              grade: ego.grade,
              sin_affinity: ego.sin_affinity,
            },
          })
        }}
        onDeselect={(_, ego) => dispatch({ type: 'REMOVE_EGO', egoId: ego.id })}
      />

      {/* ── 스킬 교환 탭 ── */}
      {subTab === 'skillset' && (
        <DeckSkillsetPanel
          sinners={sinners}
          slots={identityBoardSlots}
          identitySlots={state.identitySlots}
          dispatch={dispatch}
          onSkillChange={handleSkillChange}
        />
      )}

      {/* ── 하단: 키워드 분포 + 패시브 ── */}
      <DeckInsights identities={insightIdentities} sinCounts={deckAnalysis.resources.production} baseSinCounts={deckAnalysis.baseSinCounts} deployedIds={deployedIdentityIds} summary={<DeckResourceSummary resources={deckAnalysis.resources} />} />
    </div>
  )
}
