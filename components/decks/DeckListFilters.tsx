'use client'

import Image from 'next/image'
import { User, Link2, PackageOpen } from 'lucide-react'
import type { DeckSummary } from '@/components/decks/DeckCard'
import { CONTENT_TYPES, CONTENT_TYPE_COLORS } from '@/lib/constants/deck-tokens'
import type { SearchSuggestion } from './decks-types'

interface DeckListFiltersProps {
  // Search
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

  // Sort
  sort: string
  onSortChange: (s: string) => void

  // Content type filter
  activeContentType: string
  onContentTypeChange: (ct: string) => void

  // Advanced filter toggle
  showAdvancedFilter: boolean
  onToggleAdvancedFilter: () => void
  advancedFilterCount: number

  // Tag filter
  allTags: string[]
  activeTags: Set<string>
  showTagFilter: boolean
  onToggleTagFilter: () => void
  onToggleTag: (tag: string) => void
  onClearTags: () => void

  // Keyword filter
  availableKeywords: string[]
  activeKeywords: Set<string>
  keywordMode: 'or' | 'and'
  showKeywordFilter: boolean
  onToggleKeywordFilter: () => void
  onToggleKeyword: (kw: string) => void
  onClearKeywords: () => void
  onToggleKeywordMode: () => void

  // Collection filter
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
}

type SortKey = 'latest' | 'popular'

