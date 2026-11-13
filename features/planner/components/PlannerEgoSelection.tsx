'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import BaseModal from '@/components/ui/BaseModal'
import SuggestionRibbon from '@/components/ui/SuggestionRibbon'
import { SuggestionGroupSkeleton } from '@/components/ui/SuggestionSkeleton'
import SuggestionNote, { useArchetypeLabel } from './SuggestionNote'
import type { Archetype, Suggestion } from '@/features/community'
import CharacterPickerFilters from '@/components/ui/CharacterPickerFilters'
import EgoDisplayCard from '@/features/catalog/components/EgoDisplayCard'
import { localizeEgoName } from '@/features/decks/components/DeckIdentityCard'
import { GRADE_COLORS } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import { getEgoGradeBannerUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import type { SupportedLang } from '@/lib/i18n/types'
import { getCompactNameStyle } from '@/lib/planner/compact-name-style'
import { useLocale, useTranslations } from 'next-intl'
import { useSinnerName } from '@/features/planner/hooks/useSinnerName'
import { PLANNER_EGO_GRADE_ORDER, SUGGESTED_LIMIT, type PlannerDeckEgo, type PlannerDeckIdentity, type PlannerDeckSinner, type PlannerEgoBoardSlot } from '@/features/planner/lib/deck-selection'

export function PlannerEgoBoard({
  sinners,
  slots,
  onOpenEgoModal,
  getSinnerName,
}: {
  sinners: PlannerDeckSinner[]
  slots: Record<string, PlannerEgoBoardSlot | undefined>
  onOpenEgoModal: (sinnerId: string) => void
  getSinnerName?: (sinner: PlannerDeckSinner) => string
}) {
  const t = useTranslations('planner.deckTab.ego')
  const locale = useLocale() as SupportedLang
  const getLocalizedSinnerName = useSinnerName(locale, getSinnerName)
  const compactNameStyle = getCompactNameStyle(locale)
  const reduceMotion = useReducedMotion()

  return (
    <div className="planner-deck-ego-grid">
      {sinners.map((sinner, sinnerIndex) => {
        const slot = slots[sinner.id]
        const enabled = slot?.enabled ?? true
        const egosByGrade = slot?.egosByGrade ?? {}
        const sinnerName = getLocalizedSinnerName(sinner)
        return (
          <m.button
            key={sinner.id}
            type="button"
            onClick={() => { if (enabled) onOpenEgoModal(sinner.id) }}
            disabled={!enabled}
            className="planner-deck-ego-card text-left"
            aria-label={`${t('modalTitle')} ${sinnerName}`}
            style={{
              border: `1px solid ${enabled ? '#221a0f' : '#18120a'}`,
              opacity: enabled ? 1 : 0.5,
              cursor: enabled ? 'pointer' : 'default',
            }}
            animate={{ opacity: enabled ? 1 : 0.5 }}
            transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex min-w-0 items-center gap-1.5" style={{ padding: '0.375rem 0.5rem', borderBottom: '1px solid #1a1208' }}>
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.5 }} />
              <span className="min-w-0 truncate" title={sinnerName} style={{ ...compactNameStyle, color: enabled ? '#8a7a60' : '#3a2a10', fontSize: '0.875rem' }}>
                {sinnerName}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-0.5">
              {PLANNER_EGO_GRADE_ORDER.map(grade => {
                const ego = egosByGrade[grade]
                const gradeColor = GRADE_COLORS[grade] ?? '#555'
                const sinEn = ego?.sin_affinity ? (SIN_KR_TO_EN[ego.sin_affinity] ?? ego.sin_affinity) : null
                const egoColor = sinEn ? (SIN_COLORS[sinEn as keyof typeof SIN_COLORS] ?? gradeColor) : gradeColor
                return (
                  <div
                    key={grade}
                    className="planner-deck-ego-row flex items-center gap-1.5 rounded-sm"
                    style={{
                      background: ego ? `${egoColor}1a` : 'rgba(10,8,5,0.7)',
                      border: `1px solid ${ego ? `${egoColor}55` : '#18120a'}`,
                      padding: '0.25rem 0.3125rem',
                      minHeight: '1.5rem',
                    }}
                  >
                    <Image
                      src={getEgoGradeBannerUrl(grade)}
                      alt={grade}
                      width={48}
                      height={22}
                      unoptimized
                      style={{ width: '2.75rem', height: '1.25rem', objectFit: 'contain', opacity: ego ? 1 : 0.45, flexShrink: 0 }}
                    />
                    {ego ? (() => {
                      const egoName = localizeEgoName(ego, locale)
                      return (
                      <span className="planner-deck-ego-name" title={egoName} style={{ ...compactNameStyle, color: egoColor, fontSize: '0.875rem', lineHeight: 1.2, flex: 1, textAlign: 'left' }}>
                        {egoName}
                      </span>
                      )
                    })() : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1 }}>{enabled ? '—' : ''}</span>
                    )}
                  </div>
                )
              })}
            </div>
            {!enabled && (
              <div className="px-2 pb-1.5 pt-1 text-center">
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('noIdentity')}</span>
              </div>
            )}
          </m.button>
        )
      })}
      <style jsx>{`
        .planner-deck-ego-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: 1rem;
          row-gap: 1rem;
        }
        .planner-deck-ego-card {
          min-width: 0;
          overflow: hidden;
          border-radius: 0.25rem;
          background: linear-gradient(160deg, #1a1510 0%, #100d08 100%);
          transition: border-color 0.15s ease, filter 0.15s ease;
        }
        .planner-deck-ego-card:not(:disabled):hover,
        .planner-deck-ego-card:not(:disabled):focus-visible {
          border-color: rgba(200,144,10,0.42);
          filter: brightness(1.05);
          outline: none;
        }
        .planner-deck-ego-card:not(:disabled):focus-visible {
          box-shadow: 0 0 0 2px rgba(232,176,48,0.55);
        }
        .planner-deck-ego-row {
          min-width: 0;
          overflow: hidden;
        }
        .planner-deck-ego-name {
          display: block;
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          word-break: keep-all;
        }
        @media (min-width: 40rem) {
          .planner-deck-ego-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (min-width: 48rem) {
          .planner-deck-ego-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (min-width: 64rem) {
          .planner-deck-ego-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
        }
        @media (max-width: 39.9375rem) {
          .planner-deck-ego-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 0.5rem;
            row-gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}

export function PlannerEgoSelectModal({
  open,
  sinner,
  egos,
  selectedEgosByGrade,
  suggestions,
  archetype,
  suggestionsLoading = false,
  partnerIdentity,
  onClose,
  onSelect,
  onDeselect,
  getSinnerName,
}: {
  open: boolean
  sinner: PlannerDeckSinner | null
  egos: PlannerDeckEgo[]
  selectedEgosByGrade: Record<string, PlannerDeckEgo | undefined>
  /** Suggested E.G.O, most equipped first, listed under the "추천" ribbon; only while nothing is searched or filtered. They stay in their grade rows too. */
  suggestions?: readonly Suggestion[] | null
  archetype?: Archetype | null
  /** The suggestions are still being read: hold the group's place with its loading shape. */
  suggestionsLoading?: boolean
  partnerIdentity?: (id: string) => PlannerDeckIdentity | undefined
  onClose: () => void
  onSelect: (ego: PlannerDeckEgo) => void
  onDeselect: (grade: string, ego: PlannerDeckEgo) => void
  getSinnerName?: (sinner: PlannerDeckSinner) => string
}) {
  const t = useTranslations('planner.deckTab.ego')
  const locale = useLocale() as SupportedLang
  const getLocalizedSinnerName = useSinnerName(locale, getSinnerName)
  const compactNameStyle = getCompactNameStyle(locale)
  const [query, setQuery] = useState(''), [gradeFilter, setGradeFilter] = useState('')
  useEffect(() => { setQuery(''); setGradeFilter('') }, [open, sinner?.id])
  const filtered = egos.filter(ego => (!gradeFilter || ego.grade === gradeFilter) && [ego.name_kr, ego.name_en, ego.name_jp].some(name => name?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
  const egoById = new Map(filtered.map(ego => [ego.id, ego]))
  const suggestionOf = new Map((suggestions ?? []).map(suggestion => [suggestion.id, suggestion]))
  const holdSuggested = suggestionsLoading && !query.trim() && !gradeFilter
  const suggested = query.trim() || gradeFilter ? [] : (suggestions ?? []).flatMap(suggestion => egoById.get(suggestion.id) ?? []).slice(0, SUGGESTED_LIMIT)
  const archetypeLabel = useArchetypeLabel()(archetype)
  const renderEgo = (ego: PlannerDeckEgo, note = false) => (
    <div key={ego.id}>
      <EgoDisplayCard
        onClick={() => onSelect(ego)}
        ego={ego}
        name={localizeEgoName(ego, locale)}
        sinnerId={ego.sinner_id}
        lang={locale}
        selected={selectedEgosByGrade[ego.grade]?.id === ego.id}
        className="character-picker-ego-card"
      />
      {note && partnerIdentity && suggestionOf.has(ego.id) && <SuggestionNote suggestion={suggestionOf.get(ego.id)!} identityOf={partnerIdentity} />}
    </div>
  )
  const egosByGrade = new Map<string, PlannerDeckEgo[]>()
  for (const ego of filtered) egosByGrade.set(ego.grade, [...(egosByGrade.get(ego.grade) ?? []), ego])
  return (
    <BaseModal open={open && !!sinner} onClose={onClose} maxWidth="64rem" title={t('modalTitle')}>
      {sinner && (
        <div className="planner-deck-select-modal">
          <div className="planner-deck-select-modal__header">
            <div className="flex min-w-0 items-center gap-2">
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }} />
              <span className="min-w-0 truncate" style={{ ...compactNameStyle, color: 'var(--text-primary)', fontSize: '1rem' }}>
                {t('modalHeading', { sinner: getLocalizedSinnerName(sinner) })}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label={t('close')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden="true" />
            </button>
          </div>

          <div className="character-picker-layout">
          <CharacterPickerFilters query={query} onQuery={setQuery} grade={gradeFilter} onGrade={setGradeFilter} grades={PLANNER_EGO_GRADE_ORDER.map(value => ({ value, label: value }))} count={filtered.length} />
          <div className="planner-deck-select-modal__results flex flex-col gap-5 p-5">
            {holdSuggested && (
              <SuggestionGroupSkeleton shape="ego" count={SUGGESTED_LIMIT} titleClassName="mb-2" tilesClassName="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" archetype />
            )}
            {suggested.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2.5"><SuggestionRibbon />{archetypeLabel && <span className="font-[family-name:var(--font-heading)] text-[0.9375rem] text-[#cbb994]">{archetypeLabel}</span>}</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{suggested.map(ego => renderEgo(ego, true))}</div>
              </div>
            )}
            {!filtered.length && <p className="py-8 text-center" style={{ color: 'var(--text-secondary)' }}>{locale === 'ja' ? '結果がありません' : locale === 'en' ? 'No results' : '검색 결과가 없습니다'}</p>}
            {PLANNER_EGO_GRADE_ORDER.filter(grade => (egosByGrade.get(grade)?.length ?? 0) > 0).map(grade => {
              const gradeColor = GRADE_COLORS[grade] ?? '#555'
              const gradeEgos = egosByGrade.get(grade) ?? []
              const selectedForGrade = selectedEgosByGrade[grade]

              return (
                <div key={grade}>
                  <div className="mb-2 flex items-center gap-2">
                    <Image
                      src={getEgoGradeBannerUrl(grade)}
                      alt={grade}
                      width={48}
                      height={22}
                      unoptimized
                      style={{ width: '3rem', height: '1.375rem', objectFit: 'contain' }}
                    />
                    <div style={{ flex: 1, height: '1px', background: `${gradeColor}30` }} />
                    {selectedForGrade && grade !== 'ZAYIN' && (
                      <button
                        type="button"
                        onClick={() => onDeselect(grade, selectedForGrade)}
                        className="min-h-11 rounded px-3"
                        style={{ color: 'var(--error-text)', fontSize: '0.9375rem', cursor: 'pointer', border: '1px solid #3a1515', background: 'rgba(200,48,64,0.08)' }}
                      >
                        {t('remove')}
                      </button>
                    )}
                  </div>

                  {gradeEgos.length === 0 ? (
                    <div className="rounded p-2.5 text-center" style={{ background: 'rgba(10,8,5,0.5)', border: `1px solid ${gradeColor}15` }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('emptyGrade')}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {gradeEgos.map(ego => renderEgo(ego))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          </div>
          <style jsx>{`
            .planner-deck-select-modal {
              display: flex;
              flex-direction: column;
              height: 82dvh;
              max-height: 50rem;
              overflow: hidden;
              border: 1px solid #333;
              border-radius: 0.5rem;
              background: #1a1510;
              box-shadow: 0 1rem 3rem rgba(0,0,0,0.8);
            }
            .planner-deck-select-modal__results { overflow-y: auto; min-height: 0; overscroll-behavior: contain; }
            .planner-deck-select-modal__header {
              flex-shrink: 0;
              position: sticky;
              top: 0;
              z-index: 30;
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1px solid #222;
              background: #1a1510;
              padding: 1rem 1.25rem;
            }
          `}</style>
        </div>
      )}
    </BaseModal>
  )
}
