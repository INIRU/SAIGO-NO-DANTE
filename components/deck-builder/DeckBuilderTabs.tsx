'use client'

import { useSuggestionState } from '@/hooks/useSuggestions'
import { LCB_IDS } from '@/lib/constants/game'
import { identitySuggestUrl, suggestionContext, type SuggestionResponse } from '@/lib/discovery/suggestion-types'
import { useMemo, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  getSinnerLogoUrl,
  getIdentityInfoUrl,
  getSinnerProfileUrl,
  getSkillIconUrl,
  SIN_COLORS,
} from '@/lib/data/sinners'
import IdentityCard from '@/components/sinners/IdentityCard'
import { localizeIdentityName } from '@/components/deck-detail/DeckIdentityCard'
import { localizeDeckKeyword } from '@/components/decks/decks-types'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { useLocale, useTranslations } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import { DECK_MAIN_KEYWORDS } from '@/lib/decks/keyword-rules'
import SkillExchangePanel from '@/components/planner/SkillExchangePanel'
import { DEPLOYED_SLOT_COUNT } from '@/lib/constants/game'
import {
  PlannerEgoBoard,
  PlannerEgoSelectModal,
  PlannerIdentityBoard,
  PlannerIdentitySelectModal,
  type PlannerDeckEgo,
  type PlannerEgoBoardSlot,
  type PlannerIdentityBoardSlot,
} from '@/components/planner/deck/PlannerDeckSelection'

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

