'use client'

import { Search } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useMemo, useState } from 'react'
import Dropdown, { type DropdownOption } from '@/components/ui/Dropdown'
import TierCardInteractive, { type TierIdentity } from './TierCardInteractive'
import type { RatingPeriod, TierCategory, Tier, TierRatingViewer } from './TierRatingModal'

const TIERS: Tier[] = ['S+', 'S', 'A', 'B', 'C', 'N/A']

const TIER_COLORS: Record<Tier, string> = {
  'S+': '#ff5050',
  'S': '#ffa030',
  'A': '#ffd040',
  'B': '#60c860',
  'C': '#60a0ff',
  'N/A': '#8a7855',
}

const TIER_LABEL_STYLES: Record<Tier, { color: string; subtext: string; textShadow?: string }> = {
  'S+': { color: '#fff', subtext: '#ffe5dc', textShadow: '0 1px 3px rgba(0,0,0,0.4)' },
  'S': { color: '#fff', subtext: '#fff1d6', textShadow: '0 1px 3px rgba(0,0,0,0.38)' },
  'A': { color: '#241900', subtext: '#3a2800' },
  'B': { color: '#071f08', subtext: '#123214' },
  'C': { color: '#fff', subtext: '#e5f0ff', textShadow: '0 1px 3px rgba(0,0,0,0.4)' },
  'N/A': { color: '#fff8e8', subtext: '#f0dfba', textShadow: '0 1px 3px rgba(0,0,0,0.35)' },
}

type SupportedLocale = 'ko' | 'en' | 'ja'

const TIER_LABELS: Record<SupportedLocale, Record<Tier, string>> = {
  ko: {
    'S+': '9.2+',
    'S': '8.4+',
    'A': '7.2+',
    'B': '6.0+',
    'C': '<6.0',
    'N/A': '측정 불가',
  },
  en: {
    'S+': '9.2+',
    'S': '8.4+',
    'A': '7.2+',
    'B': '6.0+',
    'C': '<6.0',
    'N/A': 'Unrated',
  },
  ja: {
    'S+': '9.2+',
    'S': '8.4+',
    'A': '7.2+',
    'B': '6.0+',
    'C': '<6.0',
    'N/A': '未測定',
  },
}

const NA_FILTER_PANEL_HEIGHT = '3.875rem'
const NA_CONTROL_HEIGHT = '2.25rem'

const FILTER_COPY = {
  ko: {
    searchPlaceholder: '인격 이름 검색',
    searchLabel: '측정 안됨 인격 검색',
    sinnerPrefix: '수감자',
    sinnerAll: '전체',
    rarityPrefix: '등급',
    rarityAll: '전체',
    raritySuffix: '성',
    acquisitionPrefix: '획득',
    acquisitionAll: '전체',
    unknown: '미분류',
    shown: '표시',
    noResult: '조건에 맞는 측정 안됨 인격이 없습니다.',
  },
  en: {
    searchPlaceholder: 'Search identities',
    searchLabel: 'Search unmeasured identities',
    sinnerPrefix: 'Sinner',
    sinnerAll: 'All',
    rarityPrefix: 'Rarity',
    rarityAll: 'All',
    raritySuffix: '★',
    acquisitionPrefix: 'Source',
    acquisitionAll: 'All',
    unknown: 'Unsorted',
    shown: 'shown',
    noResult: 'No unmeasured identities match these filters.',
  },
  ja: {
    searchPlaceholder: '人格名を検索',
    searchLabel: '未測定人格を検索',
    sinnerPrefix: '囚人',
    sinnerAll: 'すべて',
    rarityPrefix: 'レア',
    rarityAll: 'すべて',
    raritySuffix: '星',
    acquisitionPrefix: '入手',
    acquisitionAll: 'すべて',
    unknown: '未分類',
    shown: '表示',
    noResult: '条件に一致する未測定人格がありません。',
  },
} as const

const ACQUISITION_LABELS: Record<string, Record<SupportedLocale, string>> = {
  default: { ko: '기본', en: 'Default', ja: '基本' },
  standard: { ko: '상시', en: 'Standard', ja: '恒常' },
  event: { ko: '이벤트', en: 'Event', ja: 'イベント' },
  walpurgis: { ko: '발푸르기스', en: 'Walpurgis', ja: 'ヴァルプルギス' },
  attendance: { ko: '출석', en: 'Login', ja: 'ログイン' },
}

function normalizeLocale(locale: string): SupportedLocale {
  return locale === 'en' || locale === 'ja' ? locale : 'ko'
}

