'use client'

import useSWR from 'swr'
import { ArrowUpRight } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import DeckCard, { type DeckSummary } from '@/components/decks/DeckCard'
import PlanCard, { type PlanSummary } from '@/components/planner/PlanCard'
import { CardSkeleton } from '@/components/discovery/BoardSkeleton'
import { SkeletonLine } from '@/components/ui/Skeleton'
import { pickShelf, type DiscoveryFeed } from '@/lib/discovery/shelf'
import styles from './HomeStaticSections.module.css'

const CARD_SLOT = ['', '', styles.third]

export type ShelfCopy = { popular: string; recent: string; link: string }

async function fetchFeed<T>(url: string): Promise<DiscoveryFeed<T>> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`discovery ${response.status}`)
  return response.json()
}

function Shelf<T extends { id: string | number }>({ kind, id, href, copy, card }: {
  kind: 'deck' | 'planner'; id: string; href: string; copy: ShelfCopy; card: (post: T) => React.ReactNode
}) {
  // Same request as the board's discovery shelf, so the CDN copy and the SWR cache are shared.
  const { data, error } = useSWR(`/api/discovery?kind=${kind}&days=7`, fetchFeed<T>)
  const shelf = data && pickShelf(data, kind)
  if (error || shelf?.posts.length === 0) return null
  const headingId = `home-${id}-heading`
  // The section is there from the first render, so the scroll reveal (ScrollAnimations) still observes it.
  return (
    <section className={styles.section} data-home-reveal aria-labelledby={shelf ? headingId : undefined} aria-busy={!shelf || undefined}>
      <div className={styles.heading}>
        {shelf ? <h2 id={headingId}>{shelf.popular ? copy.popular : copy.recent}</h2> : <SkeletonLine w="10rem" h="1.5rem" />}
        <Link className={styles.textLink} href={href}>{copy.link} <ArrowUpRight size={16} aria-hidden /></Link>
      </div>
      <div className={styles.posts}>
        {CARD_SLOT.map((slot, i) => {
          const post = shelf?.posts[i]
          if (shelf && !post) return null
          return <div key={post ? String(post.id) : i} className={`min-w-0 ${slot}`}>{post ? card(post) : <CardSkeleton kind={kind} />}</div>
        })}
      </div>
    </section>
  )
}

/**
 * The home page's community shelves, loaded in the browser from /api/discovery (a minute on the CDN). Rendered into the
 * static home page they made it regenerate every minute and after every vote, comment and post (ISR writes).
 */
export default function HomeCommunity({ plans, decks }: { plans: ShelfCopy; decks: ShelfCopy }) {
  return (
    <>
      <Shelf<PlanSummary> kind="planner" id="plans" href="/planner/community" copy={plans} card={plan => <PlanCard plan={plan} />} />
      <Shelf<DeckSummary> kind="deck" id="decks" href="/decks" copy={decks} card={deck => <DeckCard deck={deck} />} />
    </>
  )
}