const MANUAL_ATTACK_MAIN_KEYWORDS = new Set<string>(['참격', '관통', '타격'])
/* ── 탭 1: 인격 편성 (플래너 패턴: 40% 변경 / 60% 편성 토글) ── */
export function IdentityTab({
  sinners, identities, deckSlots, upties,
  formationOrder, onFormationToggle, onFormationReset, onIdentitySelect,
  mainKeywordCounts, selectedMainKeywords, maxMainKeywords, mainKeywordLabel, onMainKeywordToggle,
}: {
  sinners: Sinner[]
  identities: Identity[]
  deckSlots: Record<string, Identity | undefined>
  /** sinnerId → uptie 1–4 (missing = 4) */
  upties: Record<string, number>
  mainKeywordCounts: Record<string, number>
  selectedMainKeywords: string[]
  maxMainKeywords: number
  mainKeywordLabel: string
  formationOrder: string[]
  onFormationToggle: (sinnerId: string) => void
  onFormationReset: () => void
  onMainKeywordToggle: (keyword: string) => void
  onIdentitySelect: (identity: Identity, uptie: number) => void
}) {
  const [modalSinnerId, setModalSinnerId] = useState<string | null>(null)
  const locale = useLocale() as SupportedLang
  const { getIconUrl, keywords: keywordInfo } = useKeywordData()
  const reduceMotion = useReducedMotion()
  const modalSinner = modalSinnerId ? sinners.find(s => s.id === modalSinnerId) ?? null : null
  // Suggestions follow every identity already chosen on the board beside the slot being picked, with or without a formation number.
  const lcbIds = useMemo(() => new Set(identities.filter(identity => identity.game_id === LCB_IDS[identity.sinner_id]).map(identity => identity.id)), [identities])
  const chosenBeside = modalSinnerId
    ? suggestionContext(Object.fromEntries(Object.entries(deckSlots).map(([id, identity]) => [id, identity?.id])), formationOrder, modalSinnerId, identityId => lcbIds.has(identityId))
    : []
  const { data: suggestion, loading: suggestionLoading } = useSuggestionState<SuggestionResponse>(identitySuggestUrl(modalSinnerId, chosenBeside))
  const identityById = useMemo(() => new Map(identities.map(identity => [identity.id, identity])), [identities])
  const modalIdentities = modalSinnerId
    ? identities
        .filter(i => i.sinner_id === modalSinnerId)
        .sort((a, b) => b.rarity - a.rarity)
    : []
  const openIdentityModal = (sinnerId: string) => setModalSinnerId(sinnerId)
  const boardSlots = sinners.reduce<Record<string, PlannerIdentityBoardSlot>>((acc, sinner) => {
    const identity = deckSlots[sinner.id] ?? null
    const formIdx = formationOrder.indexOf(sinner.id)
    const isFormed = formIdx >= 0
    acc[sinner.id] = {
      sinnerId: sinner.id,
      identity,
      slotOrder: identity && isFormed ? formIdx : null,
      uptie: upties[sinner.id],
      identityName: identity ? localizeIdentityName(identity, locale) : undefined,
    }
    return acc
  }, {})

  return (
    <>
    <PlannerIdentityBoard
      sinners={sinners}
      slots={boardSlots}
      onOpenIdentityModal={openIdentityModal}
      onFormationToggle={onFormationToggle}
      onResetOrder={onFormationReset}
      getSinnerName={sinner => getDeckBuilderSinnerName(sinner as Sinner, locale)}
    />

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
          <m.button
            key={keyword}
            type="button"
            className="deck-builder-pinned-keyword"
            data-selected={selected}
            disabled={disabled}
            onClick={() => onMainKeywordToggle(keyword)}
            aria-pressed={selected}
            aria-label={accessibleName}
            title={accessibleName}
            whileHover={reduceMotion || disabled ? undefined : { y: -1 }}
            whileTap={reduceMotion || disabled ? undefined : { scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 430, damping: 32, mass: 0.5 }}
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
          </m.button>
        )
      })}
    </div>

    <style jsx global>{`
      .deck-builder-pinned-keywords { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; margin: 0.625rem 0 0; }
      .deck-builder-pinned-keyword {
        display: inline-flex; flex: 0 0 auto; max-width: 100%; min-height: 2.25rem; align-items: center; gap: 0.3125rem;
        padding: 0 0.625rem; border: 1px solid transparent; border-radius: 999px; background: rgba(232, 220, 200, 0.04);
        color: #9c8b73; cursor: pointer; font-family: var(--font-body), var(--font-sans); font-size: 0.8125rem; line-height: 1;
        transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
      }
      .deck-builder-pinned-keyword:hover:not(:disabled) { background: rgba(232, 220, 200, 0.08); color: #e8dcc8; }
      .deck-builder-pinned-keyword:focus-visible { outline: 2px solid #e8b030; outline-offset: 2px; }
      .deck-builder-pinned-keyword[data-selected="true"] { border-color: rgba(200, 144, 10, 0.45); background: rgba(200, 144, 10, 0.14); color: #e8b030; }
      .deck-builder-pinned-keyword:disabled { cursor: not-allowed; opacity: 0.38; }
      .deck-builder-pinned-keyword__icon { flex: 0 0 auto; width: 0.875rem; height: 0.875rem; object-fit: contain; }
      .deck-builder-pinned-keyword__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .deck-builder-pinned-keyword__count { color: inherit; font-size: 0.75rem; font-variant-numeric: tabular-nums; opacity: 0.7; }
      @media (pointer: coarse) { .deck-builder-pinned-keyword { min-height: 2.75rem; } }
      @media (prefers-reduced-motion: reduce) { .deck-builder-pinned-keyword { transition: none; } }
    `}</style>

    {/* ── 인격 선택 모달 (플래너 패턴) ── */}
    <PlannerIdentitySelectModal
      open={!!(modalSinnerId && modalSinner)}
      sinner={modalSinner}
      identities={modalIdentities}
      selectedIdentityId={modalSinnerId ? deckSlots[modalSinnerId]?.id ?? null : null}
      selectedUptie={modalSinnerId ? upties[modalSinnerId] ?? 4 : 4}
      suggestions={suggestion?.items}
      archetype={suggestion?.archetype}
      suggestionsLoading={suggestionLoading}
      partnerIdentity={id => identityById.get(id)}
      onClose={() => setModalSinnerId(null)}
      onSelect={(identity, uptie) => {
        onIdentitySelect(identity as Identity, uptie)
        setModalSinnerId(null)
      }}
      getSinnerName={sinner => getDeckBuilderSinnerName(sinner as Sinner, locale)}
    />
    </>
  )
}

