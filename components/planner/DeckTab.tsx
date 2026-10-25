'use client'

import { memo, useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import Image from 'next/image'
import { Users, Sparkles, SlidersHorizontal } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import {
  getIdentitySkillDistribution,
  normalizeSkillDistribution,
  type PlannerState,
  type PlannerAction,
  type IdentityData,
  type SinnerData,
  type ThemeData,
  type GiftData,
  type PassiveData,
  type SkillSummary,
  type EgoData,
  type SkillDistribution,
} from '@/lib/planner/types'
import { rowsAtUptie } from '@/lib/decks/deck-identity-uptie'
import { getIdentityImageUrl, getSkillIconUrl } from '@/lib/utils/images'
import { SIN_COLORS } from '@/lib/constants/sin'
import DeckInsights, { type DeckInsightIdentity } from '@/components/deck-analysis/DeckInsights'
import DeckResourceSummary from '@/components/deck-analysis/DeckResourceSummary'
import { computeDeckResources, computeSinProduction, fieldedEntries } from '@/lib/decks/deck-analysis'
import { localizeIdentityName, localizePassiveDescription, localizePassiveName } from '@/components/deck-detail/DeckIdentityCard'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useLocale, useTranslations } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import SkillExchangePanel from './SkillExchangePanel'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { showError, showSuccess } from '@/lib/toast'
import { planSlotsFromTeamCode } from '@/lib/planner/team-code-import'
import { withLcbIdentitySlots } from '@/lib/planner/lcb'
import { planSlotsFromDeckRows } from '@/lib/planner/formation-transfer'
import FormationSourceModal from './FormationSourceModal'
import {
  PLANNER_EGO_GRADE_ORDER,
  PlannerEgoBoard,
  PlannerEgoSelectModal,
  PlannerIdentityBoard,
  PlannerIdentitySelectModal,
  type PlannerDeckEgo,
  type PlannerEgoBoardSlot,
  type PlannerIdentityBoardSlot,
} from '@/components/planner/deck/PlannerDeckSelection'
import { LCB_IDS, isDeployedSlot } from '@/lib/constants/game'
import { useSuggestionState } from '@/hooks/useSuggestions'
import { identitySuggestUrl, plannerSuggestionContext, type SuggestionResponse } from '@/lib/discovery/suggestion-types'
import {
  DECK_MAIN_KEYWORDS,
  MAX_DECK_MAIN_KEYWORDS,
  computeDeckMainKeywordsFromSlots,
  computeDeckKeywordCounts,
  type DeckKeywordSlot,
} from '@/lib/decks/keyword-rules'

type DeckSubTab = 'identity' | 'ego' | 'skillset'
type RosterSlot = Omit<PlannerState['identitySlots'][number], 'slot_order'>

const SUB_TABS: { key: DeckSubTab; labelKey: string; icon: typeof Users }[] = [
  { key: 'identity', labelKey: 'subTabs.identity', icon: Users },
  { key: 'ego', labelKey: 'subTabs.ego', icon: Sparkles },
  { key: 'skillset', labelKey: 'subTabs.skillset', icon: SlidersHorizontal },
]

const COMPACT_KOTRA_STYLE: CSSProperties = {
  fontFamily: 'var(--font-kotra-bold), var(--font-heading), serif',
  fontWeight: 400,
  WebkitTextStroke: '0 transparent',
}

const DEFAULT_EGO_NAMES: Record<string, string> = {
  '이상': '오감도',
  '파우스트': '표사 방출기',
  '돈키호테': '라 상그레 산초',
  '료슈': '삼라영삼',
  '뫼르소': '타인의 사슬',
  '홍루': '허환경',
  '이스마엘': '작살박이',
  '오티스': '토 파토스 마토스',
  '그레고르': '어느날 갑자기',
}
const MANUAL_ATTACK_MAIN_KEYWORDS = new Set<string>(['참격', '관통', '타격'])

const getHighestDonorIndex = (dist: SkillDistribution, targetIdx: number) => {
  let donorIdx: number | null = null
  for (let idx = 0; idx < dist.length; idx++) {
    if (idx === targetIdx || dist[idx] <= 0) continue
    if (donorIdx === null || dist[idx] > dist[donorIdx]) donorIdx = idx
  }
  return donorIdx
}

