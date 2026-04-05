'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useQueryState, parseAsString } from 'nuqs'
import dynamic from 'next/dynamic'
import { ATK_TYPE_ICON_MAP } from '@/lib/data/sinners'
import { useKeywordData } from '@/components/sinners/KeywordTooltip'
import type { EgoGift, Recipe, EgoGiftTheme, MirrorDungeonEvent } from '@/components/mirror-dungeon/types'
import GiftTab from '@/components/mirror-dungeon/GiftTab'
import ThemeTab from '@/components/mirror-dungeon/ThemeTab'
import EventTab from '@/components/mirror-dungeon/EventTab'
import ThemeModal from '@/components/mirror-dungeon/ThemeModal'

const GiftModal = dynamic(() => import('@/components/mirror-dungeon/GiftModal'), { ssr: false })
const EventModal = dynamic(() => import('@/components/mirror-dungeon/EventModal'), { ssr: false })

export default function MirrorDungeonClient({
  gifts,
  recipes,
  themes = [],
  events = [],
}: {
  gifts: EgoGift[]
  recipes: Recipe[]
  themes?: EgoGiftTheme[]
  events?: MirrorDungeonEvent[]
}) {
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
  const [themeIdParam, setThemeIdParam] = useQueryState('theme', parseAsString.withDefault(''))

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
  const [selected, setSelected] = useState<EgoGift | null>(null)
  const [expandedThemeId, setExpandedThemeId] = useState<number | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<MirrorDungeonEvent | null>(null)

  // 모달 열릴 때 배경 스크롤 잠금
  useEffect(() => {
    const isOpen = !!selected || expandedThemeId !== null || !!selectedEvent
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [selected, expandedThemeId, selectedEvent])

  // ESC로 모달 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expandedThemeId !== null) setExpandedThemeId(null)
        else if (selected) setSelected(null)
        else if (selectedEvent) setSelectedEvent(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expandedThemeId, selected, selectedEvent])

  // game_id → EgoGift 매핑 (테마팩 필터 + EventTab 공용)
  const giftByGameId = useMemo(() => {
    const map = new Map<number, EgoGift>()
    for (const g of gifts) {
      if (g.game_id) map.set(g.game_id, g)
    }
    return map
  }, [gifts])

  // 테마팩별 기프트 이름 Set (GiftTab 필터용)
  const themeGiftNames = useMemo(() => {
    if (!selectedThemeId) return null
    const theme = themes.find(t => t.id === selectedThemeId)
    if (!theme) return null
    const names = new Set<string>()
    for (const gid of theme.ego_gift_ids) {
      const g = giftByGameId.get(gid)
      if (g) names.add(g.name)
    }
    return names
  }, [selectedThemeId, themes, giftByGameId])

  // 레시피 맵: result_name → Recipe
  const recipeMap = useMemo(() => {
    const map = new Map<string, Recipe>()
    recipes.forEach(r => map.set(r.result_name, r))
    return map
  }, [recipes])

  // 기프트 이름 → 이미지 URL 맵
  const giftImageMap = useMemo(() => {
    const map = new Map<string, string>()
    gifts.forEach(g => { if (g.image_url) map.set(g.name, g.image_url) })
    return map
  }, [gifts])

  // 편성 전용 효과 슬롯 번호 파싱 (gift.id → Set<number>)
  const giftSlotMap = useMemo(() => {
    const map = new Map<string, Set<number>>()
    const regex = /\[(?:편성\s*(?:순서\s*)?)?([\d번\s,]+?)(?:\s*인격\s*)?(?:편성\s*)?전용\s*효과\]/g
    for (const g of gifts) {
      const slots = new Set<number>()
      for (const text of [g.effect_base, g.effect_plus, g.effect_plusplus]) {
        if (!text) continue
        regex.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = regex.exec(text)) !== null) {
          const nums = m[1].match(/\d+/g)
          if (nums) nums.forEach(n => slots.add(Number(n)))
        }
      }
      if (slots.size > 0) map.set(g.id, slots)
    }
    return map
  }, [gifts])

  // ThemeModal에서 기프트 선택 시: 테마 모달 닫고 GiftModal 열기
  const handleThemeModalSelectGift = useCallback((gift: EgoGift) => {
    setExpandedThemeId(null)
    setSelected(gift)
  }, [])

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 md:px-6 max-w-7xl mx-auto" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background atmospheric glow */}
      <div style={{
        position: 'fixed',
        top: '-10rem',
        right: '-5rem',
        width: '35rem',
        height: '35rem',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,144,10,0.04) 0%, rgba(200,144,10,0.015) 40%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* 헤더 + 탭 */}
      <div className="mb-10">
        <div className="flex items-end justify-between mb-4 md:mb-6" style={{ position: 'relative', zIndex: 1 }}>
          <div>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, ease: [0.33, 1, 0.68, 1] }}
              style={{
                width: '4rem',
                height: '0.0625rem',
                background: 'linear-gradient(90deg, rgba(200,144,10,0.6), transparent)',
                marginBottom: '1rem',
                transformOrigin: 'left',
              }}
            />
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.33, 1, 0.68, 1] }}
              style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '0.625rem', letterSpacing: '0.15em', marginBottom: '0.375rem' }}
            >
              E.G.O GIFT ARCHIVE
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.33, 1, 0.68, 1] }}
              className="font-serif text-3xl md:text-4xl font-bold"
              style={{ color: 'var(--gold)', textShadow: '0 0 3rem rgba(200,144,10,0.15)' }}
            >
              거울 던전
            </motion.h1>
            <p className="mt-2" style={{ color: '#666688', fontSize: '0.8125rem' }}>
              E.G.O 기프트 도감 · 테마팩 · 조합 레시피
            </p>
          </div>

          {/* 데스크톱 탭 */}
          {themes.length > 0 && (
            <div
              className="hidden md:flex"
              style={{
                background: 'rgba(10,8,5,0.7)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                padding: '0.1875rem',
                gap: '0.125rem',
              }}
            >
              {(['gifts', 'themes', 'events'] as const).map(t => {
                const isActive = activeTab === t
                const label = t === 'gifts' ? '기프트' : t === 'themes' ? '테마팩' : '이벤트'
                const count = t === 'gifts' ? gifts.length : t === 'themes' ? themes.length : events.length
                return (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className="flex items-center gap-1.5 px-4 py-2 transition-all duration-200"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.8125rem',
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#0d0b08' : '#666660',
                      background: isActive ? 'linear-gradient(135deg, var(--gold) 0%, #e8b030 100%)' : 'transparent',
                      borderRadius: '0.375rem',
                      boxShadow: isActive ? '0 0.125rem 0.5rem rgba(200,144,10,0.3)' : 'none',
                      cursor: 'pointer',
                      minWidth: '6rem',
                      justifyContent: 'center',
                    }}
                  >
                    {label}
                    <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 700, opacity: isActive ? 0.7 : 0.5 }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 모바일 탭 */}
        {themes.length > 0 && (
          <div
            className="flex md:hidden mb-4"
            style={{
              background: 'rgba(10,8,5,0.7)',
              border: '1px solid var(--border)',
              borderRadius: '0.5rem',
              padding: '0.1875rem',
              gap: '0.125rem',
            }}
          >
            {(['gifts', 'themes', 'events'] as const).map(t => {
              const isActive = activeTab === t
              const label = t === 'gifts' ? '기프트' : t === 'themes' ? '테마팩' : '이벤트'
              const count = t === 'gifts' ? gifts.length : t === 'themes' ? themes.length : events.length
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className="flex flex-1 items-center gap-1.5 px-3 py-2 transition-all duration-200"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.8125rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#0d0b08' : '#666660',
                    background: isActive ? 'linear-gradient(135deg, var(--gold) 0%, #e8b030 100%)' : 'transparent',
                    borderRadius: '0.375rem',
                    boxShadow: isActive ? '0 0.125rem 0.5rem rgba(200,144,10,0.3)' : 'none',
                    cursor: 'pointer',
                    justifyContent: 'center',
                  }}
                >
                  {label}
                  <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 700, opacity: isActive ? 0.7 : 0.5 }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div style={{ height: '1px', background: 'linear-gradient(90deg, rgba(200,144,10,0.3), transparent 60%)' }} />
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
          recipeMap={recipeMap}
          giftImageMap={giftImageMap}
          onSelectGift={setSelected}
        />
      )}

      {/* 테마팩 탭 */}
      {activeTab === 'themes' && themes.length > 0 && (
        <ThemeTab
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
        <EventTab
          events={events}
          giftByGameId={giftByGameId}
          eventSearch={eventSearch}
          setEventSearch={setEventSearch}
          onSelectEvent={setSelectedEvent}
        />
      )}

      {/* 테마팩 모달 */}
      {expandedThemeId !== null && (() => {
        const theme = themes.find(t => t.id === expandedThemeId)
        if (!theme) return null
        const themeGifts = theme.ego_gift_ids.map(gid => giftByGameId.get(gid)).filter(Boolean) as EgoGift[]
        return (
          <ThemeModal
            theme={theme}
            themeGifts={themeGifts}
            getGiftKeywordIcon={getGiftKeywordIcon}
            onClose={() => setExpandedThemeId(null)}
            onSelectGift={handleThemeModalSelectGift}
          />
        )
      })()}

      {/* 기프트 상세 모달 */}
      {selected && (
        <GiftModal
          gift={selected}
          recipe={recipeMap.get(selected.name) ?? null}
          giftImageMap={giftImageMap}
          onClose={() => setSelected(null)}
          getGiftKeywordIcon={getGiftKeywordIcon}
        />
      )}

      {/* 이벤트 상세 모달 */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          allEvents={events}
          giftByGameId={giftByGameId}
          themes={themes}
          onClose={() => setSelectedEvent(null)}
          onSelectGift={setSelected}
        />
      )}
    </div>
  )
}
