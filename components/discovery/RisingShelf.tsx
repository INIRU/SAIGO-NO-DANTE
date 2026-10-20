'use client'

import useSWR from 'swr'
import { ChevronUp } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import IdentityFrameCard from '@/components/ui/IdentityFrameCard'
import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'
import PlanCard, { type PlanSummary } from '@/components/planner/PlanCard'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { RisingFeed } from '@/lib/discovery/rising-feed'

async function read(url: string): Promise<RisingFeed> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`rising ${response.status}`)
  return response.json()
}

/** The rise as a small up chevron and a Bebas multiplier. */
function Rise({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[var(--gold-light)] ${className}`}>
      <ChevronUp size={14} strokeWidth={3} aria-hidden="true" />
      <span className="font-[family-name:var(--font-title)] text-[1.25rem] leading-none tabular-nums">×{value >= 99 ? 99 : value.toFixed(1)}</span>
    </span>
  )
}

/**
 * "지금 뜨는" on a board: identities and posts whose visitors of the last 3 days rose against the 14 before.
 * Draws nothing while loading, when the read fails (the database function may not be there yet) or nobody rose.
 */
export default function RisingShelf({ kind }: { kind: 'deck' | 'planner' }) {
  const t = useTranslations('discoveryShelf')
  const lang = useLocale() as SupportedLang
  const { data } = useSWR(`/api/discovery/rising?kind=${kind}`, read, { revalidateOnFocus: false })
  const posts = (data?.posts ?? []).slice(0, 3), identities = (data?.identities ?? []).slice(0, 6)
  if (posts.length + identities.length < 2) return null

  return (
    <section data-shelf="rising" aria-labelledby="rising-title">
      <h2 id="rising-title" className="mb-4 font-[family-name:var(--font-paperlogy)] text-lg font-bold leading-snug tracking-[-0.02em] text-[var(--gold)]">
        {t('rising')}
      </h2>
      {identities.length > 0 && (
        <ul className="-mx-4 mb-5 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {identities.map(({ identity, rise }) => (
            <li key={identity.id} className="w-[6.25rem] shrink-0 snap-start sm:w-[7rem]">
              <Link href={`/sinners/${identity.sinner_id}/identities/${identity.id}`} className="group block">
                <span className="block transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                  <IdentityFrameCard identity={identity} name={getLocalizedName(identity, lang)} sizes="7rem" />
                </span>
                <Rise value={rise} className="mt-1.5 flex justify-center" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {posts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {posts.map(({ post, rise }) => (
            <div key={post.id} className="relative min-w-0">
              {kind === 'deck' ? <DeckCard deck={post as unknown as DeckSummary} /> : <PlanCard plan={post as unknown as PlanSummary} />}
              <Rise value={rise} className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-[rgba(13,11,8,0.82)] px-1.5 py-1" />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