const getLowestReceiverIndex = (dist: SkillDistribution, targetIdx: number) => {
  let receiverIdx: number | null = null
  for (let idx = 0; idx < dist.length; idx++) {
    if (idx === targetIdx) continue
    if (receiverIdx === null || dist[idx] < dist[receiverIdx]) receiverIdx = idx
  }
  return receiverIdx
}

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
  const rosterKey = useMemo(() => {
    const rank = new Map(sinners.map((sinner, index) => [sinner.id, index]))
    return [...state.identitySlots]
      .sort((a, b) => (rank.get(a.sinner_id) ?? 99) - (rank.get(b.sinner_id) ?? 99))
      .map(({ slot_order: _order, ...slot }) => JSON.stringify(slot))
      .join('\n')
  }, [sinners, state.identitySlots])
  const roster = useMemo<RosterSlot[]>(() => rosterKey ? rosterKey.split('\n').map(line => JSON.parse(line)) : [], [rosterKey])
  const rosterBySinner = useMemo(() => new Map(roster.map(slot => [slot.sinner_id, slot])), [roster])
  // Skills/passives follow each slot's uptie (nearest level the data has).
  const slotUpties = useMemo(() => new Map(roster.map(slot => [slot.identity_id, slot.uptie])), [roster])
  const skills = useMemo(() => rowsAtUptie(allSkills, slotUpties), [allSkills, slotUpties])
  const passives = useMemo(() => rowsAtUptie(allPassives, slotUpties), [allPassives, slotUpties])
  const tDeck = useTranslations('planner.deckTab')
  // A pasted formation code waiting for the user to confirm replacing the current formation.
  const [pendingCode, setPendingCode] = useState<NonNullable<ReturnType<typeof planSlotsFromTeamCode>> | null>(null)
  const applyCodeSlots = (slots: NonNullable<ReturnType<typeof planSlotsFromTeamCode>>) => {
    dispatch({ type: 'LOAD_PLAN', state: slots })
    showSuccess(tDeck('identity.codeApplied'))
  }
  const handleApplyCode = (code: string) => {
    const slots = planSlotsFromTeamCode(code, sinners, identities, egos)
    if (!slots) return false
    if (state.identitySlots.length) setPendingCode(slots)
    else applyCodeSlots(slots)
    return true
  }
  // Import from one of my saved decks: asks first when the plan already has a formation.
  const tImport = useTranslations('planner.formationImport')
  const [importOpen, setImportOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ slots: NonNullable<ReturnType<typeof planSlotsFromTeamCode>>; title: string } | null>(null)
  const handleDeckLoaded = (record: Record<string, unknown>) => {
    const loaded = planSlotsFromDeckRows((record.deck_identities as never[]) ?? [], (record.deck_egos as never[]) ?? [], identities, egos)
    if (!loaded) { showError(tImport('loadFailed')); return }
    const slots = { ...loaded, identitySlots: withLcbIdentitySlots(identities, loaded.identitySlots) }
    setImportOpen(false)
    const title = String(record.title ?? '')
    if (state.identitySlots.some(slot => slot.slot_order < 99)) setPendingImport({ slots, title })
    else { dispatch({ type: 'LOAD_PLAN', state: slots }); showSuccess(tImport('applied')) }
  }
  const tSinner = useTranslations('sinner')
  const locale = useLocale() as SupportedLang
  const { getIconUrl, keywords: keywordInfo } = useKeywordData()
  const [subTab, setSubTab] = useState<DeckSubTab>('identity')
  const reduceMotion = useReducedMotion()

  // Modal state
  const [identityModalSinner, setIdentityModalSinner] = useState<string | null>(null)
  const [egoModalSinner, setEgoModalSinner] = useState<string | null>(null)

  // 수감자별 인격 그룹 (rarity 내림차순 정렬)
  const sinnerIdentities = useMemo(() => {
    const map = new Map<string, IdentityData[]>()
    for (const ident of identities) {
      if (!map.has(ident.sinner_id)) map.set(ident.sinner_id, [])
      map.get(ident.sinner_id)!.push(ident)
    }
    for (const [, list] of map) {
      list.sort((a, b) => b.rarity - a.rarity)
    }
    return map
  }, [identities])

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
  const skillsByIdentity = useMemo(() => {
    const map = new Map<string, SkillSummary[]>()
    for (const skill of skills) (map.get(skill.identity_id) ?? map.set(skill.identity_id, []).get(skill.identity_id)!).push(skill)
    return map
  }, [skills])

  const deckKeywordSlots = useMemo<DeckKeywordSlot[]>(() => (
    state.identitySlots.map(slot => {
      const sourceIdentity = identityById.get(slot.identity_id)
      return {
        slot_order: slot.slot_order,
        identities: {
          skill_keyword_list: slot.skill_keyword_list ?? sourceIdentity?.skill_keyword_list ?? [],
          keywords: slot.keywords ?? sourceIdentity?.keywords ?? [],
          affiliation: slot.affiliation ?? sourceIdentity?.affiliation ?? null,
          association_list: slot.association_list ?? sourceIdentity?.association_list ?? [],
          skills: (skillsByIdentity.get(slot.identity_id) ?? [])
            .map(skill => ({ skill_type: skill.skill_type, atk_type: skill.skill_type })),
        },
      }
    })
  ), [identityById, skillsByIdentity, state.identitySlots])

  const mainKeywordCounts = useMemo(() => computeDeckKeywordCounts(deckKeywordSlots).counts, [deckKeywordSlots])
  const autoMainKeywords = useMemo(() => computeDeckMainKeywordsFromSlots(deckKeywordSlots), [deckKeywordSlots])
  const selectedMainKeywords = state.mainKeywords ?? []
  const mainKeywordsManual = state.mainKeywordsManual ?? false
  const effectiveMainKeywords = mainKeywordsManual ? selectedMainKeywords : autoMainKeywords

  useEffect(() => {
    if (mainKeywordsManual) return
    const same = selectedMainKeywords.length === autoMainKeywords.length &&
      selectedMainKeywords.every((keyword, index) => keyword === autoMainKeywords[index])
    if (!same) {
      dispatch({ type: 'SET_MAIN_KEYWORDS', keywords: autoMainKeywords, manual: false })
    }
  }, [autoMainKeywords, dispatch, mainKeywordsManual, selectedMainKeywords])

  useEffect(() => {
    if (!mainKeywordsManual) return
    const next = selectedMainKeywords.filter(keyword => (
      MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword) || (mainKeywordCounts[keyword] ?? 0) > 0
    ))
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

  const getLocalizedKeywordLabel = useCallback(
    (keyword: string) => localizeDeckKeyword(keyword, keywordInfo[keyword], locale),
    [keywordInfo, locale],
  )

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
      }
    }
    return slots
  }, [getIdentitySlotName, getSelectedIdentity, identityById, sinners])

  // EGO grouped by sinner (grade order within each group)
  const sinnerEgosMap = useMemo(() => {
    const map = new Map<string, EgoData[]>()
    for (const ego of egos) {
      if (!map.has(ego.sinner_id)) map.set(ego.sinner_id, [])
      map.get(ego.sinner_id)!.push(ego)
    }
    for (const [, list] of map) {
      list.sort((a, b) => PLANNER_EGO_GRADE_ORDER.indexOf(a.grade as (typeof PLANNER_EGO_GRADE_ORDER)[number]) - PLANNER_EGO_GRADE_ORDER.indexOf(b.grade as (typeof PLANNER_EGO_GRADE_ORDER)[number]))
    }
    return map
  }, [egos])

  const egoBoardSlots = useMemo<Record<string, PlannerEgoBoardSlot>>(() => {
    const slots: Record<string, PlannerEgoBoardSlot> = {}
    for (const sinner of sinners) {
      const selectedIdentity = getSelectedIdentity(sinner.id)
      const egosByGrade: Record<string, PlannerDeckEgo | undefined> = {}
      for (const slot of state.egoSlots.filter(e => e.sinner_id === sinner.id)) {
        egosByGrade[slot.grade] = egoById.get(slot.ego_id) ?? {
          id: slot.ego_id,
          sinner_id: slot.sinner_id,
          name: slot.name_kr,
          name_kr: slot.name_kr,
          grade: slot.grade,
          sin_affinity: slot.sin_affinity,
          image_url: null,
          cost: null,
        }
      }
      slots[sinner.id] = {
        sinnerId: sinner.id,
        enabled: !!selectedIdentity,
        egosByGrade,
      }
    }
    return slots
  }, [egoById, getSelectedIdentity, sinners, state.egoSlots])

  const egoModalSelectedByGrade = useMemo<Record<string, PlannerDeckEgo | undefined>>(() => {
    if (!egoModalSinner) return {}
    const selectedByGrade: Record<string, PlannerDeckEgo | undefined> = {}
    for (const slot of state.egoSlots.filter(e => e.sinner_id === egoModalSinner)) {
      selectedByGrade[slot.grade] = egoById.get(slot.ego_id) ?? {
        id: slot.ego_id,
        sinner_id: slot.sinner_id,
        name: slot.name_kr,
        name_kr: slot.name_kr,
        grade: slot.grade,
        sin_affinity: slot.sin_affinity,
        image_url: null,
        cost: null,
      }
    }
    return selectedByGrade
  }, [egoById, egoModalSinner, state.egoSlots])

  const getDefaultEgoForSinner = useCallback((sinnerId: string) => {
    const sinnerName = sinners.find(s => s.id === sinnerId)?.name_kr
    const defaultName = sinnerName ? DEFAULT_EGO_NAMES[sinnerName] : undefined
    return defaultName
      ? egos.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN' && (e.name_kr === defaultName || e.name === defaultName))
        ?? egos.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN')
      : egos.find(e => e.sinner_id === sinnerId && e.grade === 'ZAYIN')
  }, [egos, sinners])

  const defaultEgoSlots = useMemo(() => sinners.flatMap(sinner => {
    const ego = getDefaultEgoForSinner(sinner.id)
    return ego ? [{ ego_id: ego.id, sinner_id: sinner.id, name_kr: ego.name_kr ?? ego.name, grade: ego.grade, sin_affinity: ego.sin_affinity }] : []
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
  const deckAnalysis = useMemo(() => {
    const deployedSinners = new Set(state.identitySlots.filter(slot => isDeployedSlot(slot.slot_order)).map(slot => slot.sinner_id))
    const entries = roster.map(slot => ({
      skills: skillsByIdentity.get(slot.identity_id) ?? [],
      distribution: getIdentitySkillDistribution(slot),
      deployed: deployedSinners.has(slot.sinner_id),
      egos: state.egoSlots.filter(ego => ego.sinner_id === slot.sinner_id).map(ego => ({ cost: egoById.get(ego.ego_id)?.cost })),
    }))
    return { resources: computeDeckResources(entries), baseSinCounts: computeSinProduction(fieldedEntries(entries).map(({ skills }) => ({ skills }))) }
  }, [egoById, roster, skillsByIdentity, state.egoSlots, state.identitySlots])
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

    if (slot.slot_order < 99) {
      const removed = slot.slot_order
      const updated = state.identitySlots.map(item => {
        if (item.sinner_id === sinnerId) return { ...item, slot_order: 99 }
        if (item.slot_order < 99 && item.slot_order > removed) return { ...item, slot_order: item.slot_order - 1 }
        return item
      })
      dispatch({ type: 'LOAD_PLAN', state: { identitySlots: updated } })
      return
    }

    const nextOrder = state.identitySlots.filter(item => item.slot_order < 99).length
    dispatch({ type: 'ADD_IDENTITY', slot: { ...slot, slot_order: nextOrder } })
  }

  const handleSkillChange = (sinnerId: string, idx: number, delta: number) => {
    const slot = state.identitySlots.find(item => item.sinner_id === sinnerId)
    if (!slot) return
    const dist = getIdentitySkillDistribution(slot)
    const next: SkillDistribution = [dist[0], dist[1], dist[2]]

    if (delta > 0) {
      const donorIdx = getHighestDonorIndex(dist, idx)
      if (dist[idx] >= 6 || donorIdx === null) return
      next[idx] += 1
      next[donorIdx] -= 1
    } else if (delta < 0) {
      const receiverIdx = getLowestReceiverIndex(dist, idx)
      if (dist[idx] <= 0 || receiverIdx === null) return
      next[idx] -= 1
      next[receiverIdx] += 1
    } else {
      return
    }

    dispatch({ type: 'SET_SKILL_DISTRIBUTION', sinnerId, distribution: next })
  }

  const handleMainKeywordToggle = (keyword: string) => {
    const isManualAttackKeyword = MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword)
    if (!isManualAttackKeyword && (mainKeywordCounts[keyword] ?? 0) <= 0) return

    const baseKeywords = mainKeywordsManual ? selectedMainKeywords : effectiveMainKeywords
    const next = baseKeywords.includes(keyword)
      ? baseKeywords.filter(item => item !== keyword)
      : baseKeywords.length >= MAX_DECK_MAIN_KEYWORDS
        ? baseKeywords
        : [...baseKeywords, keyword]

    dispatch({ type: 'SET_MAIN_KEYWORDS', keywords: next, manual: true })
  }
  const mainKeywordToggleRef = useRef(handleMainKeywordToggle)
  useLayoutEffect(() => { mainKeywordToggleRef.current = handleMainKeywordToggle })
  const onMainKeywordToggle = useCallback((keyword: string) => mainKeywordToggleRef.current(keyword), [])

  const handleSelectIdentity = (ident: IdentityData, uptie: number) => {
    // 같은 수감자의 인격을 바꿔도 편성 순서는 유지하고, 같은 인격이면 스킬 배분도 유지한다
    const previous = getSelectedIdentity(ident.sinner_id)
    const sameIdentity = previous?.identity_id === ident.id
    dispatch({
      type: 'ADD_IDENTITY',
      slot: {
        identity_id: ident.id,
        sinner_id: ident.sinner_id,
        name_kr: ident.name_kr,
        rarity: ident.rarity,
        keywords: ident.keywords ?? [],
        skill_keyword_list: ident.skill_keyword_list ?? [],
        game_id: ident.game_id,
        folder_name: ident.folder_name,
        slot_order: previous?.slot_order ?? 99,
        ...(sameIdentity ? { s1_count: previous.s1_count, s2_count: previous.s2_count, s3_count: previous.s3_count } : {}),
        ...(uptie === 4 ? {} : { uptie }),
      },
    })
    const hasZayin = state.egoSlots.some(e => e.sinner_id === ident.sinner_id && e.grade === 'ZAYIN')
    const defaultEgo = getDefaultEgoForSinner(ident.sinner_id)
    if (!hasZayin && defaultEgo) {
      dispatch({
        type: 'ADD_EGO',
        slot: { ego_id: defaultEgo.id, sinner_id: ident.sinner_id, name_kr: defaultEgo.name_kr ?? defaultEgo.name, grade: defaultEgo.grade, sin_affinity: defaultEgo.sin_affinity },
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
      <div
        className="mb-6 flex items-center gap-1 overflow-x-auto"
        role="tablist"
        aria-label={tDeck('subTabs.label')}
        style={{ borderBottom: '1px solid var(--bg-card)', WebkitOverflowScrolling: 'touch' }}
      >
        {SUB_TABS.map(tab => {
          const active = subTab === tab.key
          const Icon = tab.icon
          return (
            <m.button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(tab.key)}
              className="flex flex-shrink-0 items-center gap-1.5 transition-[background-color,border-color,color] duration-200"
              style={{
                ...COMPACT_KOTRA_STYLE,
                padding: '0.5rem 1rem',
                fontSize: '0.9375rem',
                color: active ? 'var(--text-primary)' : '#555',
                borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
                background: active ? 'rgba(200,144,10,0.05)' : 'transparent',
                cursor: 'pointer',
              }}
              whileHover={reduceMotion ? undefined : { y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 430, damping: 32, mass: 0.5 }}
            >
              <Icon style={{ width: '0.875rem', height: '0.875rem' }} />
              {tDeck(tab.labelKey)}
            </m.button>
          )
        })}
        <div className="ml-auto flex flex-shrink-0 items-center font-mono" style={{ fontSize: '0.875rem', color: '#666', paddingRight: '0.5rem' }}>
          {state.identitySlots.filter(slot => slot.slot_order < 99).length} / 12
        </div>
      </div>

      {subTab === 'identity' && (
        <div className="planner-main-keywords" aria-label={tDeck('mainKeywords.label')}>
          {DECK_MAIN_KEYWORDS.map(keyword => {
            const iconUrl = getIconUrl(keyword)
            const count = mainKeywordCounts[keyword] ?? 0
            const selected = effectiveMainKeywords.includes(keyword)
            const isManualAttackKeyword = MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword)
            const disabled = (!isManualAttackKeyword && count <= 0) || (!selected && effectiveMainKeywords.length >= MAX_DECK_MAIN_KEYWORDS)
            const keywordLabel = getLocalizedKeywordLabel(keyword)
            const accessibleName = isManualAttackKeyword ? keywordLabel : tDeck('mainKeywords.keywordCount', { keyword: keywordLabel, count })
            return (
              <MainKeywordChip
                key={keyword}
                keyword={keyword}
                iconUrl={iconUrl}
                label={keywordLabel}
                accessibleName={accessibleName}
                count={isManualAttackKeyword ? null : count}
                selected={selected}
                disabled={disabled}
                reduceMotion={!!reduceMotion}
                onToggle={onMainKeywordToggle}
              />
            )
          })}
          <style jsx global>{`
            .planner-main-keywords { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; margin: -0.5rem 0 0.75rem; }
            .planner-main-keyword {
              display: inline-flex; flex: 0 0 auto; max-width: 100%; min-height: 2.25rem; align-items: center; gap: 0.3125rem;
              padding: 0 0.625rem; border: 1px solid transparent; border-radius: 999px; background: rgba(232, 220, 200, 0.04);
              color: #9c8b73; cursor: pointer; font-family: var(--font-body), var(--font-sans); font-size: 0.8125rem; line-height: 1;
              transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
            }
            .planner-main-keyword:hover:not(:disabled) { background: rgba(232, 220, 200, 0.08); color: #e8dcc8; }
            .planner-main-keyword:focus-visible { outline: 2px solid #e8b030; outline-offset: 2px; }
            .planner-main-keyword[data-selected="true"] { border-color: rgba(200, 144, 10, 0.45); background: rgba(200, 144, 10, 0.14); color: #e8b030; }
            .planner-main-keyword:disabled { cursor: not-allowed; opacity: 0.38; }
            .planner-main-keyword__icon { flex: 0 0 auto; width: 0.875rem; height: 0.875rem; object-fit: contain; }
            .planner-main-keyword__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .planner-main-keyword__count { color: inherit; font-size: 0.75rem; font-variant-numeric: tabular-nums; opacity: 0.7; }
            @media (pointer: coarse) { .planner-main-keyword { min-height: 2.75rem; } }
            @media (prefers-reduced-motion: reduce) { .planner-main-keyword { transition: none; } }
          `}</style>
        </div>
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
              name_kr: ego.name_kr ?? ego.name,
              grade: ego.grade,
              sin_affinity: ego.sin_affinity,
            },
          })
        }}
        onDeselect={(_, ego) => dispatch({ type: 'REMOVE_EGO', egoId: ego.id })}
      />

      {/* ── 스킬 교환 탭 ── */}
      {subTab === 'skillset' && (
        <div>
          {state.identitySlots.length === 0 ? (
            <div className="text-center" style={{ padding: '3rem 1rem', color: '#444', fontSize: '0.8125rem' }}>
              {tDeck('skillset.selectIdentityFirst')}
            </div>
          ) : (
            <div className="skill-exchange-list">
              {sinners.map(sinner => {
                const slot = getSelectedIdentity(sinner.id)
                if (!slot) return null

                const identData = identityById.get(slot.identity_id)
                const dist = getIdentitySkillDistribution(slot)

                // Build a fake Identity-like object for getSkillIconUrl
                const identForIcon = identData ? { game_id: identData.game_id, sinner_id: identData.sinner_id } as { game_id: string | null; sinner_id: string } : null

                // 각 슬롯(S1,S2,S3)별 최고 업타이 스킬 (죄악 속성 시각화용)
                const slotBestSkills = [1, 2, 3].map(order =>
                  skills
                    .filter(sk => sk.identity_id === slot.identity_id && sk.skill_order === order)
                    .sort((a, b) => (b.uptie_level ?? 0) - (a.uptie_level ?? 0))[0] ?? null
                )

                return (
                  <SkillExchangePanel
                      key={sinner.id}
                      identity={{
                        imageUrl: identData ? getIdentityInfoImageUrl(identData) : null,
                        name: getIdentitySlotName(slot),
                        sinnerName: getLocalizedSinnerName(sinner),
                      }}
                      distribution={dist}
                      skills={[
                        slotBestSkills[0] ? {
                          name: slotBestSkills[0].name,
                          iconSrc: identForIcon?.game_id ? getSkillIconUrl(identForIcon as Parameters<typeof getSkillIconUrl>[0], 1) : null,
                          sinColor: SIN_COLORS[slotBestSkills[0].sin_affinity as keyof typeof SIN_COLORS] ?? '#555',
                        } : null,
                        slotBestSkills[1] ? {
                          name: slotBestSkills[1].name,
                          iconSrc: identForIcon?.game_id ? getSkillIconUrl(identForIcon as Parameters<typeof getSkillIconUrl>[0], 2) : null,
                          sinColor: SIN_COLORS[slotBestSkills[1].sin_affinity as keyof typeof SIN_COLORS] ?? '#555',
                        } : null,
                        slotBestSkills[2] ? {
                          name: slotBestSkills[2].name,
                          iconSrc: identForIcon?.game_id ? getSkillIconUrl(identForIcon as Parameters<typeof getSkillIconUrl>[0], 3) : null,
                          sinColor: SIN_COLORS[slotBestSkills[2].sin_affinity as keyof typeof SIN_COLORS] ?? '#555',
                        } : null,
                      ]}
                      canDecrease={idx => dist[idx] > 0}
                      canIncrease={idx => dist[idx] < 6 && getHighestDonorIndex(dist, idx) !== null}
                      onAdjust={(idx, delta) => handleSkillChange(sinner.id, idx, delta)}
                      onPresetSelect={preset => dispatch({ type: 'SET_SKILL_DISTRIBUTION', sinnerId: sinner.id, distribution: normalizeSkillDistribution(preset) })}
                    />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 하단: 키워드 분포 + 패시브 ── */}
      <DeckInsights identities={insightIdentities} sinCounts={deckAnalysis.resources.production} baseSinCounts={deckAnalysis.baseSinCounts} deployedIds={deployedIdentityIds} summary={<DeckResourceSummary resources={deckAnalysis.resources} />} />
    </div>
  )
}

const MAIN_KEYWORD_SPRING = { type: 'spring', stiffness: 430, damping: 32, mass: 0.5 } as const

// Memoized so a formation click only re-renders chips whose count/state changed.
const MainKeywordChip = memo(function MainKeywordChip({ keyword, iconUrl, label, accessibleName, count, selected, disabled, reduceMotion, onToggle }: {
  keyword: string
  iconUrl: string | null | undefined
  label: string
  accessibleName: string
  /** null = attack-type keyword without a count. */
  count: number | null
  selected: boolean
  disabled: boolean
  reduceMotion: boolean
  onToggle: (keyword: string) => void
}) {
  return (
    <m.button
      type="button"
      className="planner-main-keyword"
      data-selected={selected}
      disabled={disabled}
      onClick={() => onToggle(keyword)}
      aria-pressed={selected}
      aria-label={accessibleName}
      title={accessibleName}
      whileHover={reduceMotion || disabled ? undefined : { y: -1 }}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.985 }}
      transition={MAIN_KEYWORD_SPRING}
    >
      {iconUrl && <Image src={iconUrl} alt="" width={16} height={16} className="planner-main-keyword__icon" />}
      <span className="planner-main-keyword__label">{label}</span>
      {count != null && <span className="planner-main-keyword__count">{count}</span>}
    </m.button>
  )
})
