'use client'

import dynamic from 'next/dynamic'
import { isConfiguredFloor } from '@/lib/planner/stripPlanForList'

import FloorConstraints from './FloorConstraints'
import FloorGuidance from './FloorGuidance'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { ChevronUp, Plus, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import GiftCard from '@/components/ui/GiftCard'
import GiftCatalog, { GiftGradeChip, GiftKeywordTab, giftKeywordIcon, giftKeywordLabel, toCatalogGift, useGiftCatalogFilters, type GiftCatalogCardProps } from '@/components/gifts/GiftCatalog'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import type { EgoGift } from '@/components/mirror-dungeon/types'
import FinalGiftTile from './FinalGiftTile'
import FloorGiftPickerModal from './FloorGiftPickerModal'
import { useSuggestionState } from '@/hooks/useSuggestions'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { previousFloorGifts } from '@/lib/planner/floor-copy'
import { showSuccess } from '@/lib/toast'
import FinalGiftPresets from './FinalGiftPresets'
import ThemePackCard from '@/components/ui/ThemePackCard'
import {
  ThemePackModalPill,
  ThemePackPickerModal,
} from '@/components/ui/ThemePackModal'
import { GRADE_ROMAN, SLUG_TO_KEYWORD, getKeywordSlug } from '@/components/planner/gift-plan/constants'
import type { PlannerState, PlannerAction, ThemeData, GiftData, FloorDifficulty, FloorEntry, RecipeData } from '@/lib/planner/types'
import { DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import {
  deriveBlockedFinalFusionMaterialIds,
  findAvailableFusions,
  getAvailableThemes,
  getFinalGiftVariantIds,
  getGiftsFromThemes,
  parseFinalGiftIds,
  themeExclusiveGiftIds,
  withThemeRewards,
} from '@/lib/planner/fusion'
import { deriveFinalGifts, finalEnhanceEdit, finalKeyForFloorPick, type FinalGift } from '@/lib/planner/final-gifts'
import { isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import {
  buildKeywordPool,
  buildEgoGiftPool,
  type AutocompleteSuggestion,
} from '@/components/notes/NoteAutocomplete'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import type { NoteFormationMember } from '@/lib/notes/assets'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots, giftConditionKey } from '@/lib/planner/gift-condition-status'

// Tiptap and ProseMirror load when a floor memo is shown, not with the planner page. The shell holds its toolbar and 7rem body.
const NoteDocumentEditor = dynamic(() => import('@/components/notes/NoteDocumentEditor'), {
  ssr: false,
  loading: () => <div className="note-editor-shell min-h-[10rem] rounded-md bg-[var(--bg-deep)]" aria-busy="true" />,
})

// The descent rail: its colour marks which stretch of the dungeon a floor belongs to.
const LADDER_SEGMENTS = [
  { id: 'early', start: 1, end: 5, rail: '#c8900a', label: '#c8900a' },
  { id: 'loop', start: 6, end: 10, rail: '#e8b030', label: '#e8b030' },
  { id: 'extreme', start: 11, end: Infinity, rail: '#9b2c23', label: '#d0675c' },
] as const

// 미러 던전 기프트 목록과 같은 순서: 공통 → 키워드 → 참격/관통/타격, 등급은 Ⅰ → EX
const FINAL_KEYWORD_ORDER = ['general', 'burn', 'bleed', 'tremor', 'rupture', 'sinking', 'breath', 'charge', 'slash', 'pierce', 'blunt']
const FINAL_GIFT_GRADE_ORDER = ['1', '2', '3', '4', '5', 'EX']
// Below this many final gifts the keyword/grade filters are noise.
const FINAL_FILTER_MIN = 8

function getDifficultyTone(difficulty: FloorDifficulty) {
  if (difficulty === 'extreme') return '#d0675c'
  if (difficulty === 'overlap') return '#e8b030'
  if (difficulty === 'hard') return '#c8900a'
  return '#9c8b73'
}

/** Gifts a pack offers: its regular and exclusive pools and its clear rewards, each gift once. */
function getThemeGiftCount(theme: ThemeData | null) {
  if (!theme) return 0
  return new Set([...(theme.ego_gift_ids ?? []), ...(theme.specific_ego_gift_ids ?? []), ...(theme.fixed_reward_gift_ids ?? [])]).size
}

function getMemoPreview(memo: string) {
  return memo
    .replace(/\[(?:s|p|e|k|i|g):([^\]]+)\]/g, '$1')
    .replace(/\{\{([^}|]+)(?:\|[^}]*)?\}\}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_`>~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeFloorDifficulty(entryDifficulty: unknown, floor: number): FloorDifficulty {
  if (isFloorDifficulty(entryDifficulty) && isAllowedFloorDifficulty(entryDifficulty, floor)) return entryDifficulty
  if (floor <= 5) return 'hard'
  if (floor <= 10) return 'overlap'
  return 'extreme'
}

/** A floor's memo: the same block editor as the plan description and deck notes, with its own preview toggle. */
function FloorMemo({
  value,
  onChange,
  pool,
  formation,
  allowedKeywords,
  egoGiftLookup,
}: {
  value: string
  onChange: (v: string) => void
  pool: AutocompleteSuggestion[]
  formation: NoteFormationMember[]
  allowedKeywords?: Set<string>
  egoGiftLookup?: Record<string, NoteEgoGiftEntry>
}) {
  const [preview, setPreview] = useState(false)
  return (
    // 층 메모는 짧다: 편집기 기본 높이(24rem)를 줄인다
    <div className="[&_.note-document-content]:!min-h-[7rem] [&_.note-document-content]:!px-5 [&_.note-document-content]:!py-4 [&_.note-editor-preview]:!min-h-[7rem] [&_.note-editor-preview]:!p-4">
    <NoteDocumentEditor
      formation={formation}
      pool={pool}
      value={value}
      onChange={onChange}
      preview={preview}
      onPreviewChange={setPreview}
      previewContent={<NoteRenderer text={value} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />}
    />
    </div>
  )
}

interface FloorTabProps {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  themes: ThemeData[]
  gifts: GiftData[]
  recipes: RecipeData[]
  giftMap: Map<number, GiftData>
}

export default function FloorTab({ state, dispatch, themes, gifts, recipes, giftMap }: FloorTabProps) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.floorTab')
  const sinnerT = useTranslations('sinner')
  // 메모 편집기의 스킬·인격 넣기용 편성(편성 순서대로)
  const noteFormation = useMemo<NoteFormationMember[]>(() => [...state.identitySlots]
    .filter(slot => slot.slot_order < 99)
    .sort((a, b) => a.slot_order - b.slot_order)
    .map(slot => ({ identityId: slot.identity_id, sinnerId: slot.sinner_id, name: sinnerT(slot.sinner_id as Parameters<typeof sinnerT>[0]) })), [sinnerT, state.identitySlots])
  const shouldReduceMotion = useReducedMotion()
  const [activeFloor, setActiveFloor] = useState<number | null>(null)
  const [themeModalOpen, setThemeModalOpen] = useState(false)
  const [giftPickerOpen, setGiftPickerOpen] = useState(false)
  const tCopy = useTranslations('planner.floorCopy')
  const [copyConfirm, setCopyConfirm] = useState<{ floor: number; giftIds: string[] } | null>(null)
  const [finalGiftKeyword, setFinalGiftKeyword] = useState<string | null>(null)
  const [finalGiftGrade, setFinalGiftGrade] = useState<string | null>(null)
  const [dismissedFusionIds, setDismissedFusionIds] = useState<Set<string>>(() => new Set())
  const [fusionCollapsed, setFusionCollapsed] = useState(false)

  const themeMap = useMemo(() => new Map(themes.map(theme => [String(theme.id), theme])), [themes])
  const activeEntry = activeFloor === null ? undefined : state.floorPlan.find(entry => entry.floor === activeFloor)
  const activeDifficulty = activeEntry
    ? normalizeFloorDifficulty(activeEntry.difficulty, activeEntry.floor)
    : 'hard'
  const selectedTheme = activeEntry?.theme_id ? themeMap.get(activeEntry.theme_id) ?? null : null
  // What plans like this one took on the floor, asked only while one of the pickers is open.
  const fielded = state.identitySlots.filter(slot => slot.slot_order < 99).map(slot => slot.identity_id)
  const { data: floorSuggestions, loading: floorSuggestionsLoading } = useSuggestionState<{ themes: { id: string; count: number }[]; gifts: { id: string }[] }>(
    activeEntry && (themeModalOpen || giftPickerOpen)
      ? `/api/discovery/suggest?type=floor&floor=${activeEntry.floor}&identities=${fielded.join(',')}&keywords=${encodeURIComponent((state.mainKeywords ?? []).join(','))}`
      : null,
  )

  useEffect(() => {
    if (activeFloor !== null && !state.floorPlan.some(entry => entry.floor === activeFloor)) {
      setActiveFloor(null)
    }
  }, [activeFloor, state.floorPlan])

  useEffect(() => {
    const invalidEntry = state.floorPlan.find(entry => {
      const difficulty = normalizeFloorDifficulty(entry.difficulty, entry.floor)
      if (entry.difficulty !== difficulty) return true
      if (!entry.theme_id) return false

      const availableThemes = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], entry.floor)
      return !availableThemes.some(theme => String(theme.id) === entry.theme_id)
    })

    if (!invalidEntry) return

    const difficulty = normalizeFloorDifficulty(invalidEntry.difficulty, invalidEntry.floor)
    const availableThemes = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], invalidEntry.floor)
    const hasInvalidTheme = Boolean(
      invalidEntry.theme_id && !availableThemes.some(theme => String(theme.id) === invalidEntry.theme_id)
    )

    dispatch({
      type: 'SET_FLOOR_DIFFICULTY',
      floor: invalidEntry.floor,
      difficulty,
      clearSelection: hasInvalidTheme,
    })
  }, [dispatch, state.floorPlan, themes])

  const availableThemesByFloor = useMemo(() => {
    const map = new Map<number, ThemeData[]>()
    for (const entry of state.floorPlan) {
      const difficulty = normalizeFloorDifficulty(entry.difficulty, entry.floor)
      map.set(entry.floor, getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], entry.floor))
    }
    return map
  }, [state.floorPlan, themes])

  const activeAvailableThemes = activeEntry
    ? availableThemesByFloor.get(activeEntry.floor) ?? []
    : []

  const pickerThemes = useMemo(() => {
    if (!activeEntry) return []
    const usedThemeIds = new Set(
      state.floorPlan
        .filter(entry => entry.floor !== activeEntry.floor && entry.theme_id)
        .map(entry => entry.theme_id!)
    )
    return activeAvailableThemes.filter(theme => !usedThemeIds.has(String(theme.id)) || String(theme.id) === activeEntry.theme_id)
  }, [activeAvailableThemes, activeEntry, state.floorPlan])

  const kwContext = useKeywordData()
  const localizedGift = useCallback((gift: GiftData): GiftData => ({
    ...gift,
    name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale),
  }), [locale])

  const acPool = useMemo(() => {
    const kwPool = buildKeywordPool(kwContext.keywords)
    const giftPool = buildEgoGiftPool(
      gifts.filter(gift => gift.keyword && gift.name).map(gift => ({
        name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale),
        keyword: gift.keyword!,
        image_url: gift.image_url,
      }))
    )
    return [...kwPool, ...giftPool]
  }, [kwContext, gifts, locale])

  const allowedKeywords = useMemo(() => new Set(Object.keys(kwContext.keywords)), [kwContext.keywords])

  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const gift of gifts) {
      if (gift.name && gift.keyword) {
        const name = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
        map[name] = {
          name,
          keyword: gift.keyword,
          grade: gift.grade ?? '1',
          image_url: gift.image_url,
          effect_base: gift.effect_base,
        }
      }
    }
    return map
  }, [gifts, locale])

  // Stored picks (final_<id>[_plus|_plusplus]) versus the derived final set, which also holds start/observed gifts
  // and drops whatever a fusion result in it consumed.
  const storedFinalIds = useMemo(() => parseFinalGiftIds(state.giftInventory), [state.giftInventory])
  const derivedFinal = useMemo(
    () => deriveFinalGifts(state.giftInventory, recipes, giftMap),
    [giftMap, recipes, state.giftInventory],
  )
  const { gifts: finalEntries, consumed: blockedFinalMaterialIds } = derivedFinal
  const finalEntryById = useMemo(() => new Map(finalEntries.map(entry => [entry.id, entry])), [finalEntries])
  const finalGiftIds = useMemo(() => new Set(finalEntryById.keys()), [finalEntryById])

  useEffect(() => {
    if (blockedFinalMaterialIds.size === 0) return

    for (const blockedId of blockedFinalMaterialIds) {
      if (!storedFinalIds.has(blockedId)) continue
      for (const giftId of getFinalGiftVariantIds(blockedId)) {
        dispatch({ type: 'REMOVE_GIFT', giftId })
      }
    }
  }, [blockedFinalMaterialIds, dispatch, storedFinalIds])

  // 편성으로 발동 조건을 못 채우는 기프트에 조건 미달/위험 덮개를 씌운다(기프트 탭과 같은 판정)
  const conditionCounts = useMemo(() => getGiftConditionCountsForSlots(state.identitySlots), [state.identitySlots])
  const conditionOf = useCallback((gift: GiftData | undefined) => gift ? getGiftActivationConditionStatus({
    gift,
    ...conditionCounts,
  }) : null, [conditionCounts])

  const finalFloorGifts = useMemo(() => {
    return finalEntries
      .map(entry => giftMap.get(entry.id))
      .filter(Boolean)
      .map(gift => localizedGift(gift as GiftData))
  }, [finalEntries, giftMap, localizedGift])
  const showFinalFilters = finalFloorGifts.length >= FINAL_FILTER_MIN

  const finalGiftKeywordCounts = useMemo(() => {
    const counts = new Map<string | null, number>()
    counts.set(null, finalFloorGifts.length)
    for (const gift of finalFloorGifts) {
      const slug = getKeywordSlug(gift.keyword)
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    return counts
  }, [finalFloorGifts])

  const finalGiftGradeCounts = useMemo(() => {
    const counts = new Map<string | null, number>()
    counts.set(null, finalFloorGifts.length)
    for (const gift of finalFloorGifts) {
      const grade = gift.grade ?? '1'
      counts.set(grade, (counts.get(grade) ?? 0) + 1)
    }
    return counts
  }, [finalFloorGifts])

  const finalKeywordOptions = useMemo(() => {
    return Array.from(finalGiftKeywordCounts.entries())
      .filter(([slug, count]) => slug !== null && count > 0)
      .map(([slug, count]) => ({ slug: slug as string, count }))
      .sort((a, b) => FINAL_KEYWORD_ORDER.indexOf(a.slug) - FINAL_KEYWORD_ORDER.indexOf(b.slug))
  }, [finalGiftKeywordCounts])

  const filteredFinalGifts = useMemo(() => {
    const keyword = showFinalFilters ? finalGiftKeyword : null
    const gradeFilter = showFinalFilters ? finalGiftGrade : null
    return finalFloorGifts.filter(gift => {
      const slug = getKeywordSlug(gift.keyword)
      const grade = gift.grade ?? '1'
      if (keyword && slug !== keyword) return false
      if (gradeFilter && grade !== gradeFilter) return false
      return true
    })
  }, [finalFloorGifts, finalGiftGrade, finalGiftKeyword, showFinalFilters])

  const catalogFilters = useGiftCatalogFilters()
  const catalogGifts = useMemo(() => gifts.map(toCatalogGift), [gifts])
  const catalogSelectedIds = useMemo(() => new Set([...finalEntryById.keys()].map(String)), [finalEntryById])
  // Which picked result each blocked ingredient belongs to, for the disabled card's tooltip.
  const blockedBy = useMemo(() => {
    const map = new Map<number, string>()
    for (const entry of finalEntries) {
      const result = giftMap.get(entry.id)
      if (!result) continue
      for (const id of deriveBlockedFinalFusionMaterialIds({ selectedFinalGiftIds: [entry.id], recipes, giftMap })) {
        if (!map.has(id)) map.set(id, localizedGift(result).name)
      }
    }
    return map
  }, [finalEntries, giftMap, localizedGift, recipes])

  const craftableFusions = useMemo(() => {
    const inventory = Array.from(finalGiftIds).map(String)
    return findAvailableFusions(inventory, recipes, giftMap)
      .filter(fusion => (
        fusion.canCraft &&
        fusion.result &&
        !finalGiftIds.has(fusion.result.game_id) &&
        !dismissedFusionIds.has(fusion.result.game_id.toString())
      ))
  }, [dismissedFusionIds, finalGiftIds, giftMap, recipes])

  const suggestedFusion = craftableFusions[0]

  const applySuggestedFusion = useCallback(() => {
    if (!suggestedFusion?.result) return

    for (const material of suggestedFusion.materials) {
      for (const giftId of getFinalGiftVariantIds(material.game_id)) {
        dispatch({ type: 'REMOVE_GIFT', giftId })
      }
    }

    if (!finalGiftIds.has(suggestedFusion.result.game_id)) {
      dispatch({ type: 'ADD_GIFT', giftId: `final_${suggestedFusion.result.game_id}` })
    }
  }, [dispatch, finalGiftIds, suggestedFusion])

  const dismissSuggestedFusion = useCallback(() => {
    if (!suggestedFusion?.result) return
    const fusionId = suggestedFusion.result.game_id.toString()
    setDismissedFusionIds(prev => new Set(prev).add(fusionId))
  }, [suggestedFusion])

  const removeFinalGift = useCallback((giftGameId: number) => {
    for (const giftId of getFinalGiftVariantIds(giftGameId)) {
      dispatch({ type: 'REMOVE_GIFT', giftId })
    }
  }, [dispatch])

  const toggleFinalGift = useCallback((giftGameId: number) => {
    const entry = finalEntryById.get(giftGameId)
    if (entry) {
      // Start and observed gifts are set in the gift plan, not here.
      if (entry.source !== 'final') return
      removeFinalGift(giftGameId)
      return
    }
    if (blockedFinalMaterialIds.has(giftGameId)) return
    dispatch({ type: 'ADD_GIFT', giftId: `final_${giftGameId}` })
  }, [blockedFinalMaterialIds, dispatch, finalEntryById, removeFinalGift])

  const onCatalogGiftClick = useCallback((gift: EgoGift) => toggleFinalGift(Number(gift.id)), [toggleFinalGift])
  // 칸 속성은 (막힘 이유, 출처)가 같으면 같은 객체를 돌려준다: 448칸의 번역 호출과 비교를 누를 때마다 반복하지 않게
  const cardPropsCache = useMemo(() => new Map<string, GiftCatalogCardProps>(), [locale, t])
  const catalogCardProps = useCallback((gift: EgoGift): GiftCatalogCardProps => {
    const id = Number(gift.id)
    const blocked = blockedFinalMaterialIds.has(id)
    const source = finalEntryById.get(id)?.source
    const conditionStatus = blocked ? null : conditionOf(giftMap.get(id))
    const key = `${id}|${blocked ? blockedBy.get(id) ?? '' : '-'}|${source ?? ''}|${giftConditionKey(conditionStatus)}`
    const cached = cardPropsCache.get(key)
    if (cached) return cached
    const name = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
    let props: GiftCatalogCardProps
    if (blocked) {
      const label = t('finalBlockedByRecipe', { gift: name, result: blockedBy.get(id) ?? '' })
      props = { disabled: true, title: label, ariaLabel: label }
    } else {
      const label = source === 'start' || source === 'observe'
        ? `${name}. ${t(source === 'start' ? 'finalAutoStart' : 'finalAutoObserve')}`
        : source ? t('removeAlreadyAddedGift', { gift: name }) : t('addFinalGift', { gift: name })
      props = { title: label, ariaLabel: label, conditionStatus, conditionDetail: false }
    }
    cardPropsCache.set(key, props)
    return props
  }, [blockedBy, blockedFinalMaterialIds, cardPropsCache, conditionOf, finalEntryById, giftMap, locale, t])

  // Keeps a pick's place in the inventory and swaps only its level suffix. 인벤토리는 ref로 읽어 함수가 바뀌지 않게 한다(타일 memo 유지).
  const inventoryRef = useRef(state.giftInventory)
  useLayoutEffect(() => { inventoryRef.current = state.giftInventory })
  const setFinalEnhance = useCallback((entry: FinalGift, level: number) => {
    const { oldId, newId } = finalEnhanceEdit(inventoryRef.current, entry, level)
    if (oldId && newId) dispatch({ type: 'REPLACE_GIFT', oldId, newId })
    else if (newId) dispatch({ type: 'ADD_GIFT', giftId: newId })
    else if (oldId) dispatch({ type: 'REMOVE_GIFT', giftId: oldId })
  }, [dispatch])

  const selectTheme = useCallback((themeId: string | null) => {
    if (!activeEntry) return
    dispatch({ type: 'SET_FLOOR_THEME', floor: activeEntry.floor, themeId })
    setThemeModalOpen(false)
    setGiftPickerOpen(false)
  }, [activeEntry, dispatch])

  const setDifficulty = useCallback((difficulty: FloorDifficulty) => {
    if (!activeEntry || activeEntry.floor > 5) return
    const nextThemes = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], activeEntry.floor)
    const selectedStillValid = !activeEntry.theme_id || nextThemes.some(theme => String(theme.id) === activeEntry.theme_id)
    dispatch({
      type: 'SET_FLOOR_DIFFICULTY',
      floor: activeEntry.floor,
      difficulty,
      clearSelection: !selectedStillValid,
    })
    if (!selectedStillValid) setGiftPickerOpen(false)
  }, [activeEntry, dispatch, themes])

  const toggleGiftId = useCallback((giftGameId: string, currentIds: string[]) => {
    if (!activeEntry) return
    if (currentIds.includes(giftGameId)) {
      dispatch({ type: 'SET_FLOOR_GIFTS', floor: activeEntry.floor, giftIds: currentIds.filter(id => id !== giftGameId) })
      const selectedOnAnotherFloor = state.floorPlan.some(entry => (
        entry.floor !== activeEntry.floor && entry.gift_ids.includes(giftGameId)
      ))
      if (!selectedOnAnotherFloor) {
        const gid = parseInt(giftGameId, 10)
        if (!Number.isNaN(gid)) {
          for (const giftId of getFinalGiftVariantIds(gid)) {
            dispatch({ type: 'REMOVE_GIFT', giftId })
          }
        }
      }
    } else {
      const gid = parseInt(giftGameId, 10)
      if (Number.isNaN(gid)) return
      // 층 계획은 최종 조합이 소비하는 재료도 고를 수 있다. 최종 기프트에는 넣지 않는다(REQ-PLANNER-018).
      dispatch({ type: 'SET_FLOOR_GIFTS', floor: activeEntry.floor, giftIds: [...currentIds, giftGameId] })
      const finalKey = finalKeyForFloorPick(gid, derivedFinal)
      if (finalKey) dispatch({ type: 'ADD_GIFT', giftId: finalKey })
    }
  }, [activeEntry, derivedFinal, dispatch, state.floorPlan])

  const copyGifts = (floor: number, giftIds: string[]) => {
    dispatch({ type: 'SET_FLOOR_GIFTS', floor, giftIds })
    showSuccess(tCopy('copied', { floor: floor - 1 }))
  }
  const copyPreviousFloor = (entry: FloorEntry) => {
    const giftIds = previousFloorGifts(state.floorPlan, entry.floor)
    if (entry.gift_ids.length) setCopyConfirm({ floor: entry.floor, giftIds })
    else copyGifts(entry.floor, giftIds)
  }

  function getThemeAvailableGifts(theme: ThemeData): GiftData[] {
    // 일반 풀 + 전용 풀·보스 보상(어시스트와 같은 규칙). 보스 러시류(1511~1520)는 보상 기프트가 일반 풀에 없어 빠졌었다.
    return getGiftsFromThemes([theme.id], [theme], giftMap).map(localizedGift)
  }

  const shouldReduceScroll = shouldReduceMotion
  const rowRefs = useRef(new Map<number, HTMLLIElement>())
  // Viewport top of the row being opened, so collapsing a row above it doesn't yank it upward.
  const openAnchor = useRef<{ floor: number, top: number } | null>(null)

  useLayoutEffect(() => {
    const anchor = openAnchor.current
    openAnchor.current = null
    const row = anchor && anchor.floor === activeFloor ? rowRefs.current.get(anchor.floor) : null
    if (!anchor || !row) return
    const shift = row.getBoundingClientRect().top - anchor.top
    if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: 'instant' })
  }, [activeFloor])

  useEffect(() => {
    if (activeFloor === null) return
    // Collapsing the previous row can move the opened one out of view; measure once layout has settled.
    const frame = requestAnimationFrame(() => {
      const row = rowRefs.current.get(activeFloor)
      if (!row) return
      const { top } = row.getBoundingClientRect()
      if (top < 0 || top > window.innerHeight * 0.6) {
        row.scrollIntoView({ block: 'start', behavior: shouldReduceScroll ? 'auto' : 'smooth' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [activeFloor, shouldReduceScroll])

  function openFloor(floor: number) {
    if (floor === activeFloor) return
    const row = rowRefs.current.get(floor)
    if (row) openAnchor.current = { floor, top: row.getBoundingClientRect().top }
    setActiveFloor(floor)
    setThemeModalOpen(false)
    setGiftPickerOpen(false)
  }

  function toggleFloor(floor: number) {
    if (floor !== activeFloor) {
      openFloor(floor)
      return
    }
    setActiveFloor(null)
    setThemeModalOpen(false)
    setGiftPickerOpen(false)
  }

  function getFloorGifts(entry: FloorEntry, theme: ThemeData | null) {
    return withThemeRewards(entry.gift_ids, theme)
      .map(id => giftMap.get(parseInt(id, 10)))
      .filter((gift): gift is GiftData => Boolean(gift))
      .map(localizedGift)
  }

  const themeName = (theme: ThemeData) => getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, locale)
  const activeThemeName = selectedTheme ? themeName(selectedTheme) : null
  // 최종 조합이 소비하는 재료도 층에서 얻는 기프트라 목록에 둔다(REQ-PLANNER-018)
  const availableGifts = selectedTheme ? getThemeAvailableGifts(selectedTheme) : []
  // 이 층에서 얻을 수 있는 전체: 다른 테마팩 전용 기프트만 뺀다(합성·조합식 결과는 포함)
  const reachableGifts = useMemo(() => {
    const ownExclusive = new Set(selectedTheme ? themeExclusiveGiftIds(selectedTheme) : [])
    const otherExclusive = new Set(themes.flatMap(theme => themeExclusiveGiftIds(theme)).filter(id => !ownExclusive.has(id)))
    return gifts.filter(gift => !otherExclusive.has(gift.game_id))
  }, [gifts, selectedTheme, themes])
  const exclusiveLabel = t('ladder.packExclusive')
  const configuredCount = state.floorPlan.filter(isConfiguredFloor).length
  const segments = LADDER_SEGMENTS
    .map(segment => ({ ...segment, entries: state.floorPlan.filter(entry => entry.floor >= segment.start && entry.floor <= segment.end) }))
    .filter(segment => segment.entries.length > 0)

  // A hairline rail; the open floor's stretch lights up so the eye finds it.
  const railClass = 'pointer-events-none absolute inset-y-0 left-[0.875rem] w-[0.125rem] sm:left-[1.375rem]'
  const railStyle = (tone: string, lit = false) => ({ background: tone, opacity: lit ? 0.9 : 0.35 })
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]'

  function renderEditor(entry: FloorEntry, floorGifts: GiftData[]) {
    const plannedIds = new Set(entry.gift_ids)
    return (
      <div
        id={`floor-editor-${entry.floor}`}
        className="rounded-sm border p-3 sm:p-4"
        style={{ background: '#17120c', borderColor: '#2e2417' }}
      >
        {/* 포스터 옆에 테마팩 이름·난이도·접기·버튼과 획득 기프트를 모은다. 모바일에서는 기프트가 전체 폭으로 내려간다. */}
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:grid-rows-[auto_1fr]">
          <div className="min-w-0 sm:row-span-2">
            {selectedTheme ? (
              <ThemePackCard
                theme={selectedTheme}
                lang={locale}
                sizes="(max-width: 640px) 104px, 144px"
                ariaLabel={t('ladder.changeThemeAria', { floor: entry.floor, theme: activeThemeName ?? selectedTheme.name })}
                onClick={() => setThemeModalOpen(true)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setThemeModalOpen(true)}
                disabled={pickerThemes.length === 0}
                aria-label={t('selectTheme')}
                className={`flex aspect-[416/684] w-full items-center justify-center rounded-sm border border-dashed transition-colors hover:border-[var(--gold)] hover:text-[var(--gold-light)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                style={{ borderColor: '#4a3b28', background: '#120e09', color: '#6a6058' }}
              >
                <Plus size={28} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1 basis-40">
                <h4
                  className="text-[1.25rem] leading-snug"
                  style={{ fontFamily: 'var(--font-heading)', color: activeThemeName ? '#e8b030' : '#9c8b73' }}
                >
                  {activeThemeName ?? t('noTheme')}
                </h4>
                <p className="mt-0.5 text-sm" style={{ color: '#9c8b73' }}>
                  {selectedTheme
                    ? t('themeGiftCount', { count: getThemeGiftCount(selectedTheme) })
                    : pickerThemes.length > 0 ? t('availableThemeCount', { count: pickerThemes.length }) : t('emptyThemes')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {entry.floor <= 5 ? (
                  <div
                    role="group"
                    className="flex rounded-md border p-0.5"
                    style={{ background: '#0d0b08', borderColor: '#2e2417' }}
                    aria-label={t('difficultySelectorLabel', { floor: entry.floor })}
                  >
                    {(['normal', 'hard'] as const).map(difficulty => {
                      const selected = activeDifficulty === difficulty
                      return (
                        <button
                          key={difficulty}
                          type="button"
                          onClick={() => setDifficulty(difficulty)}
                          aria-pressed={selected}
                          className={`min-h-[2.5rem] rounded px-3.5 text-sm font-semibold transition-colors ${focusRing}`}
                          style={{
                            background: selected ? 'rgba(200,144,10,0.2)' : 'transparent',
                            color: selected ? '#e8b030' : '#9c8b73',
                          }}
                        >
                          {t(`difficulty.${difficulty}`)}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <ThemePackModalPill tone={activeDifficulty === 'extreme' ? 'red' : 'gold'}>
                    {t(`difficulty.${activeDifficulty}`)}
                  </ThemePackModalPill>
                )}
                <button
                  type="button"
                  onClick={() => toggleFloor(entry.floor)}
                  aria-label={t('ladder.collapse', { floor: entry.floor })}
                  title={t('ladder.collapseShort')}
                  className={`grid h-[2.75rem] w-[2.75rem] place-items-center rounded-md transition-colors hover:bg-white/5 hover:text-[#e8dcc8] ${focusRing}`}
                  style={{ color: '#9c8b73' }}
                >
                  <ChevronUp size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setThemeModalOpen(true)}
                disabled={pickerThemes.length === 0}
                className={`min-h-[2.75rem] rounded-md border px-4 text-[0.9375rem] font-semibold transition-colors hover:bg-[rgba(200,144,10,0.2)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                style={{ borderColor: 'rgba(200,144,10,0.4)', background: 'rgba(200,144,10,0.12)', color: '#e8b030' }}
              >
                {selectedTheme ? t('changeTheme') : t('selectTheme')}
              </button>
              {selectedTheme && (
                <button
                  type="button"
                  onClick={() => selectTheme(null)}
                  className={`min-h-[2.75rem] rounded-md border px-3 text-[0.9375rem] transition-colors hover:bg-white/5 ${focusRing}`}
                  style={{ borderColor: '#2e2417', color: '#9c8b73' }}
                >
                  {t('clearTheme')}
                </button>
              )}
              {selectedTheme && previousFloorGifts(state.floorPlan, entry.floor).length > 0 && (
                <button
                  type="button"
                  onClick={() => copyPreviousFloor(entry)}
                  className={`min-h-[2.75rem] rounded-md border px-3 text-[0.9375rem] transition-colors hover:bg-white/5 ${focusRing}`}
                  style={{ borderColor: '#2e2417', color: '#9c8b73' }}
                >
                  {tCopy('copyPrevious')}
                </button>
              )}
            </div>
          </div>

          <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
            <h5 className="mb-2 text-[0.9375rem]" style={{ fontFamily: 'var(--font-heading)', color: '#e8dcc8' }}>
              {t('acquiredGiftCount', { count: floorGifts.length })}
            </h5>
            <div className="flex flex-wrap items-start gap-2">
              {floorGifts.map(gift => {
                const warning = selectedTheme && themeExclusiveGiftIds(selectedTheme).includes(gift.game_id) ? exclusiveLabel : undefined
                if (!plannedIds.has(String(gift.game_id))) {
                  return (
                    <div key={gift.game_id} className="w-[4rem]">
                      <GiftCard
                        gift={gift}
                        size="4rem"
                        showName={false}
                        warning={warning}
                        onClick={() => undefined}
                        title={t('ladder.rewardTitle', { gift: gift.name })}
                        ariaLabel={t('ladder.rewardTitle', { gift: gift.name })}
                      />
                      <span className="mt-1 block text-center text-[0.75rem]" style={{ color: '#9c8b73' }}>{t('ladder.reward')}</span>
                    </div>
                  )
                }
                return (
                  <GiftCard
                    key={gift.game_id}
                    gift={gift}
                    size="4rem"
                    showName={false}
                    warning={warning}
                    onClick={() => toggleGiftId(String(gift.game_id), entry.gift_ids)}
                    onRemove={() => toggleGiftId(String(gift.game_id), entry.gift_ids)}
                  />
                )
              })}
              <GiftCard
                gift={{ name: t('addGift') }}
                variant="insert"
                size="4rem"
                showName
                ariaLabel={t('giftPickerTitle')}
                onClick={() => setGiftPickerOpen(true)}
              />
            </div>
          </div>

          <ConfirmModal
            open={copyConfirm !== null}
            title={tCopy('replaceTitle')}
            message={tCopy('copyPrevious')}
            confirmLabel={tCopy('replaceConfirm')}
            variant="warning"
            onConfirm={() => { if (copyConfirm) copyGifts(copyConfirm.floor, copyConfirm.giftIds); setCopyConfirm(null) }}
            onCancel={() => setCopyConfirm(null)}
          />
          <FloorGiftPickerModal
            open={giftPickerOpen}
            title={t('floorGiftPickerTitle', { floor: entry.floor })}
            floorGifts={selectedTheme ? availableGifts : null}
            allGifts={reachableGifts}
            exclusiveIds={selectedTheme ? themeExclusiveGiftIds(selectedTheme) : []}
            showRecent
            suggestedIds={floorSuggestions?.gifts.map(gift => gift.id)}
            suggestionsLoading={floorSuggestionsLoading}
            selectedIds={plannedIds}
            onToggle={gift => toggleGiftId(String(gift.game_id), entry.gift_ids)}
            onClose={() => setGiftPickerOpen(false)}
          />
        </div>

        <FloorConstraints floor={entry.floor} entries={state.floorPlan} onChange={ids => dispatch({ type: 'SET_FLOOR_CONSTRAINTS', floor: entry.floor, ids })} />
        <FloorGuidance entry={entry} entries={state.floorPlan} inventory={state.giftInventory} recipes={recipes} gifts={giftMap} />

        <div className="mt-5">
          <h5 className="mb-2 text-[0.9375rem]" style={{ fontFamily: 'var(--font-heading)', color: '#e8dcc8' }}>
            {t('memo')}
          </h5>
          <FloorMemo
            value={entry.memo}
            onChange={memo => dispatch({ type: 'SET_FLOOR_MEMO', floor: entry.floor, memo })}
            pool={acPool}
            formation={noteFormation}
            allowedKeywords={allowedKeywords}
            egoGiftLookup={egoGiftLookup}
          />
        </div>
      </div>
    )
  }

  function renderSummary(entry: FloorEntry, theme: ThemeData | null, floorGifts: GiftData[]) {
    const difficulty = normalizeFloorDifficulty(entry.difficulty, entry.floor)
    const memoPreview = getMemoPreview(entry.memo)
    return (
      // The floor number is the keyboard control; clicking anywhere on the row is a pointer shortcut.
      <div
        className="-m-1 flex cursor-pointer gap-3 rounded-sm p-1 transition-colors hover:bg-[rgba(200,144,10,0.05)] sm:gap-4"
        onClick={() => openFloor(entry.floor)}
      >
        <div className="w-[3.5rem] shrink-0 sm:w-[4rem]">
          {theme ? (
            <ThemePackCard
              theme={theme}
              lang={locale}
              sizes="(max-width: 640px) 56px, 64px"
              ariaLabel={t('ladder.expand', { floor: entry.floor })}
              onClick={() => openFloor(entry.floor)}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-[3rem] items-center justify-center rounded-sm border border-dashed"
              style={{ borderColor: '#3a2f22', color: '#5c4f3e' }}
            >
              <Plus size={18} />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-sm font-semibold" style={{ color: getDifficultyTone(difficulty) }}>
              {t(`difficulty.${difficulty}`)}
            </span>
            <span
              className={`min-w-0 leading-snug ${theme ? 'text-[1rem]' : 'text-[0.9375rem]'}`}
              style={{ fontFamily: theme ? 'var(--font-heading)' : undefined, color: theme ? '#e8dcc8' : '#6a6058' }}
            >
              {theme ? themeName(theme) : t('ladder.emptyHint')}
            </span>
          </p>
          {floorGifts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {floorGifts.map(gift => (
                <GiftCard
                  key={gift.game_id}
                  gift={gift}
                  size="clamp(2.75rem, 2.4rem + 0.6vw, 3.25rem)"
                  showName={false}
                  warning={themeExclusiveGiftIds(theme).includes(gift.game_id) ? exclusiveLabel : undefined}
                  title={entry.gift_ids.includes(String(gift.game_id)) ? gift.name : t('ladder.rewardTitle', { gift: gift.name })}
                  onClick={() => openFloor(entry.floor)}
                />
              ))}
            </div>
          )}
          {memoPreview && (
            <p className="line-clamp-2 max-w-[48rem] text-sm leading-relaxed" style={{ color: '#9c8b73' }}>
              {memoPreview}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10" data-floor-plan>
      <section aria-label={t('ladder.title')}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[0.9375rem]" style={{ color: '#9c8b73' }}>{t('ladder.hint')}</p>
          <p className="text-[0.9375rem] tabular-nums" style={{ color: '#9c8b73' }}>
            {t('configuredFloorCount', { configured: configuredCount, total: state.floorPlan.length })}
          </p>
        </div>

        {segments.map(segment => (
          <div key={segment.id}>
            <div className="grid grid-cols-[3.75rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)]">
              <span className="relative" aria-hidden="true">
                <span className={railClass} style={railStyle(segment.rail)} />
              </span>
              <h3
                className="border-b pb-2 pt-5 text-[0.9375rem]"
                style={{ fontFamily: 'var(--font-heading)', color: segment.label, borderColor: '#2e2417' }}
              >
                {t(`ladder.segment.${segment.id}`, { start: segment.entries[0].floor, end: segment.entries[segment.entries.length - 1].floor })}
              </h3>
            </div>
            <ol>
              {segment.entries.map(entry => {
                const isOpen = entry.floor === activeFloor
                const theme = entry.theme_id ? themeMap.get(entry.theme_id) ?? null : null
                const planned = isConfiguredFloor(entry)
                const floorGifts = getFloorGifts(entry, theme)
                return (
                  <li
                    key={entry.floor}
                    ref={element => {
                      if (element) rowRefs.current.set(entry.floor, element)
                      else rowRefs.current.delete(entry.floor)
                    }}
                    data-floor-row={entry.floor}
                    className="grid grid-cols-[3.75rem_minmax(0,1fr)] sm:grid-cols-[6rem_minmax(0,1fr)]"
                    style={{ scrollMarginTop: '5rem' }}
                  >
                    <div className="relative">
                      <span className={railClass} style={railStyle(segment.rail, isOpen)} aria-hidden="true" />
                      <button
                        type="button"
                        data-floor-toggle
                        onClick={() => toggleFloor(entry.floor)}
                        aria-expanded={isOpen}
                        aria-controls={isOpen ? `floor-editor-${entry.floor}` : undefined}
                        aria-label={t(isOpen ? 'ladder.collapse' : 'ladder.expand', { floor: entry.floor })}
                        className={`relative ml-[1.375rem] mt-2 flex min-h-[2.75rem] min-w-[2.75rem] items-start rounded-sm leading-none tabular-nums sm:ml-[2.125rem] ${focusRing}`}
                        style={{
                          fontFamily: 'var(--font-title)',
                          fontSize: 'clamp(2.125rem, 1.6rem + 1.6vw, 3.25rem)',
                          color: isOpen ? '#e8b030' : planned ? '#e8dcc8' : '#5c4f3e',
                        }}
                      >
                        {entry.floor}
                      </button>
                    </div>
                    <div className="min-w-0 border-b py-3" style={{ borderColor: '#2e2417' }}>
                      {isOpen ? renderEditor(entry, floorGifts) : renderSummary(entry, theme, floorGifts)}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </section>

      <section aria-labelledby="final-gifts-title" className="relative border-t pt-5 lg:-ml-[var(--planner-rail-w,0rem)]" style={{ borderColor: '#2e2417' }}>
        {/* 이 영역은 처음부터 목차 레일 자리까지 넓다. 여기에 오면 레일 대신 위쪽 가로 막대가 겹쳐 나타난다(PlannerClient가 관찰) */}
        <div data-final-gifts-start aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-px" />
        <div className="mb-1 flex items-baseline gap-2">
          <h3 id="final-gifts-title" className="text-[1.25rem] leading-tight" style={{ fontFamily: 'var(--font-heading)', color: '#e8dcc8' }}>
            {t('finalGifts')}
          </h3>
          <span className="tabular-nums leading-none" style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', color: '#c8900a' }}>
            <span aria-hidden="true">{finalFloorGifts.length}</span>
            <span className="sr-only">{t('finalGiftCount', { count: finalFloorGifts.length })}</span>
          </span>
          <FinalGiftPresets inventory={state.giftInventory} dispatch={dispatch} giftMap={giftMap} />
        </div>

        {showFinalFilters && (
          <div className="mb-3 sm:flex sm:items-center sm:border-b sm:border-[#2e2417]">
            {/* 미러 던전 기프트 목록의 도구줄과 같은 부품: 키워드 밑줄 탭 + 등급 칩, 수는 작고 흐리게 */}
            <div role="group" aria-label={t('keywordDistribution')} className="flex min-w-0 overflow-x-auto border-b border-[#2e2417] [scrollbar-width:none] sm:flex-1 sm:border-b-0 [&::-webkit-scrollbar]:hidden">
              {[{ slug: null as string | null, count: finalGiftKeywordCounts.get(null) ?? 0 }, ...finalKeywordOptions].map(({ slug, count }) => {
                const key = !slug ? '전체' : slug === 'general' ? '공통' : SLUG_TO_KEYWORD[slug] ?? slug
                return (
                  <GiftKeywordTab
                    key={slug ?? 'all'}
                    label={giftKeywordLabel(key, locale)}
                    iconUrl={slug ? giftKeywordIcon(key) : null}
                    color={slug ? GIFT_KEYWORD_COLORS[key] ?? '#9c8b73' : undefined}
                    active={(finalGiftKeyword ?? null) === slug}
                    count={count}
                    onClick={() => setFinalGiftKeyword(finalGiftKeyword === slug || !slug ? null : slug)}
                  />
                )
              })}
            </div>
            <div role="group" aria-label={t('finalGradeFilter')} className="mt-2 flex items-center gap-0.5 sm:ml-3 sm:mt-0 sm:shrink-0">
              {FINAL_GIFT_GRADE_ORDER.map(grade => {
                const count = finalGiftGradeCounts.get(grade) ?? 0
                if (count === 0) return null
                return (
                  <GiftGradeChip
                    key={grade}
                    grade={grade}
                    ariaLabel={`${t('finalGradeFilter')} ${GRADE_ROMAN[grade] ?? grade}`}
                    active={finalGiftGrade === grade}
                    count={count}
                    onClick={() => setFinalGiftGrade(finalGiftGrade === grade ? null : grade)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {finalFloorGifts.length === 0 ? (
          <p className="border-y border-dashed py-5 text-center text-[0.9375rem]" style={{ borderColor: '#2e2417', color: '#9c8b73' }}>
            {t('finalGiftEmpty')}
          </p>
        ) : filteredFinalGifts.length === 0 ? (
          <p className="px-4 py-5 text-center text-[0.9375rem]" style={{ color: '#9c8b73' }}>{t('finalGiftNoResults')}</p>
        ) : (
          <ul aria-label={t('finalSelectedPanel')} className="grid grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] justify-items-center gap-x-2.5 gap-y-3 pt-1 sm:grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] sm:gap-x-3">
            {filteredFinalGifts.map(gift => {
              const entry = finalEntryById.get(gift.game_id)
              if (!entry) return null
              return (
                <FinalGiftTile
                  key={gift.game_id}
                  gift={gift}
                  entry={entry}
                  conditionStatus={conditionOf(giftMap.get(gift.game_id))}
                  onEnhance={setFinalEnhance}
                  onRemove={removeFinalGift}
                />
              )
            })}
          </ul>
        )}

        <div className="mt-5">
          <h4 className="mb-2 text-[0.9375rem]" style={{ fontFamily: 'var(--font-heading)', color: '#e8dcc8' }}>{t('allGiftCatalog')}</h4>
          {/* 페이지 흐름 안에 둔다(스크롤은 창 하나). 도구줄은 사이트 메뉴와 플래너 가로 목차 아래에 붙고, 결과 칸은 필터를 바꿔도 페이지가 줄지 않게 한 화면 높이를 확보한다. */}
          <div
            className="border-t px-0.5 pb-3"
            style={{
              borderColor: '#2e2417',
              '--gift-catalog-bg': '#0d0b08',
              '--gift-catalog-sticky-top': 'calc(var(--nav-offset, 4rem) + var(--planner-bar-h, 0rem))',
              '--gift-catalog-min-h': 'calc(100dvh - var(--gift-catalog-sticky-top) - 6rem)',
            } as React.CSSProperties}
          >
            <GiftCatalog
              compact
              gifts={catalogGifts}
              getGiftKeywordIcon={giftKeywordIcon}
              filters={catalogFilters}
              selectedIds={catalogSelectedIds}
              onGiftClick={onCatalogGiftClick}
              cardProps={catalogCardProps}
            />
          </div>
        </div>
      </section>

      {suggestedFusion?.result && (() => {
        const result = localizedGift(suggestedFusion.result)
        const materials = suggestedFusion.materials.map(localizedGift)
        const applyLabel = t('fusionAlertApply', { gift: result.name })
        const iconButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-[#9c8b73] transition-colors hover:text-[#e8dcc8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-light)]'
        return (
          // 페이지 이동 버튼(PageNavigation, 오른쪽 아래 2.75rem 폭) 바로 왼쪽에 붙는다: 오른쪽 여백 = 그 버튼 여백 + 폭 + 테두리 + 간격
          <aside
            aria-live="polite"
            aria-labelledby="fusion-alert-title"
            className={`fixed bottom-[max(0.875rem,env(safe-area-inset-bottom))] right-[calc(max(0.875rem,env(safe-area-inset-right))_+_3.375rem)] z-20 rounded-lg border ${fusionCollapsed ? '' : 'left-3 sm:left-auto sm:w-[20rem]'}`}
            style={{ background: '#17120c', borderColor: 'rgba(200,144,10,0.4)', boxShadow: '0 0.25rem 1rem #0009' }}
          >
            {fusionCollapsed ? (
              <div className="flex items-center pl-1.5">
                <span inert className="w-8" title={result.name}><GiftCard gift={result} size="100%" showName={false} onClick={applySuggestedFusion} /></span>
                <button
                  type="button"
                  data-fusion-toggle
                  aria-expanded={false}
                  title={t('fusionAlertExpand')}
                  onClick={() => setFusionCollapsed(false)}
                  className="flex h-11 items-center gap-2 rounded-r-lg pl-2 pr-2.5 text-[0.875rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-light)]"
                  style={{ color: '#e8b030', fontFamily: 'var(--font-heading)' }}
                >
                  <span id="fusion-alert-title">{t('fusionAlertTitle')}</span>
                  {craftableFusions.length > 1 && <span className="tabular-nums" style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', color: '#c8900a' }}>{craftableFusions.length}</span>}
                  <ChevronUp size={16} aria-hidden="true" className="text-[#9c8b73]" />
                </button>
              </div>
            ) : (
              <div className="pb-3 pl-3.5">
                <div className="flex items-center gap-2">
                  <h3 id="fusion-alert-title" className="min-w-0 flex-1 text-[0.9375rem]" style={{ color: '#e8b030', fontFamily: 'var(--font-heading)' }}>
                    {t('fusionAlertTitle')}
                    {craftableFusions.length > 1 && <span className="ml-1.5 tabular-nums" style={{ fontFamily: 'var(--font-title)', fontSize: '1.0625rem', color: '#c8900a' }}>{craftableFusions.length}</span>}
                  </h3>
                  <div className="flex">
                    <button type="button" data-fusion-toggle aria-expanded aria-label={t('fusionAlertCollapse')} title={t('fusionAlertCollapse')} onClick={() => setFusionCollapsed(true)} className={iconButton}>
                      <ChevronUp size={16} aria-hidden="true" className="rotate-180" />
                    </button>
                    <button type="button" onClick={dismissSuggestedFusion} aria-label={t('fusionAlertDismiss')} title={t('fusionAlertDismiss')} className={iconButton}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* 재료 아이콘 + … = 결과. 아이콘은 보기 전용이고 반영은 아래 버튼 하나로 한다 */}
                <div className="flex items-center gap-2 pr-3.5">
                  <p className="sr-only">{t('fusionAlertMaterials')}: {materials.map(gift => gift.name).join(', ')}</p>
                  <ul inert className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1.5">
                    {materials.map((gift, index) => (
                      <li key={gift.game_id} className="flex items-center gap-1" title={gift.name}>
                        {index > 0 && <span aria-hidden="true" className="text-[0.8125rem] text-[#6b5d4b]">+</span>}
                        <span className="w-11"><GiftCard gift={gift} size="100%" showName={false} onClick={applySuggestedFusion} /></span>
                      </li>
                    ))}
                  </ul>
                  <span aria-hidden="true" className="shrink-0 text-[1rem] text-[#9c8b73]">=</span>
                  <span inert className="w-14 shrink-0" title={result.name}><GiftCard gift={result} size="100%" showName={false} onClick={applySuggestedFusion} /></span>
                </div>

                <div className="mt-2.5 flex items-end gap-3 pr-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] text-[#e8dcc8]" style={{ fontFamily: 'var(--font-heading)' }} title={result.name}>{result.name}</p>
                    <p className="mt-0.5 break-keep text-[0.75rem] leading-snug text-[#9c8b73]">{t('fusionAlertHint')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={applySuggestedFusion}
                    aria-label={applyLabel}
                    className="h-9 shrink-0 rounded px-3.5 text-[0.875rem] font-bold transition-colors hover:bg-[#e8b030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17120c]"
                    style={{ background: '#c8900a', color: '#0d0b08' }}
                  >
                    {t('fusionAlertApplyShort')}
                  </button>
                </div>
              </div>
            )}
          </aside>
        )
      })()}

      {themeModalOpen && activeEntry && (
        <ThemePackPickerModal
          title={t('themeModalTitle', { floor: activeEntry.floor })}
          closeLabel={t('close')}
          emptyLabel={t('emptyThemes')}
          searchLabel={t('themeSearch')}
          noResultsLabel={t('themeSearchEmpty')}
          countLabel={count => t('themeResultCount', { count })}
          searchText={theme => [theme.name, theme.name_en, theme.name_jp, ...[...(theme.ego_gift_ids ?? []), ...(theme.specific_ego_gift_ids ?? [])]
            .flatMap(id => { const gift = giftMap.get(id); return gift ? [gift.name, gift.name_en, gift.name_jp] : [] })].join(' ')}
          themes={pickerThemes}
          suggested={floorSuggestions?.themes}
          suggestionsLoading={floorSuggestionsLoading}
          selectedThemeId={activeEntry.theme_id}
          lang={locale}
          onClose={() => setThemeModalOpen(false)}
          onSelectTheme={theme => selectTheme(String(theme.id))}
          meta={
            <ThemePackModalPill tone={activeDifficulty === 'extreme' ? 'red' : activeDifficulty === 'overlap' ? 'purple' : activeDifficulty === 'hard' ? 'gold' : 'neutral'}>
              {t(`difficulty.${activeDifficulty}`)}
            </ThemePackModalPill>
          }
        />
      )}
    </div>
  )
}
