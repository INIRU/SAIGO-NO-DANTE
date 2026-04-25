'use client'

import { KeyboardEvent, useState } from 'react'
import IdentityCard from '@/components/sinners/IdentityCard'
import type { Identity } from '@/lib/types'
import { TierRatingModal, type RatingPeriod, type TierCategory, type TierRatingViewer } from './TierRatingModal'

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
    derivedTier: 'S+' | 'S' | 'A' | 'B' | 'C' | 'N/A'
    distribution?: Record<number, number>
    sourceCategories?: Array<'reroll' | 'mirror_dungeon' | 'goodstuff'>
  }
}

export default function TierCardInteractive({
  identity,
  category,
  period,
  viewer,
}: {
  identity: TierIdentity
  category: TierCategory
  period: RatingPeriod
  viewer: TierRatingViewer
}) {
  const [modalOpen, setModalOpen] = useState(false)

  const openModal = () => setModalOpen(true)
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openModal()
    }
  }

  return (
    <>
    <div
      role="button"
      tabIndex={0}
      onClick={openModal}
      onKeyDown={handleKeyDown}
      aria-label={`${identity.name_kr} 평가 열기`}
      data-identity-id={identity.id}
      style={{
        position: 'relative',
        cursor: 'pointer',
        overflow: 'visible',
        padding: '0.25rem',
        outline: 'none',
      }}
      className="tier-identity-cell group rounded-md focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
    >
      <IdentityCard identity={identity} compact />
    </div>
    <TierRatingModal
      identity={identity}
      category={category}
      period={period}
      initialViewer={viewer}
      open={modalOpen}
      onClose={() => setModalOpen(false)}
    />
    </>
  )
}
