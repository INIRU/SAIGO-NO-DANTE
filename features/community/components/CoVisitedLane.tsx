import { getTranslations } from 'next-intl/server'
import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'
import PlanCard, { type PlanSummary } from '@/components/planner/PlanCard'
import { RecommendationLane } from '@/components/deck-detail/DeckRecommendations'
import { getCoVisited } from '@/features/community/server/co-visited'
import type { DiscoveryKind } from '@/features/community/lib/recommend'
import type { SupportedLang } from '@/lib/i18n/types'

/** "함께 본 글" on a deck or plan page. Draws nothing when the read fails or there is nothing to show; stream it inside a Suspense. */
export default async function CoVisitedLane({ kind, id, lang, exclude }: { kind: DiscoveryKind; id: string; lang: SupportedLang; exclude: string[] }) {
  const posts = await getCoVisited(kind, id, exclude).catch(error => {
    console.error('Failed to fetch co-visited posts:', error)
    return []
  })
  if (!posts.length) return null
  const t = await getTranslations({ locale: lang, namespace: 'decks.recommendations' })
  return (
    <RecommendationLane id="co-visited" title={t('coVisited')} count={posts.length}>
      {posts.map(post => (
        <div key={post.id} className="min-w-0">
          {kind === 'deck' ? <DeckCard deck={post as unknown as DeckSummary} /> : <PlanCard plan={post as unknown as PlanSummary} />}
        </div>
      ))}
    </RecommendationLane>
  )
}
