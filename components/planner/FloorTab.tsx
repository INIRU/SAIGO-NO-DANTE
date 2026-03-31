'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, X, Plus, Package } from 'lucide-react'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import type { PlannerState, PlannerAction, ThemeData, GiftData } from '@/lib/planner/types'
import { DIFFICULTY_FLOOR_KEY } from '@/lib/planner/types'
import { getAvailableThemes, computeKeywordDistribution } from '@/lib/planner/fusion'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import {
  useNoteAutocomplete,
  NoteAutocompleteDropdown,
  buildKeywordPool,
  buildEgoGiftPool,
  type AutocompleteSuggestion,
} from '@/components/notes/NoteAutocomplete'
import { NoteRenderer, type NoteEgoGiftEntry } from '@/components/decks/NoteChips'

import { STORAGE_BASE } from '@/lib/constants/game'
const OCTAGON_CLIP = 'polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)'

const GRADE_ROMAN: Record<string, string> = {
  'EX': 'EX', '5': '\u2164', '4': '\u2163', '3': '\u2162', '2': '\u2161', '1': '\u2160',
}

const SLUG_TO_KEYWORD: Record<string, string> = {
  burn: '화상', bleed: '출혈', tremor: '진동', rupture: '파열',
  sinking: '침잠', breath: '호흡', charge: '충전', slash: '참격',
  pierce: '관통', blunt: '타격',
}
const STATS_SLUGS = new Set(['slash', 'pierce', 'blunt'])

function getKeywordSlug(keyword: string | null): string | null {
  if (!keyword) return null
  for (const [slug, kw] of Object.entries(SLUG_TO_KEYWORD)) {
    if (keyword.includes(kw) || kw.includes(keyword)) return slug
  }
  return null
}

function getKeywordIconUrl(slug: string): string | null {
  if (STATS_SLUGS.has(slug)) return `${STORAGE_BASE}/icons/stats/${slug}.webp`
  return `${STORAGE_BASE}/icons/keywords/${slug}.webp`
}

