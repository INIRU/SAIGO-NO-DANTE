'use client'

import { memo, useState, useMemo, useEffect, useCallback, startTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryState, parseAsString } from 'nuqs'
import ScrollReveal from '@/features/mirror-dungeon/components/ScrollReveal'
import { fadeInUp } from '@/lib/animations'
import dynamic from 'next/dynamic'
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch'
import { translations } from '@/lib/i18n/translations'
import type { SupportedLang } from '@/lib/i18n/types'
import { ATK_TYPE_ICON_MAP } from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import type { EgoGift, Recipe, EgoGiftTheme, MdEvent, MdEventChoice } from '@/features/mirror-dungeon'
import { useMirrorDungeonData } from '@/features/mirror-dungeon/hooks/useMirrorDungeonData'
import GiftTabView from '@/features/mirror-dungeon/components/GiftTab'
import ThemeTabView from '@/features/mirror-dungeon/components/ThemeTab'
import EventTab from '@/features/mirror-dungeon/components/EventTab'
import PageHeader from '@/components/ui/PageHeader'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import { stepInto } from '@/lib/utils/detail-trail'
import { getLocalizedName } from '@/lib/i18n/localize'
import { getThemePackCompositeImageUrl, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'

type DetailRef = { kind: 'gift' | 'pack'; id: string }
const refKey = (ref: DetailRef) => `${ref.kind}:${ref.id}`

const ThemeModal = dynamic(() => import('@/features/mirror-dungeon/components/ThemeModal'), { ssr: false })
const GiftModal = dynamic(() => import('@/features/mirror-dungeon/components/GiftModal'), { ssr: false })
const EventModal = dynamic(() => import('@/features/mirror-dungeon/components/EventModal'), { ssr: false })
// Opening a modal changes page state; memo keeps the 448-gift and 117-pack grids from re-rendering underneath it.
const GiftTab = memo(GiftTabView)
const ThemeTab = memo(ThemeTabView)

export default function MirrorDungeonClient({
  lang,
  gifts,
  recipes,
  themes = [],
  events = [],
  choices = [],
}: {
  lang: SupportedLang
  gifts: EgoGift[]
  recipes: Recipe[]
  themes?: EgoGiftTheme[]
  events?: MdEvent[]
  choices?: MdEventChoice[]
}) {
  useRoutePrefetch([`/${lang}/keywords`])
  const tp = useTranslations('mirrorDungeonPage')
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return (entry as Record<string, string>)[lang] ?? (entry as Record<string, string>)['ko'] ?? key
  }

  const { getIconUrl } = useKeywordData()
  const getGiftKeywordIcon = useCallback(
    (keyword: string) => getIconUrl(keyword) ?? ATK_TYPE_ICON_MAP[keyword] ?? null,
    [getIconUrl]
  )

  // nuqs URL 상태 (검색/필터/탭 — 공유 가능)
  const [searchParam, setSearchParam] = useQueryState('q', parseAsString.withDefault(''))
  const [kwParam, setKwParam] = useQueryState('kw', parseAsString.withDefault(''))
  const [gradeParam, setGradeParam] = useQueryState('grade', parseAsString.withDefault(''))
  const [tierParam, setTierParam] = useQueryState('tier', parseAsString.withDefault(''))
  const [sortByParam, setSortByParam] = useQueryState('sort', parseAsString.withDefault('default'))
  const [sortDescParam, setSortDescParam] = useQueryState('desc', parseAsString.withDefault('false'))
  const [activeTabParam, setActiveTabParam] = useQueryState('tab', parseAsString.withDefault('gifts'))
  const [themeSearchParam, setThemeSearchParam] = useQueryState('tq', parseAsString.withDefault(''))
  const [themeDiffParam, setThemeDiffParam] = useQueryState('diff', parseAsString.withDefault('전체'))
  const [slotFilterParam, setSlotFilterParam] = useQueryState('slot', parseAsString.withDefault('전체'))
  const [eventSearchParam, setEventSearchParam] = useQueryState('eq', parseAsString.withDefault(''))
  const [eventThemeParam, setEventThemeParam] = useQueryState('etheme', parseAsString.withDefault(''))

  const [themeIdParam, setThemeIdParam] = useQueryState('theme', parseAsString.withDefault(''))
  const [checkParam, setCheckParam] = useQueryState('check', parseAsString.withDefault(''))

  // URL 파라미터 → 파생 상태
  const keywords = useMemo(() => new Set(kwParam.split(',').filter(Boolean)), [kwParam])
  const grades = useMemo(() => new Set(gradeParam.split(',').filter(Boolean)), [gradeParam])
  const tiers = useMemo(() => new Set(tierParam.split(',').filter(Boolean)), [tierParam])
  const search = searchParam
  const sortBy = (sortByParam as 'default' | 'name' | 'grade') || 'default'
  const sortDesc = sortDescParam === 'true'
  const activeTab = (activeTabParam as 'gifts' | 'themes' | 'events') || 'gifts'
  const themeSearch = themeSearchParam
  const themeDiffFilter = themeDiffParam
  const slotFilter = slotFilterParam
  const eventSearch = eventSearchParam
  const selectedThemeId = themeIdParam ? Number(themeIdParam) : null
  // Gift check mode: the gift list alone, without navigation, header or tabs.
  const checkMode = activeTab === 'gifts' && checkParam === '1'
  const setCheckMode = useCallback((on: boolean) => setCheckParam(on ? '1' : null), [setCheckParam])
  useHtmlFlag('with-gift-check', checkMode)

  // Set 상태 래퍼
  const setKeywords = useCallback((fn: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof fn === 'function') {
      const next = fn(keywords)
      setKwParam(next.size > 0 ? Array.from(next).join(',') : null)
    } else {
      setKwParam(fn.size > 0 ? Array.from(fn).join(',') : null)
    }
  }, [keywords, setKwParam])

  const setGrades = useCallback((fn: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof fn === 'function') {
      const next = fn(grades)
      setGradeParam(next.size > 0 ? Array.from(next).join(',') : null)
    } else {
      setGradeParam(fn.size > 0 ? Array.from(fn).join(',') : null)
    }
  }, [grades, setGradeParam])

  const setTiers = useCallback((fn: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof fn === 'function') {
      const next = fn(tiers)
      setTierParam(next.size > 0 ? Array.from(next).join(',') : null)
    } else {
      setTierParam(fn.size > 0 ? Array.from(fn).join(',') : null)
    }
  }, [tiers, setTierParam])

  const setSearch = useCallback((v: string) => setSearchParam(v || null), [setSearchParam])
  const [inputValue, setInputValue] = useState(search)
  // Load the modal chunks while idle so the first click opens without a network round trip.
  useEffect(() => {
    const load = () => { void import('@/features/mirror-dungeon/components/ThemeModal'); void import('@/features/mirror-dungeon/components/GiftModal') }
    if (typeof requestIdleCallback === 'undefined') { const id = setTimeout(load, 1500); return () => clearTimeout(id) }
    const id = requestIdleCallback(load, { timeout: 3000 })
    return () => cancelIdleCallback(id)
  }, [])
  useEffect(() => {
    const t = setTimeout(() => setSearch(inputValue), 300)
    return () => clearTimeout(t)
  }, [inputValue, setSearch])

  const setSortBy = useCallback((v: 'default' | 'name' | 'grade') => setSortByParam(v === 'default' ? null : v), [setSortByParam])
  const setSortDesc = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    if (typeof v === 'function') setSortDescParam(v(sortDesc) ? 'true' : null)
    else setSortDescParam(v ? 'true' : null)
  }, [sortDesc, setSortDescParam])
  const setActiveTab = useCallback((v: 'gifts' | 'themes' | 'events') => setActiveTabParam(v === 'gifts' ? null : v), [setActiveTabParam])
  const setThemeSearch = useCallback((v: string) => setThemeSearchParam(v || null), [setThemeSearchParam])
  const setThemeDiffFilter = useCallback((v: string) => setThemeDiffParam(v === '전체' ? null : v), [setThemeDiffParam])
  const setSlotFilter = useCallback((v: string) => setSlotFilterParam(v === '전체' ? null : v), [setSlotFilterParam])
  const setEventSearch = useCallback((v: string) => setEventSearchParam(v || null), [setEventSearchParam])

  const setSelectedThemeId = useCallback((v: number | null) => setThemeIdParam(v !== null ? String(v) : null), [setThemeIdParam])

  // 로컬 상태 (모달/UI)
  // 기프트·테마팩·이벤트 상세는 주소(gift, pack, event)로 열고 닫는다: 검색 결과가 바로 그 창으로 온다
  // 창 열기는 transition으로: 느린 폰에서도 누른 직후 한 번 그린 뒤 창을 그린다(INP)
  const [giftIdParam, setGiftIdParam] = useQueryState('gift', parseAsString.withDefault(''))
  const {
    localizedEvents, eventById, choicesByEventId, eventCount, choiceCountByEventId, selected, giftByGameId, themeGiftNames,
    giftNameByGameId, recipeMap, giftImageMap, giftNameMap, giftSlotMap,
  } = useMirrorDungeonData({ lang, gifts, recipes, themes, events, choices, selectedThemeId, giftIdParam })
  const setSelected = useCallback((gift: EgoGift | null) => startTransition(() => { void setGiftIdParam(gift ? String(gift.id) : null) }), [setGiftIdParam])
  const [packIdParam, setPackIdParam] = useQueryState('pack', parseAsString.withDefault(''))
  const expandedThemeId = packIdParam && themes.some(t => String(t.id) === packIdParam) ? Number(packIdParam) : null
  const setExpandedThemeId = useCallback((id: number | null) => startTransition(() => { void setPackIdParam(id === null ? null : String(id)) }), [setPackIdParam])
  const [eventIdParam, setEventIdParam] = useQueryState('event', parseAsString.withDefault(''))
  const selectedEvent = eventById.get(Number(eventIdParam)) ?? null
  const setSelectedEvent = (event: MdEvent | null) => startTransition(() => { void setEventIdParam(event ? String(event.id) : null) })

  // The gift and pack windows opened one from another: one shows at a time, and the last entry is the one on screen.
  const [trail, setTrail] = useState<DetailRef[]>([])
  const showDetail = (ref: DetailRef | null) => startTransition(() => {
    void setGiftIdParam(ref?.kind === 'gift' ? ref.id : null)
    void setPackIdParam(ref?.kind === 'pack' ? ref.id : null)
  })
  const current: DetailRef | null = selected ? { kind: 'gift', id: String(selected.id) } : expandedThemeId !== null ? { kind: 'pack', id: String(expandedThemeId) } : null
  // A window opened from a list or by its address starts a new trail.
  const onTrail = current !== null && trail.length > 0 && refKey(trail[trail.length - 1]) === refKey(current)
  const moveTo = (next: DetailRef) => {
    setTrail(stepInto(onTrail ? trail : current ? [current] : [], next, refKey))
    showDetail(next)
  }
  const closeDetail = () => { setTrail([]); showDetail(null) }
  const previous = onTrail ? trail[trail.length - 2] : undefined
  const back = (() => {
    if (!previous) return undefined
    const onClick = () => { setTrail(trail.slice(0, -1)); showDetail(previous) }
    if (previous.kind === 'gift') {
      const gift = gifts.find(g => String(g.id) === previous.id)
      return gift && { name: getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, lang), image: gift.image_url, onClick }
    }
    const theme = themes.find(th => String(th.id) === previous.id)
    return theme && {
      name: getLocalizedName({ name_kr: theme.name, name_en: theme.name_en, name_jp: theme.name_jp }, lang),
      image: getThemePackVisualConfig(theme.id) ? getThemePackCompositeImageUrl(theme.id) : theme.image_url,
      onClick,
    }
  })()

  const tabs = (['gifts', 'themes', 'events'] as const).map(tab => ({
    key: tab,
    label: tab === 'gifts' ? t('mirrorDungeon.tab.gifts') : tab === 'themes' ? t('mirrorDungeon.tab.themes') : t('mirrorDungeon.tab.events'),
    count: tab === 'gifts' ? gifts.length : tab === 'themes' ? themes.length : eventCount,
  }))

  return (
    <div className={`min-h-screen px-4 pb-16 md:px-6 ${checkMode ? 'pt-1' : 'mx-auto max-w-7xl pt-[5.5rem]'}`}>
      {/* 헤더 + 탭 */}
      <div className={checkMode ? 'hidden' : 'mb-2'}>
        <PageHeader title={lang === 'ko' ? '거울 던전' : lang === 'ja' ? 'ミラーダンジョン' : 'Mirror Dungeon'} />

        {themes.length > 0 && (
          <div role="tablist" aria-label={tp('tabsLabel')} className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ borderBottom: '1px solid #2e2417' }}>
            {tabs.map(tab => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex min-h-[3rem] flex-1 shrink-0 items-baseline justify-center gap-1.5 whitespace-nowrap px-2 pt-2 text-[0.9375rem] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gold-light)] sm:flex-none sm:justify-start sm:px-5 sm:text-[1.0625rem]"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: isActive ? 'var(--text-primary)' : '#9c8b73',
                    borderBottom: `3px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
                    marginBottom: '-1px',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                  <span className="tabular-nums" style={{ fontFamily: 'var(--font-title)', fontSize: '1.25rem', lineHeight: 1, color: isActive ? 'var(--gold-light)' : 'var(--text-muted)' }}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 기프트 탭 */}
      {activeTab === 'gifts' && (
          <GiftTab
            gifts={gifts}
            themes={themes}
            search={search}
            keywords={keywords}
            grades={grades}
            tiers={tiers}
            sortBy={sortBy}
            sortDesc={sortDesc}
            slotFilter={slotFilter}
            selectedThemeId={selectedThemeId}
            themeGiftNames={themeGiftNames}
            giftSlotMap={giftSlotMap}
            inputValue={inputValue}
            setInputValue={setInputValue}
            setSearch={setSearch}
            setKeywords={setKeywords}
            setGrades={setGrades}
            setTiers={setTiers}
            setSortBy={setSortBy}
            setSortDesc={setSortDesc}
            setSlotFilter={setSlotFilter}
            setSelectedThemeId={setSelectedThemeId}
            getGiftKeywordIcon={getGiftKeywordIcon}
            recipes={recipes}
            onSelectGift={setSelected}
            checkMode={checkMode}
            onCheckModeChange={setCheckMode}
          />
      )}

      {/* 테마팩 탭 */}
      {activeTab === 'themes' && themes.length > 0 && (
          <ThemeTab
            lang={lang}
            themes={themes}
            gifts={gifts}
            giftByGameId={giftByGameId}
            themeSearch={themeSearch}
            themeDiffFilter={themeDiffFilter}
            setThemeSearch={setThemeSearch}
            setThemeDiffFilter={setThemeDiffFilter}
            onThemeClick={setExpandedThemeId}
          />
      )}

      {/* 이벤트 탭 */}
      {activeTab === 'events' && events.length > 0 && (
        <ScrollReveal variant={fadeInUp} as="div">
          <EventTab
            lang={lang}
            events={localizedEvents}
            choicesByEventId={choicesByEventId}
            giftByGameId={giftByGameId}
            themes={themes}
            eventSearch={eventSearch}
            setEventSearch={setEventSearch}
            eventThemeFilter={eventThemeParam}
            setEventThemeFilter={(v) => setEventThemeParam(v === '' ? null : v)}

            onSelectEvent={setSelectedEvent}
          />
        </ScrollReveal>
      )}

      {/* 테마팩 모달 */}
      {expandedThemeId !== null && (() => {
        const theme = themes.find(t => t.id === expandedThemeId)
        if (!theme) return null
        const allGiftIds = new Set([...theme.ego_gift_ids, ...theme.specific_ego_gift_ids, ...(theme.fixed_reward_gift_ids ?? [])])
        const themeGifts = [...allGiftIds].map(gid => giftByGameId.get(gid)).filter(Boolean) as EgoGift[]
        return (
          <ThemeModal
            lang={lang}
            theme={theme}
            themeGifts={themeGifts}
            getGiftKeywordIcon={getGiftKeywordIcon}
            onClose={closeDetail}
            onSelectGift={gift => moveTo({ kind: 'gift', id: String(gift.id) })}
            back={back}
            events={localizedEvents}
            choiceCountByEventId={choiceCountByEventId}
          />
        )
      })()}

      {/* 기프트 상세 모달 */}
      {selected && (() => {
        const resolvedGift = {
          ...selected,
          effect_base: selected.effect_base?.replace('{0}', selected.convert_to ? `→ [${giftNameByGameId.get(selected.convert_to) ?? selected.convert_to}]` : '') ?? null,
          effect_base_en: selected.effect_base_en?.replace('{0}', selected.convert_to ? `→ [${giftNameByGameId.get(selected.convert_to) ?? selected.convert_to}]` : '') ?? null,
          effect_base_jp: selected.effect_base_jp?.replace('{0}', selected.convert_to ? `→ [${giftNameByGameId.get(selected.convert_to) ?? selected.convert_to}]` : '') ?? null,
        }
        return (
          <GiftModal
            gift={resolvedGift}
            recipe={recipeMap.get(selected.name) ?? null}
            giftImageMap={giftImageMap}
            giftNameMap={giftNameMap}
            onClose={closeDetail}
            getGiftKeywordIcon={getGiftKeywordIcon}
            themes={themes}
            onThemeClick={id => moveTo({ kind: 'pack', id: String(id) })}
            gifts={gifts}
            onSelectGift={gift => moveTo({ kind: 'gift', id: String(gift.id) })}
            back={back}
          />
        )
      })()}

      {/* 이벤트 상세 모달 */}
      {selectedEvent && (
        <EventModal
          lang={lang}
          event={selectedEvent}
          eventById={eventById}
          choicesByEventId={choicesByEventId}
          giftByGameId={giftByGameId}
          themes={themes}
          onClose={() => setSelectedEvent(null)}
          onSelectGift={setSelected}
        />
      )}
    </div>
  )
}
