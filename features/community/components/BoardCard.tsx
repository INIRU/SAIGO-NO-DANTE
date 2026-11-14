'use client'

import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import IntentLink from '@/components/ui/IntentLink'
import { useMemo } from 'react'
import { Portrait } from '@/components/cards/FormationThumbnail'
import RelativeTime from '@/components/ui/RelativeTime'
import { formationThumbnail } from '@/lib/decks/formation-thumbnail'
import type { DiscoveryKind } from '@/features/community/lib/recommend'
import type { SupportedLang } from '@/lib/i18n/types'
import { AuthorLine, PostChips, PostCounts, PostSummary, postSlots, type RowPost } from './BoardParts'
import { postHref } from './FormationRow'

/** The rank of a post as a gold plate with a cut corner (first three) or a dark one. */
export function RankPlate({ rank }: { rank: number }) {
  return (
    <span className={`grid h-6 min-w-[1.875rem] shrink-0 place-items-center px-2 font-[family-name:var(--font-title)] text-[1.125rem] leading-none tabular-nums ${rank <= 3 ? 'bg-[var(--gold)] text-[var(--bg-deep)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}
      style={{ clipPath: 'polygon(0 0, 100% 0, 100% 58%, calc(100% - 0.4375rem) 100%, 0 100%)' }}>
      {rank}
    </span>
  )
}

/**
 * A board card of equal height: the 6×2 formation, a one-line title, the memo's first line and the tag line, and a footer with the lead
 * (rank plate or rise), the author with how long ago the post went up, and the counts. Nothing sits on the portraits.
 */
export default function BoardCard({ kind, post, lead, compactOnPhone = false }: { kind: DiscoveryKind; post: RowPost; lead?: ReactNode; /** One row of six portraits on a phone (the list view), the full 6×2 from md up. */ compactOnPhone?: boolean }) {
  const locale = useLocale() as SupportedLang
  const anonymous = useTranslations('planner.communityBoard.card')('anonymous')
  const tiles = useMemo(() => {
    const all = formationThumbnail(postSlots(kind, post) as never)
    const formed = all.some(slot => slot.order !== null)
    return all.map(slot => ({ slot, dim: formed && slot.order === null }))
  }, [kind, post])
  return (
    <article className="board-card group relative flex flex-col overflow-hidden transition-transform duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100">
      <IntentLink href={postHref(kind, post.id)} aria-label={post.title} className="absolute inset-0 z-[1] focus-visible:outline-none" />
      <div className="grid grid-cols-6 gap-px border-b border-[#2e2417] bg-[#17120c]">
        {tiles.map(({ slot, dim }, index) => (
          <div key={slot.sinnerId} className={compactOnPhone && index >= 6 ? 'max-md:hidden' : undefined}>
            <Portrait slot={{ ...slot, order: slot.order }} dim={dim} locked={false} sizes="(max-width: 768px) 17vw, 8vw" />
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 pb-2 pt-2.5">
        <h3 className="line-clamp-1 font-[family-name:var(--font-heading)] text-[1rem] leading-snug text-[var(--text-primary)]">{post.title}</h3>
        <PostSummary post={post} />
        <PostChips kind={kind} post={post} max={3} nowrap className="min-h-6" />
      </div>
      <div className="flex h-11 items-center gap-2.5 border-t border-[#2e2417] px-3">
        {lead}
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <AuthorLine kind={kind} post={post} locale={locale} anonymous={anonymous} />
          {typeof post.created_at === 'string' && <RelativeTime date={post.created_at} className="shrink-0 text-[0.75rem] text-[var(--text-muted)]" />}
        </span>
        <PostCounts post={post} />
      </div>
    </article>
  )
}
