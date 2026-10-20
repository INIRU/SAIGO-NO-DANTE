'use client'

import { useMemo, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import { Portrait } from '@/components/ui/FormationThumbnail'
import { formationThumbnail } from '@/lib/decks/formation-thumbnail'
import type { DiscoveryKind } from '@/lib/discovery/recommend'
import type { SupportedLang } from '@/lib/i18n/types'
import { AuthorLine, PostChips, PostCounts, postSlots, type RowPost } from './parts'

export const postHref = (kind: DiscoveryKind, id: string) => (kind === 'deck' ? `/decks/${id}` : `/planner/community/${id}`)

/** The first six active portraits as a 3×2 mosaic: tiles of 34px on a phone, 43px wide, 2px apart, only the outer corners rounded. */
export function FormationMosaic({ kind, post }: { kind: DiscoveryKind; post: RowPost }) {
  const tiles = useMemo(() => {
    const all = formationThumbnail(postSlots(kind, post) as never)
    const formed = all.some(slot => slot.order !== null)
    return all.slice(0, 6).map(slot => ({ slot, dim: formed && slot.order === null }))
  }, [kind, post])
  return (
    <span aria-hidden="true" className="grid w-[6.5rem] shrink-0 grid-cols-3 gap-[2px] overflow-hidden rounded-md bg-[var(--bg-deep)] md:w-[8.25rem]">
      {tiles.map(({ slot, dim }) => <Portrait key={slot.sinnerId} slot={{ ...slot, order: null }} dim={dim} locked={false} ratio="1 / 1" sizes="9rem" />)}
    </span>
  )
}

/** "10.19" of a timestamp in Korea time (the game's update clock). */
export const monthDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(5, 10).replace('-', '.')

/**
 * One post as a compact row: mosaic, title, one line of tags, author and counts. The whole row is the link (at least 56px tall).
 * `lead` is the edit date.
 */
export default function FormationRow({ kind, post, lead, tags = true }: {
  kind: DiscoveryKind
  post: RowPost
  lead?: ReactNode
  tags?: boolean
}) {
  const locale = useLocale() as SupportedLang
  const anonymous = useTranslations('planner.communityBoard.card')('anonymous')
  return (
    <Link href={postHref(kind, post.id)} prefetch={false}
      className="group flex min-h-[5.25rem] items-center gap-3 px-4 py-3 transition-[background-color,transform] duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] active:bg-white/[0.06] focus-visible:bg-white/[0.04] focus-visible:outline-none motion-reduce:transition-none motion-reduce:active:scale-100 [@media(hover:hover)]:hover:bg-white/[0.035] md:px-3">
      {lead}
      <FormationMosaic kind={kind} post={post} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 font-[family-name:var(--font-heading)] text-[0.9375rem] leading-snug text-[var(--text-primary)]">{post.title}</span>
        {tags && <PostChips kind={kind} post={post} max={3} nowrap className="mt-1.5" />}
        <span className="mt-1 flex min-w-0 items-center gap-2.5">
          <AuthorLine kind={kind} post={post} locale={locale} anonymous={anonymous} />
          <PostCounts post={post} className="ml-auto" />
        </span>
      </span>
    </Link>
  )
}

/** The rank of a post in a real sequence: Bebas numeral, gold for the first three. */
export function RankNumeral({ rank }: { rank: number }) {
  return <span className={`w-7 shrink-0 text-center font-[family-name:var(--font-title)] text-[1.5rem] leading-none tabular-nums ${rank <= 3 ? 'text-[var(--gold)]' : 'text-[var(--text-tertiary)]'}`}>{rank}</span>
}

/** The edit date, first in a row of the recently edited list. */
export function DateLead({ iso }: { iso: string }) {
  return <span className="w-[3.25rem] shrink-0 font-[family-name:var(--font-title)] text-[1.25rem] leading-none tabular-nums text-[var(--text-secondary)]">{monthDay(iso)}</span>
}
