'use client'

import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'
import { useTranslations } from 'next-intl'

export type DeckRecommendationSummary = DeckSummary & {
  reason?: string
}

export type DeckRecommendationsData = {
  otherOpinions: DeckRecommendationSummary[]
  similarDecks: DeckRecommendationSummary[]
}

type RecommendationLaneProps = {
  id: string
  title: string
  description: string
  decks: DeckRecommendationSummary[]
  emptyLabel?: string
}

function RecommendationLane({ id, title, description, decks, emptyLabel }: RecommendationLaneProps) {
  const t = useTranslations('decks.recommendations')
  if (decks.length === 0 && !emptyLabel) return null

  return (
    <section aria-labelledby={`${id}-recommendations-title`} className="min-w-0">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2
            id={`${id}-recommendations-title`}
            className="font-serif leading-tight"
            style={{ color: 'var(--text-primary)', fontSize: '1rem' }}
          >
            {title}
          </h2>
          <p
            className="mt-1"
            style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', lineHeight: 1.55 }}
          >
            {description}
          </p>
        </div>
        {decks.length > 0 && (
          <span
            className="font-mono"
            style={{ color: 'var(--gold-dim)', fontSize: '0.875rem', opacity: 0.7 }}
          >
            {t('count', { count: decks.length })}
          </span>
        )}
      </div>

      {decks.length > 0 ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {decks.map(deck => (
            <div key={deck.id} className="min-w-0">
              <DeckCard deck={deck} />
            </div>
          ))}
        </div>
      ) : (
        <p
          className="rounded px-3 py-2"
          style={{
            background: 'rgba(200,144,10,0.04)',
            border: '1px solid rgba(200,144,10,0.12)',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.875rem',
            lineHeight: 1.55,
          }}
        >
          {emptyLabel}
        </p>
      )}
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
    <div
      className="mb-5 flex min-w-0 flex-col gap-4"
      style={{ borderTop: '1px solid rgba(200,144,10,0.14)', paddingTop: '1rem' }}
    >
      <RecommendationLane
        id="other-opinions"
        title={t('otherOpinions')}
        description={t('otherOpinionsDescription')}
        decks={otherOpinions}
      />
      <RecommendationLane
        id="similar-decks"
        title={t('similarDecks')}
        description={t('similarDecksDescription')}
        decks={similarDecks}
      />
    </div>
  )
}
