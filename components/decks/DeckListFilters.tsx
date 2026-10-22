'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useLocale, useTranslations } from 'next-intl'
import { Info, Link2, Search, User, X } from 'lucide-react'
import { CONTENT_TYPES, CONTENT_TYPE_COLORS } from '@/lib/constants/deck-tokens'
import { getIdentityInfoUrl } from '@/lib/utils/images'
import { useKeywords } from '@/components/providers/KeywordProvider'
import type { SupportedLang } from '@/lib/i18n'
import {
  DECK_LANGUAGE_FILTERS,
  contentTypeMessageKey,
  localizeDeckKeyword,
  type DeckLanguageFilter,
  type SearchSuggestion,
} from './decks-types'
import type { DeckFilterIdentity, DeckFilterSinner } from './DeckIdentityFilterModal'
import FormationCountFilter from './FormationCountFilter'
import { FilterChoice, FilterFieldHelp, FilterIconTile, FilterPicked, FilterSection, FilterSinnerTiles, FilterTextButton, filterStyles } from '@/components/board/FilterControls'

// The closed BaseModal is SSR-safe; opting out here aborts the whole list's Suspense boundary.
const DeckIdentityFilterModal = dynamic(() => import('./DeckIdentityFilterModal'), {
  loading: () => null,
})

interface DeckListFiltersProps {
  /** Counts up each time the list's own filters button asks for the filter drawer to open. */
  openSignal?: number
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
  activeKeywordTags: Set<string>
  keywordTagMode: 'or' | 'and'
  showKeywordFilter: boolean
  onToggleKeywordFilter: () => void
  onToggleKeywordTag: (kw: string) => void
  onClearKeywordTags: () => void
  onToggleKeywordTagMode: () => void
  activeMainKeywords: Set<string>
  mainKeywordMode: 'or' | 'and'
  onToggleMainKeyword: (kw: string) => void
  onClearMainKeywords: () => void
  onToggleMainKeywordMode: () => void
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
  minInfoScore: number | null
  onMinInfoScoreChange: (score: number | null) => void
  identityFilterSinners: DeckFilterSinner[]
  identityFilterIdentities: DeckFilterIdentity[]
  selectedIdentityIds: Set<string>
  selectedIdentities: DeckFilterIdentity[]
  identityMode: 'or' | 'and'
  onToggleSelectedIdentity: (identityId: string) => void
  onToggleIdentityMode: () => void
  onClearSelectedIdentities: () => void
  languageFilter: DeckLanguageFilter
  onLanguageFilterChange: (value: DeckLanguageFilter) => void
  /** Board facet sections (affiliation, E.G.O), placed before the collection filter. */
  facetSections?: React.ReactNode
}

type SortKey = 'latest' | 'popular'
const INFO_SCORE_OPTIONS = [1, 2, 3] as const


function InfoScoreLabel() {
  const t = useTranslations('decks')
  const tooltipId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const tooltipWidth = 13 * rootFontSize
      const gap = 0.375 * rootFontSize
      const viewportPadding = 0.75 * rootFontSize
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding),
      )
      const tooltipHeight = tooltipRef.current?.offsetHeight ?? 0
      const belowTop = rect.bottom + gap
      const top = tooltipHeight > 0 && belowTop + tooltipHeight + viewportPadding > window.innerHeight
        ? Math.max(viewportPadding, rect.top - tooltipHeight - gap)
        : belowTop
      setPosition({ top, left })
    }

    updatePosition()
    const frame = window.requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  return (
    <span className="relative inline-flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate">{t('filters.infoScore')}</span>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
        style={{
          width: '1.5rem',
          height: '1.5rem',
          color: 'var(--deck-filter-text-soft)',
          cursor: 'help',
        }}
        aria-label={t('filters.infoScoreHelpLabel')}
        aria-describedby={open ? tooltipId : undefined}
        onBlur={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Info size={13} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {mounted && open && createPortal(
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-50 w-[13rem] rounded border px-2.5 py-2 text-left"
          style={{
            top: position.top,
            left: position.left,
            background: '#1a1510',
            borderColor: 'rgba(200,144,10,0.28)',
            boxShadow: '0 0.75rem 1.5rem rgba(0,0,0,0.32)',
            color: 'var(--deck-filter-text-muted)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            lineHeight: 1.45,
            whiteSpace: 'normal',
          }}
        >
          {t('filters.infoScoreHelp')}
        </span>,
        document.body,
      )}
    </span>
  )
}

