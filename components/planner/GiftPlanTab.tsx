'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import { X, Search, Plus } from 'lucide-react'
import type { PlannerState, PlannerAction, GiftData } from '@/lib/planner/types'

const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
}

type GiftSubTab = 'observe' | 'start' | 'final'

const GRADE_ROMAN: Record<string, string> = {
  '5': 'Ⅴ', '4': 'Ⅳ', '3': 'Ⅲ', '2': 'Ⅱ', '1': 'Ⅰ',
}

const KEYWORD_TABS = [
  { label: '전체', slug: null },
  { label: '화상', slug: 'burn' },
  { label: '출혈', slug: 'bleed' },
  { label: '진동', slug: 'tremor' },
  { label: '파열', slug: 'rupture' },
  { label: '침잠', slug: 'sinking' },
  { label: '호흡', slug: 'breath' },
  { label: '충전', slug: 'charge' },
  { label: '참격', slug: 'slash' },
  { label: '관통', slug: 'pierce' },
  { label: '타격', slug: 'blunt' },
  { label: '공통', slug: 'general' },
] as const

const SLUG_TO_KEYWORD: Record<string, string> = {
  burn: '화상', bleed: '출혈', tremor: '진동', rupture: '파열',
  sinking: '침잠', breath: '호흡', charge: '충전', slash: '참격',
  pierce: '관통', blunt: '타격', general: '공통/범용',
}

const GRADE_ORDER = ['5', '4', '3', '2', '1']

// 참격/관통/타격은 icons/stats/, 나머지는 icons/keywords/, 공통은 null
const STATS_SLUGS = new Set(['slash', 'pierce', 'blunt'])
function getKeywordIconUrl(slug: string): string | null {
  if (slug === 'general') return null
  if (STATS_SLUGS.has(slug)) return `${STORAGE_BASE}/icons/stats/${slug}.webp`
  return `${STORAGE_BASE}/icons/keywords/${slug}.webp`
}

function getKeywordSlug(keyword: string | null): string | null {
  if (!keyword) return 'general'
  for (const [slug, kw] of Object.entries(SLUG_TO_KEYWORD)) {
    if (keyword.includes(kw) || kw.includes(keyword)) return slug
  }
  return 'general'
}

function GiftImage({ gift, size = 2.5 }: { gift: GiftData; size?: number }) {
  const px = Math.round(size * 16)
  return gift.image_url ? (
    <Image
      src={gift.image_url}
      alt={gift.name}
      width={px}
      height={px}
      style={{ width: `${size}rem`, height: `${size}rem`, objectFit: 'contain', flexShrink: 0 }}
    />
  ) : (
    <div style={{
      width: `${size}rem`, height: `${size}rem`,
      background: '#222', borderRadius: '0.25rem', flexShrink: 0,
    }} />
  )
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const colors: Record<string, string> = {
    '5': '#c8900a', '4': '#7c4fc0', '3': '#2a7fd4', '2': '#2d9e60', '1': '#888',
  }
  return (
    <span style={{
      fontSize: '0.5625rem',
      color: colors[grade] ?? '#888',
      background: `${colors[grade] ?? '#888'}22`,
      border: `1px solid ${colors[grade] ?? '#888'}55`,
      borderRadius: '0.2rem',
      padding: '0 0.25rem',
      lineHeight: 1.6,
      fontWeight: 700,
      flexShrink: 0,
    }}>
      {GRADE_ROMAN[grade] ?? grade}
    </span>
  )
}

