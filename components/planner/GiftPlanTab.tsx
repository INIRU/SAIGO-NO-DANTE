'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import { X, Search, Plus, ChevronRight } from 'lucide-react'
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
  '5': '\u2164', '4': '\u2163', '3': '\u2162', '2': '\u2161', '1': '\u2160',
}

const GRADE_COLORS: Record<string, string> = {
  '5': '#c8900a', '4': '#7c4fc0', '3': '#2a7fd4', '2': '#2d9e60', '1': '#888',
}

const KEYWORD_FILTERS = [
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

const GRADE_ORDER = ['3', '2', '1']
const GRADE_ORDER_ALL = ['5', '4', '3', '2', '1']

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

const OCTAGON_CLIP = 'polygon(12% 0%, 88% 0%, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0% 88%, 0% 12%)'

// ── 8-sided gift card ────────────────────────────────────────────────────────
function GiftCard({
  gift,
  isSelected,
  onClick,
  disabled,
}: {
  gift: GiftData
  isSelected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const kwSlug = getKeywordSlug(gift.keyword ?? null)
  const kwIconUrl = kwSlug ? getKeywordIconUrl(kwSlug) : null

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: '4.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        opacity: disabled ? 0.4 : 1,
        transform: hovered && !disabled ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.2s ease, opacity 0.15s',
        zIndex: hovered ? 10 : 1,
        position: 'relative',
      }}
    >
      {/* 8-sided frame */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        overflow: 'hidden',
        backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        clipPath: OCTAGON_CLIP,
        outline: isSelected ? '2px solid #c8900a' : 'none',
        outlineOffset: '2px',
        boxShadow: hovered && !disabled
          ? '0 0 0.75rem rgba(200,144,10,0.3)'
          : 'none',
      }}>
        {/* Grade label top-left */}
        <span style={{
          position: 'absolute',
          top: '4%',
          left: '3%',
          zIndex: 10,
          pointerEvents: 'none',
          fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
          fontWeight: 700,
          fontSize: '1.25rem',
          lineHeight: 1,
          color: 'rgb(251, 183, 46)',
          textShadow: '0 0 0.5rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
        }}>
          {GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade}
        </span>

        {/* Keyword icon bottom-right */}
        {kwIconUrl && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            zIndex: 10,
            pointerEvents: 'none',
            width: '30%',
            height: '30%',
          }}>
            <Image src={kwIconUrl} alt="" fill sizes="40px" style={{ objectFit: 'contain' }} />
          </div>
        )}

        {/* Gift image centered */}
        <div style={{
          position: 'absolute',
          inset: '15%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {gift.image_url?.startsWith('http') ? (
            <Image src={gift.image_url} alt={gift.name} fill style={{ objectFit: 'contain' }} sizes="80px" />
          ) : (
            <div style={{ width: '1.75rem', height: '1.75rem', background: '#333', borderRadius: '50%' }} />
          )}
        </div>

        {/* Selected checkmark overlay */}
        {isSelected && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            background: 'rgba(200,144,10,0.22)',
          }}>
            <span style={{
              color: '#e8b030',
              fontSize: '1.5rem',
              textShadow: '0 0 0.5rem rgba(200,144,10,0.6)',
            }}>
              ✓
            </span>
          </div>
        )}

        {/* Hover glow gradient */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(251,183,46,0.18) 0%, transparent 50%)',
          opacity: hovered && !disabled ? 1 : 0,
          transition: 'opacity 0.2s',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Name below card */}
      <p style={{
        fontSize: '0.5625rem',
        color: isSelected ? '#e8b030' : '#aaa',
        textAlign: 'center',
        marginTop: '0.25rem',
        lineHeight: 1.2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
        transition: 'color 0.15s',
      }}>
        {gift.name}
      </p>
    </button>
  )
}

