'use client'

import { getFormationBannerUrl } from '@/lib/utils/images'

import { useMemo, type CSSProperties } from 'react'
import Image from 'next/image'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { RefreshCcw, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import BaseModal from '@/components/ui/BaseModal'
import EgoDisplayCard from '@/components/sinners/EgoDisplayCard'
import { localizeEgoName, localizeIdentityName } from '@/components/deck-detail/DeckIdentityCard'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { GRADE_COLORS, RARITY_COLORS, STORAGE_BASE } from '@/lib/constants/game'
import { SIN_COLORS, SIN_KR_TO_EN } from '@/lib/constants/sin'
import { getIdentityImageUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import type { SupportedLang } from '@/lib/i18n/types'
import { useLocale, useTranslations } from 'next-intl'

export type PlannerDeckSinner = {
  id: string
  name_kr: string
  name?: string | null
  name_en?: string | null
  name_jp?: string | null
}

export type PlannerDeckIdentity = {
  id: string
  sinner_id: string
  name?: string | null
  name_kr?: string | null
  name_en?: string | null
  name_jp?: string | null
  rarity: number
  keywords?: string[] | null
  skill_keyword_list?: string[] | null
  game_id?: string | null
  folder_name?: string | null
}

export type PlannerDeckEgo = {
  id: string
  sinner_id: string
  name: string
  name_kr: string | null
  name_en?: string | null
  name_jp?: string | null
  grade: string
  sin_affinity?: string | null
  image_url?: string | null
  cost?: number[] | null
}

export type PlannerIdentityBoardSlot = {
  sinnerId: string
  identity: PlannerDeckIdentity | null
  identityName?: string
  slotOrder: number | null
  gacksung: boolean
}

export type PlannerEgoBoardSlot = {
  sinnerId: string
  enabled?: boolean
  egosByGrade: Record<string, PlannerDeckEgo | undefined>
}

export const PLANNER_EGO_GRADE_ORDER = ['ZAYIN', 'TETH', 'HE', 'WAW', 'ALEPH'] as const

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

function RarityStars({ rarity, size = 'md' }: { rarity: number; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'sm' ? 18 : size === 'lg' ? 32 : 24
  return (
    <Image
      src={`${STORAGE_BASE}/icons/Rarity/${rarity}star.webp`}
      alt={`${rarity}`}
      width={h * rarity}
      height={h}
      style={{ height: `${h / 16}rem`, width: 'auto', objectFit: 'contain' }}
    />
  )
}

function SkillKeywordChips({
  keywords,
  getIconUrl,
  getKeywordLabel,
}: {
  keywords: string[] | null | undefined
  getIconUrl: (keyword: string) => string | null
  getKeywordLabel: (keyword: string) => string
}) {
  const skillKeywords = (keywords ?? []).filter(Boolean)
  if (skillKeywords.length === 0) return null

  return (
    <div className="mt-1 flex min-w-0 items-center gap-1 overflow-hidden" aria-label="skill keywords" style={{ minHeight: '1.625rem' }}>
      {skillKeywords.slice(0, 3).map(keyword => {
        const iconUrl = getIconUrl(keyword)
        return (
          <span
            key={keyword}
            className="inline-flex min-w-0 flex-shrink items-center gap-1 rounded-sm"
            style={{
              maxWidth: '100%',
              padding: '0.1875rem 0.3125rem',
              background: 'rgba(120,76,28,0.14)',
              border: '1px solid rgba(200,144,10,0.18)',
              color: '#8d7f69',
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
            <span className="truncate">{getKeywordLabel(keyword)}</span>
          </span>
        )
      })}
    </div>
  )
}

function useSinnerName(locale: SupportedLang, getSinnerName?: (sinner: PlannerDeckSinner) => string) {
  const tSinner = useTranslations('sinner')

  return (sinner: PlannerDeckSinner) => {
    if (getSinnerName) return getSinnerName(sinner)
    if (sinner.id) return tSinner(sinner.id as Parameters<typeof tSinner>[0])
    return localizeIdentityName(sinner, locale)
  }
}

function getIdentityInfoImageUrl(identity: PlannerDeckIdentity, gacksung: boolean) {
  if (!identity.game_id || !identity.folder_name) return ''
  const prefix = gacksung ? 'gacksung' : 'normal'
  return getIdentityImageUrl(identity.sinner_id, identity.folder_name, `${identity.game_id}_${prefix}_info`)
}

export function PlannerIdentityBoard({
  sinners,
  slots,
  onOpenIdentityModal,
  onFormationToggle,
  onGacksungToggle,
  getSinnerName,
}: {
  sinners: PlannerDeckSinner[]
  slots: Record<string, PlannerIdentityBoardSlot | undefined>
  onOpenIdentityModal: (sinnerId: string) => void
  onFormationToggle: (sinnerId: string) => void
  onGacksungToggle: (sinnerId: string) => void
  getSinnerName?: (sinner: PlannerDeckSinner) => string
}) {
  const t = useTranslations('planner.deckTab.identity')
  const locale = useLocale() as SupportedLang
  const getLocalizedSinnerName = useSinnerName(locale, getSinnerName)
  const compactNameStyle = getCompactNameStyle(locale)

  return (
    <div className="planner-deck-identity-grid">
      {sinners.map(sinner => {
        const boardSlot = slots[sinner.id]
        const identity = boardSlot?.identity ?? null
        const slotOrder = boardSlot?.slotOrder ?? null
        const isGacksung = boardSlot?.gacksung ?? false
        const identityName = boardSlot?.identityName ?? (identity ? localizeIdentityName(identity, locale) : '')
        const sinnerName = getLocalizedSinnerName(sinner)
        const rarityColor = identity ? (RARITY_COLORS[identity.rarity] ?? RARITY_COLORS[1]) : null
        const isFormed = slotOrder != null && slotOrder < 99

        return (
          <motion.div
            key={sinner.id}
            className="relative min-w-0"
            style={{ overflow: 'visible' }}
          >
            <div
              className="planner-deck-identity-card group relative w-full"
              data-filled={identity ? 'true' : 'false'}
              role="group"
              tabIndex={0}
              aria-label={identity ? `${identityName} ${t('change')}` : `${sinnerName} ${t('form')}`}
              style={{
                border: `0.09375rem ${identity ? 'solid' : 'dashed'} ${identity ? (rarityColor?.border ?? '#2a2015') : '#2a2015'}`,
                boxShadow: identity ? `0 0 0.5rem ${rarityColor?.glow ?? 'transparent'}` : 'none',
              }}
            >
              {identity ? (
                <>
                  {getIdentityInfoImageUrl(identity, isGacksung) && (
                    <Image
                      src={getIdentityInfoImageUrl(identity, isGacksung)}
                      alt={identityName}
                      fill
                      className="object-cover object-top"
                      sizes="180px"
                    />
                  )}
                  <div className="absolute left-0 top-0 z-10 flex items-center gap-0.5 p-1">
                    <RarityStars rarity={identity.rarity} />
                  </div>
                  <div className="planner-deck-identity-card__name">
                    <p style={{ ...compactNameStyle, color: '#e8dcc8', fontSize: '0.8125rem', lineHeight: 1.2 }}>
                      {identityName}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 z-10 flex items-center justify-center">
                    <Image
                      src={getSinnerLogoUrl(sinner.id)}
                      alt=""
                      width={32}
                      height={32}
                      style={{ width: '2rem', height: '2rem', opacity: 0.35 }}
                    />
                  </div>
                  <div className="absolute right-0 top-0 w-[36%] opacity-15">
                    <Image
                      src={getGameUiAsset(`sinners/${sinner.id}`)}
                      alt=""
                      width={389}
                      height={1023}
                      className="h-auto w-full"
                      loading="eager"
                    />
                  </div>
                  <div className="planner-deck-identity-card__name">
                    <p style={{ ...compactNameStyle, color: '#3a2a10', fontSize: '0.875rem' }}>{sinnerName}</p>
                  </div>
                </>
              )}

              {identity && slotOrder != null && (() => {
                const n = slotOrder >= 99 ? null : slotOrder + 1
                const isFormation = n != null && n <= 7
                return (
                  <div className="planner-deck-identity-card__formation pointer-events-none">
                    <Image src={getFormationBannerUrl(isFormation ? 'selected' : 'backup')} alt={isFormation ? t('formed') : t('bench')} width={260} height={66} className="absolute left-0 top-[54%] h-auto w-full" />
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-body)', lineHeight: 1, color: isFormation ? '#e8b030' : '#5ab0d0', textShadow: `0 0 1rem ${isFormation ? 'rgba(200,144,10,0.7)' : 'rgba(90,176,208,0.7)'}, 0 0.125rem 0.5rem rgba(0,0,0,1)`, marginLeft: '0.25rem' }}>
                      {n}
                    </span>
                  </div>
                )
              })()}

              <div className="planner-deck-identity-card__overlay">
                {identity ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenIdentityModal(sinner.id)}
                      className="planner-deck-identity-card__overlay-button planner-deck-identity-card__overlay-button--change"
                      aria-label={`${t('change')} ${sinnerName}`}
                    >
                      {t('change')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onFormationToggle(sinner.id)}
                      className="planner-deck-identity-card__overlay-button planner-deck-identity-card__overlay-button--formation"
                      data-formed={isFormed}
                      aria-pressed={isFormed}
                      aria-label={`${isFormed ? t('removeFormation') : t('addFormation')} ${sinnerName}`}
                    >
                      {isFormed ? t('removeFormation') : t('addFormation')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenIdentityModal(sinner.id)}
                    className="planner-deck-identity-card__overlay-button planner-deck-identity-card__overlay-button--empty"
                    aria-label={`${t('form')} ${sinnerName}`}
                  >
                    {t('form')}
                  </button>
                )}
              </div>
            </div>

            {identity && (
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation()
                  onGacksungToggle(sinner.id)
                }}
                title={isGacksung ? t('toNormalArt') : t('toAwakenedArt')}
                aria-label={isGacksung ? t('toNormalArt') : t('toAwakenedArt')}
                className="planner-deck-identity-card__art-button"
                data-active={isGacksung}
              >
                <RefreshCcw aria-hidden="true" strokeWidth={2} />
              </button>
            )}
          </motion.div>
        )
      })}

      <style jsx>{`
        .planner-deck-identity-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: 1rem;
          row-gap: 1.5rem;
        }
        .planner-deck-identity-card {
          aspect-ratio: 2 / 3;
          background: linear-gradient(160deg, #1e1810 0%, #120e08 60%, #1a1410 100%);
          border-radius: 0.25rem;
          overflow: hidden;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .planner-deck-identity-card:focus-within,
        .planner-deck-identity-card:focus-visible,
        .planner-deck-identity-card:hover {
          filter: brightness(1.04);
        }
        .planner-deck-identity-card:focus-visible {
          outline: 0.125rem solid rgba(232,176,48,0.72);
          outline-offset: 0.125rem;
        }
        .planner-deck-identity-card__name {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 10;
          background: linear-gradient(to top, rgba(13,11,8,0.95) 0%, transparent 100%);
          padding: 1.5rem 0.25rem 0.375rem;
          text-align: center;
        }
        .planner-deck-identity-card[data-filled="false"] .planner-deck-identity-card__name {
          padding-top: 1.25rem;
        }
        .planner-deck-identity-card__formation {
          position: absolute;
          inset: 0;
          z-index: 15;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-bottom: 30%;
          background: rgba(13,11,8,0.5);
        }
        .planner-deck-identity-card__overlay {
          position: absolute;
          inset: 0;
          z-index: 20;
          display: flex;
          flex-direction: column;
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
          backdrop-filter: blur(0.375rem) brightness(0.4);
          -webkit-backdrop-filter: blur(0.375rem) brightness(0.4);
          transition: opacity 0.18s ease, visibility 0s linear 0.18s;
        }
        .planner-deck-identity-card:hover .planner-deck-identity-card__overlay,
        .planner-deck-identity-card:focus .planner-deck-identity-card__overlay,
        .planner-deck-identity-card:focus-within .planner-deck-identity-card__overlay {
          opacity: 1;
          pointer-events: auto;
          visibility: visible;
          transition-delay: 0s;
        }
        .planner-deck-identity-card__overlay-button {
          display: flex;
          min-height: 2.75rem;
          align-items: center;
          justify-content: center;
          border: 0;
          color: #e8b030;
          cursor: pointer;
          font-family: var(--font-body), var(--font-sans);
          font-size: 0.9375rem;
          font-weight: 700;
          line-height: 1.1;
          padding: 0.375rem 0.5rem;
          text-align: center;
          text-shadow: 0 0 0.5rem rgba(200,144,10,0.5), 0 0.125rem 0.375rem rgba(0,0,0,0.9);
          transition: background-color 0.18s ease, color 0.18s ease;
        }
        .planner-deck-identity-card__overlay-button:focus-visible,
        .planner-deck-identity-card__art-button:focus-visible {
          outline: 2px solid rgba(232,176,48,0.7);
          outline-offset: -2px;
        }
        .planner-deck-identity-card__overlay-button--change {
          height: 40%;
          background: rgba(13,11,8,0.6);
          border-bottom: 1px solid rgba(200,144,10,0.2);
        }
        .planner-deck-identity-card__overlay-button--change:hover,
        .planner-deck-identity-card__overlay-button--change:focus-visible {
          background: rgba(200,144,10,0.15);
        }
        .planner-deck-identity-card__overlay-button--formation {
          height: 60%;
          background: rgba(13,11,8,0.5);
          font-weight: 600;
        }
        .planner-deck-identity-card__overlay-button--formation:hover,
        .planner-deck-identity-card__overlay-button--formation:focus-visible {
          background: rgba(200,144,10,0.12);
        }
        .planner-deck-identity-card__overlay-button--formation[data-formed="true"] {
          color: #5ab0d0;
          text-shadow: 0 0 0.5rem rgba(90,176,208,0.48), 0 0.125rem 0.375rem rgba(0,0,0,0.9);
        }
        .planner-deck-identity-card__overlay-button--formation[data-formed="true"]:hover,
        .planner-deck-identity-card__overlay-button--formation[data-formed="true"]:focus-visible {
          background: rgba(90,176,208,0.12);
        }
        .planner-deck-identity-card__overlay-button--empty {
          height: 100%;
          background: rgba(13,11,8,0.5);
          font-size: 1rem;
        }
        .planner-deck-identity-card__overlay-button--empty:hover,
        .planner-deck-identity-card__overlay-button--empty:focus-visible {
          background: rgba(200,144,10,0.12);
        }
        .planner-deck-identity-card__art-button {
          position: absolute;
          top: 0.375rem;
          right: 0.375rem;
          z-index: 20;
          display: flex;
          height: 2.75rem;
          width: 2.75rem;
          align-items: center;
          justify-content: center;
          border: 0.09375rem solid #2a2015;
          border-radius: 999px;
          background: rgba(18,14,9,0.92);
          color: rgba(232,220,200,0.78);
          cursor: pointer;
          line-height: 1;
          padding: 0;
          box-shadow: 0 0.25rem 0.75rem rgba(0,0,0,0.45);
          transition: border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }
        .planner-deck-identity-card__art-button:hover,
        .planner-deck-identity-card__art-button:focus-visible {
          border-color: rgba(232,176,48,0.58);
          background: rgba(42,32,21,0.95);
          color: #f0d48a;
          box-shadow: 0 0.25rem 0.75rem rgba(0,0,0,0.5), inset 0 0 0 1px rgba(232,176,48,0.1);
        }
        .planner-deck-identity-card__art-button:active {
          transform: scale(0.96);
        }
        .planner-deck-identity-card__art-button svg {
          height: 1rem;
          width: 1rem;
          flex: 0 0 auto;
        }
        .planner-deck-identity-card__art-button[data-active="true"] {
          color: #0d0b08;
          border-color: #c8900a;
          background: rgba(200,144,10,0.92);
          box-shadow: 0 0 0.5rem rgba(200,144,10,0.5), 0 0.25rem 0.75rem rgba(0,0,0,0.45);
        }
        @media (min-width: 40rem) {
          .planner-deck-identity-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (min-width: 48rem) {
          .planner-deck-identity-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (min-width: 64rem) {
          .planner-deck-identity-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
        }
        @media (max-width: 39.9375rem) {
          .planner-deck-identity-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            column-gap: 0.375rem;
            row-gap: 0.5rem;
          }
          .planner-deck-identity-card__overlay {
            opacity: 1;
            pointer-events: auto;
            visibility: visible;
            transition-delay: 0s;
          }
          .planner-deck-identity-card__overlay-button {
            font-size: 0.875rem;
            padding-inline: 0.25rem;
          }
          .planner-deck-identity-card__overlay-button--empty {
            font-size: 0.9375rem;
          }
          .planner-deck-identity-card__art-button {
            top: 0.1875rem;
            right: 0.1875rem;
          }
        }
        @media (max-width: 22.4375rem) {
          .planner-deck-identity-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .planner-deck-identity-card,
          .planner-deck-identity-card__overlay,
          .planner-deck-identity-card__overlay-button,
          .planner-deck-identity-card__art-button {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}

export function PlannerIdentitySelectModal({
  open,
  sinner,
  identities,
  selectedIdentityId,
  onClose,
  onSelect,
  onDeselect,
  getSinnerName,
}: {
  open: boolean
  sinner: PlannerDeckSinner | null
  identities: PlannerDeckIdentity[]
  selectedIdentityId?: string | null
  onClose: () => void
  onSelect: (identity: PlannerDeckIdentity) => void
  onDeselect?: () => void
  getSinnerName?: (sinner: PlannerDeckSinner) => string
}) {
  const t = useTranslations('planner.deckTab.identity')
  const locale = useLocale() as SupportedLang
  const { getIconUrl, keywords: keywordInfo } = useKeywordData()
  const getLocalizedSinnerName = useSinnerName(locale, getSinnerName)
  const getKeywordLabel = (keyword: string) => localizeDeckKeyword(keyword, keywordInfo[keyword], locale)
  const compactNameStyle = getCompactNameStyle(locale)

  return (
    <BaseModal open={open && !!sinner} onClose={onClose} maxWidth="48rem" title={t('modalTitle')}>
      {sinner && (
        <div className="planner-deck-select-modal">
          <div className="planner-deck-select-modal__header">
            <div className="flex min-w-0 items-center gap-2">
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }} />
              <span className="min-w-0 truncate" style={{ ...compactNameStyle, color: '#e8dcc8', fontSize: '1rem' }}>
                {t('modalHeading', { sinner: getLocalizedSinnerName(sinner) })}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label={t('close')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded" style={{ color: '#666', cursor: 'pointer' }}>
              <X style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden="true" />
            </button>
          </div>

          {selectedIdentityId && onDeselect && (
            <div className="px-5 pt-3">
              <button
                type="button"
                onClick={onDeselect}
                className="flex min-h-11 w-full items-center gap-1.5 rounded transition-colors hover:bg-[#2a1510]"
                style={{ color: '#c83030', fontSize: '0.9375rem', border: '1px solid #3a1515', padding: '0.5rem 0.75rem', cursor: 'pointer', background: 'rgba(200,48,48,0.05)' }}
              >
                <X style={{ width: '0.875rem', height: '0.875rem' }} aria-hidden="true" />
                {t('clear')}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 md:grid-cols-4">
            {identities.map(identity => {
              const isSelected = selectedIdentityId === identity.id
              const rarityColor = RARITY_COLORS[identity.rarity] ?? RARITY_COLORS[1]
              const identityName = localizeIdentityName(identity, locale)
              return (
                <button
                  key={identity.id}
                  type="button"
                  onClick={() => onSelect(identity)}
                  className="text-left transition-[filter,box-shadow,border-color] duration-200 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0c09]"
                  style={{
                    background: isSelected
                      ? 'linear-gradient(160deg, rgba(200,144,10,0.15) 0%, rgba(200,144,10,0.05) 100%)'
                      : 'linear-gradient(160deg, #1e1810 0%, #120e08 100%)',
                    border: `0.09375rem solid ${isSelected ? '#c8900a' : `${rarityColor.border}40`}`,
                    borderRadius: '0.375rem',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: isSelected ? `0 0 0.75rem ${rarityColor.glow}` : 'none',
                  }}
                >
                  <div className="relative isolate w-full overflow-hidden" style={{ aspectRatio: '2/3' }}>
                    {identity.game_id && identity.folder_name && (
                      <Image
                        src={getIdentityInfoImageUrl(identity, false)}
                        alt={identityName}
                        fill
                        className="object-cover object-top"
                        sizes="200px"
                      />
                    )}
                    <div className="absolute left-0 top-0 z-[1] flex items-center p-1">
                      <RarityStars rarity={identity.rarity} />
                    </div>
                    {isSelected && (
                      <div className="absolute inset-0 z-[2]" style={{ background: 'rgba(200,144,10,0.1)', border: '0.125rem solid #c8900a', borderRadius: '0.25rem' }} />
                    )}
                  </div>
                  <div style={{ padding: '0.375rem 0.5rem 0.5rem' }}>
                    <p
                      className="planner-deck-select-modal__card-name"
                      style={{ ...compactNameStyle, color: isSelected ? '#e8dcc8' : '#b0a898', fontSize: '0.875rem', lineHeight: 1.3 }}
                    >
                      {identityName}
                    </p>
                    <SkillKeywordChips keywords={identity.skill_keyword_list} getIconUrl={getIconUrl} getKeywordLabel={getKeywordLabel} />
                  </div>
                </button>
              )
            })}
            {identities.length === 0 && (
              <p className="col-span-full py-8 text-center" style={{ color: 'var(--text-tertiary)', fontSize: '0.9375rem' }}>{t('noResults')}</p>
            )}
          </div>
          <style jsx>{`
            .planner-deck-select-modal {
              max-height: 85vh;
              overflow-y: auto;
              border: 1px solid #333;
              border-radius: 0.5rem;
              background: #1a1510;
              box-shadow: 0 1rem 3rem rgba(0,0,0,0.8);
            }
            .planner-deck-select-modal__header {
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
            .planner-deck-select-modal__card-name {
              display: -webkit-box;
              min-height: 2.25em;
              overflow: hidden;
              overflow-wrap: anywhere;
              word-break: keep-all;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 2;
            }
          `}</style>
        </div>
      )}
    </BaseModal>
  )
}

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
          <motion.button
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
                      <span style={{ color: gradeColor, fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', opacity: ego ? 0.9 : 0.3, flexShrink: 0 }}>ALEPH</span>
                    )}
                    {ego ? (() => {
                      const egoName = localizeEgoName(ego, locale)
                      return (
                      <span className="planner-deck-ego-name" title={egoName} style={{ ...compactNameStyle, color: egoColor, fontSize: '0.875rem', lineHeight: 1.2, flex: 1, textAlign: 'left' }}>
                        {egoName}
                      </span>
                      )
                    })() : (
                      <span style={{ color: '#2a1e10', fontSize: '0.875rem', lineHeight: 1 }}>{enabled ? '—' : ''}</span>
                    )}
                  </div>
                )
              })}
            </div>
            {!enabled && (
              <div className="px-2 pb-1.5 pt-1 text-center">
                <span style={{ fontSize: '0.875rem', color: '#333' }}>{t('noIdentity')}</span>
              </div>
            )}
          </motion.button>
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
  onClose,
  onSelect,
  onDeselect,
  getSinnerName,
}: {
  open: boolean
  sinner: PlannerDeckSinner | null
  egos: PlannerDeckEgo[]
  selectedEgosByGrade: Record<string, PlannerDeckEgo | undefined>
  onClose: () => void
  onSelect: (ego: PlannerDeckEgo) => void
  onDeselect: (grade: string, ego: PlannerDeckEgo) => void
  getSinnerName?: (sinner: PlannerDeckSinner) => string
}) {
  const t = useTranslations('planner.deckTab.ego')
  const locale = useLocale() as SupportedLang
  const getLocalizedSinnerName = useSinnerName(locale, getSinnerName)
  const compactNameStyle = getCompactNameStyle(locale)
  const egosByGrade = useMemo(() => {
    const map = new Map<string, PlannerDeckEgo[]>()
    for (const ego of egos) {
      if (!map.has(ego.grade)) map.set(ego.grade, [])
      map.get(ego.grade)!.push(ego)
    }
    return map
  }, [egos])

  return (
    <BaseModal open={open && !!sinner} onClose={onClose} maxWidth="42rem" title={t('modalTitle')}>
      {sinner && (
        <div className="planner-deck-select-modal">
          <div className="planner-deck-select-modal__header">
            <div className="flex min-w-0 items-center gap-2">
              <Image src={getSinnerLogoUrl(sinner.id)} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem', opacity: 0.7 }} />
              <span className="min-w-0 truncate" style={{ ...compactNameStyle, color: '#e8dcc8', fontSize: '1rem' }}>
                {t('modalHeading', { sinner: getLocalizedSinnerName(sinner) })}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label={t('close')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded" style={{ color: '#666', cursor: 'pointer' }}>
              <X style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col gap-5 p-5">
            {PLANNER_EGO_GRADE_ORDER.map(grade => {
              const gradeColor = GRADE_COLORS[grade] ?? '#555'
              const gradeEgos = egosByGrade.get(grade) ?? []
              const selectedForGrade = selectedEgosByGrade[grade]

              return (
                <div key={grade}>
                  <div className="mb-2 flex items-center gap-2">
                    {grade !== 'ALEPH' ? (
                      <Image
                        src={`${STORAGE_BASE}/icons/grade/${grade}.webp`}
                        alt={grade}
                        width={22}
                        height={11}
                        unoptimized
                        style={{ height: '0.75rem', width: 'auto' }}
                      />
                    ) : (
                      <span style={{ color: gradeColor, fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>ALEPH</span>
                    )}
                    <div style={{ flex: 1, height: '1px', background: `${gradeColor}30` }} />
                    {selectedForGrade && grade !== 'ZAYIN' && (
                      <button
                        type="button"
                        onClick={() => onDeselect(grade, selectedForGrade)}
                        className="min-h-11 rounded px-3"
                        style={{ color: '#c83040', fontSize: '0.9375rem', cursor: 'pointer', border: '1px solid #3a1515', background: 'rgba(200,48,64,0.08)' }}
                      >
                        {t('remove')}
                      </button>
                    )}
                  </div>

                  {gradeEgos.length === 0 ? (
                    <div className="rounded p-2.5 text-center" style={{ background: 'rgba(10,8,5,0.5)', border: `1px solid ${gradeColor}15` }}>
                      <span style={{ color: '#333', fontSize: '0.875rem' }}>{t('emptyGrade')}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {gradeEgos.map(ego => {
                        const isSelected = selectedForGrade?.id === ego.id
                        return (
                          <div key={ego.id}>
                            <EgoDisplayCard
                              onClick={() => onSelect(ego)}
                              ego={ego}
                              name={localizeEgoName(ego, locale)}
                              sinnerId={ego.sinner_id}
                              lang={locale}
                              selected={isSelected}
                              className="transition-[filter] duration-200 ease-out brightness-95 hover:brightness-105 hover:saturate-110"
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <style jsx>{`
            .planner-deck-select-modal {
              max-height: 85vh;
              overflow-y: auto;
              border: 1px solid #333;
              border-radius: 0.5rem;
              background: #1a1510;
              box-shadow: 0 1rem 3rem rgba(0,0,0,0.8);
            }
            .planner-deck-select-modal__header {
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
