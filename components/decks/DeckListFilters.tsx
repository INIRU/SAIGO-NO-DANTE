'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronRight, Link2, Minus, Plus, Search, SlidersHorizontal, User, X } from 'lucide-react'
import { CONTENT_TYPES, CONTENT_TYPE_COLORS } from '@/lib/constants/deck-tokens'
import { getSinnerLogoUrl } from '@/lib/data/sinners'
import { getIdentityInfoUrl } from '@/lib/utils/images'
import type { SearchSuggestion } from './decks-types'
import DeckIdentityFilterModal, { type DeckFilterIdentity, type DeckFilterSinner } from './DeckIdentityFilterModal'

interface DeckListFiltersProps {
  inputValue: string
  onInputChange: (value: string) => void
  onInputFocus: () => void
  onSearchClear: () => void
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  searchRef: React.RefObject<HTMLDivElement | null>
  showSuggestions: boolean
  suggestions: SearchSuggestion[]
  acIndex: number
  onSuggestionClick: (label: string) => void
  getIconUrl: (kw: string) => string | null
  sort: string
  onSortChange: (s: string) => void
  activeContentType: string
  onContentTypeChange: (ct: string) => void
  showAdvancedFilter: boolean
  onToggleAdvancedFilter: () => void
  advancedFilterCount: number
  allTags: string[]
  activeTags: Set<string>
  showTagFilter: boolean
  onToggleTagFilter: () => void
  onToggleTag: (tag: string) => void
  onClearTags: () => void
  keywordCandidates: string[]
  availableKeywords: string[]
  activeKeywords: Set<string>
  keywordMode: 'or' | 'and'
  showKeywordFilter: boolean
  onToggleKeywordFilter: () => void
  onToggleKeyword: (kw: string) => void
  onClearKeywords: () => void
  onToggleKeywordMode: () => void
  showCollectionFilter: boolean
  onToggleCollectionFilter: () => void
  collectionLoading: boolean
  hasCollection: boolean
  filterOwnedIdentity: boolean
  filterOwnedEgo: boolean
  onToggleFilterOwnedIdentity: () => void
  onToggleFilterOwnedEgo: () => void
  onClearCollection: () => void
  codeInput: string
  onCodeInputChange: (v: string) => void
  onApplyCode: () => void
  codeError: boolean
  formationCount: number | null
  onFormationCountChange: (count: number | null) => void
  identityFilterSinners: DeckFilterSinner[]
  identityFilterIdentities: DeckFilterIdentity[]
  selectedIdentityIds: Set<string>
  selectedIdentities: DeckFilterIdentity[]
  identityMode: 'or' | 'and'
  onToggleSelectedIdentity: (identityId: string) => void
  onToggleIdentityMode: () => void
  onClearSelectedIdentities: () => void
}

type SortKey = 'latest' | 'popular'

