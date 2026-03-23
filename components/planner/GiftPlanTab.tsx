'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Image from 'next/image'
import { X, Search, Plus, ChevronRight } from 'lucide-react'
import type { PlannerState, PlannerAction, GiftData } from '@/lib/planner/types'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'

const STORAGE_BASE = 'https://lpgqcleszdlldneiwgep.supabase.co/storage/v1/object/public/limbus-assets'

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
}

type GiftSubTab = 'observe' | 'start' | 'final'

const GRADE_ROMAN: Record<string, string> = {
  'EX': 'EX',
  '5': '\u2164', '4': '\u2163', '3': '\u2162', '2': '\u2161', '1': '\u2160',
}

const GRADE_COLORS: Record<string, string> = {
  'EX': '#c6ff2e', '5': '#c8900a', '4': '#7c4fc0', '3': '#2a7fd4', '2': '#2d9e60', '1': '#888',
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
  enhance,
  onEnhance,
  onRemove,
  conditionStatus,
}: {
  gift: GiftData
  isSelected: boolean
  onClick: () => void
  disabled?: boolean
  enhance?: number       // 0=기본, 1=+, 2=++
  onEnhance?: () => void // 강화 순환 클릭
  onRemove?: () => void  // 제거 클릭
  conditionStatus?: { level: 'warn' | 'unmet'; text: string } | null
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
          color: (gift.grade === 'EX') ? 'rgb(198, 255, 46)' : 'rgb(251, 183, 46)',
          textShadow: (gift.grade === 'EX')
            ? '0 0 0.625rem rgb(251,255,8), 0 0 0.25rem rgb(12,90,0), 0.0625rem 0.0625rem 0.125rem rgba(0,0,0,0.8)'
            : '0 0 0.5rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
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

        {/* 강화 배지 — 오른쪽 위 (카드 내부) */}
        {enhance != null && enhance > 0 && (
          <div
            onClick={e => { e.stopPropagation(); onEnhance?.() }}
            style={{
              position: 'absolute',
              top: '1%',
              right: '6%',
              zIndex: 25,
              cursor: 'pointer',
              fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
              fontWeight: 800,
              fontSize: '1.25rem',
              lineHeight: 1,
              color: enhance === 2 ? '#ff8c00' : '#e8b030',
              textShadow: enhance === 2
                ? '0 0 0.5rem rgba(255,140,0,0.8), 0 0 1rem rgba(255,100,0,0.5), 0 0.125rem 0.25rem rgba(0,0,0,0.9)'
                : '0 0 0.375rem rgba(200,144,10,0.6), 0 0.125rem 0.25rem rgba(0,0,0,0.8)',
            }}
          >
            <span style={{
              display: 'inline-block',
              padding: '0.0625rem 0.125rem',
              borderRadius: '0.125rem',
              background: enhance === 2
                ? 'radial-gradient(ellipse, rgba(255,140,0,0.35) 0%, transparent 70%)'
                : 'radial-gradient(ellipse, rgba(232,176,48,0.3) 0%, transparent 70%)',
              filter: enhance === 2
                ? 'drop-shadow(0 0 0.375rem rgba(255,100,0,0.8)) drop-shadow(0 0 0.75rem rgba(255,140,0,0.4))'
                : 'drop-shadow(0 0 0.25rem rgba(232,176,48,0.7)) drop-shadow(0 0 0.5rem rgba(200,144,10,0.3))',
            }}>
              {enhance === 2 ? '++' : '+'}
            </span>
          </div>
        )}

        {/* 강화 가능 표시 (미강화) */}
        {enhance === 0 && onEnhance && (
          <div
            onClick={e => { e.stopPropagation(); onEnhance() }}
            style={{
              position: 'absolute', top: '1%', right: '6%', zIndex: 25, cursor: 'pointer',
              fontSize: '1.25rem', fontWeight: 800, color: '#44403c',
              fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
            }}
          >+</div>
        )}

        {/* 제거 버튼 — 왼쪽 아래 (호버 시만) */}
        {onRemove && (
          <div
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onRemove() }}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onRemove() } }}
            style={{
              position: 'absolute', bottom: '4%', left: '4%', zIndex: 25,
              background: 'rgba(220,38,38,0.85)', borderRadius: '50%',
              width: '1rem', height: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
            }}
          >
            <X size={10} color="#fff" />
          </div>
        )}

        {/* 조건 오버레이 */}
        {conditionStatus && (
          <div
            title={conditionStatus.level === 'unmet'
              ? `조건 미달: ${conditionStatus.text} — 편성+대기 포함해도 부족`
              : `조건 주의: ${conditionStatus.text} — 편성(1-7)만으로는 부족, 대기 포함 시 충족`}
            style={{
              position: 'absolute', inset: 0, zIndex: 18,
              background: conditionStatus.level === 'unmet' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'auto', cursor: 'help',
            }}
          >
            <span style={{
              fontSize: '0.5rem', fontWeight: 700,
              color: conditionStatus.level === 'unmet' ? '#ef4444' : '#e8b030',
              textShadow: '0 0 0.25rem rgba(0,0,0,0.9)',
              textAlign: 'center', lineHeight: 1.3, padding: '0 0.125rem',
            }}>
              {conditionStatus.level === 'unmet' ? '조건 미달' : '조건 주의'}
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
        color: conditionStatus?.level === 'unmet' ? '#ef4444' : conditionStatus?.level === 'warn' ? '#e8b030' : isSelected ? '#e8b030' : '#aaa',
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
      {conditionStatus && (
        <p style={{ fontSize: '0.5rem', color: conditionStatus.level === 'unmet' ? '#ef4444' : '#e8b030', textAlign: 'center', lineHeight: 1.2, marginTop: '0.0625rem' }}>
          {conditionStatus.text}
        </p>
      )}
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
// GiftSearchAdd removed — final tab uses inline search + drag

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
  const [finalDragOver, setFinalDragOver] = useState(false)
  const [finalSearch, setFinalSearch] = useState('')
  const [finalFilterKeyword, setFinalFilterKeyword] = useState<string | null>(null)
  const [finalFilterGrade, setFinalFilterGrade] = useState<string | null>(null)

  // 키워드별 인격 수: 편성(1-7) vs 전체(편성+대기) — 특수 충전 등 정규화 적용
  const { formationKwCounts, allKwCounts } = useMemo(() => {
    const formation: Record<string, number> = {}
    const all: Record<string, number> = {}
    for (const slot of state.identitySlots) {
      if (slot.slot_order >= 99) continue // 편성 순서 없는 인격(벤치) 제외
      const isFormation = slot.slot_order < 7  // 0-6 = 편성 1-7
      // 중복 카운트 방지: 인격당 정규화된 키워드 유니크
      const normalized = new Set<string>(slot.keywords.map(normalizeThemeKeyword))
      for (const kw of normalized) {
        all[kw] = (all[kw] ?? 0) + 1
        if (isFormation) formation[kw] = (formation[kw] ?? 0) + 1
      }
    }
    return { formationKwCounts: formation, allKwCounts: all }
  }, [state.identitySlots])

  // 조건 체크: null=충족, {level:'warn',text} = 대기 포함 시 충족, {level:'unmet',text} = 불충족
  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    const cond = gift.activation_condition
    if (!cond || !cond.count) return null

    let formationHave = 0, allHave = 0, label = ''
    if (cond.type === 'keyword' && cond.keyword) {
      formationHave = formationKwCounts[cond.keyword] ?? 0
      allHave = allKwCounts[cond.keyword] ?? 0
      label = cond.keyword
    } else if (cond.type === 'multi_keyword' && cond.keywords) {
      formationHave = cond.keywords.reduce((s, kw) => s + (formationKwCounts[kw] ?? 0), 0)
      allHave = cond.keywords.reduce((s, kw) => s + (allKwCounts[kw] ?? 0), 0)
      label = cond.keywords.join('+')
    } else {
      return null
    }

    if (formationHave >= cond.count) return null // 편성만으로 충족
    if (allHave >= cond.count) return { level: 'warn', text: `${label} ${formationHave}/${cond.count}` }
    return { level: 'unmet', text: `${label} ${allHave}/${cond.count}` }
  }

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
  // finalIds: game_id Set + 강화 상태 Map
  const finalIds = useMemo(() => {
    const ids = new Set<number>()
    for (const id of state.giftInventory) {
      if (!id.startsWith('final_')) continue
      const rest = id.replace('final_', '').replace('_plusplus', '').replace('_plus', '')
      const num = parseInt(rest)
      if (!isNaN(num)) ids.add(num)
    }
    return ids
  }, [state.giftInventory])

  // 강화 상태: game_id → 0(기본) | 1(+) | 2(++)
  const finalEnhance = useMemo(() => {
    const map = new Map<number, number>()
    for (const id of state.giftInventory) {
      if (!id.startsWith('final_')) continue
      if (id.endsWith('_plusplus')) {
        const gid = parseInt(id.replace('final_', '').replace('_plusplus', ''))
        if (!isNaN(gid)) map.set(gid, 2)
      } else if (id.endsWith('_plus')) {
        const gid = parseInt(id.replace('final_', '').replace('_plus', ''))
        if (!isNaN(gid)) map.set(gid, 1)
      } else {
        const gid = parseInt(id.replace('final_', ''))
        if (!isNaN(gid) && !map.has(gid)) map.set(gid, 0)
      }
    }
    return map
  }, [state.giftInventory])

  function getGiftsByIds(ids: Set<number>): GiftData[] {
    return Array.from(ids)
      .map(id => giftMap.get(id))
      .filter(Boolean) as GiftData[]
  }

  // Observe: grade 1-3, exclude 잔영
  const filteredFinalSourceGifts = useMemo(() => {
    return gifts.filter(g => {
      if (finalFilterGrade && g.grade !== finalFilterGrade) return false
      if (finalFilterKeyword) {
        const slug = getKeywordSlug(g.keyword ?? null)
        if (slug !== finalFilterKeyword) return false
      }
      if (finalSearch.trim()) {
        if (!g.name.includes(finalSearch.trim())) return false
      }
      return true
    })
  }, [gifts, finalFilterGrade, finalFilterKeyword, finalSearch])

  const finalGradeGroups = useMemo(() => {
    const groups: Record<string, GiftData[]> = {}
    for (const g of filteredFinalSourceGifts) {
      const grade = g.grade ?? '1'
      if (!groups[grade]) groups[grade] = []
      groups[grade].push(g)
    }
    return groups
  }, [filteredFinalSourceGifts])

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
      {subTab === 'start' && (() => {
        // 시작 기프트 풀 (game_id 기준)
        const START_GIFT_IDS = new Set([
          9009, 9001, 9103, // 화상: 작열우모, 지옥나비의 꿈, 울화통
          9005, 9029, 9108, // 출혈: 상처붙이, 작고 나쁠 인형, 경외심
          9113, 9086, 9044, // 진동: 시큼한 주향, 잔향, 진동형 팔찌
          9117, 9169, 9047, // 파열: 유연 화약, 가시오랏줄, 가시 올가미
          9041, 9054, 9124, // 침잠: 적색 지령, 녹아내린 시계태엽, 장엄
          9051, 9046, 9129, // 호흡: 돌무덤, 물부리, 낡은 목각 인형
          9134, 9043, 9052, // 충전: 순찰용 손전등, 사원증, 휴대용 전지 소켓
          9032, 9194, 9140, // 참격: 꿈을 꾸는 전기양, 짧은 케인 소드, 결의
          9198, 9145, 9030, // 관통: 증명의 깃털, 찢어진 밴돌리어, 수집하는 해골
          9012, 9202, 9150, // 타격: 오늘의 표정, 포켓 암기 노트, 시간 굴레
        ])

        // 가호에서 시작 기프트 추가 선택 수 계산
        // baseId 103(쏟아지는 유성우), 109(완전한 가능성)가 ADDITIONAL_START_EGO_GIFT_SELECT +1
        const BLESSING_START_GIFT_IDS = [103, 109]
        let maxStartGifts = 1 // 기본 1개
        for (const inv of state.giftInventory) {
          if (!inv.startsWith('blessing_')) continue
          const parts = inv.split('_')
          const baseId = parseInt(parts[1])
          if (BLESSING_START_GIFT_IDS.includes(baseId)) maxStartGifts += 1
        }

        const startPool = gifts.filter(g => START_GIFT_IDS.has(g.game_id))
        const KEYWORD_ORDER = ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전', '참격', '관통', '타격']
        const grouped = new Map<string, GiftData[]>()
        for (const kw of KEYWORD_ORDER) grouped.set(kw, [])
        for (const g of startPool) {
          const kw = g.keyword ?? '공통'
          if (!grouped.has(kw)) grouped.set(kw, [])
          grouped.get(kw)!.push(g)
        }

        return (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* 키워드별 카드 그리드 (게임 UI 스타일) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: '0.75rem' }}>
                {KEYWORD_ORDER.map(kw => {
                  const kwGifts = grouped.get(kw) ?? []
                  if (kwGifts.length === 0) return null
                  const slug = getKeywordSlug(kw)
                  const iconUrl = slug ? getKeywordIconUrl(slug) : null
                  return (
                    <div key={kw} style={{
                      background: '#1a1510',
                      border: '1px solid #2a2520',
                      borderRadius: '0.5rem',
                      overflow: 'hidden',
                    }}>
                      {/* 키워드 헤더 */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                        padding: '0.5rem 0.75rem',
                        background: '#12100d',
                        borderBottom: '1px solid #2a2520',
                      }}>
                        {iconUrl && (
                          <Image src={iconUrl} alt="" width={18} height={18} style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain' }} />
                        )}
                        <span style={{ color: '#e8dcc8', fontSize: '0.8125rem', fontWeight: 600 }}>{kw}</span>
                      </div>
                      {/* 기프트 3개 */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}>
                        {kwGifts.map(gift => {
                          const isSelected = startIds.has(gift.game_id)
                          return (
                            <button
                              key={gift.id}
                              onClick={() => {
                                const key = `start_${gift.game_id}`
                                if (isSelected) {
                                  dispatch({ type: 'REMOVE_GIFT', giftId: key })
                                } else if (startIds.size < maxStartGifts) {
                                  dispatch({ type: 'ADD_GIFT', giftId: key })
                                }
                              }}
                              className="group"
                              style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                                cursor: startIds.size >= maxStartGifts && !isSelected ? 'not-allowed' : 'pointer',
                                opacity: startIds.size >= maxStartGifts && !isSelected ? 0.4 : 1,
                                transition: 'all 0.15s',
                              }}
                            >
                              <div style={{
                                width: '3.5rem', height: '3.5rem',
                                clipPath: OCTAGON_CLIP,
                                backgroundImage: `url(${STORAGE_BASE}/icons/ego-gift-bg.webp)`,
                                backgroundSize: 'cover',
                                position: 'relative',
                                overflow: 'hidden',
                                outline: isSelected ? '2px solid #c8900a' : 'none',
                                outlineOffset: '2px',
                              }}>
                                <span style={{
                                  position: 'absolute', top: '4%', left: '5%', zIndex: 10,
                                  fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                                  fontWeight: 700, fontSize: '0.875rem', lineHeight: 1,
                                  color: 'rgb(251,183,46)',
                                  textShadow: '0 0 0.375rem rgb(255,114,21), 0 0 0.125rem rgba(0,0,0,0.6)',
                                }}>
                                  {GRADE_ROMAN[gift.grade ?? '1']}
                                </span>
                                <div style={{ position: 'absolute', inset: '15%' }}>
                                  {gift.image_url?.startsWith('http') && (
                                    <Image src={gift.image_url} alt={gift.name} fill sizes="56px" style={{ objectFit: 'contain' }} />
                                  )}
                                </div>
                                {isSelected && (
                                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(200,144,10,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                                    <span style={{ color: '#e8b030', fontSize: '1.25rem', textShadow: '0 0 0.5rem rgba(0,0,0,0.8)' }}>✓</span>
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: '0.5625rem', color: '#aaa', textAlign: 'center', lineHeight: 1.2, maxWidth: '3.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {gift.name}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <SelectedPanel
              title="시작 기프트"
              selectedGifts={getGiftsByIds(startIds)}
              onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `start_${gift.game_id}` })}
              badge={
                <span style={{
                  fontSize: '0.5625rem',
                  color: startIds.size >= maxStartGifts ? '#dc2626' : '#c8900a',
                  background: startIds.size >= maxStartGifts ? 'rgba(220,38,38,0.1)' : 'rgba(200,144,10,0.1)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  border: `1px solid ${startIds.size >= maxStartGifts ? 'rgba(220,38,38,0.25)' : 'rgba(200,144,10,0.25)'}`,
                  fontWeight: 600,
                }}>
                  선택 {startIds.size}/{maxStartGifts}
                </span>
              }
            />
          </div>
        )
      })()}

      {/* ── Final tab ───────────────────────────────────────────────────── */}
      {subTab === 'final' && (() => {
        // hooks moved to component top level
        const gradeGroups = finalGradeGroups

        const GRADE_OPTIONS = [
          { value: null, label: '전체' },
          { value: 'EX', label: 'EX' },
          { value: '5', label: 'Ⅴ' },
          { value: '4', label: 'Ⅳ' },
          { value: '3', label: 'Ⅲ' },
          { value: '2', label: 'Ⅱ' },
          { value: '1', label: 'Ⅰ' },
        ]

        const gradeGroupOrder = ['EX', '5', '4', '3', '2', '1']

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* ── Top section: drop zone ──────────────────────────────── */}
            <div
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setFinalDragOver(true) }}
              onDragLeave={() => setFinalDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setFinalDragOver(false)
                const gameId = e.dataTransfer.getData('text/plain')
                if (gameId && !finalIds.has(Number(gameId))) {
                  dispatch({ type: 'ADD_GIFT', giftId: `final_${gameId}` })
                }
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.625rem',
                padding: '0.625rem',
                background: finalDragOver ? 'rgba(200,144,10,0.07)' : 'rgba(26,21,16,0.4)',
                border: `1px ${finalDragOver ? 'solid' : 'solid'} ${finalDragOver ? '#c8900a' : '#1f1a14'}`,
                borderRadius: '0.5rem',
                boxShadow: finalDragOver ? '0 0 0.75rem rgba(200,144,10,0.25)' : 'none',
                transition: 'all 0.15s',
                minHeight: '6rem',
              }}
            >
              {/* Drop zone header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>
                    최종 기프트 빌드
                  </span>
                  {finalIds.size > 0 && (
                    <span style={{
                      fontSize: '0.5625rem',
                      color: '#c8900a',
                      background: 'rgba(200,144,10,0.12)',
                      padding: '0.0625rem 0.375rem',
                      borderRadius: '0.25rem',
                      border: '1px solid rgba(200,144,10,0.2)',
                      fontWeight: 700,
                    }}>
                      {finalIds.size}개
                    </span>
                  )}
                </div>
                {finalIds.size > 0 && (
                  <button
                    onClick={() => {
                      Array.from(finalIds).forEach(id => {
                        dispatch({ type: 'REMOVE_GIFT', giftId: `final_${id}` })
                      })
                    }}
                    style={{
                      fontSize: '0.6875rem',
                      color: '#dc2626',
                      background: 'rgba(220,38,38,0.08)',
                      border: '1px solid rgba(220,38,38,0.2)',
                      borderRadius: '0.25rem',
                      padding: '0.125rem 0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.16)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)' }}
                  >
                    전체 삭제
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.625rem', color: '#44403c', marginTop: '-0.25rem' }}>
                아래 목록에서 드래그하거나 클릭하여 추가 · 강화 가능한 기프트는 클릭하여 +/++ 강화
              </p>
              {state.identitySlots.length > 0 && finalIds.size > 0 && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.125rem', fontSize: '0.5625rem' }}>
                  <span style={{ color: '#ef4444' }}>● 조건 미달 — 전체 인격으로도 부족</span>
                  <span style={{ color: '#e8b030' }}>● 조건 주의 — 편성(1-7)만으로는 부족, 대기 포함 시 충족</span>
                </div>
              )}

              {/* Drop zone content */}
              {finalIds.size === 0 ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '4rem',
                  border: '1px dashed rgba(200,144,10,0.2)',
                  borderRadius: '0.375rem',
                  color: finalDragOver ? '#c8900a' : '#3f3520',
                  fontSize: '0.75rem',
                  transition: 'color 0.15s',
                }}>
                  기프트를 아래에서 드래그하거나 클릭하여 추가하세요
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))',
                  gap: '0.5rem',
                }}>
                  {getGiftsByIds(finalIds).map(gift => {
                    const enh = finalEnhance.get(gift.game_id) ?? 0
                    const canEnh = !!(gift.effect_plus)
                    const cycleEnh = () => {
                      if (!canEnh) return
                      const oldKey = enh === 2 ? `final_${gift.game_id}_plusplus` : enh === 1 ? `final_${gift.game_id}_plus` : `final_${gift.game_id}`
                      const next = (enh + 1) % (gift.effect_plusplus ? 3 : 2)
                      const newKey = next === 2 ? `final_${gift.game_id}_plusplus` : next === 1 ? `final_${gift.game_id}_plus` : `final_${gift.game_id}`
                      dispatch({ type: 'REPLACE_GIFT', oldId: oldKey, newId: newKey })
                    }
                    const removeGift = () => {
                      const key = enh === 2 ? `final_${gift.game_id}_plusplus` : enh === 1 ? `final_${gift.game_id}_plus` : `final_${gift.game_id}`
                      dispatch({ type: 'REMOVE_GIFT', giftId: key })
                    }
                    return (
                      <GiftCard
                        key={gift.id}
                        gift={gift}
                        isSelected={false}
                        onClick={canEnh ? cycleEnh : () => {}}
                        enhance={canEnh ? enh : undefined}
                        onEnhance={canEnh ? cycleEnh : undefined}
                        onRemove={removeGift}
                        conditionStatus={getConditionStatus(gift)}
                      />
                    )
                  })}
                </div>
              )}

              {/* Quick add pills from observe/start */}
              {(observeIds.size > 0 || startIds.size > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.25rem' }}>
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
            </div>

            {/* ── Bottom section: full gift list ──────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600 }}>전체 기프트 목록</span>

              {/* Search input */}
              <div style={{ position: 'relative' }}>
                <Search
                  size={14}
                  color="#555"
                  style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
                <input
                  type="text"
                  placeholder="기프트 이름 검색..."
                  value={finalSearch}
                  onChange={e => setFinalSearch(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '2rem',
                    paddingRight: '0.75rem',
                    paddingTop: '0.375rem',
                    paddingBottom: '0.375rem',
                    background: '#1a1510',
                    border: '1px solid #2a2520',
                    borderRadius: '0.375rem',
                    color: '#d1d5db',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Keyword filter tabs + grade dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Scrollable keyword tabs */}
                <div style={{
                  display: 'flex',
                  gap: '0.25rem',
                  overflowX: 'auto',
                  flex: 1,
                  paddingBottom: '0.125rem',
                  scrollbarWidth: 'none',
                }}>
                  {KEYWORD_FILTERS.map(tab => {
                    const isActive = finalFilterKeyword === tab.slug
                    const iconUrl = tab.slug ? getKeywordIconUrl(tab.slug) : null
                    return (
                      <button
                        key={tab.slug ?? 'all'}
                        onClick={() => setFinalFilterKeyword(isActive && tab.slug !== null ? null : tab.slug)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          background: isActive ? 'rgba(200,144,10,0.18)' : '#1a1510',
                          border: `1px solid ${isActive ? '#c8900a60' : '#2a2520'}`,
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          color: isActive ? '#e8b030' : '#888',
                          fontSize: '0.6875rem',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'all 0.15s',
                        }}
                      >
                        {iconUrl && (
                          <Image src={iconUrl} alt="" width={12} height={12} style={{ width: '0.75rem', height: '0.75rem', objectFit: 'contain' }} />
                        )}
                        {tab.label}
                      </button>
                    )
                  })}
                </div>

                {/* Grade dropdown */}
                <select
                  value={finalFilterGrade ?? ''}
                  onChange={e => setFinalFilterGrade(e.target.value || null)}
                  style={{
                    background: '#1a1510',
                    border: '1px solid #2a2520',
                    borderRadius: '0.375rem',
                    color: '#d1d5db',
                    fontSize: '0.6875rem',
                    padding: '0.25rem 0.375rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                    outline: 'none',
                  }}
                >
                  {GRADE_OPTIONS.map(opt => (
                    <option key={opt.value ?? 'all'} value={opt.value ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gift grid (grouped by grade) */}
              <div style={{ maxHeight: '35rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {gradeGroupOrder.filter(g => gradeGroups[g]?.length > 0).map(grade => (
                  <div key={grade}>
                    {/* Grade divider */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.375rem',
                    }}>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: GRADE_COLORS[grade] ?? '#888',
                        fontFamily: "'Bebas Neue', var(--font-title), sans-serif",
                      }}>
                        {GRADE_ROMAN[grade]}
                      </span>
                      <div style={{ flex: 1, height: '1px', background: `${GRADE_COLORS[grade] ?? '#333'}40` }} />
                      <span style={{ fontSize: '0.5625rem', color: '#444' }}>{gradeGroups[grade].length}</span>
                    </div>

                    {/* Cards row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(4.5rem, 1fr))',
                      gap: '0.5rem',
                    }}>
                      {gradeGroups[grade].map(gift => {
                        const alreadyAdded = finalIds.has(gift.game_id)
                        return (
                          <div
                            key={gift.id}
                            draggable={!alreadyAdded}
                            onDragStart={e => {
                              e.dataTransfer.setData('text/plain', String(gift.game_id))
                              e.dataTransfer.effectAllowed = 'copy'
                            }}
                            style={{ opacity: alreadyAdded ? 0.3 : 1, transition: 'opacity 0.15s' }}
                          >
                            <GiftCard
                              gift={gift}
                              isSelected={alreadyAdded}
                              onClick={() => {
                                if (!alreadyAdded) {
                                  dispatch({ type: 'ADD_GIFT', giftId: `final_${gift.game_id}` })
                                }
                              }}
                              disabled={alreadyAdded}
                              conditionStatus={getConditionStatus(gift)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {filteredFinalSourceGifts.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#3f3520', fontSize: '0.75rem', padding: '2rem 0' }}>
                    검색 결과가 없습니다
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