// ── Shared: gift grid filtered by keyword ──────────────────────────────────────
function GiftGrid({
  gifts,
  selectedIds,
  onToggle,
}: {
  gifts: GiftData[]
  selectedIds: Set<number>
  onToggle: (gift: GiftData) => void
}) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<number | null>(null)

  const filteredGifts = useMemo(() => {
    if (!activeSlug) return gifts
    return gifts.filter(g => {
      const slug = getKeywordSlug(g.keyword)
      return slug === activeSlug || (activeSlug === 'general' && (!g.keyword || g.keyword.includes('범용') || g.keyword.includes('공통')))
    })
  }, [gifts, activeSlug])

  const grouped = useMemo(() => {
    const map = new Map<string, GiftData[]>()
    for (const grade of GRADE_ORDER) map.set(grade, [])
    for (const g of filteredGifts) {
      const gr = g.grade ?? '1'
      if (!map.has(gr)) map.set(gr, [])
      map.get(gr)!.push(g)
    }
    return map
  }, [filteredGifts])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Keyword filter tabs */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.25rem',
        borderBottom: '1px solid #222', paddingBottom: '0.5rem',
      }}>
        {KEYWORD_TABS.map(tab => {
          const isActive = activeSlug === tab.slug
          return (
            <button
              key={tab.slug ?? 'all'}
              onClick={() => setActiveSlug(tab.slug)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.5rem',
                background: isActive ? 'rgba(200,144,10,0.15)' : 'transparent',
                border: `1px solid ${isActive ? '#c8900a60' : '#333'}`,
                borderRadius: '0.375rem',
                cursor: 'pointer',
                color: isActive ? '#e8b030' : '#777',
                fontSize: '0.75rem',
                fontWeight: isActive ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {tab.slug && getKeywordIconUrl(tab.slug) && (
                <Image
                  src={getKeywordIconUrl(tab.slug)!}
                  alt={tab.label}
                  width={14}
                  height={14}
                  style={{ width: '0.875rem', height: '0.875rem', objectFit: 'contain' }}
                />
              )}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Gift grid grouped by grade */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '22rem', overflowY: 'auto' }}>
        {GRADE_ORDER.map(grade => {
          const gradeGifts = grouped.get(grade) ?? []
          if (gradeGifts.length === 0) return null
          return (
            <div key={grade}>
              <div style={{
                fontSize: '0.6875rem', color: '#666', fontWeight: 600,
                marginBottom: '0.375rem',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
              }}>
                <span style={{
                  color: { '5': '#c8900a', '4': '#7c4fc0', '3': '#2a7fd4', '2': '#2d9e60', '1': '#888' }[grade] ?? '#888',
                }}>
                  {GRADE_ROMAN[grade] ?? grade}등급
                </span>
                <span style={{ color: '#444' }}>({gradeGifts.length})</span>
              </div>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
              }}>
                {gradeGifts.map(gift => {
                  const isSelected = selectedIds.has(gift.game_id)
                  const kwSlug = getKeywordSlug(gift.keyword ?? null)
                  const kwIconUrl = kwSlug ? getKeywordIconUrl(kwSlug) : null
                  return (
                    <div
                      key={gift.id}
                      style={{ position: 'relative' }}
                      onMouseEnter={() => setTooltip(gift.game_id)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <button
                        onClick={() => onToggle(gift)}
                        className="group relative flex flex-col items-center transition-all duration-200 hover:scale-[1.06] hover:z-10"
                        style={{ cursor: 'pointer', width: '4.5rem' }}
                      >
                        {/* 8각형 카드 프레임 */}
                        <div
                          className="relative w-full aspect-square overflow-hidden"
                          style={{
                            backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            clipPath: 'polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)',
                            outline: isSelected ? '2px solid #c8900a' : 'none',
                            outlineOffset: '2px',
                          }}
                        >
                          {/* 등급 라벨 — 왼쪽 위 */}
                          <span
                            className="absolute top-[4%] left-[3%] z-10 pointer-events-none"
                            style={{
                              fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                              fontWeight: 700,
                              fontSize: '1.25rem',
                              lineHeight: 1,
                              color: 'rgb(251, 183, 46)',
                              textShadow: '0 0 0.5rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
                            }}
                          >
                            {GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade}
                          </span>

                          {/* 키워드 아이콘 — 오른쪽 아래 */}
                          {kwIconUrl && (
                            <div className="absolute bottom-0 right-0 z-10 pointer-events-none" style={{ width: '30%', height: '30%' }}>
                              <Image src={kwIconUrl} alt="" fill sizes="40px" className="object-contain" />
                            </div>
                          )}

                          {/* 기프트 이미지 — 중앙 */}
                          <div className="absolute flex items-center justify-center" style={{ inset: '15%' }}>
                            {gift.image_url?.startsWith('http') ? (
                              <Image src={gift.image_url} alt={gift.name} fill className="object-contain" sizes="80px" />
                            ) : (
                              <div style={{ width: '1.75rem', height: '1.75rem', background: '#333', borderRadius: '50%' }} />
                            )}
                          </div>

                          {/* 선택 체크 오버레이 */}
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center z-20" style={{ background: 'rgba(200,144,10,0.2)' }}>
                              <span style={{ color: '#e8b030', fontSize: '1.25rem' }}>✓</span>
                            </div>
                          )}

                          {/* 호버 글로우 */}
                          <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                            style={{ background: 'linear-gradient(135deg, rgba(251,183,46,0.15) 0%, transparent 50%)' }}
                          />
                        </div>

                        {/* 이름 */}
                        <p style={{ fontSize: '0.5625rem', color: '#aaa', textAlign: 'center', marginTop: '0.25rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                          {gift.name}
                        </p>
                      </button>

                      {tooltip === gift.game_id && (
                        <div style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 0.375rem)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#111',
                          border: '1px solid #333',
                          borderRadius: '0.375rem',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.6875rem',
                          color: '#e5e7eb',
                          whiteSpace: 'nowrap',
                          zIndex: 100,
                          pointerEvents: 'none',
                          maxWidth: '10rem',
                          wordBreak: 'keep-all',
                          textAlign: 'center',
                        }}>
                          {gift.name}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {filteredGifts.length === 0 && (
          <div style={{
            padding: '2rem', textAlign: 'center',
            color: '#4b5563', fontSize: '0.8125rem',
            border: '1px dashed #222', borderRadius: '0.5rem',
          }}>
            해당 키워드의 기프트가 없습니다
          </div>
        )}
      </div>
    </div>
  )
}

// ── Selected gift list panel ───────────────────────────────────────────────────
function SelectedPanel({
  title,
  selectedGifts,
  onRemove,
  badge,
}: {
  title: string
  selectedGifts: GiftData[]
  onRemove: (gift: GiftData) => void
  badge?: React.ReactNode
}) {
  return (
    <div style={{
      background: '#111',
      border: '1px solid #222',
      borderRadius: '0.5rem',
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      minWidth: '11rem',
      maxWidth: '14rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>{title}</span>
        {badge}
      </div>
      {selectedGifts.length === 0 ? (
        <div style={{
          padding: '1.5rem 0', textAlign: 'center',
          color: '#3f3f3f', fontSize: '0.75rem',
          border: '1px dashed #1f1f1f', borderRadius: '0.375rem',
        }}>
          선택 없음
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {selectedGifts.map(gift => (
            <div
              key={gift.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.25rem 0.375rem',
                background: '#1a1510',
                border: '1px solid #222',
                borderRadius: '0.375rem',
              }}
            >
              <GiftImage gift={gift} size={1.5} />
              <span style={{
                flex: 1, fontSize: '0.6875rem', color: '#d1d5db',
                lineHeight: 1.3, wordBreak: 'keep-all',
              }}>
                {gift.name}
              </span>
              <GradeBadge grade={gift.grade} />
              <button
                onClick={() => onRemove(gift)}
                style={{
                  background: 'rgba(220,38,38,0.7)', border: 'none',
                  borderRadius: '50%',
                  width: '1rem', height: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0, flexShrink: 0,
                }}
                title="제거"
              >
                <X size={10} color="#fff" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Search add for final tab ───────────────────────────────────────────────────
function GiftSearchAdd({ gifts, selectedIds, onAdd }: {
  gifts: GiftData[]
  selectedIds: Set<number>
  onAdd: (gift: GiftData) => void
}) {
  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => {
    if (!query.trim()) return []
    return gifts.filter(g => g.name.includes(query) && !selectedIds.has(g.game_id)).slice(0, 8)
  }, [query, gifts, selectedIds])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: '#1a1510', border: '1px solid #333',
        borderRadius: '0.375rem', padding: '0.375rem 0.625rem',
      }}>
        <Search size={14} color="#6b7280" />
        <input
          type="text"
          placeholder="기프트 검색하여 추가..."
          value={query}
          onChange={e => { setQuery(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: '0.8125rem', color: '#e5e7eb',
          }}
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 0.25rem)',
          left: 0, right: 0, background: '#1a1510',
          border: '1px solid #333', borderRadius: '0.375rem',
          zIndex: 50, maxHeight: '14rem', overflowY: 'auto',
        }}>
          {suggestions.map(gift => (
            <button
              key={gift.id}
              onClick={() => { onAdd(gift); setQuery(''); setShowSuggestions(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.625rem', background: 'transparent',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer', textAlign: 'left', color: '#e5e7eb',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,144,10,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <GiftImage gift={gift} size={1.75} />
              <span style={{ fontSize: '0.8125rem', flex: 1 }}>{gift.name}</span>
              <GradeBadge grade={gift.grade} />
              {gift.keyword && (
                <span style={{ fontSize: '0.6875rem', color: '#8a6010' }}>{gift.keyword}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GiftPlanTab({ state, dispatch, gifts, giftMap }: Props) {
  const [subTab, setSubTab] = useState<GiftSubTab>('observe')

  const observeIds = useMemo(
    () => new Set(
      state.giftInventory
        .filter(id => id.startsWith('observe_'))
        .map(id => parseInt(id.replace('observe_', '')))
    ),
    [state.giftInventory]
  )
  const startIds = useMemo(
    () => new Set(
      state.giftInventory
        .filter(id => id.startsWith('start_'))
        .map(id => parseInt(id.replace('start_', '')))
    ),
    [state.giftInventory]
  )
  const finalIds = useMemo(
    () => new Set(
      state.giftInventory
        .filter(id => id.startsWith('final_'))
        .map(id => parseInt(id.replace('final_', '')))
    ),
    [state.giftInventory]
  )

  function getGiftsByIds(ids: Set<number>): GiftData[] {
    return Array.from(ids)
      .map(id => giftMap.get(id))
      .filter(Boolean) as GiftData[]
  }

  function toggleGift(gift: GiftData, prefix: string, ids: Set<number>) {
    const key = `${prefix}_${gift.game_id}`
    if (ids.has(gift.game_id)) {
      dispatch({ type: 'REMOVE_GIFT', giftId: key })
    } else {
      dispatch({ type: 'ADD_GIFT', giftId: key })
    }
  }

  const subTabs: { key: GiftSubTab; label: string; count: number }[] = [
    { key: 'observe', label: '관측 기프트', count: observeIds.size },
    { key: 'start', label: '시작 기프트', count: startIds.size },
    { key: 'final', label: '최종 기프트', count: finalIds.size },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #222', paddingBottom: '0' }}>
        {subTabs.map(tab => {
          const isActive = subTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? '#c8900a' : 'transparent'}`,
                cursor: 'pointer',
                color: isActive ? '#e8b030' : '#666',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 700 : 400,
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  fontSize: '0.625rem',
                  background: isActive ? 'rgba(200,144,10,0.2)' : '#1a1510',
                  color: isActive ? '#c8900a' : '#555',
                  border: `1px solid ${isActive ? '#c8900a40' : '#333'}`,
                  borderRadius: '0.75rem',
                  padding: '0 0.375rem',
                  lineHeight: 1.6,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Sub-tab content */}
      {subTab === 'observe' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              관측 비용: <Image src={`${STORAGE_BASE}/icons/start-buffs/starlight.webp`} alt="별빛" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', display: 'inline', verticalAlign: 'middle' }} />{observeIds.size * 70}
            </span>
            <span style={{
              fontSize: '0.6875rem',
              color: observeIds.size >= 3 ? '#c83030' : '#c8900a',
              background: observeIds.size >= 3 ? 'rgba(200,48,48,0.12)' : 'rgba(200,144,10,0.12)',
              padding: '0.125rem 0.5rem',
              borderRadius: '0.25rem',
              border: `1px solid ${observeIds.size >= 3 ? 'rgba(200,48,48,0.3)' : 'rgba(200,144,10,0.3)'}`,
            }}>
              선택 {observeIds.size}/3
            </span>
            <span style={{ fontSize: '0.6875rem', color: '#555' }}>Ⅰ~Ⅲ 등급만 · 잔영 제외</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <GiftGrid
                gifts={gifts.filter(g => {
                  const grade = parseInt(g.grade ?? '0')
                  return grade >= 1 && grade <= 3 && !g.name.includes('잔영')
                })}
                selectedIds={observeIds}
                onToggle={gift => {
                  const key = `observe_${gift.game_id}`
                  if (observeIds.has(gift.game_id)) {
                    dispatch({ type: 'REMOVE_GIFT', giftId: key })
                  } else if (observeIds.size < 3) {
                    dispatch({ type: 'ADD_GIFT', giftId: key })
                  }
                }}
              />
            </div>
            <SelectedPanel
              title="관측 기프트"
              selectedGifts={getGiftsByIds(observeIds)}
              onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `observe_${gift.game_id}` })}
            />
          </div>
        </div>
      )}

      {subTab === 'start' && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <GiftGrid
              gifts={gifts}
              selectedIds={startIds}
              onToggle={gift => {
                const key = `start_${gift.game_id}`
                if (startIds.has(gift.game_id)) {
                  dispatch({ type: 'REMOVE_GIFT', giftId: key })
                } else if (startIds.size < 1) {
                  dispatch({ type: 'ADD_GIFT', giftId: key })
                }
              }}
            />
          </div>
          <SelectedPanel
            title="시작 기프트"
            selectedGifts={getGiftsByIds(startIds)}
            onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `start_${gift.game_id}` })}
            badge={
              <span style={{
                fontSize: '0.6875rem',
                color: startIds.size >= 1 ? '#c83030' : '#c8900a',
                background: startIds.size >= 1 ? 'rgba(200,48,48,0.12)' : 'rgba(200,144,10,0.12)',
                padding: '0.125rem 0.5rem',
                borderRadius: '0.25rem',
                border: `1px solid ${startIds.size >= 1 ? 'rgba(200,48,48,0.3)' : 'rgba(200,144,10,0.3)'}`,
              }}>
                선택 {startIds.size}/1
              </span>
            }
          />
        </div>
      )}

      {subTab === 'final' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
              최종 목표 기프트 빌드
            </span>
            <span style={{
              fontSize: '0.6875rem', color: '#c8900a',
              background: 'rgba(200,144,10,0.12)',
              padding: '0.125rem 0.5rem',
              borderRadius: '0.25rem',
              border: '1px solid rgba(200,144,10,0.3)',
            }}>
              {finalIds.size}개
            </span>
          </div>

          <GiftSearchAdd
            gifts={gifts}
            selectedIds={finalIds}
            onAdd={gift => dispatch({ type: 'ADD_GIFT', giftId: `final_${gift.game_id}` })}
          />

          {/* Quick add from observed/starting */}
          {(observeIds.size > 0 || startIds.size > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {observeIds.size > 0 && (
                <div>
                  <div style={{ fontSize: '0.6875rem', color: '#666', marginBottom: '0.375rem' }}>
                    관측 기프트에서 추가
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {getGiftsByIds(observeIds).map(gift => {
                      const already = finalIds.has(gift.game_id)
                      return (
                        <button
                          key={gift.id}
                          onClick={() => {
                            if (!already) dispatch({ type: 'ADD_GIFT', giftId: `final_${gift.game_id}` })
                          }}
                          disabled={already}
                          title={gift.name}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            background: already ? 'rgba(200,144,10,0.1)' : '#1a1510',
                            border: `1px solid ${already ? '#c8900a60' : '#2a2520'}`,
                            borderRadius: '0.375rem',
                            cursor: already ? 'default' : 'pointer',
                            opacity: already ? 0.6 : 1,
                            color: '#d1d5db', fontSize: '0.6875rem',
                            transition: 'all 0.15s',
                          }}
                        >
                          <GiftImage gift={gift} size={1.25} />
                          <span style={{ wordBreak: 'keep-all' }}>{gift.name}</span>
                          {!already && <Plus size={10} color="#c8900a" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {startIds.size > 0 && (
                <div>
                  <div style={{ fontSize: '0.6875rem', color: '#666', marginBottom: '0.375rem' }}>
                    시작 기프트에서 추가
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {getGiftsByIds(startIds).map(gift => {
                      const already = finalIds.has(gift.game_id)
                      return (
                        <button
                          key={gift.id}
                          onClick={() => {
                            if (!already) dispatch({ type: 'ADD_GIFT', giftId: `final_${gift.game_id}` })
                          }}
                          disabled={already}
                          title={gift.name}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            background: already ? 'rgba(200,144,10,0.1)' : '#1a1510',
                            border: `1px solid ${already ? '#c8900a60' : '#2a2520'}`,
                            borderRadius: '0.375rem',
                            cursor: already ? 'default' : 'pointer',
                            opacity: already ? 0.6 : 1,
                            color: '#d1d5db', fontSize: '0.6875rem',
                            transition: 'all 0.15s',
                          }}
                        >
                          <GiftImage gift={gift} size={1.25} />
                          <span style={{ wordBreak: 'keep-all' }}>{gift.name}</span>
                          {!already && <Plus size={10} color="#c8900a" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Final gift grid */}
          {finalIds.size === 0 ? (
            <div style={{
              padding: '2.5rem', textAlign: 'center',
              color: '#4b5563', fontSize: '0.8125rem',
              border: '1px dashed #222', borderRadius: '0.5rem',
            }}>
              최종 목표 기프트를 추가해주세요
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(5rem, 1fr))',
              gap: '0.5rem',
            }}>
              {getGiftsByIds(finalIds).map(gift => (
                <div
                  key={gift.id}
                  style={{
                    position: 'relative',
                    background: '#1a1510',
                    border: '1px solid #2a2520',
                    borderRadius: '0.375rem',
                    padding: '0.5rem',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '0.25rem',
                  }}
                >
                  <GiftImage gift={gift} size={3} />
                  <GradeBadge grade={gift.grade} />
                  <span style={{
                    fontSize: '0.5625rem', color: '#9ca3af',
                    textAlign: 'center', lineHeight: 1.3,
                    wordBreak: 'keep-all', maxWidth: '100%',
                  }}>
                    {gift.name}
                  </span>
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_GIFT', giftId: `final_${gift.game_id}` })}
                    style={{
                      position: 'absolute', top: '0.125rem', right: '0.125rem',
                      background: 'rgba(220,38,38,0.8)', border: 'none',
                      borderRadius: '50%',
                      width: '1rem', height: '1rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', padding: 0,
                    }}
                    title="제거"
                  >
                    <X size={10} color="#fff" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
