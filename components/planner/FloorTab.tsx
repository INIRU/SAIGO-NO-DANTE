'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Package, Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import GiftCard from '@/components/ui/GiftCard'
import {
  ThemePackModalPill,
  ThemePackPickerModal,
} from '@/components/ui/ThemePackModal'
import type { PlannerState, PlannerAction, ThemeData, GiftData, FloorDifficulty } from '@/lib/planner/types'
import { DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import { getAvailableThemes, computeKeywordDistribution } from '@/lib/planner/fusion'
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
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

const FLOOR_SEGMENTS = [
  { id: 'early', start: 1, end: 5, tone: '#c8900a' },
  { id: 'loop', start: 6, end: 10, tone: '#9070b0' },
  { id: 'extreme', start: 11, end: 15, tone: '#d04a3a' },
] as const

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
  giftMap: Map<number, GiftData>
}

export default function FloorTab({ state, dispatch, themes, gifts, giftMap }: FloorTabProps) {
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.floorTab')
  const [activeFloor, setActiveFloor] = useState(() => state.floorPlan[0]?.floor ?? 1)
  const [themeModalOpen, setThemeModalOpen] = useState(false)
  const [giftPickerOpen, setGiftPickerOpen] = useState(false)

  const themeMap = useMemo(() => new Map(themes.map(theme => [theme.id, theme])), [themes])
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
      return !availableThemes.some(theme => theme.id === entry.theme_id)
    })

    if (!invalidEntry) return

    const difficulty = normalizeFloorDifficulty(invalidEntry.difficulty, invalidEntry.floor)
    const availableThemes = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], invalidEntry.floor)
    const hasInvalidTheme = Boolean(
      invalidEntry.theme_id && !availableThemes.some(theme => theme.id === invalidEntry.theme_id)
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
    return activeAvailableThemes.filter(theme => !usedThemeIds.has(theme.id) || theme.id === activeEntry.theme_id)
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
    return new Set(
      state.giftInventory
        .filter(id => id.startsWith('final_'))
        .map(id => parseInt(id.replace('final_', '').replace('_plusplus', '').replace('_plus', ''), 10))
        .filter(n => !Number.isNaN(n))
    )
  }, [state.giftInventory])

  const keywordDistribution = useMemo(() => {
    const allGiftIds = state.floorPlan.flatMap(entry => entry.gift_ids)
    const giftKeywords = allGiftIds
      .map(id => giftMap.get(parseInt(id, 10)))
      .filter(Boolean)
      .filter(gift => gift!.keyword)
      .map(gift => [gift!.keyword as string])
    return computeKeywordDistribution(giftKeywords)
  }, [state.floorPlan, giftMap])

  const totalGiftCount = state.floorPlan.reduce((sum, entry) => sum + entry.gift_ids.length, 0)
  const activeFloorGifts = (activeEntry?.gift_ids ?? [])
    .map(id => giftMap.get(parseInt(id, 10)))
    .filter(Boolean)
    .map(gift => localizedGift(gift as GiftData))

  const selectTheme = useCallback((themeId: string | null) => {
    if (!activeEntry) return
    dispatch({ type: 'SET_FLOOR_THEME', floor: activeEntry.floor, themeId })
    setThemeModalOpen(false)
    setGiftPickerOpen(false)
  }, [activeEntry, dispatch])

  const setDifficulty = useCallback((difficulty: FloorDifficulty) => {
    if (!activeEntry || activeEntry.floor > 5) return
    const nextThemes = getAvailableThemes(themes, DIFFICULTY_FLOOR_KEY[difficulty], activeEntry.floor)
    const selectedStillValid = !activeEntry.theme_id || nextThemes.some(theme => theme.id === activeEntry.theme_id)
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
    } else {
      dispatch({ type: 'SET_FLOOR_GIFTS', floor: activeEntry.floor, giftIds: [...currentIds, giftGameId] })
      const gid = parseInt(giftGameId, 10)
      if (!Number.isNaN(gid) && !finalGiftIds.has(gid)) {
        dispatch({ type: 'ADD_GIFT', giftId: `final_${gid}` })
      }
    }
  }, [activeEntry, dispatch, finalGiftIds])

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
  const availableGifts = selectedTheme ? getThemeAvailableGifts(selectedTheme) : []

  return (
    <div className="flex flex-col gap-4">
      <section
        className="rounded-lg border p-3 md:p-4"
        style={{ background: '#1a1510', borderColor: '#2a2218' }}
        aria-label={t('floorBoard')}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-[repeat(15,minmax(0,1fr))]">
          {state.floorPlan.map(entry => {
            const floorDifficulty = normalizeFloorDifficulty(entry.difficulty, entry.floor)
            const floorTheme = entry.theme_id ? themeMap.get(entry.theme_id) ?? null : null
            const floorThemeName = floorTheme
              ? getLocalizedName({ name_kr: floorTheme.name, name_en: floorTheme.name_en, name_jp: floorTheme.name_jp }, locale)
              : null
            const isActive = entry.floor === activeEntry.floor
            const isPlanned = Boolean(floorTheme || entry.gift_ids.length > 0 || entry.memo.trim())
            const segment = getFloorSegment(entry.floor)
            const difficultyTone = getDifficultyTone(floorDifficulty)

            return (
              <button
                key={entry.floor}
                type="button"
                onClick={() => {
                  setActiveFloor(entry.floor)
                  setThemeModalOpen(false)
                  setGiftPickerOpen(false)
                }}
                aria-label={t('chooseFloorAria', { floor: entry.floor })}
                aria-pressed={isActive}
                className="group min-h-[5.5rem] min-w-0 rounded-md border p-2 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                style={{
                  background: isActive ? 'rgba(200,144,10,0.14)' : isPlanned ? 'rgba(255,255,255,0.045)' : 'rgba(13,11,8,0.72)',
                  borderColor: isActive ? '#c8900a' : isPlanned ? `${segment.tone}66` : '#2d261d',
                  boxShadow: isActive ? 'inset 0 0 0 1px rgba(232,176,48,0.18)' : 'none',
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-base font-bold" style={{ color: isActive ? '#e8b030' : '#e8d8c0' }}>
                    {getFloorLabel(entry.floor, locale)}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: isPlanned ? '#c8900a' : '#4b3f30' }}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className="mt-1 block truncate font-mono text-sm"
                  style={{ color: difficultyTone }}
                >
                  {t(`difficulty.${floorDifficulty}`)}
                </span>
                <span className="mt-1 block truncate text-sm" style={{ color: floorThemeName ? '#d8c8a8' : '#6f675e' }}>
                  {floorThemeName ?? t('empty')}
                </span>
                {entry.gift_ids.length > 0 && (
                  <span className="mt-1 block font-mono text-sm" style={{ color: '#8fb8c8' }}>
                    {t('shortGiftCount', { count: entry.gift_ids.length })}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

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
              <h3 className="mt-1 font-serif text-2xl font-semibold" style={{ color: '#e8d8c0', WebkitTextStroke: 0 }}>
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

              {giftPickerOpen && (
                <div className="mt-3 rounded-md border p-3" style={{ borderColor: '#333', background: '#151210' }}>
                  {availableGifts.length === 0 ? (
                    <div className="py-6 text-center text-sm" style={{ color: '#6b7280' }}>
                      {t('noThemeGifts')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5">
                      {availableGifts.map(gift => {
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
                            {!isInFinal && !isAdded && (
                              <div className="mt-1 text-center font-mono text-sm" style={{ color: '#4898b0' }}>
                                {t('addToFinal')}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
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

      {keywordDistribution.length > 0 && (
        <section className="rounded-lg border p-4" style={{ background: '#1a1510', borderColor: '#2a2218' }}>
          <div className="mb-3 text-base font-semibold" style={{ color: '#d8c8a8' }}>
            {t('keywordDistribution')}
          </div>
          <div className="flex flex-col gap-2">
            {keywordDistribution.slice(0, 10).map(({ keyword, count }) => {
              const max = keywordDistribution[0].count
              return (
                <div key={keyword} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-sm" style={{ color: '#e5e7eb' }}>
                    {keyword}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: '#222' }}>
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{
                        width: `${(count / max) * 100}%`,
                        background: '#c8900a',
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono text-sm" style={{ color: '#8a6010' }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-sm" style={{ color: '#6f675e' }}>
            {t('totalGifts', { count: totalGiftCount })}
          </div>
        </section>
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
          onSelectTheme={theme => selectTheme(theme.id)}
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
    </div>
  )
}
