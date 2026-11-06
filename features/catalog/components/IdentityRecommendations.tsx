'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import IdentityFrameCard from '@/features/catalog/components/IdentityFrameCard'
import DeckCard, { type DeckSummary } from '@/features/decks/components/DeckCard'
import PlanCard, { type PlanSummary } from '@/features/planner/components/PlanCard'
import { RecommendationLane } from '@/features/decks/components/DeckRecommendations'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { IdentityCompanion, IdentityPost } from '@/features/community/server'

/** Identities fielded with this one, and the popular decks and plans that field it. Draws nothing when there are none. */
export default function IdentityRecommendations({ companions, posts }: { companions: IdentityCompanion[]; posts: IdentityPost[] }) {
  const t = useTranslations('identity.recommendations')
  const lang = useLocale() as SupportedLang
  if (companions.length === 0 && posts.length === 0) return null

  return (
    <div className="flex min-w-0 flex-col gap-8">
      {companions.length > 0 && (
        <section aria-labelledby="identity-companions-title" className="min-w-0">
          <h3 id="identity-companions-title" className="mb-3 font-[family-name:var(--font-heading)] text-[1.0625rem] leading-snug text-[var(--text-primary)]">
            {t('companions')}
          </h3>
          <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {companions.map(companion => (
              <li key={companion.id} className="w-[6.25rem] shrink-0 snap-start sm:w-[7rem]">
                <Link href={`/sinners/${companion.sinner_id}/identities/${companion.id}`} className="group block">
                  <span className="block transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                    <IdentityFrameCard identity={companion} name={getLocalizedName(companion, lang)} sizes="7rem" />
                  </span>
                  <span className="mt-1.5 flex items-baseline justify-center gap-1">
                    <span className="font-[family-name:var(--font-title)] text-[1.25rem] leading-none text-[var(--gold-light)] tabular-nums">{companion.count}</span>
                    <span className="text-[0.75rem] text-[var(--text-muted)]">{t('unit')}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <RecommendationLane id="identity-popular" title={t('popular')} count={posts.length}>
        {posts.map(({ kind, post }) => (
          <div key={`${kind}:${post.id}`} className="min-w-0">
            {kind === 'deck' ? <DeckCard deck={post as unknown as DeckSummary} /> : <PlanCard plan={post as unknown as PlanSummary} />}
          </div>
        ))}
      </RecommendationLane>
    </div>
  )
}