// ── FloorMemo: 자동완성 지원 메모 입력 ──────────────────────────────────────
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
  const ref = useRef<HTMLTextAreaElement>(null)
  const ac = useNoteAutocomplete({
    text: value,
    setText: onChange,
    textareaRef: ref,
    pool,
  })

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        value={value}
        onChange={e => {
          onChange(e.target.value)
          ac.onTextChange(e)
        }}
        onSelect={ac.onTextSelect}
        onKeyDown={ac.handleKeyDown}
        placeholder="이번 층 전략 메모... (키워드·기프트 자동완성 지원)"
        rows={4}
        style={{
          width: '100%',
          background: '#0d0b08',
          border: '1px solid #333',
          borderRadius: '0.375rem',
          padding: '0.5rem 0.625rem',
          color: '#e5e7eb',
          fontSize: '0.8125rem',
          lineHeight: 1.5,
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#c8900a' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#333' }}
      />
      <NoteAutocompleteDropdown
        suggestions={ac.suggestions}
        selectedIdx={ac.selectedIdx}
        onSelect={ac.select}
        onHover={ac.setSelectedIdx}
      />
      {value.trim() && (
        <div style={{
          marginTop: '0.375rem', background: '#0d0b08', border: '1px solid #222',
          borderRadius: '0.375rem', padding: '0.5rem 0.625rem',
        }}>
          <div style={{ fontSize: '0.5625rem', color: '#4b5563', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>미리보기</div>
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
  const [expandedFloor, setExpandedFloor] = useState<number | null>(null)
  const [themeModalFloor, setThemeModalFloor] = useState<number | null>(null)
  const [giftPickerFloor, setGiftPickerFloor] = useState<number | null>(null)

  // 모달 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (themeModalFloor !== null) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [themeModalFloor])

  const diffKey = DIFFICULTY_FLOOR_KEY[state.difficulty]

  const themeMap = useMemo(() => new Map(themes.map(t => [t.id, t])), [themes])

  // 자동완성 풀: 키워드 + 기프트
  const kwContext = useKeywordData()
  const acPool = useMemo(() => {
    const kwPool = buildKeywordPool(kwContext.keywords)
    const giftPool = buildEgoGiftPool(
      gifts.filter(g => g.keyword && g.name).map(g => ({
        name: g.name,
        keyword: g.keyword!,
        image_url: g.image_url,
      }))
    )
    return [...kwPool, ...giftPool]
  }, [kwContext, gifts])

  const allowedKeywords = useMemo(() => new Set(Object.keys(kwContext.keywords)), [kwContext.keywords])

  const egoGiftLookup = useMemo(() => {
    const map: Record<string, NoteEgoGiftEntry> = {}
    for (const g of gifts) {
      if (g.name && g.keyword) {
        map[g.name] = { name: g.name, keyword: g.keyword, grade: g.grade ?? '1', image_url: g.image_url, effect_base: g.effect_base }
      }
    }
    return map
  }, [gifts])

  // 최종 기프트 목록에서 game_id Set 추출
  const finalGiftIds = useMemo(() => {
    return new Set(
      state.giftInventory
        .filter(id => id.startsWith('final_'))
        .map(id => parseInt(id.replace('final_', '').replace('_plusplus', '').replace('_plus', '')))
        .filter(n => !isNaN(n))
    )
  }, [state.giftInventory])

  // 누적 키워드 분포
  const keywordDistribution = useMemo(() => {
    const allGiftIds = state.floorPlan.flatMap(f => f.gift_ids)
    const giftKeywords = allGiftIds
      .map(id => giftMap.get(parseInt(id)))
      .filter(Boolean)
      .filter(g => g!.keyword)
      .map(g => [g!.keyword as string])
    return computeKeywordDistribution(giftKeywords)
  }, [state.floorPlan, giftMap])

  const totalGiftCount = state.floorPlan.reduce((sum, f) => sum + f.gift_ids.length, 0)

  const toggleFloor = useCallback((floor: number) => {
    setExpandedFloor(prev => prev === floor ? null : floor)
    setThemeModalFloor(null)
    setGiftPickerFloor(null)
  }, [])

  const selectTheme = useCallback((floor: number, themeId: string | null) => {
    dispatch({ type: 'SET_FLOOR_THEME', floor, themeId })
    setThemeModalFloor(null)
  }, [dispatch])

  const toggleGiftId = useCallback((floor: number, giftGameId: string, currentIds: string[]) => {
    if (currentIds.includes(giftGameId)) {
      dispatch({ type: 'SET_FLOOR_GIFTS', floor, giftIds: currentIds.filter(id => id !== giftGameId) })
    } else {
      dispatch({ type: 'SET_FLOOR_GIFTS', floor, giftIds: [...currentIds, giftGameId] })
      // 최종 기프트에 없으면 자동 추가
      const gid = parseInt(giftGameId)
      if (!isNaN(gid) && !finalGiftIds.has(gid)) {
        dispatch({ type: 'ADD_GIFT', giftId: `final_${gid}` })
      }
    }
  }, [dispatch, finalGiftIds])

  // 테마에서 얻을 수 있는 기프트 전체
  function getThemeAvailableGifts(theme: ThemeData): GiftData[] {
    const themeGiftIds = [...(theme.ego_gift_ids ?? []), ...(theme.specific_ego_gift_ids ?? [])]
    return themeGiftIds
      .map(gid => giftMap.get(gid))
      .filter(Boolean) as GiftData[]
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {state.floorPlan.map((entry) => {
        const availableThemes = getAvailableThemes(themes, diffKey, entry.floor)
        const selectedTheme = entry.theme_id ? themeMap.get(entry.theme_id) : null
        const isExpanded = expandedFloor === entry.floor
        const floorGifts = entry.gift_ids.map(id => giftMap.get(parseInt(id))).filter(Boolean) as GiftData[]

        return (
          <div
            key={entry.floor}
            style={{
              background: '#1a1510',
              border: `1px solid ${isExpanded ? '#c8900a' : '#222'}`,
              borderRadius: '0.5rem',
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}
          >
            {/* --- Collapsed header --- */}
            <button
              onClick={() => toggleFloor(entry.floor)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                padding: '0.625rem 0.75rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#e5e7eb',
              }}
            >
              {/* Floor badge */}
              <span style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '50%',
                background: selectedTheme ? '#c8900a' : '#222',
                color: selectedTheme ? '#0d0b08' : '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {entry.floor}
              </span>

              {/* Theme preview or placeholder */}
              {selectedTheme ? (
                <>
                  {selectedTheme.image_url && (
                    <div style={{ position: 'relative', width: '1.75rem', height: '3.175rem', flexShrink: 0 }}>
                      <Image
                        src={selectedTheme.image_url}
                        alt={selectedTheme.name}
                        width={18}
                        height={33}
                        style={{ width: '1.75rem', height: '3.175rem', objectFit: 'cover', borderRadius: '0.1875rem' }}
                      />
                      {selectedTheme.boss_image_url && (
                        <Image
                          src={selectedTheme.boss_image_url}
                          alt="보스"
                          width={28}
                          height={32}
                          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '1.625rem', height: '1.8rem', objectFit: 'contain', opacity: 0.85 }}
                        />
                      )}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#e8b030',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {selectedTheme.name}
                    </div>
                    {entry.gift_ids.length > 0 && (
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.0625rem' }}>
                        획득 기프트 {entry.gift_ids.length}개
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, fontSize: '0.8125rem', color: '#4b5563' }}>
                  {availableThemes.length > 0
                    ? `테마팩 미선택 (${availableThemes.length}개 가능)`
                    : '해당 층 없음'}
                </div>
              )}

              {isExpanded
                ? <ChevronUp size={14} color="#6b7280" style={{ flexShrink: 0 }} />
                : <ChevronDown size={14} color="#6b7280" style={{ flexShrink: 0 }} />}
            </button>

            {/* --- Expanded content --- */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid #222', padding: '0.75rem' }}>
                {/* ===== 테마팩 선택 ===== */}
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    테마팩 선택
                  </div>

                  {/* Selected theme display or selector button */}
                  {selectedTheme ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.5rem',
                      background: 'rgba(200,144,10,0.08)',
                      borderRadius: '0.375rem',
                      border: '1px solid rgba(200,144,10,0.2)',
                    }}>
                      {selectedTheme.image_url && (
                        <div style={{ position: 'relative', width: '2.375rem', height: '4.3125rem', flexShrink: 0 }}>
                          <Image
                            src={selectedTheme.image_url}
                            alt={selectedTheme.name}
                            width={38}
                            height={69}
                            style={{ width: '2.375rem', height: '4.3125rem', objectFit: 'cover', borderRadius: '0.25rem' }}
                          />
                          {selectedTheme.boss_image_url && (
                            <Image
                              src={selectedTheme.boss_image_url}
                              alt="보스"
                              width={40}
                              height={44}
                              style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '2.25rem', height: '2.5rem', objectFit: 'contain', opacity: 0.85 }}
                            />
                          )}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e8b030' }}>
                          {selectedTheme.name}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                          기프트 {(selectedTheme.ego_gift_ids?.length ?? 0) + (selectedTheme.specific_ego_gift_ids?.length ?? 0)}종
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                        <button
                          onClick={() => setThemeModalFloor(entry.floor)}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid #333',
                            borderRadius: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.6875rem',
                            color: '#9ca3af',
                            cursor: 'pointer',
                          }}
                        >
                          변경
                        </button>
                        <button
                          onClick={() => selectTheme(entry.floor, null)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            color: '#6b7280',
                          }}
                          title="선택 해제"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setThemeModalFloor(entry.floor)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px dashed #333',
                        borderRadius: '0.375rem',
                        color: '#6b7280',
                        fontSize: '0.8125rem',
                        cursor: availableThemes.length > 0 ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                      }}
                      disabled={availableThemes.length === 0}
                    >
                      <Package size={14} />
                      {availableThemes.length > 0
                        ? `테마팩 선택 (${availableThemes.length}개)`
                        : '이 층에 사용 가능한 테마팩 없음'}
                    </button>
                  )}

                </div>

                {/* ===== 획득 기프트 선택 ===== */}
                {selectedTheme && (
                  <div style={{ marginBottom: '0.875rem' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      획득 기프트
                    </div>

                    {/* Selected gifts */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-start' }}>
                      {floorGifts.map(gift => {
                        const kwSlug = getKeywordSlug(gift.keyword ?? null)
                        const kwIconUrl = kwSlug ? getKeywordIconUrl(kwSlug) : null
                        return (
                          <div
                            key={gift.game_id}
                            style={{
                              width: '4.5rem',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                            onClick={() => toggleGiftId(entry.floor, String(gift.game_id), entry.gift_ids)}
                          >
                            <div style={{
                              position: 'relative',
                              width: '100%',
                              aspectRatio: '1',
                              overflow: 'hidden',
                              backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              clipPath: OCTAGON_CLIP,
                              outline: '2px solid #c8900a',
                              outlineOffset: '2px',
                            }}>
                              {/* Grade */}
                              <span style={{
                                position: 'absolute', top: '4%', left: '3%', zIndex: 10, pointerEvents: 'none',
                                fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                                fontWeight: 700, fontSize: '1.25rem', lineHeight: 1,
                                color: (gift.grade === 'EX') ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
                                textShadow: (gift.grade === 'EX')
                                  ? '0 0 0.625rem rgb(251,255,8), 0 0 0.25rem rgb(12,90,0), 0.0625rem 0.0625rem 0.125rem rgba(0,0,0,0.8)'
                                  : '0 0 0.5rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
                              }}>
                                {GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade}
                              </span>
                              {/* Keyword icon */}
                              {kwIconUrl && (
                                <div style={{ position: 'absolute', bottom: 0, right: 0, zIndex: 10, pointerEvents: 'none', width: '30%', height: '30%' }}>
                                  <Image src={kwIconUrl} alt="" fill sizes="40px" style={{ objectFit: 'contain' }} />
                                </div>
                              )}
                              {/* Gift image */}
                              <div style={{ position: 'absolute', inset: '15%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {gift.image_url?.startsWith('http') ? (
                                  <Image src={gift.image_url} alt={gift.name} fill style={{ objectFit: 'contain' }} sizes="80px" />
                                ) : (
                                  <div style={{ width: '1.75rem', height: '1.75rem', background: '#333', borderRadius: '50%' }} />
                                )}
                              </div>
                              {/* Remove overlay on hover */}
                              <div style={{
                                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s', zIndex: 20,
                              }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '0' }}
                              >
                                <X size={18} color="#ef4444" />
                              </div>
                            </div>
                            <span style={{
                              fontSize: '0.625rem', color: '#e5e7eb', textAlign: 'center',
                              marginTop: '0.25rem', lineHeight: 1.2, width: '100%',
                              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>
                              {gift.name}
                            </span>
                          </div>
                        )
                      })}

                      {/* Add button */}
                      <div
                        onClick={() => setGiftPickerFloor(giftPickerFloor === entry.floor ? null : entry.floor)}
                        style={{
                          width: '4.5rem',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{
                          width: '100%',
                          aspectRatio: '1',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px dashed #444',
                          clipPath: OCTAGON_CLIP,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6b7280',
                        }}>
                          <Plus size={20} />
                        </div>
                        <span style={{ fontSize: '0.625rem', color: '#4b5563', marginTop: '0.25rem' }}>추가</span>
                      </div>
                    </div>

                    {/* Gift picker dropdown */}
                    {giftPickerFloor === entry.floor && (() => {
                      const available = getThemeAvailableGifts(selectedTheme)
                      if (available.length === 0) {
                        return (
                          <div style={{
                            marginTop: '0.5rem',
                            padding: '0.75rem',
                            background: '#151210',
                            border: '1px solid #333',
                            borderRadius: '0.375rem',
                            fontSize: '0.75rem',
                            color: '#4b5563',
                            textAlign: 'center',
                          }}>
                            최종 기프트 목록에 이 테마의 기프트가 없습니다
                          </div>
                        )
                      }
                      return (
                        <div style={{
                          marginTop: '0.5rem',
                          background: '#151210',
                          border: '1px solid #333',
                          borderRadius: '0.375rem',
                          padding: '0.625rem',
                          maxHeight: '18rem',
                          overflowY: 'auto',
                        }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {available.map(gift => {
                              const isAdded = entry.gift_ids.includes(String(gift.game_id))
                              const isInFinal = finalGiftIds.has(gift.game_id)
                              const kwSlug = getKeywordSlug(gift.keyword ?? null)
                              const kwIconUrl = kwSlug ? getKeywordIconUrl(kwSlug) : null
                              return (
                                <div
                                  key={gift.game_id}
                                  onClick={() => toggleGiftId(entry.floor, String(gift.game_id), entry.gift_ids)}
                                  style={{
                                    width: '4.5rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    opacity: isAdded ? 1 : 0.55,
                                    transition: 'opacity 0.15s, transform 0.15s',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.05)' }}
                                  onMouseLeave={e => { if (!isAdded) e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.transform = 'scale(1)' }}
                                >
                                  <div style={{
                                    position: 'relative',
                                    width: '100%',
                                    aspectRatio: '1',
                                    overflow: 'hidden',
                                    backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    clipPath: OCTAGON_CLIP,
                                    outline: isAdded ? '2px solid #c8900a' : 'none',
                                    outlineOffset: '2px',
                                  }}>
                                    <span style={{
                                      position: 'absolute', top: '4%', left: '3%', zIndex: 10, pointerEvents: 'none',
                                      fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                                      fontWeight: 700, fontSize: '1.25rem', lineHeight: 1,
                                      color: 'rgb(251, 183, 46)',
                                      textShadow: '0 0 0.5rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
                                    }}>
                                      {GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade}
                                    </span>
                                    {kwIconUrl && (
                                      <div style={{ position: 'absolute', bottom: 0, right: 0, zIndex: 10, pointerEvents: 'none', width: '30%', height: '30%' }}>
                                        <Image src={kwIconUrl} alt="" fill sizes="40px" style={{ objectFit: 'contain' }} />
                                      </div>
                                    )}
                                    <div style={{ position: 'absolute', inset: '15%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {gift.image_url?.startsWith('http') ? (
                                        <Image src={gift.image_url} alt={gift.name} fill style={{ objectFit: 'contain' }} sizes="80px" />
                                      ) : (
                                        <div style={{ width: '1.75rem', height: '1.75rem', background: '#333', borderRadius: '50%' }} />
                                      )}
                                    </div>
                                    {isAdded && (
                                      <div style={{
                                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        zIndex: 20, background: 'rgba(200,144,10,0.22)',
                                      }}>
                                        <span style={{ color: '#e8b030', fontSize: '1.5rem', textShadow: '0 0 0.5rem rgba(200,144,10,0.6)' }}>✓</span>
                                      </div>
                                    )}
                                  </div>
                                  <span style={{
                                    fontSize: '0.625rem', color: isAdded ? '#e8b030' : '#9ca3af', textAlign: 'center',
                                    marginTop: '0.25rem', lineHeight: 1.2, width: '100%',
                                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                  }}>
                                    {gift.name}
                                    {!isInFinal && !isAdded && (
                                      <span style={{ display: 'block', fontSize: '0.5rem', color: '#4898b0', marginTop: '0.0625rem' }}>+최종 추가</span>
                                    )}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* ===== 플랜 메모 ===== */}
                <div>
                  <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    플랜 메모
                  </div>
                  <FloorMemo
                    value={entry.memo}
                    onChange={memo => dispatch({ type: 'SET_FLOOR_MEMO', floor: entry.floor, memo })}
                    pool={acPool}
                    allowedKeywords={allowedKeywords}
                    egoGiftLookup={egoGiftLookup}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ===== 누적 키워드 분포 ===== */}
      {keywordDistribution.length > 0 && (
        <div style={{
          background: '#1a1510',
          border: '1px solid #222',
          borderRadius: '0.5rem',
          padding: '0.875rem 1rem',
        }}>
          <div style={{ fontSize: '0.8125rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
            누적 기프트 키워드 분포
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {keywordDistribution.slice(0, 10).map(({ keyword, count }) => {
              const max = keywordDistribution[0].count
              return (
                <div key={keyword} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#e5e7eb', width: '4rem', flexShrink: 0 }}>
                    {keyword}
                  </span>
                  <div style={{ flex: 1, height: '0.375rem', background: '#222', borderRadius: '0.25rem', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(count / max) * 100}%`,
                      background: '#c8900a',
                      borderRadius: '0.25rem',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: '#8a6010', width: '1.5rem', textAlign: 'right', flexShrink: 0 }}>
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '0.625rem', fontSize: '0.6875rem', color: '#4b5563' }}>
            총 {totalGiftCount}개 기프트
          </div>
        </div>
      )}

      {/* ===== 테마팩 선택 모달 ===== */}
      {themeModalFloor !== null && (() => {
        const modalEntry = state.floorPlan.find(e => e.floor === themeModalFloor)
        if (!modalEntry) return null
        const modalAvailable = getAvailableThemes(themes, diffKey, themeModalFloor)
        // 다른 층에서 이미 선택된 테마 제외
        const usedThemeIds = new Set(
          state.floorPlan
            .filter(f => f.floor !== themeModalFloor && f.theme_id)
            .map(f => f.theme_id!)
        )
        const filteredThemes = modalAvailable.filter(t => !usedThemeIds.has(t.id))

        return (
          <div
            onClick={() => setThemeModalFloor(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: '#131110',
                border: '1px solid #333',
                borderRadius: '0.75rem',
                width: '100%',
                maxWidth: '52rem',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1rem',
                borderBottom: '1px solid #222',
                flexShrink: 0,
              }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#e8b030',
                  margin: 0,
                  fontFamily: 'var(--font-title), sans-serif',
                }}>
                  {themeModalFloor}층 테마팩 선택
                </h3>
                <button
                  onClick={() => setThemeModalFloor(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '0.25rem',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Grid */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem',
              }}>
                {filteredThemes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#4b5563', fontSize: '0.875rem' }}>
                    사용 가능한 테마팩이 없습니다
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
                    gap: '0.75rem',
                  }}>
                    {filteredThemes.map(theme => {
                      const isSelected = modalEntry.theme_id === theme.id
                      const tGiftCount = (theme.ego_gift_ids?.length ?? 0) + (theme.specific_ego_gift_ids?.length ?? 0)
                      return (
                        <button
                          key={theme.id}
                          onClick={() => selectTheme(themeModalFloor, theme.id)}
                          style={{
                            background: isSelected ? 'rgba(200,144,10,0.12)' : '#1a1510',
                            border: isSelected ? '2px solid #c8900a' : '1px solid #222',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textAlign: 'left',
                            padding: 0,
                            transition: 'border-color 0.2s, background 0.2s',
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = 'rgba(200,144,10,0.35)'
                              e.currentTarget.style.background = '#1f1a13'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#222'
                              e.currentTarget.style.background = '#1a1510'
                            }
                          }}
                        >
                          {/* Theme image with boss overlay */}
                          <div style={{ position: 'relative', width: '100%', overflow: 'hidden', aspectRatio: '380/690' }}>
                            {theme.image_url ? (
                              <ImageWithFallback
                                src={theme.image_url}
                                alt={theme.name}
                                fill
                                fallbackType="theme"
                                sizes="(max-width: 640px) 50vw, 25vw"
                                style={{ objectFit: 'cover', opacity: 0.85 }}
                              />
                            ) : (
                              <div style={{ position: 'absolute', inset: 0, background: '#222' }} />
                            )}
                            {theme.boss_image_url && (
                              <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                              }}>
                                <div style={{ position: 'relative', width: '100%', aspectRatio: '391/432' }}>
                                  <ImageWithFallback
                                    src={theme.boss_image_url}
                                    alt=""
                                    fill
                                    fallbackType="default"
                                    sizes="(max-width: 640px) 33vw, 20vw"
                                    style={{ objectFit: 'contain', filter: 'drop-shadow(0 0.125rem 0.25rem rgba(0,0,0,0.5))' }}
                                  />
                                </div>
                              </div>
                            )}
                            {/* Gradient overlay */}
                            <div style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'linear-gradient(to top, rgba(13,11,8,0.9) 0%, rgba(13,11,8,0.3) 50%, transparent 100%)',
                            }} />
                            {/* Bottom info */}
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              padding: '0 0.5rem 0.375rem',
                            }}>
                              <div style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#fff',
                                lineHeight: 1.3,
                                textShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,0.8)',
                                fontFamily: 'var(--font-title), sans-serif',
                              }}>
                                {theme.name}
                              </div>
                              <div style={{
                                fontSize: '0.625rem',
                                color: 'rgba(255,255,255,0.6)',
                                marginTop: '0.125rem',
                                fontFamily: 'var(--font-mono), monospace',
                              }}>
                                {tGiftCount}종
                              </div>
                            </div>
                            {/* Selected checkmark */}
                            {isSelected && (
                              <div style={{
                                position: 'absolute',
                                top: '0.375rem',
                                right: '0.375rem',
                                width: '1.5rem',
                                height: '1.5rem',
                                borderRadius: '50%',
                                background: '#c8900a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                color: '#0d0b08',
                                fontWeight: 700,
                                boxShadow: '0 0.125rem 0.375rem rgba(0,0,0,0.4)',
                              }}>
                                ✓
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