export default function DeckListFilters({
  inputValue, onInputChange, onInputFocus, onSearchClear, onSearchKeyDown,
  searchRef, showSuggestions, suggestions, acIndex, onSuggestionClick, getIconUrl,
  sort, onSortChange,
  activeContentType, onContentTypeChange,
  showAdvancedFilter, onToggleAdvancedFilter, advancedFilterCount,
  allTags, activeTags, showTagFilter, onToggleTagFilter, onToggleTag, onClearTags,
  availableKeywords, activeKeywords, keywordMode, showKeywordFilter,
  onToggleKeywordFilter, onToggleKeyword, onClearKeywords, onToggleKeywordMode,
  showCollectionFilter, onToggleCollectionFilter,
  collectionLoading, hasCollection,
  filterOwnedIdentity, filterOwnedEgo,
  onToggleFilterOwnedIdentity, onToggleFilterOwnedEgo, onClearCollection,
  codeInput, onCodeInputChange, onApplyCode, codeError,
}: DeckListFiltersProps) {
  return (
    <div
      className="decks-filters mb-6"
      style={{
        opacity: 0,
        background: 'rgba(10,8,5,0.5)',
        border: '1px solid var(--border)',
        borderRadius: '0.375rem',
      }}
    >
      {/* 검색 + 정렬 */}
      <div className="flex flex-col sm:flex-row gap-3 px-4 py-3">
        <div className="relative flex-1" ref={searchRef}>
          <svg
            width="14" height="14" viewBox="0 0 16 16" fill="none"
            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none', zIndex: 1 }}
          >
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="인격, 키워드, 제목 검색... (+: OR, *: AND)"
            value={inputValue}
            onChange={e => { onInputChange(e.target.value) }}
            onFocus={onInputFocus}
            onKeyDown={onSearchKeyDown}
            className="w-full pl-10 pr-4 py-2.5 text-sm outline-none transition-all"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              borderRadius: '0.25rem',
              color: '#e8dcc8',
              fontFamily: 'var(--font-body)',
            }}
          />
          {inputValue && (
            <button
              onClick={onSearchClear}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', cursor: 'pointer', zIndex: 1 }}
            >
              ✕
            </button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 z-50 overflow-hidden"
              style={{
                top: '100%',
                marginTop: 4,
                background: '#1a1510',
                border: '1px solid var(--border)',
                borderRadius: '0.25rem',
                boxShadow: '0 0.5rem 1.5rem rgba(0,0,0,0.5)',
              }}
            >
              <div className="px-3 py-1" style={{ background: 'rgba(255,255,255,0.03)', color: '#444', fontSize: '0.625rem', fontWeight: 600 }}>
                인격 / 키워드 <span style={{ color: '#333', fontWeight: 400 }}>Tab으로 선택</span>
              </div>
              {suggestions.map((sg, i) => {
                const kwIconUrl = sg.type === 'keyword' ? getIconUrl(sg.label) : null
                const isFocused = acIndex === i
                return (
                  <div
                    key={`${sg.type}-${sg.label}-${i}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs"
                    onClick={() => onSuggestionClick(sg.label)}
                    style={{
                      cursor: 'pointer',
                      color: isFocused ? '#e8b030' : '#c8b890',
                      fontFamily: 'var(--font-heading)',
                      background: isFocused ? 'rgba(200,144,10,0.12)' : 'transparent',
                      borderLeft: isFocused ? '2px solid var(--gold)' : '2px solid transparent',
                    }}
                  >
                    {sg.type === 'identity' && sg.imageUrl ? (
                      <div style={{ width: '1.5rem', height: '1.5rem', borderRadius: '0.1875rem', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(200,144,10,0.2)' }}>
                        <Image src={sg.imageUrl} alt="" width={40} height={40} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
                      </div>
                    ) : sg.type === 'identity' ? (
                      <User size={14} style={{ flexShrink: 0, color: '#8a9bb0' }} />
                    ) : kwIconUrl ? (
                      <Image src={kwIconUrl} alt="" width={14} height={14} style={{ flexShrink: 0 }} />
                    ) : null}
                    <span>{sg.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.5625rem', color: '#555', flexShrink: 0 }}>
                      {sg.type === 'identity' ? '인격' : '키워드'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex gap-1.5 flex-shrink-0">
          {(['latest', 'popular'] as SortKey[]).map(s => (
            <button
              key={s}
              onClick={() => onSortChange(s)}
              className="px-4 py-2.5 rounded text-sm font-medium transition-all duration-200"
              style={{
                background: sort === s ? 'var(--gold)' : 'transparent',
                color: sort === s ? 'var(--bg-deep)' : '#888899',
                border: `1px solid ${sort === s ? 'var(--gold)' : 'var(--border)'}`,
                fontFamily: 'var(--font-heading)',
                fontSize: '0.75rem',
              }}
            >
              {s === 'latest' ? '최신순' : '인기순'}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 유형 필터 */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {CONTENT_TYPES.map(ct => {
          const active = activeContentType === ct
          const colors = CONTENT_TYPE_COLORS[ct]
          return (
            <button
              key={ct}
              onClick={() => onContentTypeChange(active ? '' : ct)}
              className="px-3 py-1 rounded text-xs transition-all duration-150"
              style={{
                background: active ? colors.bg : 'transparent',
                color: active ? colors.color : '#555566',
                border: `1px solid ${active ? colors.border : 'var(--border)'}`,
                fontFamily: 'var(--font-heading)',
                fontSize: '0.6875rem',
              }}
            >
              {ct}
            </button>
          )
        })}
        {activeContentType && (
          <button
            onClick={() => onContentTypeChange('')}
            className="px-3 py-1 rounded text-xs transition-all duration-150"
            style={{ background: 'transparent', color: '#888888', border: '1px solid var(--border)' }}
          >
            초기화
          </button>
        )}
      </div>

      {/* 상세 필터 토글 */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onToggleAdvancedFilter}
          className="flex items-center gap-2 w-full px-4 py-2.5 text-xs transition-colors hover:bg-white/[0.02]"
          style={{ color: advancedFilterCount > 0 ? 'var(--gold)' : 'var(--text-muted)', fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xs)' }}
        >
          <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{showAdvancedFilter ? '▾' : '▸'}</span>
          상세 필터
          {advancedFilterCount > 0 && (
            <span style={{ background: 'rgba(200,144,10,0.2)', color: 'var(--gold)', padding: '0 0.375rem', borderRadius: '0.5rem', fontSize: '0.625rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {advancedFilterCount}
            </span>
          )}
        </button>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', display: showAdvancedFilter ? 'block' : 'none' }}>
        {/* 태그 필터 */}
        {allTags.length > 0 && (
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <button
              onClick={onToggleTagFilter}
              className="flex items-center gap-2 w-full px-4 py-2 text-xs transition-colors hover:bg-white/[0.02]"
              style={{ color: activeTags.size > 0 ? 'var(--gold)' : '#666', fontFamily: 'var(--font-heading)', fontSize: '0.6875rem' }}
            >
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{showTagFilter ? '▾' : '▸'}</span>
              태그
              {activeTags.size > 0 && (
                <span style={{ background: 'rgba(200,144,10,0.2)', color: 'var(--gold)', padding: '0 0.375rem', borderRadius: '0.5rem', fontSize: '0.625rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {activeTags.size}
                </span>
              )}
            </button>
            {showTagFilter && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                {activeTags.size > 0 && (
                  <button
                    onClick={onClearTags}
                    className="px-2.5 py-1 rounded-full text-xs"
                    style={{ color: '#888', border: '1px solid var(--border)' }}
                  >
                    초기화
                  </button>
                )}
                {allTags.map(tag => {
                  const isActive = activeTags.has(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => onToggleTag(tag)}
                      className="px-3 py-1 rounded-full text-xs transition-all duration-150"
                      style={{
                        background: isActive ? 'rgba(200,144,10,0.2)' : 'transparent',
                        color: isActive ? 'var(--gold)' : '#555566',
                        border: `1px solid ${isActive ? 'var(--gold-dim)' : 'var(--border)'}`,
                      }}
                    >
                      #{tag}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 키워드 필터 */}
        {availableKeywords.length > 0 && (
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <button
              onClick={onToggleKeywordFilter}
              className="flex items-center gap-2 w-full px-4 py-2 text-xs transition-colors hover:bg-white/[0.02]"
              style={{ color: activeKeywords.size > 0 ? 'var(--gold)' : '#666', fontFamily: 'var(--font-heading)', fontSize: '0.6875rem' }}
            >
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{showKeywordFilter ? '▾' : '▸'}</span>
              키워드
              {activeKeywords.size > 0 && (
                <span style={{ background: 'rgba(200,144,10,0.2)', color: 'var(--gold)', padding: '0 0.375rem', borderRadius: '0.5rem', fontSize: '0.625rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {activeKeywords.size}
                </span>
              )}
              <div className="flex-1" />
              {activeKeywords.size >= 2 && (
                <span
                  onClick={e => { e.stopPropagation(); onToggleKeywordMode() }}
                  className="px-2 py-0.5 rounded transition-all"
                  style={{
                    background: keywordMode === 'and' ? 'rgba(200,144,10,0.15)' : 'rgba(255,255,255,0.05)',
                    color: keywordMode === 'and' ? '#c8a450' : '#9a9aaa',
                    border: `1px solid ${keywordMode === 'and' ? 'rgba(200,144,10,0.3)' : 'rgba(255,255,255,0.12)'}`,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.5625rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  {keywordMode === 'and' ? 'AND' : 'OR'}
                </span>
              )}
            </button>
            {showKeywordFilter && (
              <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
                {activeKeywords.size > 0 && (
                  <button
                    onClick={onClearKeywords}
                    className="px-2.5 py-1 rounded text-xs"
                    style={{ color: '#888', border: '1px solid var(--border)' }}
                  >
                    초기화
                  </button>
                )}
                {availableKeywords.map(kw => {
                  const isActive = activeKeywords.has(kw)
                  const iconUrl = getIconUrl(kw)
                  return (
                    <button
                      key={kw}
                      onClick={() => onToggleKeyword(kw)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all duration-150"
                      style={{
                        background: isActive ? 'rgba(136,88,40,0.25)' : 'transparent',
                        color: isActive ? '#c8a450' : '#555566',
                        border: `1px solid ${isActive ? 'rgba(136,88,40,0.5)' : 'var(--border)'}`,
                        fontFamily: 'var(--font-heading)',
                        fontSize: '0.6875rem',
                      }}
                    >
                      {iconUrl && (
                        <Image src={iconUrl} alt="" width={13} height={13} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.5 }} />
                      )}
                      {kw}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 컬렉션 필터 */}
        <div>
          <button
            onClick={onToggleCollectionFilter}
            className="flex items-center gap-2 w-full px-4 py-2 text-xs transition-colors hover:bg-white/[0.02]"
            style={{ color: (filterOwnedIdentity || filterOwnedEgo) ? 'var(--gold)' : '#666', fontFamily: 'var(--font-heading)', fontSize: '0.6875rem' }}
          >
            <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{showCollectionFilter ? '▾' : '▸'}</span>
            보유 필터
            {(filterOwnedIdentity || filterOwnedEgo) && (
              <span style={{ background: 'rgba(80,160,80,0.2)', color: '#80c880', padding: '0 0.375rem', borderRadius: '0.5rem', fontSize: '0.625rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {(filterOwnedIdentity ? 1 : 0) + (filterOwnedEgo ? 1 : 0)}
              </span>
            )}
          </button>
          {showCollectionFilter && (
            <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
              {collectionLoading ? (
                <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  컬렉션 로딩 중...
                </span>
              ) : hasCollection ? (
                <>
                  <button
                    onClick={onToggleFilterOwnedIdentity}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all duration-150"
                    style={{
                      background: filterOwnedIdentity ? 'rgba(80,160,80,0.15)' : 'transparent',
                      color: filterOwnedIdentity ? '#80c880' : '#555566',
                      border: `1px solid ${filterOwnedIdentity ? 'rgba(80,160,80,0.4)' : 'var(--border)'}`,
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.6875rem',
                      cursor: 'pointer',
                    }}
                  >
                    <User size={12} />
                    보유 인격 덱
                  </button>
                  <button
                    onClick={onToggleFilterOwnedEgo}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all duration-150"
                    style={{
                      background: filterOwnedEgo ? 'rgba(80,160,80,0.15)' : 'transparent',
                      color: filterOwnedEgo ? '#80c880' : '#555566',
                      border: `1px solid ${filterOwnedEgo ? 'rgba(80,160,80,0.4)' : 'var(--border)'}`,
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.6875rem',
                      cursor: 'pointer',
                    }}
                  >
                    <PackageOpen size={12} />
                    보유 에고 덱
                  </button>
                  <button
                    onClick={onClearCollection}
                    className="px-2 py-1.5 rounded text-xs transition-all duration-150"
                    style={{ color: '#888888', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-heading)', fontSize: '0.6875rem' }}
                  >
                    초기화
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <Link2 size={13} style={{ color: '#888888', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={codeInput}
                    onChange={e => { onCodeInputChange(e.target.value) }}
                    onKeyDown={e => { if (e.key === 'Enter') onApplyCode() }}
                    placeholder="보유 현황 URL 또는 코드 붙여넣기..."
                    className="flex-1 px-3 py-1.5 rounded text-xs transition-all"
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: `1px solid ${codeError ? 'rgba(200,80,80,0.5)' : 'var(--border)'}`,
                      color: '#ccc',
                      outline: 'none',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6875rem',
                      maxWidth: '25rem',
                    }}
                  />
                  <button
                    onClick={onApplyCode}
                    className="px-3 py-1.5 rounded text-xs transition-all duration-150"
                    style={{
                      background: 'rgba(200,144,10,0.12)',
                      color: 'var(--gold)',
                      border: '1px solid rgba(200,144,10,0.3)',
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.6875rem',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    적용
                  </button>
                  {codeError && (
                    <span className="text-xs" style={{ color: '#c85050', fontFamily: 'var(--font-mono)' }}>
                      잘못된 코드
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
