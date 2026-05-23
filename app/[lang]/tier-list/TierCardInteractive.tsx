'use client'

import { KeyboardEvent, memo, useCallback } from 'react'
import { useLocale } from 'next-intl'
import IdentityCard from '@/components/sinners/IdentityCard'
import type { Tier } from '@/lib/tier-list/tierModel'
import type { Identity } from '@/lib/types'

type SupportedLocale = 'ko' | 'en' | 'ja'

const DIAGNOSIS_SELECTED_LABELS: Record<SupportedLocale, string> = {
  ko: '보유',
  en: 'Owned',
  ja: '所持',
}

const DIAGNOSIS_ACTION_LABELS: Record<SupportedLocale, { select: string; deselect: string }> = {
  ko: { select: '자가진단 선택', deselect: '자가진단 선택 해제' },
  en: { select: 'Select for diagnosis', deselect: 'Deselect from diagnosis' },
  ja: { select: '診断に選択', deselect: '診断から解除' },
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
  diagnosisMode = false,
  diagnosisSelected = false,
  onToggleDiagnosis,
}: {
  identity: TierIdentity
  diagnosisMode?: boolean
  diagnosisSelected?: boolean
  onToggleDiagnosis?: (identityId: string) => void
}) {
  const locale = normalizeLocale(useLocale())
  const selectedLabel = DIAGNOSIS_SELECTED_LABELS[locale]
  const interactive = diagnosisMode && Boolean(onToggleDiagnosis)

  const toggleDiagnosis = useCallback(() => {
    onToggleDiagnosis?.(identity.id)
  }, [identity.id, onToggleDiagnosis])
  const activateCard = useCallback(() => {
    if (interactive) {
      toggleDiagnosis()
    }
  }, [interactive, toggleDiagnosis])
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (!interactive) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activateCard()
    }
  }, [activateCard, interactive])

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? activateCard : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      aria-pressed={interactive ? diagnosisSelected : undefined}
      aria-label={interactive ? `${identity.name_kr} ${diagnosisSelected ? DIAGNOSIS_ACTION_LABELS[locale].deselect : DIAGNOSIS_ACTION_LABELS[locale].select}` : undefined}
      data-identity-id={identity.id}
      data-diagnosis-mode={interactive ? 'true' : undefined}
      style={{
        position: 'relative',
        cursor: interactive ? 'pointer' : 'default',
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
  )
}

export default memo(TierCardInteractive)