/* ── 탭 2: 에고 편성 ─────────────────────────────────── */
export function EgoTab({
  sinners, egos, egoSlots, identityIds, identities, lang, onEgoSelect, onEgoDeselect,
}: {
  sinners: Sinner[]
  egos: EGO[]
  identities: Identity[]
  /** sinnerId → the identity picked for that sinner (its E.G.O suggestions follow it). */
  identityIds: Record<string, string | undefined>
  egoSlots: Record<string, Record<string, EGO>>
  lang: SupportedLang
  onEgoSelect: (ego: EGO) => void
  onEgoDeselect: (sinnerId: string, grade: string) => void
}) {
  const [modalSinnerId, setModalSinnerId] = useState<string | null>(null)
  const modalSinner = modalSinnerId ? sinners.find(s => s.id === modalSinnerId) ?? null : null
  const modalIdentityId = modalSinnerId ? identityIds[modalSinnerId] : undefined
  const { data: suggestion, loading: suggestionLoading } = useSuggestionState<SuggestionResponse>(modalIdentityId ? `/api/discovery/suggest?type=ego&identity=${modalIdentityId}` : null)
  const identityById = useMemo(() => new Map(identities.map(identity => [identity.id, identity])), [identities])
  const modalEgos = modalSinnerId
    ? egos
        .filter(e => e.sinner_id === modalSinnerId)
    : []
  const boardSlots = sinners.reduce<Record<string, PlannerEgoBoardSlot>>((acc, sinner) => {
    acc[sinner.id] = {
      sinnerId: sinner.id,
      enabled: true,
      egosByGrade: egoSlots[sinner.id] ?? {},
    }
    return acc
  }, {})
  const selectedByGrade: Record<string, PlannerDeckEgo | undefined> = modalSinnerId ? (egoSlots[modalSinnerId] ?? {}) : {}

  return (
    <>
    <PlannerEgoBoard
      sinners={sinners}
      slots={boardSlots}
      onOpenEgoModal={setModalSinnerId}
      getSinnerName={sinner => getDeckBuilderSinnerName(sinner as Sinner, lang)}
    />

    {/* ── 에고 선택 모달 (수감자별, 전 등급 동시 표시) ── */}
    <PlannerEgoSelectModal
      open={!!(modalSinnerId && modalSinner)}
      sinner={modalSinner}
      egos={modalEgos}
      selectedEgosByGrade={selectedByGrade}
      suggestions={suggestion?.items}
      archetype={suggestion?.archetype}
      suggestionsLoading={suggestionLoading}
      partnerIdentity={id => identityById.get(id)}
      onClose={() => setModalSinnerId(null)}
      onSelect={ego => onEgoSelect(ego as EGO)}
      onDeselect={grade => {
        if (modalSinnerId) onEgoDeselect(modalSinnerId, grade)
      }}
      getSinnerName={sinner => getDeckBuilderSinnerName(sinner as Sinner, lang)}
    />
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
        const isBattle = position <= DEPLOYED_SLOT_COUNT
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
  const locale = useLocale() as SupportedLang
  return (
    <div className="skill-exchange-list">
      {sinners.map(sinner => {
        const identity = deckSlots[sinner.id]
        if (!identity) return null

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
            <SkillExchangePanel
              key={sinner.id}
              identity={{
                imageUrl: getIdentityInfoUrl(identity),
                name: localizeIdentityName(identity, locale),
                sinnerName: getDeckBuilderSinnerName(sinner, locale),
              }}
              distribution={dist}
              skills={[
                skills[0] ? {
                  name: skills[0].name,
                  iconSrc: identity.game_id ? getSkillIconUrl(identity, skills[0].skill_order, skills[0]) : null,
                  sinColor: SIN_COLORS[skills[0].sin_affinity] ?? '#888',
                } : null,
                skills[1] ? {
                  name: skills[1].name,
                  iconSrc: identity.game_id ? getSkillIconUrl(identity, skills[1].skill_order, skills[1]) : null,
                  sinColor: SIN_COLORS[skills[1].sin_affinity] ?? '#888',
                } : null,
                skills[2] ? {
                  name: skills[2].name,
                  iconSrc: identity.game_id ? getSkillIconUrl(identity, skills[2].skill_order, skills[2]) : null,
                  sinColor: SIN_COLORS[skills[2].sin_affinity] ?? '#888',
                } : null,
              ]}
              onAdjust={handleChange}
              onPresetSelect={preset => onDistributionChange(sinner.id, preset)}
            />
        )
      })}
    </div>
  )
}
