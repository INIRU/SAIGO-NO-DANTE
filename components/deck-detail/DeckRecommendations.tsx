'use client'

import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

export type DeckRecommendationSummary = DeckSummary & {
  reason?: string
}

export type DeckRecommendationsData = {
  otherOpinions: DeckRecommendationSummary[]
  similarDecks: DeckRecommendationSummary[]
}

/** A titled row of post cards (decks and plans share it); `description` is optional and the heading stands alone without it. */
export function RecommendationLane({ id, title, description, count, children }: {
  id: string
  title: string
  description?: string
  count: number
  children: ReactNode
}) {
  const t = useTranslations('decks.recommendations')
  if (count === 0) return null

  return (
    <section aria-labelledby={`${id}-recommendations-title`} className="min-w-0">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3
            id={`${id}-recommendations-title`}
            className="font-[family-name:var(--font-heading)] text-[1.0625rem] leading-snug text-[var(--text-primary)]"
          >
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-[0.875rem] leading-snug text-[#9c8b73]">
              {description}
            </p>
          )}
        </div>
        <span className="text-[0.875rem] tabular-nums text-[#9c8b73]">
          {t('count', { count })}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  )
}

export default function DeckRecommendations({
  recommendations,
  currentDeckId,
}: {
  recommendations?: DeckRecommendationsData | null
  currentDeckId: string
}) {
  const t = useTranslations('decks.recommendations')
  const otherOpinions = (recommendations?.otherOpinions ?? [])
    .filter(deck => deck.id !== currentDeckId)
    .slice(0, 3)
  const otherIds = new Set(otherOpinions.map(deck => deck.id))
  const similarDecks = (recommendations?.similarDecks ?? [])
    .filter(deck => deck.id !== currentDeckId && !otherIds.has(deck.id))
    .slice(0, 3)

  if (!recommendations) return null

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <RecommendationLane
        id="other-opinions"
        title={t('otherOpinions')}
        description={t('otherOpinionsDescription')}
        count={otherOpinions.length}
      >
        {otherOpinions.map(deck => <div key={deck.id} className="min-w-0"><DeckCard deck={deck} /></div>)}
      </RecommendationLane>
      <RecommendationLane
        id="similar-decks"
        title={t('similarDecks')}
        description={t('similarDecksDescription')}
        count={similarDecks.length}
      >
        {similarDecks.map(deck => <div key={deck.id} className="min-w-0"><DeckCard deck={deck} /></div>)}
      </RecommendationLane>
    </div>
  )
}