function getLocalizedSinnerName(identity: TierIdentity, locale: SupportedLocale) {
  const sinner = identity.sinner
  if (!sinner) return identity.sinner_id
  if (locale === 'en') return sinner.name_en ?? sinner.name ?? sinner.name_kr ?? sinner.name_jp ?? identity.sinner_id
  if (locale === 'ja') return sinner.name_jp ?? sinner.name ?? sinner.name_kr ?? sinner.name_en ?? identity.sinner_id
  return sinner.name_kr ?? sinner.name ?? sinner.name_en ?? sinner.name_jp ?? identity.sinner_id
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('ko')
}

function getAcquisitionFilterValue(identity: TierIdentity) {
  return identity.acquisition_info?.type ?? 'unknown'
}

const dropdownButtonStyle = {
  width: '100%',
  minHeight: NA_CONTROL_HEIGHT,
  height: NA_CONTROL_HEIGHT,
  justifyContent: 'space-between',
  background: '#0d0b08',
  borderColor: 'var(--border)',
  borderRadius: '0.375rem',
  color: '#d8c99b',
  padding: '0 0.625rem',
  fontSize: '0.8125rem',
} as const

function matchesNaFilters(
  identity: TierIdentity,
  filters: {
    search: string
    sinner: string
    rarity: string
    acquisition: string
  },
) {
  if (filters.search) {
    const haystack = [
      identity.name,
      identity.name_kr,
      identity.name_en,
      identity.name_jp,
    ].filter(Boolean).join(' ').toLocaleLowerCase('ko')
    if (!haystack.includes(filters.search)) return false
  }
  if (filters.sinner !== 'all' && identity.sinner_id !== filters.sinner) return false
  if (filters.rarity !== 'all' && String(identity.rarity) !== filters.rarity) return false
  if (filters.acquisition !== 'all' && getAcquisitionFilterValue(identity) !== filters.acquisition) return false
  return true
}

function preserveScrollAfterFilterChange(update: () => void) {
  if (typeof window === 'undefined') {
    update()
    return
  }

  const scrollX = window.scrollX
  const scrollY = window.scrollY
  update()
  requestAnimationFrame(() => {
    window.scrollTo(scrollX, scrollY)
    requestAnimationFrame(() => window.scrollTo(scrollX, scrollY))
  })
}

