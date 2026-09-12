'use client'

import { isConfiguredFloor } from '@/lib/planner/stripPlanForList'

import FloorConstraints from './FloorConstraints'
import FloorGuidance from './FloorGuidance'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Package, Plus, Search, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import GiftCard from '@/components/ui/GiftCard'
import {
  ThemePackModalPill,
  ThemePackPickerModal,
} from '@/components/ui/ThemePackModal'
import {
  getThemePackCompositeImageUrl,
  getThemePackVisualConfig,
} from '@/lib/data/theme-pack-visuals'
import { GRADE_COLORS, GRADE_ROMAN, SLUG_TO_KEYWORD, getKeywordSlug } from '@/components/planner/gift-plan/constants'
import type { PlannerState, PlannerAction, ThemeData, GiftData, FloorDifficulty, RecipeData } from '@/lib/planner/types'
import { DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import {
  deriveBlockedFinalFusionMaterialIds,
  findAvailableFusions,
  getAvailableThemes,
  getFinalGiftVariantIds,
  parseFinalGiftIds,
} from '@/lib/planner/fusion'
import { isAllowedFloorDifficulty, isFloorDifficulty } from '@/lib/planner/floor-difficulty'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import {
  useNoteAutocomplete,
  NoteAutocompleteDropdown,
  buildKeywordPool,
  buildEgoGiftPool,
  type AutocompleteSuggestion,
} from '@/components/notes/NoteAutocomplete'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { staggerContainer, workbenchStaggerItem } from '@/lib/animations'

const FLOOR_SEGMENTS = [
  { id: 'early', start: 1, end: 5, tone: '#c8900a' },
  { id: 'loop', start: 6, end: 10, tone: '#9070b0' },
  { id: 'extreme', start: 11, end: 15, tone: '#d04a3a' },
] as const

const FINAL_GIFT_GRADE_ORDER = ['EX', '5', '4', '3', '2', '1']

function buildGiftSearchText(gift: GiftData) {
  return [
    gift.name,
    gift.name_en,
    gift.name_jp,
    gift.keyword,
    gift.effect_base,
  ].filter(Boolean).join(' ').toLocaleLowerCase()
}

function getDifficultyTone(difficulty: FloorDifficulty) {
  if (difficulty === 'extreme') return '#d04a3a'
  if (difficulty === 'overlap') return '#9070b0'
  if (difficulty === 'hard') return '#e89030'
  return '#9ca3af'
}

function getFloorSegment(floor: number) {
  return FLOOR_SEGMENTS.find(segment => floor >= segment.start && floor <= segment.end) ?? FLOOR_SEGMENTS[0]
}

function getThemeGiftCount(theme: ThemeData | null) {
  if (!theme) return 0
  return (theme.ego_gift_ids ?? []).length + (theme.specific_ego_gift_ids ?? []).length
}

function getThemeImageSrc(theme: ThemeData) {
  const numericId = parseInt(String(theme.id), 10)
  return getThemePackVisualConfig(numericId)
    ? getThemePackCompositeImageUrl(numericId)
    : theme.image_url
}

function getFloorLabel(floor: number, locale: SupportedLang) {
  if (locale === 'ko') return `${floor}층`
  if (locale === 'ja') return `${floor}階`
  return `${floor}F`
}

function normalizeFloorDifficulty(entryDifficulty: unknown, floor: number): FloorDifficulty {
  if (isFloorDifficulty(entryDifficulty) && isAllowedFloorDifficulty(entryDifficulty, floor)) return entryDifficulty
  if (floor <= 5) return 'hard'
  if (floor <= 10) return 'overlap'
  return 'extreme'
}

function FloorMemo({
  value,
  onChange,
  pool,
  allowedKeywords,
  egoGiftLookup,
}: {
  value: string
  onChange: (v: string) => void
  pool: AutocompleteSuggestion[]
  allowedKeywords?: Set<string>
  egoGiftLookup?: Record<string, NoteEgoGiftEntry>
}) {
  const t = useTranslations('planner.floorTab')
  const ref = useRef<HTMLTextAreaElement>(null)
  const ac = useNoteAutocomplete({
    text: value,
    setText: onChange,
    textareaRef: ref,
    pool,
  })

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={e => {
          onChange(e.target.value)
          ac.onTextChange(e)
        }}
        onSelect={ac.onTextSelect}
        onKeyDown={ac.handleKeyDown}
        onCompositionStart={ac.onCompositionStart}
        onCompositionEnd={ac.onCompositionEnd}
        placeholder={t('memoPlaceholder')}
        rows={5}
        className="w-full resize-y rounded-md border bg-[#0d0b08] px-3 py-2 text-base leading-relaxed text-neutral-200 outline-none transition-colors focus:border-[var(--gold)]"
        style={{
          borderColor: '#333',
          minHeight: '8rem',
          fontFamily: 'inherit',
        }}
      />
      <NoteAutocompleteDropdown
        suggestions={ac.suggestions}
        selectedIdx={ac.selectedIdx}
        onSelect={ac.select}
        onHover={ac.setSelectedIdx}
      />
      {value.trim() && (
        <div
          className="mt-2 rounded-md border bg-[#0d0b08] px-3 py-2"
          style={{ borderColor: '#222' }}
        >
          <div
            className="mb-1 font-mono text-sm uppercase"
            style={{ color: '#6b7280', letterSpacing: '0.05em' }}
          >
            {t('memoPreview')}
          </div>
          <NoteRenderer text={value} allowedKeywords={allowedKeywords} egoGiftLookup={egoGiftLookup} />
        </div>
      )}
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
  const shouldReduceMotion = useReducedMotion()
  const [activeFloor, setActiveFloor] = useState(() => state.floorPlan[0]?.floor ?? 1)
  const [themeModalOpen, setThemeModalOpen] = useState(false)
  const [giftPickerOpen, setGiftPickerOpen] = useState(false)
  const [giftPickerQuery, setGiftPickerQuery] = useState('')
  const [finalGiftQuery, setFinalGiftQuery] = useState('')
  const [finalGiftKeyword, setFinalGiftKeyword] = useState<string | null>(null)
  const [finalGiftGrade, setFinalGiftGrade] = useState<string | null>(null)
  const [allGiftQuery, setAllGiftQuery] = useState('')
  const [dismissedFusionIds, setDismissedFusionIds] = useState<Set<string>>(() => new Set())

  const themeMap = useMemo(() => new Map(themes.map(theme => [String(theme.id), theme])), [themes])
  const activeEntry = state.floorPlan.find(entry => entry.floor === activeFloor) ?? state.floorPlan[0]
  const activeDifficulty = activeEntry
    ? normalizeFloorDifficulty(activeEntry.difficulty, activeEntry.floor)
    : 'hard'
  const selectedTheme = activeEntry?.theme_id ? themeMap.get(activeEntry.theme_id) ?? null : null

  useEffect(() => {
    if (!state.floorPlan.some(entry => entry.floor === activeFloor)) {
      setActiveFloor(state.floorPlan[0]?.floor ?? 1)
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

  const finalGiftIds = useMemo(() => {
    return parseFinalGiftIds(state.giftInventory)
  }, [state.giftInventory])

  const blockedFinalMaterialIds = useMemo(() => {
    return deriveBlockedFinalFusionMaterialIds({
      selectedFinalGiftIds: finalGiftIds,
      recipes,
      giftMap,
      gifts,
    })
  }, [finalGiftIds, giftMap, gifts, recipes])

  useEffect(() => {
    if (blockedFinalMaterialIds.size === 0) return

    for (const blockedId of blockedFinalMaterialIds) {
      if (!finalGiftIds.has(blockedId)) continue
      for (const giftId of getFinalGiftVariantIds(blockedId)) {
        dispatch({ type: 'REMOVE_GIFT', giftId })
      }
    }
  }, [blockedFinalMaterialIds, dispatch, finalGiftIds])

  const activeFloorGifts = (activeEntry?.gift_ids ?? [])
    .map(id => giftMap.get(parseInt(id, 10)))
    .filter(Boolean)
    .map(gift => localizedGift(gift as GiftData))

  const finalFloorGifts = useMemo(() => {
    return Array.from(finalGiftIds)
      .filter(id => !blockedFinalMaterialIds.has(id))
      .map(id => giftMap.get(id))
      .filter(Boolean)
      .map(gift => localizedGift(gift as GiftData))
  }, [blockedFinalMaterialIds, finalGiftIds, giftMap, localizedGift])

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
      .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug))
  }, [finalGiftKeywordCounts])

  const filteredFinalGifts = useMemo(() => {
    const query = finalGiftQuery.trim().toLocaleLowerCase()
    return finalFloorGifts.filter(gift => {
      const slug = getKeywordSlug(gift.keyword)
      const grade = gift.grade ?? '1'
      if (finalGiftKeyword && slug !== finalGiftKeyword) return false
      if (finalGiftGrade && grade !== finalGiftGrade) return false
      return !query || buildGiftSearchText(gift).includes(query)
    })
  }, [finalFloorGifts, finalGiftGrade, finalGiftKeyword, finalGiftQuery])

  const filteredAllGifts = useMemo(() => {
    const query = allGiftQuery.trim().toLocaleLowerCase()
    const source = gifts
      .filter(gift => !blockedFinalMaterialIds.has(gift.game_id))
      .map(localizedGift)
    if (!query) return source
    return source.filter(gift => buildGiftSearchText(gift).includes(query))
  }, [allGiftQuery, blockedFinalMaterialIds, gifts, localizedGift])

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
    if (finalGiftIds.has(giftGameId)) {
      removeFinalGift(giftGameId)
      return
    }
    if (blockedFinalMaterialIds.has(giftGameId)) return
    dispatch({ type: 'ADD_GIFT', giftId: `final_${giftGameId}` })
  }, [blockedFinalMaterialIds, dispatch, finalGiftIds, removeFinalGift])

  const selectTheme = useCallback((themeId: string | null) => {
    if (!activeEntry) return
    dispatch({ type: 'SET_FLOOR_THEME', floor: activeEntry.floor, themeId })
    setThemeModalOpen(false)
    setGiftPickerOpen(false)
    setGiftPickerQuery('')
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
      if (Number.isNaN(gid) || blockedFinalMaterialIds.has(gid)) return
      dispatch({ type: 'SET_FLOOR_GIFTS', floor: activeEntry.floor, giftIds: [...currentIds, giftGameId] })
      if (!finalGiftIds.has(gid)) {
        dispatch({ type: 'ADD_GIFT', giftId: `final_${gid}` })
      }
    }
  }, [activeEntry, blockedFinalMaterialIds, dispatch, finalGiftIds, state.floorPlan])

  function getThemeAvailableGifts(theme: ThemeData): GiftData[] {
    return (theme.ego_gift_ids ?? [])
      .map(gid => giftMap.get(gid))
      .filter(Boolean)
      .map(gift => localizedGift(gift as GiftData))
  }

  if (!activeEntry) {
    return null
  }

  const activeSegment = getFloorSegment(activeEntry.floor)
  const activeThemeName = selectedTheme
    ? getLocalizedName({ name_kr: selectedTheme.name, name_en: selectedTheme.name_en, name_jp: selectedTheme.name_jp }, locale)
    : null
  const availableGifts = selectedTheme
    ? getThemeAvailableGifts(selectedTheme).filter(gift => !blockedFinalMaterialIds.has(gift.game_id))
    : []
  const filteredAvailableGifts = availableGifts.filter(gift => {
    const query = giftPickerQuery.trim().toLocaleLowerCase()
    if (!query) return true
    return buildGiftSearchText(gift).includes(query)
  })

  return (
    <div className="flex flex-col gap-4">
      <section
        className="rounded-lg border p-4 md:p-5"
        style={{ background: '#1a1510', borderColor: '#2a2218' }}
        aria-label={t('floorBoard')}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-semibold" style={{ color: '#e8d8c0', WebkitTextStroke: 0 }}>
              {t('floorBoard')}
            </h3>
            <p className="mt-1 text-sm" style={{ color: '#7a7168' }}>
              {t('floorBoardHint')}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FLOOR_SEGMENTS.map(segment => (
              <span
                key={segment.id}
                className="inline-flex min-h-[2.25rem] items-center rounded-full border px-2.5 py-1 font-mono text-sm"
                style={{
                  borderColor: `${segment.tone}55`,
                  color: segment.tone,
                  background: `${segment.tone}12`,
                }}
              >
                {t(`segment.${segment.id}`, {
                  start: getFloorLabel(segment.start, locale),
                  end: getFloorLabel(segment.end, locale),
                })}
              </span>
            ))}
          </div>
        </div>

        <motion.div
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
          variants={shouldReduceMotion ? undefined : staggerContainer(0.035)}
          initial={shouldReduceMotion ? false : 'initial'}
          animate={shouldReduceMotion ? undefined : 'animate'}
        >
          {state.floorPlan.map((entry, index) => {
            const floorDifficulty = normalizeFloorDifficulty(entry.difficulty, entry.floor)
            const floorTheme = entry.theme_id ? themeMap.get(entry.theme_id) ?? null : null
            const floorThemeName = floorTheme
              ? getLocalizedName({ name_kr: floorTheme.name, name_en: floorTheme.name_en, name_jp: floorTheme.name_jp }, locale)
              : null
            const isActive = entry.floor === activeEntry.floor
            const isPlanned = isConfiguredFloor(entry)
            const segment = getFloorSegment(entry.floor)
            const difficultyTone = getDifficultyTone(floorDifficulty)
            const floorThemeImageSrc = floorTheme ? getThemeImageSrc(floorTheme) : null

            return (
              <motion.button
                key={entry.floor}
                type="button"
                variants={shouldReduceMotion ? undefined : workbenchStaggerItem}
                custom={index}
                onClick={() => {
                  setActiveFloor(entry.floor)
                  setThemeModalOpen(false)
                  setGiftPickerOpen(false)
                  setGiftPickerQuery('')
                }}
                aria-label={t('chooseFloorAria', { floor: entry.floor })}
                aria-pressed={isActive}
                className="group relative flex min-h-[7.25rem] min-w-0 flex-col overflow-hidden rounded-md border p-2.5 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                style={{
                  background: floorThemeImageSrc
                    ? '#100c08'
                    : isActive
                      ? 'rgba(200,144,10,0.14)'
                      : isPlanned
                        ? 'rgba(255,255,255,0.045)'
                        : 'rgba(13,11,8,0.72)',
                  borderColor: isActive ? '#c8900a' : isPlanned ? `${segment.tone}66` : '#2d261d',
                  boxShadow: isActive
                    ? 'inset 0 0 0 1px rgba(232,176,48,0.2)'
                    : floorThemeImageSrc
                      ? 'inset 0 0 0 1px rgba(232,216,192,0.04)'
                      : 'none',
                }}
              >
                {floorThemeImageSrc && (
                  <span className="pointer-events-none absolute inset-0" aria-hidden="true">
                    <ImageWithFallback
                      src={floorThemeImageSrc}
                      alt=""
                      fill
                      fallbackType="theme"
                      sizes="(max-width: 640px) 25vw, (max-width: 1536px) 20vw, 7rem"
                      className="object-cover opacity-80 saturate-[0.86]"
                    />
                    <span className="absolute inset-0 bg-[#080604]/45" />
                    <span className="absolute inset-x-0 bottom-0 h-[56%] bg-[#080604]/58" />
                    <span className="absolute inset-x-0 top-0 h-[46%] bg-[#080604]/36" />
                    {isActive && <span className="absolute inset-0 bg-[#c8900a]/12" />}
                  </span>
                )}
                <span className="relative flex items-center justify-between gap-2">
                  <span
                    className="font-mono text-base font-bold"
                    style={{
                      color: isActive ? '#e8b030' : '#e8d8c0',
                      textShadow: floorThemeImageSrc ? '0 1px 2px rgba(0,0,0,0.9)' : 'none',
                    }}
                  >
                    {getFloorLabel(entry.floor, locale)}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: isPlanned ? '#c8900a' : '#4b3f30',
                      boxShadow: floorThemeImageSrc && isPlanned ? '0 0 0 2px rgba(8,6,4,0.55)' : 'none',
                    }}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className="relative mt-1 block w-fit max-w-full truncate rounded-sm px-1.5 py-0.5 font-mono text-sm"
                  style={{
                    color: difficultyTone,
                    background: floorThemeImageSrc ? 'rgba(8,6,4,0.58)' : 'transparent',
                  }}
                >
                  {t(`difficulty.${floorDifficulty}`)}
                </span>
                <span
                  className="relative mt-1 block truncate text-sm font-medium leading-snug"
                  style={{
                    color: floorThemeName ? '#f0dfbd' : '#6f675e',
                    textShadow: floorThemeImageSrc ? '0 1px 2px rgba(0,0,0,0.92)' : 'none',
                  }}
                >
                  {floorThemeName ?? t('empty')}
                </span>
                {entry.gift_ids.length > 0 && (
                  <span
                    className="relative mt-auto block w-fit rounded-sm px-1.5 py-0.5 font-mono text-sm"
                    style={{
                      color: '#9ed0de',
                      background: floorThemeImageSrc ? 'rgba(8,6,4,0.58)' : 'transparent',
                    }}
                  >
                    {t('shortGiftCount', { count: entry.gift_ids.length })}
                  </span>
                )}
              </motion.button>
            )
          })}
        </motion.div>
      </section>

      <FloorConstraints floor={activeEntry.floor} entries={state.floorPlan} onChange={ids => dispatch({ type: 'SET_FLOOR_CONSTRAINTS', floor: activeEntry.floor, ids })} />
      <FloorGuidance entry={activeEntry} entries={state.floorPlan} inventory={state.giftInventory} recipes={recipes} gifts={giftMap} />
      <section
        className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]"
        aria-label={t('activeFloor', { floor: activeEntry.floor })}
      >
        <div className="rounded-lg border p-4" style={{ background: '#1a1510', borderColor: '#2a2218' }}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-sm uppercase" style={{ color: activeSegment.tone, letterSpacing: '0.08em' }}>
                {t(`segment.${activeSegment.id}`, {
                  start: getFloorLabel(activeSegment.start, locale),
                  end: getFloorLabel(activeSegment.end, locale),
                })}
              </div>
              <h3 className="mt-1 font-serif text-[1.5rem] font-semibold leading-tight" style={{ color: '#e8d8c0', WebkitTextStroke: 0 }}>
                {t('activeFloor', { floor: activeEntry.floor })}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeEntry.floor <= 5 ? (
                <div
                  className="flex rounded-md border p-1"
                  style={{ background: '#0d0b08', borderColor: '#30271d' }}
                  aria-label={t('difficultySelectorLabel', { floor: activeEntry.floor })}
                >
                  {(['normal', 'hard'] as const).map(difficulty => {
                    const selected = activeDifficulty === difficulty
                    return (
                      <button
                        key={difficulty}
                        type="button"
                        onClick={() => setDifficulty(difficulty)}
                        className="min-h-[2.75rem] rounded px-3 font-mono text-[0.9375rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                        style={{
                          background: selected ? 'rgba(200,144,10,0.2)' : 'transparent',
                          color: selected ? '#e8b030' : '#8b8177',
                        }}
                      >
                        {t(`difficulty.${difficulty}`)}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <ThemePackModalPill tone={activeDifficulty === 'extreme' ? 'red' : 'purple'}>
                  {t('fixedDifficulty')}: {t(`difficulty.${activeDifficulty}`)}
                </ThemePackModalPill>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <div className="min-w-0">
              {selectedTheme ? (
                <div className="overflow-hidden rounded-md border" style={{ borderColor: 'rgba(200,144,10,0.24)', background: '#0d0b08' }}>
                  <div className="relative aspect-[416/684] w-full bg-[#151210]">
                    {selectedTheme.image_url ? (
                      <ImageWithFallback
                        src={selectedTheme.image_url}
                        alt={activeThemeName ?? selectedTheme.name}
                        fill
                        fallbackType="theme"
                        sizes="(max-width: 768px) 45vw, 12rem"
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ color: '#6f675e' }}>
                        <Package size={32} aria-hidden="true" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setThemeModalOpen(true)}
                  disabled={pickerThemes.length === 0}
                  className="flex aspect-[416/684] w-full flex-col items-center justify-center rounded-md border border-dashed p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: '#40362c', background: '#0d0b08', color: '#7b7066' }}
                >
                  <Package size={28} aria-hidden="true" />
                  <span className="mt-3 text-base">{pickerThemes.length > 0 ? t('selectTheme') : t('emptyThemes')}</span>
                </button>
              )}
            </div>

            <div className="min-w-0">
              <div className="mb-3">
                <div className="font-mono text-sm uppercase" style={{ color: '#7a7168', letterSpacing: '0.08em' }}>
                  {t('themeSection')}
                </div>
                <h4 className="mt-1 text-xl font-semibold" style={{ color: activeThemeName ? '#e8b030' : '#8a8076' }}>
                  {activeThemeName ?? (pickerThemes.length > 0 ? t('noThemeWithCount', { count: pickerThemes.length }) : t('noFloorThemes'))}
                </h4>
                {selectedTheme && (
                  <p className="mt-1 text-sm" style={{ color: '#8b8177' }}>
                    {t('themeGiftCount', { count: getThemeGiftCount(selectedTheme) })}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setThemeModalOpen(true)}
                  disabled={pickerThemes.length === 0}
                  className="min-h-[2.75rem] rounded-md border px-4 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: 'rgba(200,144,10,0.32)', background: 'rgba(200,144,10,0.12)', color: '#e8b030' }}
                >
                  {selectedTheme ? t('changeTheme') : t('selectThemeWithCount', { count: pickerThemes.length })}
                </button>
                {selectedTheme && (
                  <button
                    type="button"
                    onClick={() => selectTheme(null)}
                    className="min-h-[2.75rem] rounded-md border px-3 text-[0.9375rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                    style={{ borderColor: '#333', background: 'rgba(255,255,255,0.03)', color: '#9ca3af' }}
                  >
                    {t('clearTheme')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4" style={{ background: '#1a1510', borderColor: '#2a2218' }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="font-mono text-sm uppercase" style={{ color: '#7a7168', letterSpacing: '0.08em' }}>
                {t('acquiredGifts')}
              </div>
              <h4 className="mt-1 text-lg font-semibold" style={{ color: '#e8d8c0' }}>
                {t('acquiredGiftCount', { count: activeEntry.gift_ids.length })}
              </h4>
            </div>
            {selectedTheme && (
              <button
                type="button"
                onClick={() => setGiftPickerOpen(open => !open)}
                className="inline-flex min-h-[2.75rem] items-center gap-2 rounded-md border px-3 text-[0.9375rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                style={{ borderColor: '#333', background: 'rgba(255,255,255,0.04)', color: '#d8c8a8' }}
              >
                <Plus size={16} aria-hidden="true" />
                {t('addGift')}
              </button>
            )}
          </div>

          {selectedTheme ? (
            <>
              <div className="flex flex-wrap gap-2">
                {activeFloorGifts.map(gift => (
                  <GiftCard
                    key={gift.game_id}
                    gift={gift}
                    size="4.75rem"
                    isSelected
                    onClick={() => toggleGiftId(String(gift.game_id), activeEntry.gift_ids)}
                    onRemove={() => toggleGiftId(String(gift.game_id), activeEntry.gift_ids)}
                  />
                ))}
                <GiftCard
                  gift={{ name: t('addGift') }}
                  variant="insert"
                  size="4.75rem"
                  showName
                  onClick={() => setGiftPickerOpen(open => !open)}
                />
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed px-4 py-8 text-center text-base" style={{ borderColor: '#333', color: '#6f675e' }}>
              {t('selectThemeFirst')}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border p-4" style={{ background: '#1a1510', borderColor: '#2a2218' }}>
        <div className="mb-2 font-mono text-sm uppercase" style={{ color: '#7a7168', letterSpacing: '0.08em' }}>
          {t('memo')}
        </div>
        <FloorMemo
          value={activeEntry.memo}
          onChange={memo => dispatch({ type: 'SET_FLOOR_MEMO', floor: activeEntry.floor, memo })}
          pool={acPool}
          allowedKeywords={allowedKeywords}
          egoGiftLookup={egoGiftLookup}
        />
      </section>

      <section className="planner-floor-final-section rounded-lg border p-3 md:p-4" style={{ background: '#17120d', borderColor: '#2a2218' }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-sm uppercase" style={{ color: '#7a7168', letterSpacing: '0.08em' }}>
              {t('finalGifts')}
            </div>
            <h4 className="mt-1 text-lg font-semibold leading-tight" style={{ color: '#e8d8c0' }}>
              {t('finalGiftCount', { count: finalFloorGifts.length })}
            </h4>
          </div>
        </div>

        <div className="planner-floor-final-workbench grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)]">
          <div
            className="planner-floor-final-selected flex min-w-0 flex-col rounded-md border p-3"
            style={{
              background: '#120f0b',
              borderColor: '#2a2218',
              height: 'min(40rem, calc(100svh - 8rem))',
              minHeight: '22rem',
            }}
          >
            <div className="mb-3 flex shrink-0 flex-col gap-2">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="truncate font-mono text-[0.9375rem] uppercase" style={{ color: '#c8900a', letterSpacing: '0.08em' }}>
                  {t('finalSelectedPanel')}
                </div>
                <div className="shrink-0 rounded-md border px-2 py-1 font-mono text-sm tabular-nums" style={{ color: '#a99d90', borderColor: '#2a2218', background: '#17120d' }}>
                  {filteredFinalGifts.length}/{finalFloorGifts.length}
                </div>
              </div>
              <label className="min-w-0">
                <span className="sr-only">{t('finalGiftSearchPlaceholder')}</span>
                <div className="relative">
                  <Search
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: '#6f675e' }}
                  />
                  <input
                    type="search"
                    value={finalGiftQuery}
                    onChange={event => setFinalGiftQuery(event.target.value)}
                    placeholder={t('finalGiftSearchPlaceholder')}
                    className="w-full rounded-md border bg-[#0d0b08] py-1.5 pl-8 pr-3 text-[0.9375rem] text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]"
                    style={{ borderColor: '#30271d', minHeight: '2.75rem' }}
                  />
                </div>
              </label>
            </div>

            <div className="planner-floor-final-filterbar mb-3 flex shrink-0 flex-col gap-1.5 border-y py-2" style={{ borderColor: '#241d15' }}>
              <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="mr-1 shrink-0 font-mono text-[0.875rem] uppercase" style={{ color: '#6f675e', letterSpacing: '0.06em' }}>
                  {t('finalKeywordFilter')}
                </span>
                <button
                  type="button"
                  onClick={() => setFinalGiftKeyword(null)}
                  aria-pressed={finalGiftKeyword === null}
                  className="min-h-[2.75rem] shrink-0 rounded-md border px-2.5 text-[0.9375rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                  style={{
                    borderColor: finalGiftKeyword === null ? '#c8900a' : '#2a2218',
                    background: finalGiftKeyword === null ? 'rgba(200,144,10,0.12)' : 'transparent',
                    color: finalGiftKeyword === null ? '#e8b030' : '#a99d90',
                  }}
                >
                  {t('filterAll')} {finalGiftKeywordCounts.get(null) ?? 0}
                </button>
                {finalKeywordOptions.map(({ slug, count }) => {
                  const keyword = SLUG_TO_KEYWORD[slug] ?? slug
                  const selected = finalGiftKeyword === slug
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => setFinalGiftKeyword(selected ? null : slug)}
                      aria-pressed={selected}
                      className="min-h-[2.75rem] shrink-0 rounded-md border px-2.5 text-[0.9375rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                      style={{
                        borderColor: selected ? '#c8900a' : '#2a2218',
                        background: selected ? 'rgba(200,144,10,0.12)' : 'transparent',
                        color: selected ? '#e8b030' : '#a99d90',
                      }}
                    >
                      {localizeDeckKeyword(keyword, kwContext.keywords[keyword], locale)} {count}
                    </button>
                  )
                })}
              </div>

              <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="mr-1 shrink-0 font-mono text-[0.875rem] uppercase" style={{ color: '#6f675e', letterSpacing: '0.06em' }}>
                  {t('finalGradeFilter')}
                </span>
                <button
                  type="button"
                  onClick={() => setFinalGiftGrade(null)}
                  aria-pressed={finalGiftGrade === null}
                  className="min-h-[2.75rem] shrink-0 rounded-md border px-2.5 font-mono text-[0.9375rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                  style={{
                    borderColor: finalGiftGrade === null ? '#c8900a' : '#2a2218',
                    background: finalGiftGrade === null ? 'rgba(200,144,10,0.12)' : 'transparent',
                    color: finalGiftGrade === null ? '#e8b030' : '#a99d90',
                  }}
                >
                  {t('filterAll')} {finalGiftGradeCounts.get(null) ?? 0}
                </button>
                {FINAL_GIFT_GRADE_ORDER.map(grade => {
                  const count = finalGiftGradeCounts.get(grade) ?? 0
                  if (count === 0) return null
                  const selected = finalGiftGrade === grade
                  const color = GRADE_COLORS[grade] ?? '#888'
                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setFinalGiftGrade(selected ? null : grade)}
                      aria-pressed={selected}
                      className="min-h-[2.75rem] shrink-0 rounded-md border px-2.5 font-mono text-[0.9375rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                      style={{
                        borderColor: selected ? color : '#2a2218',
                        background: selected ? `${color}18` : 'transparent',
                        color: selected ? color : '#a99d90',
                      }}
                    >
                      {GRADE_ROMAN[grade] ?? grade} {count}
                    </button>
                  )
                })}
              </div>
            </div>

            {finalFloorGifts.length === 0 ? (
              <div className="rounded-md border px-3 py-4 text-center text-base" style={{ color: '#7a7168', background: 'rgba(13,11,8,0.34)', borderColor: '#241d15' }}>
                {t('finalGiftEmpty')}
              </div>
            ) : filteredFinalGifts.length === 0 ? (
              <div className="rounded-md border px-3 py-4 text-center text-base" style={{ color: '#7a7168', background: 'rgba(13,11,8,0.34)', borderColor: '#241d15' }}>
                {t('finalGiftNoResults')}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1" style={{ scrollbarGutter: 'stable' }}>
                <div className="planner-floor-final-selected-grid grid grid-cols-[repeat(auto-fill,minmax(4.85rem,1fr))] gap-2">
                  {filteredFinalGifts.map(gift => (
                    <GiftCard
                      key={gift.game_id}
                      gift={gift}
                      size="100%"
                      showName
                      onClick={() => removeFinalGift(gift.game_id)}
                      ariaLabel={t('removeFinalGift', { gift: gift.name })}
                      title={t('removeFinalGift', { gift: gift.name })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside
            className="planner-floor-final-catalog flex min-w-0 flex-col rounded-md border p-3"
            style={{
              background: '#0d0b08',
              borderColor: '#241d15',
              height: 'min(40rem, calc(100svh - 8rem))',
              minHeight: '22rem',
            }}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-mono text-[0.9375rem] uppercase" style={{ color: '#e8b030', letterSpacing: '0.08em' }}>
                  {t('allGiftCatalog')}
                </div>
              </div>
            </div>

            <label className="mb-3 block shrink-0">
              <span className="sr-only">{t('allGiftSearchPlaceholder')}</span>
              <div className="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: '#6f675e' }}
                />
                <input
                  type="search"
                  value={allGiftQuery}
                  onChange={event => setAllGiftQuery(event.target.value)}
                  placeholder={t('allGiftSearchPlaceholder')}
                  className="w-full rounded-md border bg-[#0d0b08] py-1.5 pl-8 pr-3 text-[0.9375rem] text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]"
                  style={{ borderColor: '#30271d', minHeight: '2.75rem' }}
                />
              </div>
            </label>

            {filteredAllGifts.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-4 text-center text-base" style={{ color: '#7a7168' }}>
                {t('allGiftNoResults')}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1" style={{ scrollbarGutter: 'stable' }}>
                <div className="planner-floor-final-catalog-grid grid grid-cols-[repeat(auto-fill,minmax(4.65rem,1fr))] gap-2 md:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(4.65rem,1fr))]">
                  {filteredAllGifts.map(gift => {
                    const alreadyAdded = finalGiftIds.has(gift.game_id)
                    return (
                      <div
                        key={gift.game_id}
                        className="min-w-0 rounded-md p-0.5 transition-colors"
                        style={{
                          background: alreadyAdded ? 'rgba(200,144,10,0.08)' : 'transparent',
                          boxShadow: alreadyAdded ? 'inset 0 0 0 1px rgba(200,144,10,0.28)' : 'none',
                        }}
                      >
                        <GiftCard
                          gift={gift}
                          size="100%"
                          showName
                          onClick={() => toggleFinalGift(gift.game_id)}
                          ariaLabel={alreadyAdded ? t('removeAlreadyAddedGift', { gift: gift.name }) : t('addFinalGift', { gift: gift.name })}
                          title={alreadyAdded ? t('removeAlreadyAddedGift', { gift: gift.name }) : t('addFinalGift', { gift: gift.name })}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {suggestedFusion?.result && (
        <aside
          aria-live="polite"
          className="fixed inset-x-3 bottom-3 z-20 rounded-lg border p-3 md:inset-x-auto md:right-4 md:w-[23rem]"
          style={{
            background: '#151210',
            borderColor: 'rgba(232,176,48,0.28)',
            boxShadow: '0 1.25rem 3rem rgba(0,0,0,0.68), inset 0 1px 0 rgba(232,216,192,0.05)',
          }}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-sm uppercase" style={{ color: '#e8b030', letterSpacing: '0.08em' }}>
                {t('fusionAlertTitle')}
              </div>
              <p className="mt-1 text-sm leading-snug" style={{ color: '#b9aa98' }}>
                {t('fusionAlertHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissSuggestedFusion}
              aria-label={t('fusionAlertDismiss')}
              className="inline-flex min-h-[max(2.75rem,44px)] min-w-[max(2.75rem,44px)] items-center justify-center rounded-md transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
              style={{ color: '#aaa' }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {suggestedFusion.materials.map(material => {
                const gift = localizedGift(material)
                return (
                  <span
                    key={material.game_id}
                    className="max-w-full truncate rounded-md border px-2 py-1 text-sm"
                    style={{ borderColor: '#35291a', background: '#0d0b08', color: '#d8c5aa' }}
                    title={gift.name}
                  >
                    {gift.name}
                  </span>
                )
              })}
            </div>
            <div className="w-[5.25rem] shrink-0">
              <GiftCard
                gift={localizedGift(suggestedFusion.result)}
                size="100%"
                onClick={applySuggestedFusion}
                ariaLabel={t('fusionAlertApply', { gift: localizedGift(suggestedFusion.result).name })}
                title={t('fusionAlertApply', { gift: localizedGift(suggestedFusion.result).name })}
              />
            </div>
          </div>
        </aside>
      )}

      {giftPickerOpen && selectedTheme && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={t('giftPickerTitle')}
          className="popup-drawer fixed inset-x-3 bottom-3 z-30 mx-auto flex flex-col overflow-hidden rounded-lg border p-2.5 md:bottom-4 md:max-w-2xl md:p-3"
          style={{
            background: '#151210',
            borderColor: 'rgba(200,144,10,0.28)',
            boxShadow: '0 1.5rem 4rem rgba(0,0,0,0.72), 0 0 0 1px rgba(232,176,48,0.06)',
            maxHeight: 'min(30rem, calc(100svh - 1.5rem))',
          }}
        >
          <div className="mb-2 flex shrink-0 items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="font-mono text-[0.8125rem] uppercase leading-tight" style={{ color: '#7a7168', letterSpacing: '0.08em' }}>
                {t('giftPickerTitle')}
              </div>
              <p className="mt-0.5 text-sm leading-snug" style={{ color: '#9a9086' }}>
                {t('giftPickerHint', { theme: activeThemeName ?? selectedTheme.name })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGiftPickerOpen(false)}
              aria-label={t('close')}
              className="inline-flex min-h-[max(2.75rem,44px)] min-w-[max(2.75rem,44px)] items-center justify-center rounded-md transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
              style={{ color: '#aaa' }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <label className="mb-2 block shrink-0">
            <span className="sr-only">{t('giftPickerSearchPlaceholder')}</span>
            <div className="relative">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: '#6f675e' }}
              />
              <input
                type="search"
                value={giftPickerQuery}
                onChange={event => setGiftPickerQuery(event.target.value)}
                placeholder={t('giftPickerSearchPlaceholder')}
                className="w-full rounded-md border bg-[#0d0b08] py-1.5 pl-8 pr-3 text-[0.9375rem] text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]"
                style={{ borderColor: '#30271d', minHeight: 'max(2.75rem, 44px)' }}
              />
            </div>
          </label>

          <div className="min-h-0 overflow-y-auto overscroll-contain pr-0.5">
            {availableGifts.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-base" style={{ borderColor: '#333', color: '#6b7280' }}>
                {t('noThemeGifts')}
              </div>
            ) : filteredAvailableGifts.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-base" style={{ borderColor: '#333', color: '#6b7280' }}>
                {t('giftPickerEmpty')}
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 md:grid-cols-7">
                {filteredAvailableGifts.map(gift => {
                  const isAdded = activeEntry.gift_ids.includes(String(gift.game_id))
                  const isInFinal = finalGiftIds.has(gift.game_id)
                  return (
                    <div key={gift.game_id} className="min-w-0">
                      <GiftCard
                        gift={gift}
                        size="100%"
                        isSelected={isAdded}
                        onClick={() => toggleGiftId(String(gift.game_id), activeEntry.gift_ids)}
                        title={!isInFinal && !isAdded ? t('addToFinal') : undefined}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {themeModalOpen && (
        <ThemePackPickerModal
          title={t('themeModalTitle', {
            floor: activeEntry.floor,
            difficulty: t(`difficulty.${activeDifficulty}`),
          })}
          closeLabel={t('close')}
          emptyLabel={t('emptyThemes')}
          themes={pickerThemes}
          selectedThemeId={activeEntry.theme_id}
          lang={locale}
          onClose={() => setThemeModalOpen(false)}
          onSelectTheme={theme => selectTheme(String(theme.id))}
          meta={
            <>
              <ThemePackModalPill tone={activeDifficulty === 'extreme' ? 'red' : activeDifficulty === 'overlap' ? 'purple' : activeDifficulty === 'hard' ? 'gold' : 'neutral'}>
                {t(`difficulty.${activeDifficulty}`)}
              </ThemePackModalPill>
              <ThemePackModalPill>{t('availableThemeCount', { count: pickerThemes.length })}</ThemePackModalPill>
            </>
          }
        />
      )}
      <style jsx global>{`
        @media (max-width: 1023px) {
          .planner-floor-final-workbench {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .planner-floor-final-selected,
          .planner-floor-final-catalog {
            height: auto !important;
            min-height: 0 !important;
          }

          .planner-floor-final-selected {
            max-height: min(28rem, 56svh);
          }

          .planner-floor-final-catalog {
            max-height: min(30rem, 58svh);
          }
        }

        @media (max-width: 767px) {
          .planner-floor-final-section {
            padding: 0.75rem !important;
          }

          .planner-floor-final-filterbar {
            gap: 0.5rem !important;
          }

          .planner-floor-final-selected-grid,
          .planner-floor-final-catalog-grid {
            grid-template-columns: repeat(auto-fill, minmax(4.25rem, 1fr)) !important;
            gap: 0.5rem !important;
          }
        }

        @media (max-width: 360px) {
          .planner-floor-final-selected-grid,
          .planner-floor-final-catalog-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  )
}
