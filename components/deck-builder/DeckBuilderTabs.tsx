'use client'

import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import Image from 'next/image'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  getSinnerLogoUrl,
  getSinnerProfileUrl,
  getSkillIconUrl,
  STORAGE_BASE,
  SIN_COLORS,
  SinType,
  GRADE_COLORS,
} from '@/lib/data/sinners'
import IdentityCard from '@/components/sinners/IdentityCard'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import BaseModal from '@/components/ui/BaseModal'
import { localizeEgoName, localizeIdentityName } from '@/components/deck-detail/DeckIdentityCard'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useLocale, useTranslations } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import { DECK_MAIN_KEYWORDS } from '@/lib/decks/keyword-rules'
import SkillExchangePanel from '@/components/planner/SkillExchangePanel'
import { Search, X } from 'lucide-react'

const COMPACT_KOTRA_STYLE: CSSProperties = {
  fontFamily: 'var(--font-kotra-bold), var(--font-heading), serif',
  fontWeight: 400,
  WebkitTextStroke: '0 transparent',
}

function getCompactNameStyle(locale: SupportedLang): CSSProperties {
  if (locale === 'ko') return COMPACT_KOTRA_STYLE
  return {
    fontFamily: 'var(--font-sans)',
    fontWeight: 700,
    WebkitTextStroke: '0 transparent',
  }
}

function isPlaceholderName(value: string | null | undefined): boolean {
  const normalized = value?.trim()
  return !normalized || normalized === '-' || normalized === '—'
}

function getDeckBuilderSinnerName(sinner: Sinner, locale: SupportedLang): string {
  const localized = getLocalizedName(sinner, locale)
  if (!isPlaceholderName(localized)) return localized
  if (!isPlaceholderName(sinner.name_en)) return sinner.name_en!.trim()
  if (!isPlaceholderName(sinner.name)) return sinner.name.trim()
  return sinner.name_kr
}

/* ── 수감자 빈 카드 (공통) ────────────────────────────── */
function SinnerGhostCard({ sinner, children }: { sinner: Sinner; children?: React.ReactNode }) {
  const profileUrl = getSinnerProfileUrl(sinner.id)
  const locale = useLocale() as SupportedLang
  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: '2/3',
        background: 'rgba(18,14,9,0.88)',
        border: '0.09375rem dashed #2a2015',
        borderRadius: '0.25rem',
        overflow: 'hidden',
      }}
    >
      {profileUrl && (
        <Image src={profileUrl} alt={sinner.name} fill className="object-cover object-top" style={{ opacity: 0.18 }} sizes="120px" />
      )}
      {children}
      <div className="absolute bottom-0 left-0 right-0 text-center pb-1.5 z-10" style={{ background: 'rgba(13,11,8,0.9)', borderTop: '1px solid rgba(200,144,10,0.12)' }}>
        <p style={{ ...getCompactNameStyle(locale), color: 'rgba(232,220,200,0.72)', fontSize: '0.875rem' }}>{getDeckBuilderSinnerName(sinner, locale)}</p>
      </div>
    </div>
  )
}

const GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH']
const MANUAL_ATTACK_MAIN_KEYWORDS = new Set<string>(['참격', '관통', '타격'])
const IDENTITY_RARITY_FILTERS = ['all', '3', '2', '1'] as const
/* ── 탭 1: 인격 편성 (플래너 패턴: 40% 변경 / 60% 편성 토글) ── */
export function IdentityTab({
  sinners, identities, deckSlots, gacksungSlots, onGacksungToggle,
  formationOrder, onFormationToggle, onIdentitySelect, onIdentityDeselect,
  mainKeywordCounts, selectedMainKeywords, maxMainKeywords, mainKeywordLabel, onMainKeywordToggle,
}: {
  sinners: Sinner[]
  identities: Identity[]
  deckSlots: Record<string, Identity | undefined>
  gacksungSlots: Record<string, boolean>
  mainKeywordCounts: Record<string, number>
  selectedMainKeywords: string[]
  maxMainKeywords: number
  mainKeywordLabel: string
  onGacksungToggle: (sinnerId: string) => void
  formationOrder: string[]
  onFormationToggle: (sinnerId: string) => void
  onMainKeywordToggle: (keyword: string) => void
  onIdentitySelect: (identity: Identity) => void
  onIdentityDeselect: (sinnerId: string) => void
}) {
  const [modalSinnerId, setModalSinnerId] = useState<string | null>(null)
  const [identitySearch, setIdentitySearch] = useState('')
  const [identityRarityFilter, setIdentityRarityFilter] = useState<(typeof IDENTITY_RARITY_FILTERS)[number]>('all')
  const locale = useLocale() as SupportedLang
  const t = useTranslations('planner.deckTab.identity')
  const { getIconUrl, keywords: keywordInfo } = useKeywordData()
  const modalSinner = modalSinnerId ? sinners.find(s => s.id === modalSinnerId) : null
  const modalIdentities = modalSinnerId
    ? identities
        .filter(i => i.sinner_id === modalSinnerId)
        .filter(i => identityRarityFilter === 'all' || String(i.rarity) === identityRarityFilter)
        .filter(i => {
          const query = identitySearch.trim().toLowerCase()
          if (!query) return true
          return [localizeIdentityName(i, locale), i.name_kr, i.name_en, i.name_jp]
            .filter(Boolean)
            .some(name => name!.toLowerCase().includes(query))
        })
        .sort((a, b) => b.rarity - a.rarity)
    : []
  const openIdentityModal = (sinnerId: string) => setModalSinnerId(sinnerId)
  const handleSlotKeyDown = (event: KeyboardEvent<HTMLDivElement>, sinnerId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openIdentityModal(sinnerId)
  }

  return (
    <>
    <div className="deck-builder-identity-grid grid grid-cols-4 md:grid-cols-4 lg:grid-cols-6 gap-x-1.5 gap-y-2 sm:gap-x-4 sm:gap-y-6">
      {sinners.map(sinner => {
        const identity = deckSlots[sinner.id]
        const isGacksung = gacksungSlots[sinner.id] ?? false
        const formIdx = formationOrder.indexOf(sinner.id)
        const isFormed = formIdx >= 0
        const isBackup = formIdx >= 7
        const formationColor = isBackup ? '#5ab0d0' : '#e8b030'
        const formationBorder = isBackup ? 'rgba(90,176,208,0.5)' : 'rgba(200,144,10,0.5)'
        const sinnerName = getDeckBuilderSinnerName(sinner, locale)

        return (
          <div key={sinner.id} className="relative" style={{ overflow: 'visible' }}>
            <div
              className={`deck-builder-identity-slot ${identity ? 'deck-builder-identity-slot--filled' : 'deck-builder-identity-slot--empty'} group cursor-pointer relative w-full`}
              role="button"
              tabIndex={0}
              aria-label={`${t(identity ? 'change' : 'form')} ${sinnerName}`}
              onClick={() => {
                if (!identity) openIdentityModal(sinner.id)
              }}
              onKeyDown={event => handleSlotKeyDown(event, sinner.id)}
              style={{
                aspectRatio: '4/5',
                background: identity ? '#120e08' : 'rgba(18,14,9,0.84)',
                border: `0.0625rem ${identity ? 'solid' : 'dashed'} ${identity ? (isFormed ? formationBorder : '#2a2015') : 'rgba(200,144,10,0.2)'}`,
                borderRadius: '0.25rem',
                overflow: 'hidden',
                boxShadow: 'none',
                transition: 'all 0.2s',
              }}
            >
              {identity ? (
                <>
                  <Image
                    src={`${STORAGE_BASE}/sinners/${identity.sinner_id}/identities/${identity.folder_name}/${identity.game_id}_${isGacksung ? 'gacksung' : 'normal'}_info.webp`}
                    alt={localizeIdentityName(identity, locale)}
                    fill
                    className="object-cover object-top"
                    sizes="180px"
                  />
                  {/* 이름 오버레이 */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 text-center" style={{ background: 'rgba(13,11,8,0.88)', borderTop: '1px solid rgba(200,144,10,0.14)', padding: '0.375rem 0.25rem' }}>
                    <p className="text-[0.75rem] sm:text-[0.8125rem]" style={{ ...COMPACT_KOTRA_STYLE, color: '#e8dcc8', lineHeight: 1.2 }}>{localizeIdentityName(identity, locale)}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={32} height={32} className="deck-builder-empty-slot-logo h-6 w-6 sm:h-7 sm:w-7" style={{ opacity: 0.72 }} />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 text-center z-10" style={{ background: 'rgba(13,11,8,0.78)', borderTop: '1px solid rgba(200,144,10,0.12)', padding: '0.3125rem 0.25rem' }}>
                    <p className="deck-builder-empty-slot-name text-[0.8125rem]" style={{ ...getCompactNameStyle(locale), color: 'rgba(232,220,200,0.78)', lineHeight: 1.12 }}>{sinnerName}</p>
                  </div>
                </>
              )}

              {/* 편성 순서 오버레이 */}
              {identity && isFormed && (
                <div className="absolute inset-0 flex items-center justify-center z-[15] pointer-events-none" style={{ background: 'rgba(13,11,8,0.5)' }}>
                  <span className="text-[0.875rem] sm:text-[1.125rem]" style={{ fontWeight: 700, fontFamily: 'var(--font-body)', color: formationColor }}>{isBackup ? t('bench') : t('formed')}</span>
                  <span className="text-[1.25rem] sm:text-[1.75rem]" style={{ fontWeight: 800, fontFamily: 'var(--font-body)', lineHeight: 1, color: formationColor, marginLeft: '0.25rem' }}>{formIdx + 1}</span>
                </div>
              )}

              {/* 호버 오버레이 — 40% 변경 / 60% 편성 토글 */}
              <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col" style={{ background: 'rgba(13,11,8,0.82)' }}>
                {identity ? (
                  <>
                    <div
                      onClick={event => { event.stopPropagation(); openIdentityModal(sinner.id) }}
                      className="flex items-center justify-center transition-colors"
                      style={{ height: '40%', background: 'rgba(13,11,8,0.6)', borderBottom: '1px solid rgba(200,144,10,0.2)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.6)' }}
                    >
                      <span className="text-[0.75rem] sm:text-[0.875rem]" style={{ color: '#e8b030', fontWeight: 700, fontFamily: 'var(--font-body)' }}>{t('change')}</span>
                    </div>
                    <div
                      onClick={event => { event.stopPropagation(); onFormationToggle(sinner.id) }}
                      className="flex items-center justify-center transition-colors"
                      style={{ height: '60%', background: 'rgba(13,11,8,0.5)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = isFormed ? 'rgba(90,176,208,0.12)' : 'rgba(200,144,10,0.12)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.5)' }}
                    >
                      <span className="text-[0.75rem]" style={{ color: isFormed ? '#5ab0d0' : '#e8b030', fontWeight: 600 }}>
                        {isFormed ? t('removeFormation') : t('addFormation')}
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    onClick={event => { event.stopPropagation(); openIdentityModal(sinner.id) }}
                    className="flex items-center justify-center transition-colors"
                    style={{ height: '100%', background: 'rgba(13,11,8,0.5)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,144,10,0.12)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(13,11,8,0.5)' }}
                  >
                    <span className="text-[0.8125rem] sm:text-[1rem]" style={{ color: '#e8b030', fontWeight: 700, fontFamily: 'var(--font-body)' }}>{t('form')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 각성 토글 */}
            {identity && (
              <button
                onClick={e => { e.stopPropagation(); onGacksungToggle(sinner.id) }}
                title={isGacksung ? t('toNormalArt') : t('toAwakenedArt')}
                style={{
                  position: 'absolute', top: '-0.4375rem', right: '-0.4375rem', zIndex: 20,
                  width: '1.375rem', height: '1.375rem', borderRadius: '50%',
                  background: isGacksung ? 'rgba(200,144,10,0.92)' : 'rgba(18,14,9,0.92)',
                  border: `0.09375rem solid ${isGacksung ? '#c8900a' : '#2a2015'}`,
                  color: isGacksung ? '#0d0b08' : '#5a4830',
                  fontSize: '0.8125rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'none',
                  transition: 'all 0.2s', lineHeight: 1,
                }}
              >
                &#x21BA;
              </button>
            )}
          </div>
        )
      })}
    </div>

    <div className="deck-builder-pinned-keywords" aria-label={mainKeywordLabel}>
      {DECK_MAIN_KEYWORDS.map(keyword => {
        const iconUrl = getIconUrl(keyword)
        const count = mainKeywordCounts[keyword] ?? 0
        const selected = selectedMainKeywords.includes(keyword)
        const isManualAttackKeyword = MANUAL_ATTACK_MAIN_KEYWORDS.has(keyword)
        const disabled = (!isManualAttackKeyword && count <= 0) || (!selected && selectedMainKeywords.length >= maxMainKeywords)
        const keywordLabel = localizeDeckKeyword(keyword, keywordInfo[keyword], locale)
        const accessibleName = isManualAttackKeyword ? keywordLabel : `${keywordLabel} ${count}`
        return (
          <button
            key={keyword}
            type="button"
            className="deck-builder-pinned-keyword"
            data-selected={selected}
            disabled={disabled}
            onClick={() => onMainKeywordToggle(keyword)}
            aria-pressed={selected}
            aria-label={accessibleName}
            title={accessibleName}
          >
            {iconUrl && (
              <Image
                src={iconUrl}
                alt=""
                width={16}
                height={16}
                className="deck-builder-pinned-keyword__icon"
              />
            )}
            <span>{keywordLabel}</span>
            {!isManualAttackKeyword && (
              <span className="deck-builder-pinned-keyword__count">{count}</span>
            )}
          </button>
        )
      })}
    </div>

    <style jsx global>{`
      .deck-builder-pinned-keywords {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.375rem;
        margin-top: 0.75rem;
      }
      .deck-builder-pinned-keyword {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        min-height: 2.75rem;
        padding: 0.375rem 0.625rem;
        border: 1px solid rgba(200, 144, 10, 0.16);
        border-radius: 0.375rem;
        background: rgba(18, 14, 9, 0.74);
        color: rgba(232, 220, 200, 0.84);
        font-size: 0.9375rem;
        line-height: 1;
        font-family: var(--font-sans);
        cursor: pointer;
        transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
      }
      .deck-builder-pinned-keyword:hover:not(:disabled),
      .deck-builder-pinned-keyword:focus-visible {
        border-color: rgba(232, 176, 48, 0.42);
        background: rgba(200, 144, 10, 0.12);
        color: #f0d48a;
      }
      .deck-builder-pinned-keyword:focus-visible {
        outline: 1px solid rgba(232, 176, 48, 0.6);
        outline-offset: 2px;
      }
      .deck-builder-pinned-keyword[data-selected="true"] {
        border-color: rgba(232, 176, 48, 0.58);
        background: rgba(200, 144, 10, 0.18);
        color: #f0d48a;
        box-shadow: inset 0 0 0 1px rgba(232, 176, 48, 0.12);
      }
      .deck-builder-pinned-keyword:disabled {
        cursor: not-allowed;
        opacity: 0.42;
      }
      .deck-builder-pinned-keyword__count {
        display: inline-flex;
        min-width: 1.25rem;
        height: 1.25rem;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(200, 144, 10, 0.18);
        border-radius: 999px;
        background: rgba(13, 11, 8, 0.52);
        color: inherit;
        font-family: var(--font-mono);
        font-size: 0.875rem;
        line-height: 1;
      }
      .deck-builder-pinned-keyword__icon {
        width: 1rem;
        height: 1rem;
        object-fit: contain;
      }
      .deck-builder-modal-card-name {
        display: -webkit-box;
        min-height: 2.25em;
        overflow: hidden;
        overflow-wrap: anywhere;
        word-break: keep-all;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }
      @media (max-width: 639px) {
        .deck-builder-identity-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem 0.375rem;
        }
        .deck-builder-identity-slot {
          aspect-ratio: 1 / 1.05 !important;
          border-width: 1px !important;
        }
        .deck-builder-empty-slot-logo {
          width: 1.375rem !important;
          height: 1.375rem !important;
        }
        .deck-builder-empty-slot-name {
          font-size: 0.8125rem !important;
          line-height: 1.15;
        }
        .deck-builder-pinned-keywords {
          margin-top: 0.625rem;
          gap: 0.3125rem;
        }
        .deck-builder-pinned-keyword {
          min-height: 2.75rem;
          padding: 0.3125rem 0.5rem;
          font-size: 0.9375rem;
        }
      }
      @media (max-width: 359px) {
        .deck-builder-identity-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    `}</style>

    {/* ── 인격 선택 모달 (플래너 패턴) ── */}
    <BaseModal open={!!(modalSinnerId && modalSinner)} onClose={() => setModalSinnerId(null)} maxWidth="48rem" padding="1rem" title={t('modalTitle')}>
      {modalSinnerId && modalSinner && (
        <div
          data-deck-builder-modal="identity"
          className="flex flex-col"
          style={{ background: 'var(--bg-card)', border: '1px solid #333', borderRadius: 'var(--radius-lg)', maxHeight: '85vh', overflow: 'hidden', boxShadow: 'none' }}
        >
          {/* 모달 헤더 */}
          <div className="flex flex-shrink-0 items-center justify-between" style={{ padding: '0.875rem 1rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
            <div className="flex min-w-0 items-center gap-2">
              <Image src={getSinnerLogoUrl(modalSinner.id)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }} />
              <span className="min-w-0 truncate" style={{ ...getCompactNameStyle(locale), color: 'var(--text-primary)', fontSize: '1rem' }}>{t('modalHeading', { sinner: getDeckBuilderSinnerName(modalSinner, locale) })}</span>
            </div>
            <button onClick={() => setModalSinnerId(null)} aria-label={t('close')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-shrink-0 flex-col gap-2.5" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="relative">
              <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input
                type="search"
                value={identitySearch}
                onChange={event => setIdentitySearch(event.target.value)}
                placeholder={t('searchPlaceholder')}
                className="min-h-11 w-full rounded pl-9 pr-10 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: '0.9375rem' }}
              />
              {identitySearch && (
                <button
                  type="button"
                  onClick={() => setIdentitySearch('')}
                  aria-label={t('clearSearch')}
                  className="absolute right-0 top-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {IDENTITY_RARITY_FILTERS.map(filter => {
                const active = identityRarityFilter === filter
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setIdentityRarityFilter(filter)}
                    className="min-h-11 rounded px-3"
                    aria-pressed={active}
                    style={{
                      border: `1px solid ${active ? 'rgba(232,176,48,0.45)' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? 'rgba(200,144,10,0.12)' : 'rgba(13,11,8,0.38)',
                      color: active ? 'var(--gold)' : 'var(--text-muted)',
                      fontSize: '0.9375rem',
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {filter === 'all' ? t('rarityAll') : t('rarity', { rarity: filter })}
                  </button>
                )
              })}
            </div>

            {deckSlots[modalSinnerId] && (
              <button
                onClick={() => { onIdentityDeselect(modalSinnerId); setModalSinnerId(null) }}
                className="min-h-11 w-full rounded transition-colors"
                style={{ color: 'var(--error)', fontSize: '0.9375rem', border: '1px solid rgba(200,48,48,0.3)', padding: '0.5rem 0.75rem', cursor: 'pointer', background: 'rgba(200,48,48,0.05)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                × {t('clear')}
              </button>
            )}
          </div>

          {/* 인격 그리드 */}
          <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4" style={{ minHeight: 0, padding: '1rem' }}>
            {modalIdentities.map((ident, index) => {
              const isSelected = deckSlots[modalSinnerId]?.id === ident.id
              return (
                <button
                  key={ident.id}
                  onClick={() => { onIdentitySelect(ident); setModalSinnerId(null) }}
                  className="text-left transition-colors"
                  data-deck-builder-identity-option={ident.id}
                  style={{
                    background: isSelected ? 'rgba(200,144,10,0.12)' : 'rgba(18,14,9,0.88)',
                    border: `0.09375rem solid ${isSelected ? 'var(--gold)' : 'rgba(42,32,21,0.5)'}`,
                    borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer',
                    boxShadow: 'none',
                  }}
                >
                  <div className="relative isolate w-full" style={{ aspectRatio: '2/3', overflow: 'hidden' }}>
                    {ident.game_id && ident.folder_name && (
                      <Image
                        src={`${STORAGE_BASE}/sinners/${ident.sinner_id}/identities/${ident.folder_name}/${ident.game_id}_normal_info.webp`}
                        alt={localizeIdentityName(ident, locale)}
                        fill
                        className="object-cover object-top"
                        loading={index < 4 ? 'eager' : 'lazy'}
                        sizes="200px"
                      />
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 z-[2]" style={{ background: 'rgba(200,144,10,0.1)', border: '0.125rem solid var(--gold)', borderRadius: 'var(--radius-sm)' }} />
                    )}
                  </div>
                  <div style={{ padding: '0.375rem 0.5rem 0.5rem' }}>
                    <p className="deck-builder-modal-card-name" style={{ ...getCompactNameStyle(locale), color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.3 }}>
                      {localizeIdentityName(ident, locale)}
                    </p>
                    {(ident.skill_keyword_list ?? []).length > 0 && (
                      <div className="mt-1 flex min-w-0 items-center gap-1 overflow-hidden" aria-label="skill keywords" style={{ minHeight: '1.625rem' }}>
                        {(ident.skill_keyword_list ?? []).slice(0, 3).map(keyword => {
                          const iconUrl = getIconUrl(keyword)
                          return (
                            <span
                              key={keyword}
                              className="deck-builder-skill-keyword-chip inline-flex min-w-0 flex-shrink items-center gap-1 rounded-sm"
                              style={{
                                maxWidth: '100%',
                                padding: '0.1875rem 0.3125rem',
                                background: 'rgba(120,76,28,0.14)',
                                border: '1px solid rgba(200,144,10,0.18)',
                                color: 'var(--text-muted)',
                                fontSize: '0.875rem',
                                lineHeight: 1,
                              }}
                            >
                              {iconUrl && (
                                <Image
                                  src={iconUrl}
                                  alt=""
                                  width={14}
                                  height={14}
                                  style={{ width: '0.875rem', height: '0.875rem', flex: '0 0 auto', opacity: 0.78 }}
                                />
                              )}
                              <span className="truncate">{localizeDeckKeyword(keyword, keywordInfo[keyword], locale)}</span>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
            {modalIdentities.length === 0 && (
              <p className="col-span-full py-8 text-center" style={{ color: 'var(--text-tertiary)', fontSize: '0.9375rem' }}>{t('noResults')}</p>
            )}
          </div>
        </div>
      )}
    </BaseModal>
    </>
  )
}

/* ── 탭 2: 에고 편성 ─────────────────────────────────── */
export function EgoTab({
  sinners, egos, egoSlots, lang, onEgoSelect, onEgoDeselect,
}: {
  sinners: Sinner[]
  egos: EGO[]
  egoSlots: Record<string, Record<string, EGO>>
  lang: SupportedLang
  onEgoSelect: (ego: EGO) => void
  onEgoDeselect: (sinnerId: string, grade: string) => void
}) {
  const [modalSinnerId, setModalSinnerId] = useState<string | null>(null)
  const [egoSearch, setEgoSearch] = useState('')
  const [egoGradeFilter, setEgoGradeFilter] = useState<string>('all')
  const t = useTranslations('planner.deckTab.ego')
  const modalSinner = modalSinnerId ? sinners.find(s => s.id === modalSinnerId) : null
  const modalEgos = modalSinnerId
    ? egos
        .filter(e => e.sinner_id === modalSinnerId)
        .filter(e => egoGradeFilter === 'all' || e.grade === egoGradeFilter)
        .filter(e => {
          const query = egoSearch.trim().toLowerCase()
          if (!query) return true
          return [localizeEgoName(e, lang), e.name_kr, e.name_en, e.name_jp]
            .filter(Boolean)
            .some(name => name!.toLowerCase().includes(query))
        })
    : []

  return (
    <>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-4">
      {sinners.map(sinner => {
        const sinnerEgos = egoSlots[sinner.id] ?? {}
        return (
          <div
            key={sinner.id}
            onClick={() => setModalSinnerId(sinner.id)}
            role="button"
            tabIndex={0}
            data-deck-builder-ego-card={sinner.id}
            aria-label={`${t('modalTitle')} ${getLocalizedName(sinner, lang)}`}
            onKeyDown={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              setModalSinnerId(sinner.id)
            }}
            style={{
              background: 'rgba(18,14,9,0.82)',
              border: '1px solid rgba(200,144,10,0.14)',
              borderRadius: '0.25rem',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            {/* 수감자 헤더 */}
            <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: '1px solid #1a1208' }}>
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={14} height={14} style={{ width: '0.875rem', height: '0.875rem', opacity: 0.5 }} unoptimized />
              <span className="truncate" style={{ ...getCompactNameStyle(lang), color: 'rgba(232,220,200,0.78)', fontSize: '0.875rem' }}>{getDeckBuilderSinnerName(sinner, lang)}</span>
            </div>
            {/* 등급 세로 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0.125rem' }}>
              {GRADE_ORDER.map(grade => {
                const ego = sinnerEgos[grade]
                const gc = GRADE_COLORS[grade]
                const sc = ego?.sin_affinity ? (SIN_COLORS[ego.sin_affinity as SinType] ?? gc) : gc
                return (
                  <div
                    key={grade}
                    style={{
                      background: ego ? `${sc}1a` : 'rgba(10,8,5,0.7)',
                      border: `1px solid ${ego ? sc + '55' : '#18120a'}`,
                      borderRadius: '0.125rem',
                      padding: '0.25rem 0.3125rem',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: '0.3125rem',
                      minHeight: '1.5rem',
                    }}
                  >
                    {grade !== 'ALEPH' ? (
                      <Image
                        src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                        alt={grade}
                        width={22}
                        height={11}
                        unoptimized
                        style={{ height: '0.6875rem', width: 'auto', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}
                      />
                    ) : (
                      <span style={{ color: ego ? sc : gc, fontSize: '0.375rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                    )}
                    {ego
                      ? <span style={{ ...COMPACT_KOTRA_STYLE, color: sc, fontSize: '0.875rem', lineHeight: 1.2, wordBreak: 'keep-all', flex: 1, textAlign: 'left' }}>{localizeEgoName(ego, lang)}</span>
                      : <span style={{ color: '#2a1e10', fontSize: '0.75rem', lineHeight: 1 }}>+</span>
                    }
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>

    {/* ── 에고 선택 모달 (수감자별, 전 등급 동시 표시) ── */}
    <BaseModal open={!!(modalSinnerId && modalSinner)} onClose={() => setModalSinnerId(null)} maxWidth="42rem" padding="1rem" title={t('modalTitle')}>
      {modalSinnerId && modalSinner && (
        <div
          data-deck-builder-modal="ego"
          className="flex flex-col"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', maxHeight: '85vh', overflow: 'hidden', boxShadow: 'none' }}
        >
          {/* 모달 헤더 */}
          <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '0.875rem 1rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
            <div className="flex min-w-0 items-center gap-2">
              <Image src={getSinnerLogoUrl(modalSinner.id)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }} />
              <span className="min-w-0 truncate" style={{ ...getCompactNameStyle(lang), color: 'var(--text-primary)', fontSize: '1rem' }}>{t('modalHeading', { sinner: getDeckBuilderSinnerName(modalSinner, lang) })}</span>
            </div>
            <button onClick={() => setModalSinnerId(null)} aria-label={t('close')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-shrink-0 flex-col gap-2.5" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="relative">
              <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input
                type="search"
                value={egoSearch}
                onChange={event => setEgoSearch(event.target.value)}
                placeholder={t('searchPlaceholder')}
                className="min-h-11 w-full rounded pl-9 pr-10 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: '0.9375rem' }}
              />
              {egoSearch && (
                <button
                  type="button"
                  onClick={() => setEgoSearch('')}
                  aria-label={t('clearSearch')}
                  className="absolute right-0 top-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', ...GRADE_ORDER] as const).map(grade => {
                const active = egoGradeFilter === grade
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => setEgoGradeFilter(grade)}
                    className="min-h-11 rounded px-3"
                    aria-pressed={active}
                    style={{
                      border: `1px solid ${active ? 'rgba(232,176,48,0.45)' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? 'rgba(200,144,10,0.12)' : 'rgba(13,11,8,0.38)',
                      color: active ? 'var(--gold)' : 'var(--text-muted)',
                      fontSize: '0.9375rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {grade === 'all' ? t('gradeAll') : grade}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 등급별 섹션 */}
          <div className="overflow-y-auto flex-1" style={{ padding: '0.75rem 1.25rem 1.25rem' }}>
            {GRADE_ORDER.filter(grade => egoGradeFilter === 'all' || egoGradeFilter === grade).map(grade => {
              const gc = GRADE_COLORS[grade] ?? '#667788'
              const gradeEgos = modalEgos.filter(e => e.grade === grade)
              const selectedEgo = egoSlots[modalSinnerId]?.[grade]
              return (
                <div key={grade} style={{ marginBottom: '1.25rem' }}>
                  {/* 등급 헤더 */}
                  <div className="flex items-center gap-2" style={{ marginBottom: '0.625rem' }}>
                    {grade !== 'ALEPH' ? (
                      <Image
                        src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                        alt={grade}
                        width={32}
                        height={16}
                        unoptimized
                        style={{ height: '1rem', width: 'auto', opacity: 0.85 }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5625rem', color: gc, letterSpacing: '0.1em' }}>ALEPH</span>
                    )}
                    <div style={{ flex: 1, height: '1px', background: `${gc}33` }} />
                    {selectedEgo && grade !== 'ZAYIN' && (
                      <button
                        onClick={() => onEgoDeselect(modalSinnerId, grade)}
                        className="min-h-11 rounded px-3"
                        style={{
                          color: '#cc4444', fontSize: '0.9375rem', cursor: 'pointer',
                          border: '1px solid rgba(200,48,32,0.3)', background: 'rgba(200,48,32,0.05)',
                          lineHeight: 1.4,
                        }}
                      >{t('remove')}</button>
                    )}
                  </div>

                  {gradeEgos.length === 0 ? (
                    <p style={{ color: '#3a2e20', fontSize: '0.875rem', fontFamily: 'var(--font-mono)', paddingLeft: '0.25rem' }}>{t('emptyGrade')}</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {gradeEgos.map(ego => {
                        const isSelected = selectedEgo?.id === ego.id
                        const egoName = localizeEgoName(ego, lang)
                        return (
                          <EgoDisplayCard
                            key={ego.id}
                            onClick={() => onEgoSelect(ego)}
                            ego={ego}
                            name={egoName}
                            sinnerId={ego.sinner_id}
                            lang={lang}
                            selected={isSelected}
                            className={[
                              'transition-[filter] duration-200 ease-out',
                              'brightness-95 hover:brightness-105 hover:saturate-110',
                            ].join(' ')}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </BaseModal>
    </>
  )
}

/* ── 탭 3: 편성 순서 ─────────────────────────────────── */
export function OrderTab({
  sinners, deckSlots, formationOrder, onToggle,
}: {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  formationOrder: string[]
  onToggle: (sinnerId: string) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-8">
      {sinners.map(sinner => {
        const idx = formationOrder.indexOf(sinner.id)
        const position = idx === -1 ? 0 : idx + 1
        const isAssigned = position > 0
        const isBattle = position <= 7
        const color = isBattle ? '#c83020' : '#3870b0'
        const identity = deckSlots[sinner.id]

        return (
          <div
            key={sinner.id}
            onClick={() => onToggle(sinner.id)}
            className="relative cursor-pointer"
            style={{ overflow: 'visible' }}
          >
            {identity ? (
              <IdentityCard identity={identity} compact />
            ) : (
              <SinnerGhostCard sinner={sinner}>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} style={{ height: '1.5rem', width: 'auto', opacity: 0.35 }} />
                </div>
              </SinnerGhostCard>
            )}

            <div
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                zIndex: 20,
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: isAssigned ? color : 'rgba(20,16,10,0.9)',
                border: isAssigned ? `2px solid ${color}` : '1.5px dashed rgba(200,144,10,0.3)',
                boxShadow: 'none',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
            >
              {isAssigned ? (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.375rem', fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>
                    {isBattle ? 'B' : 'S'}
                  </span>
                  <span style={{ color: '#fff', fontSize: '0.8125rem', fontFamily: 'var(--font-title)', fontWeight: 700, lineHeight: 1 }}>
                    {position}
                  </span>
                </>
              ) : (
                <span style={{ color: 'rgba(200,144,10,0.4)', fontSize: '1rem', lineHeight: 1 }}>+</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 탭 4: 스킬 배분 ─────────────────────────────────── */
export function SkillsetTab({
  sinners, deckSlots, skillsByIdentityId, skillDistribution, onDistributionChange,
}: {
  sinners: Sinner[]
  deckSlots: Record<string, Identity | undefined>
  skillsByIdentityId: Record<string, Skill[]>
  skillDistribution: Record<string, [number, number, number]>
  onDistributionChange: (sinnerId: string, dist: [number, number, number]) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-8">
      {sinners.map(sinner => {
        const identity = deckSlots[sinner.id]
        if (!identity) {
          return (
            <div key={sinner.id}>
              <SinnerGhostCard sinner={sinner}>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={24} height={24} style={{ height: '1.5rem', width: 'auto', opacity: 0.35 }} />
                </div>
              </SinnerGhostCard>
            </div>
          )
        }

        const dist = skillDistribution[sinner.id] ?? [3, 2, 1]
        const total = dist[0] + dist[1] + dist[2]
        const skills = (skillsByIdentityId[identity.id] ?? [])
          .filter(s => s.skill_order >= 1 && s.skill_order <= 3)
          .sort((a, b) => a.skill_order - b.skill_order)
          .filter((s, i, arr) => arr.findIndex(x => x.skill_order === s.skill_order) === i)

        const handleChange = (idx: number, delta: number) => {
          const next: [number, number, number] = [dist[0], dist[1], dist[2]]
          const newVal = next[idx] + delta
          if (newVal < 0 || total + delta > 6) return
          next[idx] = newVal
          onDistributionChange(sinner.id, next)
        }

        return (
          <div key={sinner.id}>
            <IdentityCard identity={identity} compact />
            <SkillExchangePanel
              distribution={dist}
              skills={[
                skills[0] ? {
                  name: skills[0].name,
                  iconSrc: identity.game_id ? getSkillIconUrl(identity, skills[0].skill_order) : null,
                  sinColor: SIN_COLORS[skills[0].sin_affinity] ?? '#888',
                } : null,
                skills[1] ? {
                  name: skills[1].name,
                  iconSrc: identity.game_id ? getSkillIconUrl(identity, skills[1].skill_order) : null,
                  sinColor: SIN_COLORS[skills[1].sin_affinity] ?? '#888',
                } : null,
                skills[2] ? {
                  name: skills[2].name,
                  iconSrc: identity.game_id ? getSkillIconUrl(identity, skills[2].skill_order) : null,
                  sinColor: SIN_COLORS[skills[2].sin_affinity] ?? '#888',
                } : null,
              ]}
              onAdjust={handleChange}
              onPresetSelect={preset => onDistributionChange(sinner.id, preset)}
            />
          </div>
        )
      })}
    </div>
  )
}