export default function TierGrid({
  tiers,
  category,
  period,
  viewer,
}: {
  tiers: Record<Tier, TierIdentity[]>
  category: TierCategory
  period: RatingPeriod
  viewer: TierRatingViewer
}) {
  const locale = normalizeLocale(useLocale())
  const copy = FILTER_COPY[locale]
  const [naSearch, setNaSearch] = useState('')
  const [naSinner, setNaSinner] = useState('all')
  const [naRarity, setNaRarity] = useState('all')
  const [naAcquisition, setNaAcquisition] = useState('all')
  const renderedIdentityIds = new Set<string>()
  const normalizedSearch = normalizeSearch(naSearch)

  const naIdentities = tiers['N/A']
  const sinnerOptions = useMemo<DropdownOption[]>(() => {
    const options = new Map<string, { label: string; order: number }>()
    for (const identity of naIdentities) {
      if (options.has(identity.sinner_id)) continue
      options.set(identity.sinner_id, {
        label: getLocalizedSinnerName(identity, locale),
        order: identity.sinner?.order_num ?? 999,
      })
    }
    return [
      { value: 'all', label: copy.sinnerAll },
      ...Array.from(options.entries())
        .sort(([, a], [, b]) => a.order - b.order || a.label.localeCompare(b.label, locale))
        .map(([value, item]) => ({ value, label: item.label })),
    ]
  }, [copy.sinnerAll, locale, naIdentities])
  const rarityOptions = useMemo<DropdownOption[]>(() => {
    return [
      { value: 'all', label: copy.rarityAll },
      ...Array.from(new Set(naIdentities.map(identity => String(identity.rarity))))
      .sort((a, b) => Number(b) - Number(a))
      .map(value => ({ value, label: `${value}${copy.raritySuffix}` })),
    ]
  }, [copy.rarityAll, copy.raritySuffix, naIdentities])
  const acquisitionOptions = useMemo<DropdownOption[]>(() => {
    return [
      { value: 'all', label: copy.acquisitionAll },
      ...Array.from(new Set(naIdentities.map(getAcquisitionFilterValue)))
      .sort((a, b) => (ACQUISITION_LABELS[a]?.[locale] ?? a).localeCompare(ACQUISITION_LABELS[b]?.[locale] ?? b, locale))
      .map(value => ({ value, label: ACQUISITION_LABELS[value]?.[locale] ?? copy.unknown })),
    ]
  }, [copy.acquisitionAll, copy.unknown, locale, naIdentities])

  const filtersActive = Boolean(normalizedSearch || naSinner !== 'all' || naRarity !== 'all' || naAcquisition !== 'all')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
      <style>{`
        @media (max-width: 47.999rem) {
          .tier-row {
            grid-template-columns: minmax(0, 1fr) !important;
            row-gap: 0.5rem !important;
          }
          .tier-label-rail {
            position: relative !important;
            top: auto !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 0.375rem !important;
            width: auto !important;
            max-width: 100% !important;
            margin-bottom: 0.125rem !important;
          }
          .tier-label-block {
            width: auto !important;
            min-height: 2rem !important;
            flex-direction: row !important;
            justify-content: flex-start !important;
            gap: 0.375rem !important;
            padding: 0 0.625rem !important;
            font-size: 0.9375rem !important;
          }
          .tier-label-subtext {
            margin-top: 0 !important;
            font-size: 0.6875rem !important;
            white-space: nowrap !important;
          }
          .tier-label-guide {
            display: block !important;
            flex: 0 1 8rem !important;
            width: 8rem !important;
            max-width: min(8rem, 38vw) !important;
            min-width: 2.5rem !important;
            height: 0.0625rem !important;
          }
          .tier-connector-line {
            display: none !important;
          }
          .tier-row-content {
            min-width: 0 !important;
          }
          [data-tier-na-filters] {
            margin: 0 0 0.75rem !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 0.5rem !important;
            min-height: 0 !important;
            padding: 0.5rem !important;
            border-color: rgba(200,144,10,0.12) !important;
            background: rgba(20,16,12,0.72) !important;
          }
          .tier-na-search {
            grid-column: 1 / -1 !important;
            min-height: 2rem !important;
            height: 2rem !important;
          }
          .tier-na-filter-acquisition {
            grid-column: 1 / -1 !important;
          }
          [data-tier-na-filters] button {
            min-height: 2rem !important;
            height: 2rem !important;
            padding-left: 0.5rem !important;
            padding-right: 0.5rem !important;
            font-size: 0.6875rem !important;
          }
          [data-tier-na-filters] [role="menu"] {
            max-width: calc(100vw - 2rem) !important;
          }
          .tier-card-grid {
            grid-template-columns: minmax(0, 6.25rem) minmax(0, 6.25rem) minmax(0, 6.25rem) !important;
            justify-content: center !important;
            gap: 1rem 0.625rem !important;
            padding: 0.25rem 0 0.875rem !important;
          }
        }
        @media (max-width: 22.5rem) {
          [data-tier-na-filters] {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .tier-na-filter-acquisition {
            grid-column: auto !important;
          }
        }
      `}</style>
      {TIERS.map(tier => {
        const sourceIdentities = tiers[tier]
        const tierIdentities = sourceIdentities.filter(identity => {
          if (renderedIdentityIds.has(identity.id)) return false
          renderedIdentityIds.add(identity.id)
          return true
        })
        const visibleIdentities = tier === 'N/A'
          ? tierIdentities.filter(identity => matchesNaFilters(identity, {
            search: normalizedSearch,
            sinner: naSinner,
            rarity: naRarity,
            acquisition: naAcquisition,
          }))
          : tierIdentities
        const showEmptyNaResult = tier === 'N/A' && tierIdentities.length > 0 && visibleIdentities.length === 0
        const labelStyle = TIER_LABEL_STYLES[tier]

        if (tierIdentities.length === 0 && !showEmptyNaResult) return null
        return (
          <section
            key={tier}
            data-tier-row={tier}
            className="tier-row"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(3.75rem, 4.5rem) minmax(0, 1fr)',
              columnGap: '1rem',
              alignItems: 'start',
            }}
          >
            <div
              className="tier-label-rail"
              style={{
                position: tier === 'N/A' ? 'relative' : 'sticky',
                top: tier === 'N/A' ? undefined : '5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: '0.5rem',
                paddingTop: tier === 'N/A' ? '0' : '0',
              }}
            >
              <div
                className="tier-label-block"
                style={{
                  width: '100%',
                  minHeight: tier === 'N/A' ? NA_FILTER_PANEL_HEIGHT : '3.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: TIER_COLORS[tier],
                  borderRadius: '0.375rem',
                  boxShadow: tier === 'N/A' ? 'inset 0 0 0 1px rgba(255,255,255,0.08)' : undefined,
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: labelStyle.color,
                  textShadow: labelStyle.textShadow ?? 'none',
                }}
              >
                <span>{tier}</span>
                <span className="tier-label-subtext" style={{ color: labelStyle.subtext, fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.25, marginTop: '0.125rem' }}>
                  {TIER_LABELS[locale][tier]}
                </span>
              </div>
              <div
                className="tier-label-guide"
                aria-hidden="true"
                style={{
                  display: 'none',
                  height: '0.0625rem',
                  width: '8rem',
                  maxWidth: '38vw',
                  background: `linear-gradient(90deg, ${TIER_COLORS[tier]}99, ${TIER_COLORS[tier]}33 45%, transparent 100%)`,
                }}
              />
              <div
                className="tier-connector-line"
                style={{
                  width: '0.0625rem',
                  minHeight: '4rem',
                  alignSelf: 'center',
                  background: `linear-gradient(to bottom, ${TIER_COLORS[tier]}66, transparent)`,
                }}
              />
            </div>

            <div className="tier-row-content">
              {tier === 'N/A' && (
                <div
                  data-tier-na-filters
                  className="grid gap-2 md:grid-cols-[minmax(12rem,1fr)_8rem_7rem_8.5rem]"
                  style={{
                    margin: '0 0.25rem 0.875rem',
                    minHeight: NA_FILTER_PANEL_HEIGHT,
                    padding: '0.625rem',
                    background: '#14100c',
                    border: '1px solid rgba(200,144,10,0.18)',
                    borderRadius: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  <label
                    className="tier-na-search flex items-center gap-2"
                    style={{
                      minHeight: NA_CONTROL_HEIGHT,
                      height: NA_CONTROL_HEIGHT,
                      background: '#0d0b08',
                      border: '1px solid var(--border)',
                      borderRadius: '0.375rem',
                      padding: '0 0.625rem',
                    }}
                  >
                    <Search size={14} style={{ color: '#8a7855', flexShrink: 0 }} />
                    <input
                      value={naSearch}
                      onChange={event => setNaSearch(event.target.value)}
                      placeholder={copy.searchPlaceholder}
                      aria-label={copy.searchLabel}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 0,
                        outline: 'none',
                        color: '#d8c99b',
                        fontSize: '0.8125rem',
                      }}
                    />
                  </label>
                  <Dropdown
                    value={naSinner}
                    options={sinnerOptions}
                    onChange={value => preserveScrollAfterFilterChange(() => setNaSinner(value))}
                    prefix={copy.sinnerPrefix}
                    defaultValue="all"
                    minWidth={128}
                    className="w-full min-w-0"
                    buttonStyle={dropdownButtonStyle}
                  />
                  <Dropdown
                    value={naRarity}
                    options={rarityOptions}
                    onChange={value => preserveScrollAfterFilterChange(() => setNaRarity(value))}
                    prefix={copy.rarityPrefix}
                    defaultValue="all"
                    minWidth={112}
                    className="w-full min-w-0"
                    buttonStyle={dropdownButtonStyle}
                  />
                  <Dropdown
                    value={naAcquisition}
                    options={acquisitionOptions}
                    onChange={value => preserveScrollAfterFilterChange(() => setNaAcquisition(value))}
                    prefix={copy.acquisitionPrefix}
                    defaultValue="all"
                    minWidth={128}
                    className="tier-na-filter-acquisition w-full min-w-0"
                    buttonStyle={dropdownButtonStyle}
                  />
                  {filtersActive && (
                    <div className="md:col-span-4" style={{ color: '#8a7855', fontSize: '0.6875rem' }}>
                      {visibleIdentities.length} / {tierIdentities.length} {copy.shown}
                    </div>
                  )}
                </div>
              )}

              <div
                className="tier-card-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 8.75rem), 9.75rem))',
                  justifyContent: 'center',
                  alignItems: 'start',
                  gap: '1.375rem 1.125rem',
                  padding: '0.25rem 0.25rem 0.875rem',
                  position: 'relative',
                  zIndex: 0,
                  overflow: 'visible',
                }}
              >
                {visibleIdentities.map((identity, index) => (
                  <TierCardInteractive
                    key={`${tier}-${identity.id}-${index}`}
                    identity={identity}
                    category={category}
                    period={period}
                    viewer={viewer}
                  />
                ))}
              </div>
              {showEmptyNaResult && (
                <div
                  style={{
                    margin: '0.25rem',
                    padding: '1rem',
                    background: '#14100c',
                    border: '1px dashed rgba(200,144,10,0.22)',
                    borderRadius: '0.5rem',
                    color: '#8a7855',
                    fontSize: '0.8125rem',
                  }}
                  >
                  {copy.noResult}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
