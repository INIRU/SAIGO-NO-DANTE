'use client'

import { KeyboardEvent, memo, useCallback, useState } from 'react'
import { useLocale } from 'next-intl'
import IdentityCard from '@/components/sinners/IdentityCard'
import type { Tier } from '@/lib/tier-list/tierModel'
import type { Identity } from '@/lib/types'
import { TierRatingModal, type RatingPeriod, type TierCategory, type TierRatingViewer } from './TierRatingModal'

type SupportedLocale = 'ko' | 'en' | 'ja'

const DIAGNOSIS_SELECTED_LABELS: Record<SupportedLocale, string> = {
  ko: '보유',
  en: 'Owned',
  ja: '所持',
}

function normalizeLocale(locale: string): SupportedLocale {
  return locale === 'en' || locale === 'ja' ? locale : 'ko'
}

export type TierIdentity = Identity & {
  sinner?: {
    id: string
    name: string
    name_kr: string
    name_en?: string | null
    name_jp?: string | null
    order_num?: number | null
  } | null
  tier_rating_summary?: {
    averageScore: number | null
    ratingCount: number
    derivedTier: Tier
    distribution?: Record<number, number>
    sourceCategories?: Array<'reroll' | 'mirror_dungeon' | 'goodstuff'>
  }
}

function TierCardInteractive({
  identity,
  category,
  period,
  viewer,
  diagnosisMode = false,
  diagnosisSelected = false,
  onToggleDiagnosis,
}: {
  identity: TierIdentity
  category: TierCategory
  period: RatingPeriod
  viewer: TierRatingViewer
  diagnosisMode?: boolean
  diagnosisSelected?: boolean
  onToggleDiagnosis?: (identityId: string) => void
}) {
  const locale = normalizeLocale(useLocale())
  const [modalOpen, setModalOpen] = useState(false)
  const selectedLabel = DIAGNOSIS_SELECTED_LABELS[locale]

  const closeModal = useCallback(() => {
    setModalOpen(false)
  }, [])
  const toggleDiagnosis = useCallback(() => {
    onToggleDiagnosis?.(identity.id)
  }, [identity.id, onToggleDiagnosis])
  const activateCard = useCallback(() => {
    if (diagnosisMode && onToggleDiagnosis) {
      toggleDiagnosis()
      return
    }
    setModalOpen(true)
  }, [diagnosisMode, onToggleDiagnosis, toggleDiagnosis])
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activateCard()
    }
  }, [activateCard])

  return (
    <>
    <div
      role="button"
      tabIndex={0}
      onClick={activateCard}
      onKeyDown={handleKeyDown}
      aria-pressed={diagnosisMode ? diagnosisSelected : undefined}
      aria-label={diagnosisMode ? `${identity.name_kr} 자가진단 ${diagnosisSelected ? '선택 해제' : '선택'}` : `${identity.name_kr} 평가 열기`}
      data-identity-id={identity.id}
      data-diagnosis-mode={diagnosisMode ? 'true' : undefined}
      style={{
        position: 'relative',
        cursor: 'pointer',
        overflow: 'visible',
        padding: '0.25rem',
        outline: 'none',
      }}
      className="tier-identity-cell rounded-md focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
    >
      <div
        className="tier-identity-card-shell"
        style={{
          filter: diagnosisMode && diagnosisSelected ? 'brightness(1.08) saturate(1.06)' : 'none',
        }}
      >
        <IdentityCard identity={identity} compact />
        {diagnosisMode && diagnosisSelected && (
          <span className="tier-diagnosis-selected-overlay" aria-hidden="true">
            <span className="tier-diagnosis-selected-label">
              {selectedLabel}
            </span>
          </span>
        )}
      </div>
    </div>
    {modalOpen && (
      <TierRatingModal
        identity={identity}
        category={category}
        period={period}
        initialViewer={viewer}
        open={modalOpen}
        onClose={closeModal}
      />
    )}
    </>
  )
}

export default memo(TierCardInteractive)