export default function DeckListFilters({
  inputValue, onInputChange, onInputFocus, onSearchClear, onSearchKeyDown,
  searchRef, showSuggestions, suggestions, acIndex, onSuggestionClick, getIconUrl,
  sort, onSortChange,
  activeContentType, onContentTypeChange,
  advancedFilterCount,
  allTags, activeTags, showTagFilter, onToggleTagFilter, onToggleTag, onClearTags,
  keywordCandidates, availableKeywords, activeKeywordTags, keywordTagMode,
  onToggleKeywordTag, onClearKeywordTags, onToggleKeywordTagMode,
  activeMainKeywords, mainKeywordMode, onToggleMainKeyword, onClearMainKeywords, onToggleMainKeywordMode,
  showCollectionFilter, onToggleCollectionFilter,
  collectionLoading, hasCollection,
  filterOwnedIdentity, filterOwnedEgo,
  onToggleFilterOwnedIdentity, onToggleFilterOwnedEgo, onClearCollection,
  codeInput, onCodeInputChange, onApplyCode, codeError,
  formationCount, onFormationCountChange,
  minInfoScore, onMinInfoScoreChange,
  identityFilterSinners, identityFilterIdentities,
  selectedIdentityIds, selectedIdentities,
  identityMode,
  onToggleSelectedIdentity, onToggleIdentityMode, onClearSelectedIdentities,
  languageFilter, onLanguageFilterChange, facetSections,
  openSignal,
}: DeckListFiltersProps) {
  const t = useTranslations('decks')
  const rootT = useTranslations()
  const locale = useLocale() as SupportedLang
  const keywords = useKeywords()
  const localKeyword = (keyword: string) => localizeDeckKeyword(keyword, keywords[keyword], locale)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => { if (openSignal) setMobileOpen(true) }, [openSignal])
  const [showKeywordTagFilter, setShowKeywordTagFilter] = useState(true)
  const [showFormationFilter, setShowFormationFilter] = useState(true)
  const [showIdentityFilter, setShowIdentityFilter] = useState(true)
  const [identityModalSinnerId, setIdentityModalSinnerId] = useState<string | null>(null)
  const [keywordTagInput, setKeywordTagInput] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const collectionCount = (filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)
  const totalActiveCount = advancedFilterCount + (activeContentType ? 1 : 0) + (inputValue.trim() ? 1 : 0)
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
      .filter(kw => {
        if (activeKeywordTags.has(kw)) return false
        const localized = localKeyword(kw).toLowerCase()
        return kw.toLowerCase().includes(q) || localized.includes(q)
      })
      .sort((a, b) => {
        const aLow = localKeyword(a).toLowerCase()
        const bLow = localKeyword(b).toLowerCase()
        const aStarts = aLow.startsWith(q) ? 0 : 1
        const bStarts = bLow.startsWith(q) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts
        return aLow.localeCompare(bLow, locale)
      })
      .slice(0, 8)
  }, [activeKeywordTags, keywordCandidates, keywordTagInput, localKeyword, locale])

  const addKeywordTag = (rawKeyword?: string) => {
    const value = (rawKeyword ?? keywordTagInput).trim()
    if (!value) return
    const matchedKeyword = keywordCandidates.find(kw => kw.toLowerCase() === value.toLowerCase()) ?? keywordTagSuggestions[0]
    if (!matchedKeyword || activeKeywordTags.has(matchedKeyword)) return
    onToggleKeywordTag(matchedKeyword)
    setKeywordTagInput('')
  }

  const localizeSinnerName = (sinner: DeckFilterSinner) => (
    rootT(`sinner.${sinner.id}` as Parameters<typeof rootT>[0])
  )

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
    <div className={filterStyles.surface}>
      <section>
        <div className="relative" ref={searchRef}>
          <label className={filterStyles.field}>
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder={t('search.placeholder')}
              value={inputValue}
              onChange={e => { onInputChange(e.target.value) }}
              onFocus={onInputFocus}
              onKeyDown={onSearchKeyDown}
              className={filterStyles.fieldInput}
              aria-label={t('search.label')}
            />
            {inputValue ? <button type="button" onClick={onSearchClear} aria-label={t('search.clear')}><X size={14} aria-hidden="true" /></button> : <FilterFieldHelp text={t('search.hint')} />}
          </label>
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
                      minHeight: 'var(--deck-filter-control-min)',
                      cursor: 'pointer',
                      color: isFocused ? 'var(--gold)' : 'var(--deck-filter-text)',
                      background: isFocused ? 'var(--deck-filter-surface-active)' : undefined,
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
                    <span className="min-w-0 flex-1 truncate">{sg.type === 'keyword' ? localKeyword(sg.label) : sg.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.625rem', color: '#666', flexShrink: 0 }}>
                      {sg.type === 'identity' ? t('search.suggestionIdentity') : t('search.suggestionKeyword')}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <FilterSection label={t('sort.label')}>
        <div className={filterStyles.choices}>
          {(['latest', 'popular'] as SortKey[]).map(key => <FilterChoice key={key} active={sort === key} onClick={() => onSortChange(key)}>{t(`sort.${key}`)}</FilterChoice>)}
        </div>
      </FilterSection>

      <FilterSection label={t('filters.contentType')}>
        <div className={filterStyles.choices}>
          {CONTENT_TYPES.map(ct => {
            const active = activeContentType === ct
            const tone = CONTENT_TYPE_COLORS[ct]
            return <FilterChoice key={ct} active={active} tone={tone?.color} onClick={() => onContentTypeChange(active ? '' : ct)}>{t(`contentTypes.${contentTypeMessageKey(ct)}`)}</FilterChoice>
          })}
        </div>
      </FilterSection>

      {availableKeywords.length > 0 && (
        <FilterSection
          label={t('filters.alwaysKeywords')}
          count={activeMainKeywords.size}
          end={<>
            {activeMainKeywords.size >= 2 && <FilterTextButton onClick={onToggleMainKeywordMode} aria-pressed={mainKeywordMode === 'and'} aria-label={t('filters.mainKeywordModeToggle')}>{mainKeywordMode === 'and' ? t('filters.and') : t('filters.or')}</FilterTextButton>}
            {activeMainKeywords.size > 0 && <FilterTextButton onClick={onClearMainKeywords}>{t('filters.clear')}</FilterTextButton>}
          </>}
        >
          <div className={filterStyles.tiles}>
            {availableKeywords.map(kw => <FilterIconTile key={kw} active={activeMainKeywords.has(kw)} label={localKeyword(kw)} iconUrl={getIconUrl(kw)} onClick={() => onToggleMainKeyword(kw)} />)}
          </div>
        </FilterSection>
      )}

      <FilterSection
        label={t('filters.identity')}
        count={selectedIdentityIds.size}
        open={showIdentityFilter}
        onToggle={() => setShowIdentityFilter(v => !v)}
        end={<>
          {selectedIdentityIds.size >= 2 && <FilterTextButton onClick={onToggleIdentityMode} aria-pressed={identityMode === 'and'} aria-label={t('filters.identityModeToggle')}>{identityMode === 'and' ? t('filters.and') : t('filters.or')}</FilterTextButton>}
          {selectedIdentityIds.size > 0 && <FilterTextButton onClick={onClearSelectedIdentities}>{t('filters.clear')}</FilterTextButton>}
        </>}
      >
        <FilterSinnerTiles
          sinners={identityFilterSinners}
          picked={selectedIdentitiesBySinner}
          image={getIdentityInfoUrl}
          groupLabel={t('filters.identity')}
          label={(sinner, count) => `${localizeSinnerName(sinner)} ${t('identityFilter.fallbackTitle')}${count > 0 ? `, ${count} ${t('filters.identitySelected')}` : ''}`}
          onOpen={setIdentityModalSinnerId}
        />
      </FilterSection>

      {facetSections}

      <FilterSection
        label={t('filters.keywordTags')}
        count={activeKeywordTags.size}
        open={showKeywordTagFilter}
        onToggle={() => setShowKeywordTagFilter(v => !v)}
        end={<>
          {activeKeywordTags.size >= 2 && <FilterTextButton onClick={onToggleKeywordTagMode} aria-pressed={keywordTagMode === 'and'} aria-label={t('filters.keywordTagModeToggle')}>{keywordTagMode === 'and' ? t('filters.and') : t('filters.or')}</FilterTextButton>}
          {activeKeywordTags.size > 0 && <FilterTextButton onClick={onClearKeywordTags}>{t('filters.clear')}</FilterTextButton>}
        </>}
      >
        <div className="flex flex-col gap-2">
          <label className={filterStyles.field}>
            <Search size={16} aria-hidden="true" />
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
              placeholder={t('filters.keywordTagPlaceholder')}
              className={filterStyles.fieldInput}
              role="combobox"
              aria-expanded={keywordTagSuggestions.length > 0}
              aria-label={t('filters.keywordTagInput')}
              autoComplete="off"
            />
          </label>
            {keywordTagSuggestions.length > 0 && (
              <div
                className="max-h-56 overflow-y-auto rounded"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-lg)',
                }}
                role="listbox"
                aria-label={t('filters.keywordTagSuggestions')}
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
                      <span className="min-w-0 flex-1 truncate">{localKeyword(kw)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          {activeKeywordTags.size > 0 && <div className={filterStyles.pickedList}>
            {[...activeKeywordTags].map(kw => {
              const label = localKeyword(kw)
              return <FilterPicked key={kw} label={label} removeLabel={t('filters.removeKeywordTag', { keyword: label })} image={getIconUrl(kw)} imageClassName="object-contain" onRemove={() => onToggleKeywordTag(kw)} />
            })}
          </div>}
        </div>
      </FilterSection>

      {allTags.length > 0 && (
        <FilterSection label={t('filters.tags')} count={activeTags.size} open={showTagFilter} onToggle={onToggleTagFilter}
          end={activeTags.size > 0 && <FilterTextButton onClick={onClearTags}>{t('filters.clear')}</FilterTextButton>}>
          <div className={filterStyles.choices}>
            {allTags.map(tag => <FilterChoice key={tag} active={activeTags.has(tag)} onClick={() => onToggleTag(tag)}>#{tag}</FilterChoice>)}
          </div>
        </FilterSection>
      )}

      <FilterSection label={<InfoScoreLabel />} count={minInfoScore !== null ? 1 : 0}
        end={minInfoScore !== null && <FilterTextButton onClick={() => onMinInfoScoreChange(null)}>{t('filters.clear')}</FilterTextButton>}>
        <div className={filterStyles.choices} role="group" aria-label={t('filters.infoScoreMin')}>
          {INFO_SCORE_OPTIONS.map(score => {
            const active = minInfoScore === score
            return <FilterChoice key={score} active={active} onClick={() => onMinInfoScoreChange(active ? null : score)}>{score === 3 ? '3' : `${score}+`}</FilterChoice>
          })}
        </div>
        <p className={`${filterStyles.hint} flex flex-wrap gap-x-3`}>
          {[t('filters.infoScoreFormation'), t('filters.infoScoreEgo'), t('filters.infoScoreMemo')].map(label => <span key={label}>{label}</span>)}
        </p>
      </FilterSection>

      <FilterSection label={t('filters.formationCount')} count={formationCount !== null ? 1 : 0} open={showFormationFilter} onToggle={() => setShowFormationFilter(v => !v)}>
        <FormationCountFilter value={formationCount} onChange={onFormationCountChange} />
      </FilterSection>

      <FilterSection label={t('languageFilter.label')}>
        <div className={filterStyles.choices}>
          {DECK_LANGUAGE_FILTERS.map(option => (
            <FilterChoice key={option} active={languageFilter === option} onClick={() => onLanguageFilterChange(option)}>{t(`languageFilter.${option === 'mine' ? 'current' : option}`)}</FilterChoice>
          ))}
        </div>
      </FilterSection>

      <FilterSection label={t('filters.collection')} count={collectionCount} open={showCollectionFilter} onToggle={onToggleCollectionFilter}
        end={hasCollection && !collectionLoading && <FilterTextButton onClick={onClearCollection}>{t('filters.clear')}</FilterTextButton>}>
        {collectionLoading ? (
          <p className={filterStyles.hint} role="status" style={{ marginTop: 0 }}>{t('filters.collectionLoading')}</p>
        ) : hasCollection ? (
          <div className={filterStyles.choices}>
            <FilterChoice active={filterOwnedIdentity} aria-label={t('filters.ownedIdentityDeck')} onClick={onToggleFilterOwnedIdentity}>{t('filters.collectionIdentity')}</FilterChoice>
            <FilterChoice active={filterOwnedEgo} aria-label={t('filters.ownedEgoDeck')} onClick={onToggleFilterOwnedEgo}>{t('filters.collectionEgo')}</FilterChoice>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className={`${filterStyles.field} min-w-0 flex-1`} data-invalid={codeError || undefined}>
                <Link2 size={15} aria-hidden="true" />
                <input
                  type="text"
                  value={codeInput}
                  onChange={e => { onCodeInputChange(e.target.value) }}
                  onKeyDown={e => { if (e.key === 'Enter') onApplyCode() }}
                  placeholder={t('filters.collectionCodePlaceholder')}
                  className={filterStyles.fieldInput}
                  aria-label={t('filters.collectionCodeLabel')}
                />
              </label>
              <button type="button" className={filterStyles.action} onClick={onApplyCode}>{t('filters.apply')}</button>
            </div>
            {codeError && <p className={filterStyles.hint} role="alert" style={{ color: '#c85050' }}>{t('filters.invalidCode')}</p>}
          </>
        )}
      </FilterSection>
    </div>
  )

  return (
    <>
      <aside
        className="decks-filters board-filters hidden h-full shrink-0 overflow-y-auto pr-3 lg:block"
        aria-label={t('filters.aside')}
      >
        {filterSurface}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('filters.panel')}
        >
          <button
            className="absolute inset-0 h-full w-full bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-label={t('filters.closePanel')}
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            className="popup-drawer absolute bottom-0 left-0 right-0 max-h-[82dvh] overflow-y-auto rounded-t-lg outline-none"
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
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>{t('filters.button')}</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center rounded transition-colors hover:bg-white/5"
                style={{ width: '2.75rem', height: '2.75rem', cursor: 'pointer', color: '#9a938a' }}
                aria-label={t('filters.close')}
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
        open={identityModalSinnerId !== null}
        sinnerId={identityModalSinnerId ?? ''}
        sinners={identityFilterSinners}
        identities={identityFilterIdentities}
        selectedIdentityIds={selectedIdentityIds}
        onToggleIdentity={onToggleSelectedIdentity}
        onClearIdentities={onClearSelectedIdentities}
        onSinnerChange={setIdentityModalSinnerId}
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
