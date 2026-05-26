'use client'

import { useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'
import {
  Sinner,
  Identity,
  EGO,
  Skill,
  getSinnerLogoUrl,
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
  const locale = useLocale() as SupportedLang
  const { getIconUrl, keywords: keywordInfo } = useKeywordData()
  const reduceMotion = useReducedMotion()
  const modalSinner = modalSinnerId ? sinners.find(s => s.id === modalSinnerId) ?? null : null
  const modalIdentities = modalSinnerId
    ? identities
        .filter(i => i.sinner_id === modalSinnerId)
        .sort((a, b) => b.rarity - a.rarity)
    : []
  const openIdentityModal = (sinnerId: string) => setModalSinnerId(sinnerId)
  const boardSlots = sinners.reduce<Record<string, PlannerIdentityBoardSlot>>((acc, sinner) => {
    const identity = deckSlots[sinner.id] ?? null
    const isGacksung = gacksungSlots[sinner.id] ?? false
    const formIdx = formationOrder.indexOf(sinner.id)
    const isFormed = formIdx >= 0
    acc[sinner.id] = {
      sinnerId: sinner.id,
      identity,
      slotOrder: identity && isFormed ? formIdx : null,
      gacksung: isGacksung,
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
      onGacksungToggle={onGacksungToggle}
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
          <motion.button
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
          </motion.button>
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
      @media (max-width: 639px) {
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
    `}</style>

    {/* ── 인격 선택 모달 (플래너 패턴) ── */}
    <PlannerIdentitySelectModal
      open={!!(modalSinnerId && modalSinner)}
      sinner={modalSinner}
      identities={modalIdentities}
      selectedIdentityId={modalSinnerId ? deckSlots[modalSinnerId]?.id ?? null : null}
      onClose={() => setModalSinnerId(null)}
      onSelect={identity => {
        onIdentitySelect(identity as Identity)
        setModalSinnerId(null)
      }}
      onDeselect={modalSinnerId && deckSlots[modalSinnerId] ? () => {
        onIdentityDeselect(modalSinnerId)
        setModalSinnerId(null)
      } : undefined}
      getSinnerName={sinner => getDeckBuilderSinnerName(sinner as Sinner, locale)}
    />
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
  const modalSinner = modalSinnerId ? sinners.find(s => s.id === modalSinnerId) ?? null : null
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