function Divider() {
  return <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2"
      style={{
        color: '#666',
        fontFamily: 'var(--font-heading)',
        fontSize: '0.875rem',
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  )
}

function SectionToggle({
  label,
  open,
  active,
  count,
  onClick,
}: {
  label: string
  open: boolean
  active: boolean
  count?: number
  onClick: () => void
}) {
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 text-left transition-colors hover:bg-white/[0.025]"
      style={{
        minHeight: '2.25rem',
        color: active ? 'var(--gold)' : '#666',
        fontFamily: 'var(--font-heading)',
        fontSize: '0.875rem',
      }}
      aria-expanded={open}
    >
      <Icon size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!!count && (
        <span
          style={{
            background: 'rgba(200,144,10,0.18)',
            color: 'var(--gold)',
            minWidth: '1.375rem',
            padding: '0.0625rem 0.4375rem',
            borderRadius: '999rem',
            fontSize: '0.8125rem',
            fontWeight: 400,
            fontFamily: 'var(--font-heading)',
            lineHeight: 1.2,
            textAlign: 'center',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function SortControls({ sort, onSortChange }: { sort: string; onSortChange: (s: string) => void }) {
  return (
    <section>
      <SectionLabel>정렬</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        {(['latest', 'popular'] as SortKey[]).map(s => {
          const active = sort === s
          return (
            <button
              key={s}
              onClick={() => onSortChange(s)}
              aria-pressed={active}
              className="rounded transition-all duration-200"
              style={{
                minHeight: '2.25rem',
                border: `1px solid ${active ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}`,
                background: active ? 'rgba(200,144,10,0.1)' : 'rgba(255,255,255,0.02)',
                color: active ? 'var(--gold)' : '#777',
                fontFamily: 'var(--font-heading)',
                fontSize: '0.8125rem',
                fontWeight: 700,
              }}
            >
              {s === 'latest' ? '최신순' : '인기순'}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function SquareToggle({
  active,
  label,
  iconUrl,
  onClick,
  ariaLabel,
}: {
  active: boolean
  label: string
  iconUrl?: string | null
  onClick: () => void
  ariaLabel?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      title={label}
      className="flex flex-col items-center justify-center rounded transition-all duration-200"
      style={{
        minHeight: '2.75rem',
        padding: '0.25rem 0.1875rem',
        cursor: 'pointer',
        border: `1px solid ${active ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}`,
        background: active ? 'rgba(200,144,10,0.1)' : 'rgba(255,255,255,0.02)',
        opacity: active ? 1 : 0.5,
        filter: active ? 'none' : 'grayscale(0.5)',
      }}
    >
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt=""
          width={18}
          height={18}
          style={{ width: '1.125rem', height: '1.125rem', objectFit: 'contain' }}
        />
      ) : (
        <span
          className="text-center leading-tight"
          style={{
            color: active ? 'var(--gold)' : '#777',
            fontFamily: 'var(--font-heading)',
            fontSize: '0.8125rem',
            fontWeight: 700,
          }}
        >
          {label}
        </span>
      )}
      {iconUrl && (
        <span
          className="mt-1 max-w-full truncate text-center leading-tight"
          style={{ color: active ? 'var(--gold)' : '#666', fontSize: '0.75rem', width: '100%' }}
        >
          {label}
        </span>
      )}
    </button>
  )
}

function KeywordTagChip({
  keyword,
  iconUrl,
  onRemove,
}: {
  keyword: string
  iconUrl: string | null
  onRemove: () => void
}) {
  return (
    <button
      onClick={onRemove}
      className="flex max-w-full items-center gap-1 rounded transition-all duration-150 hover:bg-[rgba(200,144,10,0.11)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
      style={{
        minHeight: '1.625rem',
        padding: '0.125rem 0.25rem 0.125rem 0.375rem',
        background: 'rgba(26,21,16,0.72)',
        border: '1px solid rgba(200,144,10,0.22)',
        borderLeftColor: 'rgba(200,144,10,0.55)',
        color: '#d8b46a',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        fontFamily: 'var(--font-body)',
        fontSize: '0.8125rem',
        fontWeight: 500,
        lineHeight: 1.15,
        cursor: 'pointer',
      }}
      aria-label={`${keyword} 키워드 제거`}
    >
      {iconUrl && (
        <Image
          src={iconUrl}
          alt=""
          width={16}
          height={16}
          style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0, objectFit: 'contain', opacity: 0.9 }}
        />
      )}
      <span className="min-w-0 truncate">{keyword}</span>
      <X size={10} strokeWidth={1.75} style={{ flexShrink: 0, color: '#8f8066' }} aria-hidden="true" />
    </button>
  )
}

export default function DeckListFilters({
  inputValue, onInputChange, onInputFocus, onSearchClear, onSearchKeyDown,
  searchRef, showSuggestions, suggestions, acIndex, onSuggestionClick, getIconUrl,
  sort, onSortChange,
  activeContentType, onContentTypeChange,
  advancedFilterCount,
  allTags, activeTags, showTagFilter, onToggleTagFilter, onToggleTag, onClearTags,
  keywordCandidates, availableKeywords, activeKeywords, keywordMode,
  onToggleKeyword, onClearKeywords, onToggleKeywordMode,
  showCollectionFilter, onToggleCollectionFilter,
  collectionLoading, hasCollection,
  filterOwnedIdentity, filterOwnedEgo,
  onToggleFilterOwnedIdentity, onToggleFilterOwnedEgo, onClearCollection,
  codeInput, onCodeInputChange, onApplyCode, codeError,
  formationCount, onFormationCountChange,
  identityFilterSinners, identityFilterIdentities,
  selectedIdentityIds, selectedIdentities,
  identityMode,
  onToggleSelectedIdentity, onToggleIdentityMode, onClearSelectedIdentities,
}: DeckListFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showKeywordTagFilter, setShowKeywordTagFilter] = useState(true)
  const [showFormationFilter, setShowFormationFilter] = useState(true)
  const [showIdentityFilter, setShowIdentityFilter] = useState(true)
  const [identityModalSinnerId, setIdentityModalSinnerId] = useState<string | null>(null)
  const [keywordTagInput, setKeywordTagInput] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const collectionCount = (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)
  const totalActiveCount = advancedFilterCount + (activeContentType ? 1 : 0) + (inputValue.trim() ? 1 : 0)
  const identityModalSinner = useMemo(
    () => identityFilterSinners.find(sinner => sinner.id === identityModalSinnerId) ?? null,
    [identityFilterSinners, identityModalSinnerId],
  )
  const identityModalIdentities = useMemo(
    () => identityFilterIdentities
      .filter(identity => identity.sinner_id === identityModalSinnerId)
      .sort((a, b) => {
        if (b.rarity !== a.rarity) return b.rarity - a.rarity
        return a.name_kr.localeCompare(b.name_kr, 'ko')
      }),
    [identityFilterIdentities, identityModalSinnerId],
  )
  const selectedIdentitiesBySinner = useMemo(() => {
    const grouped = new Map<string, DeckFilterIdentity[]>()
    for (const identity of selectedIdentities) {
      const group = grouped.get(identity.sinner_id) ?? []
      group.push(identity)
      grouped.set(identity.sinner_id, group)
    }
    return grouped
  }, [selectedIdentities])

  const keywordTagSuggestions = useMemo(() => {
    const q = keywordTagInput.trim().toLowerCase()
    if (!q) return []
    return keywordCandidates
      .filter(kw => !activeKeywords.has(kw) && kw.toLowerCase().includes(q))
      .sort((a, b) => {
        const aLow = a.toLowerCase()
        const bLow = b.toLowerCase()
        const aStarts = aLow.startsWith(q) ? 0 : 1
        const bStarts = bLow.startsWith(q) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts
        return a.localeCompare(b, 'ko')
      })
      .slice(0, 8)
  }, [activeKeywords, keywordCandidates, keywordTagInput])

  const addKeywordTag = (rawKeyword?: string) => {
    const value = (rawKeyword ?? keywordTagInput).trim()
    if (!value) return
    const matchedKeyword = keywordCandidates.find(kw => kw.toLowerCase() === value.toLowerCase()) ?? keywordTagSuggestions[0]
    if (!matchedKeyword || activeKeywords.has(matchedKeyword)) return
    onToggleKeyword(matchedKeyword)
    setKeywordTagInput('')
  }

  const applyFormationCount = (rawValue: string) => {
    const trimmed = rawValue.trim()
    if (!trimmed) {
      onFormationCountChange(null)
      return
    }

    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isNaN(parsed)) return
    onFormationCountChange(Math.min(12, Math.max(1, parsed)))
  }

  const stepFormationCount = (delta: number) => {
    const current = formationCount ?? (delta > 0 ? 0 : 13)
    onFormationCountChange(Math.min(12, Math.max(1, current + delta)))
  }

  const handleModalToggleIdentity = (identityId: string) => {
    const wasSelected = selectedIdentityIds.has(identityId)
    onToggleSelectedIdentity(identityId)
    if (!wasSelected) setIdentityModalSinnerId(null)
  }

  useEffect(() => {
    if (!mobileOpen) return
    panelRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  const filterSurface = (
    <div className="flex flex-col gap-4">
      <section>
        <SectionLabel>검색</SectionLabel>
        <div className="relative" ref={searchRef}>
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#555', zIndex: 1 }} />
          <input
            type="text"
            placeholder="인격, 키워드, 제목..."
            value={inputValue}
            onChange={e => { onInputChange(e.target.value) }}
            onFocus={onInputFocus}
            onKeyDown={onSearchKeyDown}
            className="w-full rounded pl-7 pr-8 py-1.5 text-xs outline-none"
            style={{
              minHeight: '2.25rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#ccc',
              fontSize: '0.8125rem',
            }}
            aria-label="덱 검색"
          />
          {inputValue && (
            <button
              onClick={onSearchClear}
              className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-center rounded transition-colors hover:bg-white/5"
              style={{ width: '1.75rem', height: '1.75rem', color: '#777', cursor: 'pointer', zIndex: 1 }}
              aria-label="검색어 지우기"
            >
              <X size={14} />
            </button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded"
              style={{
                top: '100%',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {suggestions.map((sg, i) => {
                const kwIconUrl = sg.type === 'keyword' ? getIconUrl(sg.label) : null
                const isFocused = acIndex === i
                return (
                  <button
                    key={`${sg.type}-${sg.label}-${i}`}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
                    onClick={() => onSuggestionClick(sg.label)}
                    style={{
                      minHeight: '2.25rem',
                      cursor: 'pointer',
                      color: isFocused ? 'var(--gold)' : '#ccc',
                      background: isFocused ? 'rgba(200,144,10,0.1)' : undefined,
                      borderLeft: isFocused ? '0.125rem solid var(--gold)' : '0.125rem solid transparent',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {sg.type === 'identity' && sg.imageUrl ? (
                      <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.1875rem', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(200,144,10,0.2)' }}>
                        <Image src={sg.imageUrl} alt="" width={36} height={36} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                      </div>
                    ) : sg.type === 'identity' ? (
                      <User size={14} style={{ flexShrink: 0, color: '#8a9bb0' }} />
                    ) : kwIconUrl ? (
                      <Image src={kwIconUrl} alt="" width={14} height={14} style={{ flexShrink: 0 }} />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{sg.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: '#666', flexShrink: 0 }}>
                      {sg.type === 'identity' ? '인격' : '키워드'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <p className="mt-2" style={{ color: '#666', fontSize: '0.75rem', lineHeight: 1.35 }}>
          + OR, * AND 검색
        </p>
      </section>

      <Divider />

      <SortControls sort={sort} onSortChange={onSortChange} />

      <Divider />

      <section>
        <SectionToggle
          label="편성 수"
          open={showFormationFilter}
          active={formationCount !== null}
          count={formationCount !== null ? 1 : undefined}
          onClick={() => setShowFormationFilter(v => !v)}
        />
        {showFormationFilter && (
          <div className="flex flex-col gap-2 pt-1">
            <div
              className="flex items-stretch rounded"
              style={{
                minHeight: '2.75rem',
                background: 'rgba(255,255,255,0.035)',
                border: `1px solid ${formationCount !== null ? 'rgba(200,144,10,0.34)' : 'rgba(255,255,255,0.09)'}`,
                boxShadow: formationCount !== null ? 'inset 0 1px 0 rgba(200,144,10,0.08)' : 'none',
              }}
            >
              <button
                type="button"
                onClick={() => stepFormationCount(-1)}
                className="flex w-11 shrink-0 items-center justify-center rounded-l transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
                style={{ color: formationCount !== null ? 'var(--gold)' : '#777', cursor: 'pointer' }}
                aria-label="편성 수 1 감소"
              >
                <Minus size={15} aria-hidden="true" />
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formationCount ?? ''}
                onChange={e => applyFormationCount(e.target.value)}
                placeholder="1-12"
                className="min-w-0 flex-1 border-x text-center outline-none"
                style={{
                  background: 'transparent',
                  borderColor: 'rgba(255,255,255,0.08)',
                  color: formationCount !== null ? 'var(--gold)' : '#777',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
                aria-label="편성 순서가 지정된 수감자 수"
              />
              <button
                type="button"
                onClick={() => stepFormationCount(1)}
                className="flex w-11 shrink-0 items-center justify-center rounded-r transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
                style={{ color: formationCount !== null ? 'var(--gold)' : '#777', cursor: 'pointer' }}
                aria-label="편성 수 1 증가"
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="flex min-h-[1.75rem] items-center justify-between gap-2">
              <span style={{ color: '#777', fontSize: '0.875rem', lineHeight: 1.35 }}>
                {formationCount ? `정확히 ${formationCount}명` : '편성 순서가 지정된 수감자 수'}
              </span>
              {formationCount !== null && (
                <button
                  onClick={() => onFormationCountChange(null)}
                  className="rounded transition-colors hover:bg-white/5"
                  style={{ minHeight: '1.75rem', padding: '0 0.5rem', color: '#888', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem' }}
                >
                  초기화
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <Divider />

      <section>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <SectionToggle
              label="수감자 인격"
              open={showIdentityFilter}
              active={selectedIdentityIds.size > 0}
              count={selectedIdentityIds.size}
              onClick={() => setShowIdentityFilter(v => !v)}
            />
          </div>
          {selectedIdentityIds.size > 0 && (
            <button
              type="button"
              onClick={onToggleIdentityMode}
              className="rounded transition-all"
              style={{
                minHeight: '1.5rem',
                padding: '0 0.4375rem',
                background: identityMode === 'and' ? 'rgba(200,144,10,0.12)' : 'transparent',
                color: identityMode === 'and' ? 'var(--gold)' : '#888',
                border: `1px solid ${identityMode === 'and' ? 'rgba(200,144,10,0.28)' : 'rgba(255,255,255,0.08)'}`,
                fontFamily: 'var(--font-heading)',
                fontSize: '0.8125rem',
                letterSpacing: '0.05em',
                fontWeight: 400,
                cursor: 'pointer',
              }}
              aria-label="인격 필터 OR/AND 조건 전환"
              aria-pressed={identityMode === 'and'}
            >
              {identityMode === 'and' ? 'AND' : 'OR'}
            </button>
          )}
        </div>
        {showIdentityFilter && (
          <div className="flex flex-col gap-2 pt-1">
            <div
              className="grid grid-cols-2 gap-1.5"
              style={{
                borderTop: '1px solid rgba(200,144,10,0.16)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '0.25rem 0',
              }}
              aria-label="수감자 인격 필터"
            >
              {identityFilterSinners.map(sinner => {
                const selectedForSinner = selectedIdentitiesBySinner.get(sinner.id) ?? []
                const representativeIdentity = selectedForSinner[0]
                const representativeImageUrl = representativeIdentity ? getIdentityInfoUrl(representativeIdentity) : null
                return (
                  <button
                    key={sinner.id}
                    onClick={() => setIdentityModalSinnerId(sinner.id)}
                    className="group relative min-w-0 overflow-hidden rounded-sm transition-colors duration-200 hover:bg-[rgba(200,144,10,0.1)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
                    style={{
                      minHeight: '3.25rem',
                      padding: 0,
                      background: selectedForSinner.length > 0 ? 'rgba(25,18,10,0.92)' : 'rgba(255,255,255,0.018)',
                      boxShadow: selectedForSinner.length > 0 ? 'inset 0.1875rem 0 0 var(--gold)' : 'inset 0.0625rem 0 0 rgba(255,255,255,0.06)',
                      color: selectedForSinner.length > 0 ? 'var(--gold)' : '#9a8460',
                      cursor: 'pointer',
                    }}
                    aria-label={`${sinner.name_kr} 인격 선택${selectedForSinner.length > 0 ? `, ${selectedForSinner.length}개 선택됨` : ''}`}
                  >
                    {representativeImageUrl ? (
                      <>
                        <span className="pointer-events-none absolute inset-0" aria-hidden="true">
                          <Image
                            src={representativeImageUrl}
                            alt=""
                            fill
                            sizes="8rem"
                            style={{ objectFit: 'cover', objectPosition: 'center 14%' }}
                          />
                        </span>
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={{ background: 'linear-gradient(90deg, rgba(13,11,8,0.48) 0%, rgba(13,11,8,0.18) 52%, rgba(13,11,8,0.36) 100%)' }}
                          aria-hidden="true"
                        />
                        <span
                          className="pointer-events-none absolute inset-y-0 left-0"
                          style={{ width: '0.1875rem', background: 'var(--gold)' }}
                          aria-hidden="true"
                        />
                      </>
                    ) : (
                      <>
                        <span
                          className="pointer-events-none absolute inset-0 flex items-center justify-center"
                          aria-hidden="true"
                        >
                          <Image
                            src={getSinnerLogoUrl(sinner.id)}
                            alt=""
                            width={44}
                            height={44}
                            style={{
                              width: '2.5rem',
                              height: '2.5rem',
                              objectFit: 'contain',
                              opacity: 0.42,
                              filter: 'sepia(0.35) saturate(0.85) brightness(0.86)',
                            }}
                          />
                        </span>
                        <span
                          className="pointer-events-none absolute inset-0"
                          style={{ background: 'radial-gradient(circle at 50% 45%, rgba(200,144,10,0.08), rgba(13,11,8,0.18) 62%, rgba(13,11,8,0.48) 100%)' }}
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </button>
                )
              })}
            </div>
            {selectedIdentityIds.size > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={onClearSelectedIdentities}
                  className="rounded transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
                  style={{ minHeight: '1.75rem', padding: '0 0.5rem', color: '#888', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem' }}
                >
                  초기화
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <Divider />

      <section>
        <SectionToggle
          label="키워드 태그"
          open={showKeywordTagFilter}
          active={activeKeywords.size > 0}
          count={activeKeywords.size}
          onClick={() => setShowKeywordTagFilter(v => !v)}
        />
        {showKeywordTagFilter && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#555', zIndex: 1 }} />
              <input
                type="text"
                name="deck-keyword-tag"
                value={keywordTagInput}
                onChange={e => setKeywordTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.nativeEvent.isComposing) return
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addKeywordTag()
                  } else if (e.key === 'Escape') {
                    setKeywordTagInput('')
                  }
                }}
                placeholder="키워드 입력"
                className="w-full rounded py-1.5 pl-7 pr-3 outline-none"
                style={{
                  minHeight: '2.25rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ccc',
                  fontSize: '0.8125rem',
                }}
                role="combobox"
                aria-expanded={keywordTagSuggestions.length > 0}
                aria-label="키워드 태그 입력"
                autoComplete="off"
              />
            </div>
            {keywordTagSuggestions.length > 0 && (
              <div
                className="max-h-56 overflow-y-auto rounded"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-lg)',
                }}
                role="listbox"
                aria-label="키워드 태그 추천"
              >
                {keywordTagSuggestions.map((kw, i) => {
                  const iconUrl = getIconUrl(kw)
                  return (
                    <button
                      key={kw}
                      onClick={() => addKeywordTag(kw)}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-white/5"
                      style={{
                        minHeight: '2.25rem',
                        color: i === 0 ? 'var(--gold)' : '#ccc',
                        background: i === 0 ? 'rgba(200,144,10,0.1)' : undefined,
                        borderLeft: i === 0 ? '0.125rem solid var(--gold)' : '0.125rem solid transparent',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                      }}
                      role="option"
                      aria-selected={i === 0}
                    >
                      {iconUrl && (
                        <Image
                          src={iconUrl}
                          alt=""
                          width={16}
                          height={16}
                          style={{ width: '1rem', height: '1rem', flexShrink: 0, objectFit: 'contain' }}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">{kw}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {activeKeywords.size > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {[...activeKeywords].map(kw => (
                  <KeywordTagChip
                    key={kw}
                    keyword={kw}
                    iconUrl={getIconUrl(kw)}
                    onRemove={() => onToggleKeyword(kw)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <SectionLabel>콘텐츠 유형</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {CONTENT_TYPES.map(ct => {
            const active = activeContentType === ct
            const colors = CONTENT_TYPE_COLORS[ct]
            return (
              <button
                key={ct}
                onClick={() => onContentTypeChange(active ? '' : ct)}
                aria-pressed={active}
                className="rounded transition-all duration-200"
                style={{
                  minHeight: '2.375rem',
                  padding: '0.25rem',
                  border: `1px solid ${active ? colors.border : 'rgba(255,255,255,0.08)'}`,
                  background: active ? colors.bg : 'rgba(255,255,255,0.02)',
                  color: active ? colors.color : '#777',
                  opacity: active ? 1 : 0.55,
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                }}
              >
                <span className="block truncate">{ct}</span>
              </button>
            )
          })}
        </div>
      </section>

      {allTags.length > 0 && (
        <>
          <Divider />
          <section>
            <SectionToggle label="태그" open={showTagFilter} active={activeTags.size > 0} count={activeTags.size} onClick={onToggleTagFilter} />
            {showTagFilter && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeTags.size > 0 && (
                  <button
                    onClick={onClearTags}
                    className="rounded-full transition-colors hover:bg-white/5"
                    style={{ minHeight: '1.875rem', padding: '0.1875rem 0.5625rem', color: '#888', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem' }}
                  >
                    초기화
                  </button>
                )}
                {allTags.map(tag => {
                  const active = activeTags.has(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => onToggleTag(tag)}
                      className="max-w-full rounded-full transition-all duration-150"
                      style={{
                        minHeight: '1.875rem',
                        padding: '0.1875rem 0.5625rem',
                        background: active ? 'rgba(200,144,10,0.14)' : 'transparent',
                        color: active ? 'var(--gold)' : '#666',
                        border: `1px solid ${active ? 'rgba(200,144,10,0.35)' : 'rgba(255,255,255,0.08)'}`,
                        fontSize: '0.75rem',
                      }}
                    >
                      <span className="block max-w-full truncate">#{tag}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {availableKeywords.length > 0 && (
        <>
          <Divider />
          <section>
            <div className="flex items-start justify-between gap-2">
              <SectionLabel>상시 키워드</SectionLabel>
              {activeKeywords.size > 0 && (
                <div className="flex items-center gap-1">
                  {activeKeywords.size >= 2 && (
                    <button
                      onClick={onToggleKeywordMode}
                      className="rounded transition-all"
                      style={{
                        minHeight: '1.5rem',
                        padding: '0 0.4375rem',
                        background: keywordMode === 'and' ? 'rgba(200,144,10,0.12)' : 'transparent',
                        color: keywordMode === 'and' ? 'var(--gold)' : '#888',
                        border: `1px solid ${keywordMode === 'and' ? 'rgba(200,144,10,0.28)' : 'rgba(255,255,255,0.08)'}`,
                        fontFamily: 'var(--font-heading)',
                        fontSize: '0.8125rem',
                        letterSpacing: '0.05em',
                        fontWeight: 400,
                      }}
                      aria-label="키워드 OR/AND 조건 전환"
                    >
                      {keywordMode === 'and' ? 'AND' : 'OR'}
                    </button>
                  )}
                  <button
                    onClick={onClearKeywords}
                    className="rounded transition-colors hover:bg-white/5"
                    style={{ minHeight: '1.5rem', padding: '0 0.4375rem', color: '#888', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.625rem' }}
                  >
                    초기화
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {availableKeywords.map(kw => (
                <SquareToggle
                  key={kw}
                  active={activeKeywords.has(kw)}
                  label={kw}
                  iconUrl={getIconUrl(kw)}
                  onClick={() => onToggleKeyword(kw)}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <Divider />

      <section>
        <SectionToggle label="보유 필터" open={showCollectionFilter} active={collectionCount > 0} count={collectionCount} onClick={onToggleCollectionFilter} />
        {showCollectionFilter && (
          <div className="flex flex-col gap-2 pt-1">
            {collectionLoading ? (
              <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                컬렉션 로딩 중...
              </span>
            ) : hasCollection ? (
              <div className="grid grid-cols-2 gap-1.5">
                <SquareToggle active={filterOwnedIdentity} label="인격" onClick={onToggleFilterOwnedIdentity} ariaLabel="보유 인격 덱" />
                <SquareToggle active={filterOwnedEgo} label="에고" onClick={onToggleFilterOwnedEgo} ariaLabel="보유 에고 덱" />
                <button
                  onClick={onClearCollection}
                  className="col-span-2 rounded transition-colors hover:bg-white/5"
                  style={{ minHeight: '2rem', color: '#888', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem' }}
                >
                  초기화
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Link2 size={13} style={{ color: '#777', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={codeInput}
                    onChange={e => { onCodeInputChange(e.target.value) }}
                    onKeyDown={e => { if (e.key === 'Enter') onApplyCode() }}
                    placeholder="보유 현황 URL 또는 코드"
                    className="min-w-0 flex-1 rounded px-2 py-1.5 outline-none"
                    style={{
                      minHeight: '2.25rem',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${codeError ? 'rgba(200,80,80,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: '#ccc',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                    aria-label="보유 현황 URL 또는 코드"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onApplyCode}
                    className="rounded transition-colors hover:bg-white/5"
                    style={{
                      minHeight: '2rem',
                      padding: '0 0.75rem',
                      background: 'rgba(200,144,10,0.1)',
                      color: 'var(--gold)',
                      border: '1px solid rgba(200,144,10,0.28)',
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                    }}
                  >
                    적용
                  </button>
                  {codeError && (
                    <span style={{ color: '#c85050', fontFamily: 'var(--font-body)', fontSize: '0.875rem' }}>
                      잘못된 코드
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )

  return (
    <>
      <aside
        className="decks-filters hidden h-full shrink-0 overflow-y-auto pr-3 scrollbar-thin lg:block"
        style={{
          width: '16rem',
          borderRight: '1px solid rgba(200,144,10,0.18)',
        }}
        aria-label="덱 필터"
      >
        {filterSurface}
      </aside>

      <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-full px-5 shadow-lg transition-transform active:scale-95"
          style={{
            minHeight: '3rem',
            cursor: 'pointer',
            background: 'var(--gold)',
            color: '#0d0b08',
            fontWeight: 700,
            fontSize: '0.9375rem',
          }}
        >
          <SlidersHorizontal size={17} />
          필터{totalActiveCount > 0 ? ` (${totalActiveCount})` : ''}
        </button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="덱 필터 패널"
        >
          <button
            className="absolute inset-0 h-full w-full bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-label="필터 패널 닫기"
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            className="absolute bottom-0 left-0 right-0 max-h-[82dvh] overflow-y-auto rounded-t-lg outline-none scrollbar-thin"
            style={{
              background: '#1a1510',
              borderTop: '1px solid rgba(200,144,10,0.25)',
              animation: 'deckFilterSlideUp 0.24s ease-out',
            }}
          >
            <div
              className="sticky top-0 flex items-center justify-between px-5 py-3"
              style={{
                background: '#1a1510',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                zIndex: 1,
              }}
            >
              <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', fontSize: '0.875rem' }}>
                FILTERS
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center rounded transition-colors hover:bg-white/5"
                style={{ width: '2.75rem', height: '2.75rem', cursor: 'pointer', color: '#9a938a' }}
                aria-label="필터 닫기"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-5 py-4">
              {filterSurface}
            </div>
          </div>
        </div>
      )}

      <DeckIdentityFilterModal
        open={!!identityModalSinnerId}
        sinner={identityModalSinner}
        identities={identityModalIdentities}
        selectedIdentityIds={selectedIdentityIds}
        onToggleIdentity={handleModalToggleIdentity}
        onClose={() => setIdentityModalSinnerId(null)}
      />

      <style jsx>{`
        @keyframes deckFilterSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
