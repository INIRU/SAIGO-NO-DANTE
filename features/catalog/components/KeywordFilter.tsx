'use client'

// Design Ref: §5.4 — 키워드 자동완성 필터 (AND 조합)
import { useRef, useMemo } from 'react'
import Image from 'next/image'
import { X, Search } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { getLocalizedKeywordName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useKeywordAutocomplete } from '@/features/catalog/hooks/useKeywordAutocomplete'
import { filterStyles } from './FilterToggleGroup'

type Props = {
  selected: Set<string>
  onToggle: (keyword: string) => void
}

export default function KeywordFilter({ selected, onToggle }: Props) {
  const { getIconUrl, keywords } = useKeywordData()
  const t = useTranslations('browser')
  const lang = useLocale() as SupportedLang
  const label = (kw: string) => getLocalizedKeywordName(kw, keywords[kw], lang)
  // Autocomplete runs on the visible (localized) names; filter state keeps the Korean keys.
  const byLabel = useMemo(() => new Map(Object.keys(keywords).map(kw => [getLocalizedKeywordName(kw, keywords[kw], lang), kw])), [keywords, lang])
  const allLabels = useMemo(() => [...byLabel.keys()], [byLabel])
  const { query, setQuery, suggestions: labelSuggestions, reset } = useKeywordAutocomplete(allLabels)
  const suggestions = labelSuggestions.map(l => byLabel.get(l) ?? l)
  const inputRef = useRef<HTMLInputElement>(null)

  // 엔터 또는 클릭으로 선택
  const handleSelect = (kw: string) => {
    if (!selected.has(kw)) onToggle(kw)
    reset()
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 한글 IME 조합 중 Enter는 무시 (조합 완료 후에만 동작)
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault()
      handleSelect(suggestions[0])
    }
  }

  return (
    <div>
      <div className={filterStyles.label}>
        {t('keyword')}
      </div>

      {/* 선택된 키워드 칩 (상단) */}
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {[...selected].map(kw => {
            const iconUrl = getIconUrl(kw)
            return (
              <button
                key={kw}
                onClick={() => onToggle(kw)}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors hover:opacity-80"
                style={{
                  cursor: 'pointer',
                  background: 'rgba(200,144,10,0.15)',
                  border: '1px solid rgba(200,144,10,0.3)',
                  color: 'var(--gold)',
                  fontSize: '0.625rem',
                }}
                aria-label={t('keywordRemove', { kw: label(kw) })}
              >
                {iconUrl && (
                  <Image
                    src={iconUrl}
                    alt=""
                    width={12}
                    height={12}
                    style={{ width: '0.75rem', height: '0.75rem' }}
                    unoptimized
                  />
                )}
                {label(kw)}
                <X size={10} />
              </button>
            )
          })}
        </div>
      )}

      {/* 검색 입력 */}
      <div className="relative">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('keywordPlaceholder')}
          className={filterStyles.input}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-label={t('keywordSearchLabel')}
        />

        {/* 자동완성 드롭다운 */}
        {suggestions.length > 0 && (
          <div
            className="absolute top-full left-0 right-0 z-40 mt-1 rounded overflow-hidden max-h-48 overflow-y-auto"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {suggestions.map((kw, i) => {
              const iconUrl = getIconUrl(kw)
              const isSelected = selected.has(kw)
              return (
                <button
                  key={kw}
                  onClick={() => handleSelect(kw)}
                  className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs transition-colors hover:bg-white/5"
                  style={{
                    cursor: 'pointer',
                    color: i === 0 ? 'var(--gold)' : isSelected ? 'var(--gold-dim)' : '#ccc',
                    background: i === 0 ? 'rgba(200,144,10,0.1)' : undefined,
                    borderLeft: i === 0 ? '2px solid var(--gold)' : '2px solid transparent',
                  }}
                >
                  {iconUrl && (
                    <Image
                      src={iconUrl}
                      alt=""
                      width={16}
                      height={16}
                      style={{ width: '1rem', height: '1rem' }}
                      unoptimized
                    />
                  )}
                  <span>{label(kw)}</span>
                  {isSelected && <span style={{ color: 'var(--gold-dim)', marginLeft: 'auto', fontSize: '0.5625rem' }}>{t('added')}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