// ── Keyword filter sidebar (vertical) ────────────────────────────────────────
function KeywordSidebar({
  activeSlug,
  onSelect,
  giftCounts,
}: {
  activeSlug: string | null
  onSelect: (slug: string | null) => void
  giftCounts: Map<string | null, number>
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.125rem',
      minWidth: '7.5rem',
      maxWidth: '8.5rem',
      flexShrink: 0,
    }}>
      {KEYWORD_FILTERS.map(tab => {
        const isActive = activeSlug === tab.slug
        const count = giftCounts.get(tab.slug) ?? 0
        const iconUrl = tab.slug ? getKeywordIconUrl(tab.slug) : null

        return (
          <button
            key={tab.slug ?? 'all'}
            onClick={() => onSelect(tab.slug)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.5rem',
              background: isActive ? 'rgba(200,144,10,0.08)' : 'transparent',
              border: 'none',
              borderLeft: `2px solid ${isActive ? '#c8900a' : 'transparent'}`,
              borderRadius: '0 0.25rem 0.25rem 0',
              cursor: 'pointer',
              color: isActive ? '#e8b030' : '#777',
              fontSize: '0.75rem',
              fontWeight: isActive ? 700 : 400,
              transition: 'all 0.15s',
              textAlign: 'left',
            }}
          >
            {iconUrl && (
              <Image
                src={iconUrl}
                alt={tab.label}
                width={20}
                height={20}
                style={{ width: '1.25rem', height: '1.25rem', objectFit: 'contain', flexShrink: 0 }}
              />
            )}
            {!iconUrl && tab.slug === null && (
              <span style={{ width: '1.25rem', textAlign: 'center', fontSize: '0.875rem', flexShrink: 0 }}>⬡</span>
            )}
            <span style={{ flex: 1 }}>{tab.label}</span>
            <span style={{
              fontSize: '0.5625rem',
              color: isActive ? '#c8900a' : '#444',
              background: isActive ? 'rgba(200,144,10,0.15)' : '#1a1510',
              padding: '0 0.375rem',
              borderRadius: '0.5rem',
              lineHeight: 1.6,
              minWidth: '1.25rem',
              textAlign: 'center',
            }}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Gift grid with grade groups ──────────────────────────────────────────────
function GiftGridPanel({
  gifts,
  selectedIds,
  onToggle,
  maxSelect,
  gradeOrder,
}: {
  gifts: GiftData[]
  selectedIds: Set<number>
  onToggle: (gift: GiftData) => void
  maxSelect?: number
  gradeOrder: string[]
}) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null)

  const filteredGifts = useMemo(() => {
    if (!activeSlug) return gifts
    return gifts.filter(g => {
      const slug = getKeywordSlug(g.keyword)
      return slug === activeSlug || (activeSlug === 'general' && (!g.keyword || g.keyword.includes('범용') || g.keyword.includes('공통')))
    })
  }, [gifts, activeSlug])

  const giftCounts = useMemo(() => {
    const counts = new Map<string | null, number>()
    counts.set(null, gifts.length)
    for (const g of gifts) {
      const slug = getKeywordSlug(g.keyword)
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    return counts
  }, [gifts])

  const grouped = useMemo(() => {
    const map = new Map<string, GiftData[]>()
    for (const grade of gradeOrder) map.set(grade, [])
    for (const g of filteredGifts) {
      const gr = g.grade ?? '1'
      if (!map.has(gr)) map.set(gr, [])
      map.get(gr)!.push(g)
    }
    return map
  }, [filteredGifts, gradeOrder])

  const atLimit = maxSelect !== undefined && selectedIds.size >= maxSelect

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: 0 }}>
      {/* Keyword sidebar */}
      <KeywordSidebar
        activeSlug={activeSlug}
        onSelect={setActiveSlug}
        giftCounts={giftCounts}
      />

      {/* Grid area */}
      <div style={{
        flex: 1,
        minWidth: 0,
        maxHeight: '28rem',
        overflowY: 'auto',
        paddingRight: '0.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        {gradeOrder.map(grade => {
          const gradeGifts = grouped.get(grade) ?? []
          if (gradeGifts.length === 0) return null
          const gradeColor = GRADE_COLORS[grade] ?? '#888'

          return (
            <div key={grade}>
              {/* Grade divider header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                paddingBottom: '0.375rem',
                borderBottom: `1px solid ${gradeColor}22`,
              }}>
                <span style={{
                  fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  color: gradeColor,
                  letterSpacing: '0.03em',
                }}>
                  {GRADE_ROMAN[grade] ?? grade}등급
                </span>
                <span style={{
                  fontSize: '0.625rem',
                  color: '#555',
                }}>
                  {gradeGifts.length}
                </span>
                <div style={{ flex: 1, height: '1px', background: `${gradeColor}15` }} />
              </div>

              {/* Gift cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))',
                gap: '0.5rem',
              }}>
                {gradeGifts.map(gift => {
                  const isSelected = selectedIds.has(gift.game_id)
                  return (
                    <GiftCard
                      key={gift.id}
                      gift={gift}
                      isSelected={isSelected}
                      disabled={atLimit && !isSelected}
                      onClick={() => onToggle(gift)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}

        {filteredGifts.length === 0 && (
          <div style={{
            padding: '2.5rem',
            textAlign: 'center',
            color: '#4b5563',
            fontSize: '0.8125rem',
            border: '1px dashed #222',
            borderRadius: '0.5rem',
          }}>
            해당 키워드의 기프트가 없습니다
          </div>
        )}
      </div>
    </div>
  )
}

// ── Selected gift panel (right sidebar) ──────────────────────────────────────
function SelectedPanel({
  title,
  selectedGifts,
  onRemove,
  badge,
  footer,
}: {
  title: string
  selectedGifts: GiftData[]
  onRemove: (gift: GiftData) => void
  badge?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div style={{
      background: 'rgba(17,17,17,0.6)',
      border: '1px solid #1f1a14',
      borderRadius: '0.5rem',
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      minWidth: '16rem',
      maxWidth: '20rem',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '0.375rem',
        borderBottom: '1px solid #1f1a14',
      }}>
        <span style={{
          fontSize: '0.75rem',
          color: '#c8900a',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}>
          {title}
        </span>
        {badge}
      </div>

      {/* Gift list */}
      {selectedGifts.length === 0 ? (
        <div style={{
          padding: '1.5rem 0',
          textAlign: 'center',
          color: '#2f2a20',
          fontSize: '0.75rem',
          border: '1px dashed #1f1a14',
          borderRadius: '0.375rem',
        }}>
          선택 없음
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {selectedGifts.map(gift => {
            const gradeColor = GRADE_COLORS[gift.grade ?? '1'] ?? '#888'
            return (
              <div
                key={gift.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.3rem 0.375rem',
                  background: '#1a1510',
                  border: '1px solid #2a2520',
                  borderRadius: '0.375rem',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Mini octagon image with grade */}
                <div style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  flexShrink: 0,
                  clipPath: OCTAGON_CLIP,
                  backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
                  backgroundSize: 'cover',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <span style={{
                    position: 'absolute', top: '2%', left: '4%', zIndex: 10,
                    fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                    fontWeight: 700, fontSize: '0.75rem', lineHeight: 1,
                    color: 'rgb(251,183,46)',
                    textShadow: '0 0 0.25rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
                  }}>
                    {GRADE_ROMAN[gift.grade ?? '1'] ?? gift.grade}
                  </span>
                  {gift.image_url?.startsWith('http') && (
                    <Image
                      src={gift.image_url}
                      alt={gift.name}
                      fill
                      sizes="36px"
                      style={{ objectFit: 'contain', padding: '15%' }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: '0.6875rem',
                    color: '#d1d5db',
                    lineHeight: 1.3,
                    wordBreak: 'keep-all',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {gift.name}
                  </span>
                  <span style={{
                    fontSize: '0.5rem',
                    color: gradeColor,
                    fontWeight: 700,
                  }}>
                    {GRADE_ROMAN[gift.grade ?? '1']}
                  </span>
                </div>
                <button
                  onClick={() => onRemove(gift)}
                  style={{
                    background: 'rgba(220,38,38,0.6)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '1rem',
                    height: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                  title="제거"
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.9)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.6)')}
                >
                  <X size={10} color="#fff" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer (starlight cost, etc.) */}
      {footer}
    </div>
  )
}

// ── Search input for final tab ───────────────────────────────────────────────
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
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: '#1a1510',
        border: '1px solid #2a2520',
        borderRadius: '0.375rem',
        padding: '0.375rem 0.625rem',
        transition: 'border-color 0.15s',
      }}>
        <Search size={14} color="#6b7280" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="기프트 검색하여 추가..."
          value={query}
          onChange={e => { setQuery(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '0.8125rem',
            color: '#e5e7eb',
          }}
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 0.25rem)',
          left: 0,
          right: 0,
          background: '#151210',
          border: '1px solid #2a2520',
          borderRadius: '0.375rem',
          zIndex: 50,
          maxHeight: '14rem',
          overflowY: 'auto',
          boxShadow: '0 0.5rem 1.5rem rgba(0,0,0,0.5)',
        }}>
          {suggestions.map(gift => {
            const gradeColor = GRADE_COLORS[gift.grade ?? '1'] ?? '#888'
            return (
              <button
                key={gift.id}
                onClick={() => { onAdd(gift); setQuery(''); setShowSuggestions(false) }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.625rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: '#e5e7eb',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,144,10,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Mini octagon */}
                <div style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  flexShrink: 0,
                  clipPath: OCTAGON_CLIP,
                  backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
                  backgroundSize: 'cover',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {gift.image_url?.startsWith('http') && (
                    <Image src={gift.image_url} alt={gift.name} fill sizes="28px" style={{ objectFit: 'contain', padding: '15%' }} />
                  )}
                </div>
                <span style={{ fontSize: '0.8125rem', flex: 1 }}>{gift.name}</span>
                <span style={{ fontSize: '0.5625rem', color: gradeColor, fontWeight: 700 }}>
                  {GRADE_ROMAN[gift.grade ?? '1']}
                </span>
                {gift.keyword && (
                  <span style={{ fontSize: '0.625rem', color: '#8a6010' }}>{gift.keyword}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Quick-add pills ──────────────────────────────────────────────────────────
function QuickAddSection({
  label,
  gifts,
  finalIds,
  onAdd,
}: {
  label: string
  gifts: GiftData[]
  finalIds: Set<number>
  onAdd: (gift: GiftData) => void
}) {
  if (gifts.length === 0) return null
  return (
    <div>
      <div style={{
        fontSize: '0.6875rem',
        color: '#666',
        marginBottom: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}>
        <ChevronRight size={10} color="#555" />
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
        {gifts.map(gift => {
          const already = finalIds.has(gift.game_id)
          return (
            <button
              key={gift.id}
              onClick={() => { if (!already) onAdd(gift) }}
              disabled={already}
              title={gift.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.5rem',
                background: already ? 'rgba(200,144,10,0.1)' : '#1a1510',
                border: `1px solid ${already ? '#c8900a60' : '#2a2520'}`,
                borderRadius: '0.375rem',
                cursor: already ? 'default' : 'pointer',
                opacity: already ? 0.6 : 1,
                color: '#d1d5db',
                fontSize: '0.6875rem',
                transition: 'all 0.15s',
              }}
            >
              {/* Mini octagon */}
              <div style={{
                width: '1.25rem',
                height: '1.25rem',
                flexShrink: 0,
                clipPath: OCTAGON_CLIP,
                backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
                backgroundSize: 'cover',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {gift.image_url?.startsWith('http') && (
                  <Image src={gift.image_url} alt={gift.name} fill sizes="20px" style={{ objectFit: 'contain', padding: '15%' }} />
                )}
              </div>
              <span style={{ wordBreak: 'keep-all' }}>{gift.name}</span>
              {!already && <Plus size={10} color="#c8900a" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function GiftPlanTab({ state, dispatch, gifts, giftMap }: Props) {
  const [subTab, setSubTab] = useState<GiftSubTab>('observe')

  // Parse selected IDs by prefix
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

  // Observe: grade 1-3, exclude 잔영
  const observeGifts = useMemo(
    () => gifts.filter(g => {
      const grade = parseInt(g.grade ?? '0')
      return grade >= 1 && grade <= 3 && !g.name.includes('잔영')
    }),
    [gifts]
  )

  const subTabs: { key: GiftSubTab; label: string; count: number }[] = [
    { key: 'observe', label: '관측 기프트', count: observeIds.size },
    { key: 'start', label: '시작 기프트', count: startIds.size },
    { key: 'final', label: '최종 기프트', count: finalIds.size },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* ── Sub-tab bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid #1f1a14',
      }}>
        {subTabs.map(tab => {
          const isActive = subTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              style={{
                padding: '0.5rem 1.25rem',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? '#c8900a' : 'transparent'}`,
                cursor: 'pointer',
                color: isActive ? '#e8b030' : '#555',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 700 : 400,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                marginBottom: '-1px',
                letterSpacing: '0.02em',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  fontSize: '0.5625rem',
                  background: isActive ? 'rgba(200,144,10,0.2)' : '#1a1510',
                  color: isActive ? '#c8900a' : '#444',
                  border: `1px solid ${isActive ? '#c8900a40' : '#222'}`,
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

      {/* ── Observe tab ─────────────────────────────────────────────────── */}
      {subTab === 'observe' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {/* Info bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            padding: '0.5rem 0.625rem',
            background: 'rgba(26,21,16,0.5)',
            borderRadius: '0.375rem',
            border: '1px solid #1f1a14',
          }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              관측 비용:
              <Image
                src={`${STORAGE_BASE}/icons/start-buffs/starlight.webp`}
                alt="별빛"
                width={16}
                height={16}
                style={{ width: '1rem', height: '1rem', verticalAlign: 'middle' }}
              />
              <span style={{ color: '#e8b030', fontWeight: 700 }}>{observeIds.size * 70}</span>
            </span>
            <span style={{
              fontSize: '0.6875rem',
              color: observeIds.size >= 3 ? '#dc2626' : '#c8900a',
              background: observeIds.size >= 3 ? 'rgba(220,38,38,0.1)' : 'rgba(200,144,10,0.1)',
              padding: '0.125rem 0.5rem',
              borderRadius: '0.25rem',
              border: `1px solid ${observeIds.size >= 3 ? 'rgba(220,38,38,0.25)' : 'rgba(200,144,10,0.25)'}`,
              fontWeight: 600,
            }}>
              선택 {observeIds.size}/3
            </span>
            <span style={{ fontSize: '0.625rem', color: '#444' }}>
              {GRADE_ROMAN['1']}~{GRADE_ROMAN['3']} 등급 · 잔영 제외
            </span>
          </div>

          {/* 3-column layout: sidebar + grid + selected */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <GiftGridPanel
              gifts={observeGifts}
              selectedIds={observeIds}
              maxSelect={3}
              gradeOrder={GRADE_ORDER}
              onToggle={gift => {
                const key = `observe_${gift.game_id}`
                if (observeIds.has(gift.game_id)) {
                  dispatch({ type: 'REMOVE_GIFT', giftId: key })
                } else if (observeIds.size < 3) {
                  dispatch({ type: 'ADD_GIFT', giftId: key })
                }
              }}
            />
            <SelectedPanel
              title="선택한 E.G.O 기프트"
              selectedGifts={getGiftsByIds(observeIds)}
              onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `observe_${gift.game_id}` })}
              badge={
                <span style={{
                  fontSize: '0.5625rem',
                  color: '#c8900a',
                  background: 'rgba(200,144,10,0.12)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  border: '1px solid rgba(200,144,10,0.2)',
                }}>
                  {observeIds.size}/3
                </span>
              }
              footer={
                observeIds.size > 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    paddingTop: '0.375rem',
                    borderTop: '1px solid #1f1a14',
                    fontSize: '0.6875rem',
                    color: '#8a6010',
                  }}>
                    <Image
                      src={`${STORAGE_BASE}/icons/start-buffs/starlight.webp`}
                      alt="별빛"
                      width={14}
                      height={14}
                      style={{ width: '0.875rem', height: '0.875rem' }}
                    />
                    {observeIds.size * 70} 별빛
                  </div>
                ) : undefined
              }
            />
          </div>
        </div>
      )}

      {/* ── Start tab ───────────────────────────────────────────────────── */}
      {subTab === 'start' && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <GiftGridPanel
            gifts={gifts}
            selectedIds={startIds}
            maxSelect={1}
            gradeOrder={GRADE_ORDER_ALL}
            onToggle={gift => {
              const key = `start_${gift.game_id}`
              if (startIds.has(gift.game_id)) {
                dispatch({ type: 'REMOVE_GIFT', giftId: key })
              } else if (startIds.size < 1) {
                dispatch({ type: 'ADD_GIFT', giftId: key })
              }
            }}
          />
          <SelectedPanel
            title="시작 기프트"
            selectedGifts={getGiftsByIds(startIds)}
            onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `start_${gift.game_id}` })}
            badge={
              <span style={{
                fontSize: '0.5625rem',
                color: startIds.size >= 1 ? '#dc2626' : '#c8900a',
                background: startIds.size >= 1 ? 'rgba(220,38,38,0.1)' : 'rgba(200,144,10,0.1)',
                padding: '0.125rem 0.375rem',
                borderRadius: '0.25rem',
                border: `1px solid ${startIds.size >= 1 ? 'rgba(220,38,38,0.25)' : 'rgba(200,144,10,0.25)'}`,
                fontWeight: 600,
              }}>
                선택 {startIds.size}/1
              </span>
            }
          />
        </div>
      )}

      {/* ── Final tab ───────────────────────────────────────────────────── */}
      {subTab === 'final' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.625rem',
            background: 'rgba(26,21,16,0.5)',
            borderRadius: '0.375rem',
            border: '1px solid #1f1a14',
          }}>
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
              최종 목표 기프트 빌드
            </span>
            <span style={{
              fontSize: '0.6875rem',
              color: '#c8900a',
              background: 'rgba(200,144,10,0.12)',
              padding: '0.125rem 0.5rem',
              borderRadius: '0.25rem',
              border: '1px solid rgba(200,144,10,0.2)',
              fontWeight: 600,
            }}>
              {finalIds.size}개
            </span>
          </div>

          {/* Search */}
          <GiftSearchAdd
            gifts={gifts}
            selectedIds={finalIds}
            onAdd={gift => dispatch({ type: 'ADD_GIFT', giftId: `final_${gift.game_id}` })}
          />

          {/* Quick add from observed/started */}
          {(observeIds.size > 0 || startIds.size > 0) && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              padding: '0.5rem 0.625rem',
              background: 'rgba(26,21,16,0.3)',
              borderRadius: '0.375rem',
              border: '1px solid #1a1510',
            }}>
              <QuickAddSection
                label="관측 기프트에서 추가"
                gifts={getGiftsByIds(observeIds)}
                finalIds={finalIds}
                onAdd={gift => dispatch({ type: 'ADD_GIFT', giftId: `final_${gift.game_id}` })}
              />
              <QuickAddSection
                label="시작 기프트에서 추가"
                gifts={getGiftsByIds(startIds)}
                finalIds={finalIds}
                onAdd={gift => dispatch({ type: 'ADD_GIFT', giftId: `final_${gift.game_id}` })}
              />
            </div>
          )}

          {/* Final gift grid */}
          {finalIds.size === 0 ? (
            <div style={{
              padding: '2.5rem',
              textAlign: 'center',
              color: '#3f3520',
              fontSize: '0.8125rem',
              border: '1px dashed #1f1a14',
              borderRadius: '0.5rem',
            }}>
              최종 목표 기프트를 추가해주세요
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))',
              gap: '0.5rem',
            }}>
              {getGiftsByIds(finalIds).map(gift => (
                <div
                  key={gift.id}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <GiftCard
                    gift={gift}
                    isSelected={false}
                    onClick={() => {}}
                  />
                  {/* Remove button overlay */}
                  <button
                    onClick={() => dispatch({ type: 'REMOVE_GIFT', giftId: `final_${gift.game_id}` })}
                    style={{
                      position: 'absolute',
                      top: '0.125rem',
                      right: '0.25rem',
                      background: 'rgba(220,38,38,0.8)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '1rem',
                      height: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      zIndex: 20,
                      transition: 'background 0.15s',
                    }}
                    title="제거"
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.8)')}
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
