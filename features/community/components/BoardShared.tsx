'use client'

import { useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/lib/i18n/navigation'
import IdentityFrameCard from '@/components/cards/IdentityFrameCard'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { DiscoveryKind } from '@/features/community/lib/recommend'
import type { SupportedLang } from '@/lib/i18n/types'
import type { Period } from '@/features/community/components/ShelfParts'
import FormationRow, { DateLead } from './FormationRow'
import type { RowPost } from './BoardParts'

type Identity = { id: string; sinner_id: string; name_kr: string; name_en?: string | null; name_jp?: string | null; rarity: number; folder_name: string | null; game_id: string | null }
export type BoardData = { recent: RowPost[]; updated: RowPost[]; popular: RowPost[]; identities: Identity[] }
export type { Period }

/** The shelves of one board and period, with the server-rendered first page as the start value. */
export function useBoardData(kind: DiscoveryKind, days: Period, initialData?: BoardData) {
  return useSWR<BoardData>(`/api/discovery?kind=${kind}&period=${days}`, { keepPreviousData: true, fallbackData: days === 'week' ? initialData : undefined })
}

export const baseOf = (kind: DiscoveryKind) => (kind === 'deck' ? '/decks' : '/planner/community')

/** A shelf title as on the current site (gold, Paperlogy), with an optional action at the right. */
export function SectionHead({ id, title, children, action }: { id?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 id={id} className="min-w-0 font-[family-name:var(--font-paperlogy)] text-lg font-bold leading-snug tracking-[-0.02em] text-[var(--gold)]">{title}</h2>
      {children}
      {action && <span className="ml-auto">{action}</span>}
    </div>
  )
}

export function TextAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-11 items-center gap-1 px-1 text-[0.9375rem] font-semibold text-[var(--gold-light)] transition-colors hover:text-[var(--text-primary)] active:opacity-70">
      {children}
    </button>
  )
}

/** A horizontal scroll-snap rail on phones (next card peeking), a grid from md up. */
export function Rail({ children, columns = 3 }: { children: ReactNode[]; columns?: 2 | 3 }) {
  return (
    <div className={`-mx-4 flex snap-x snap-mandatory scroll-px-4 items-stretch gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:gap-4 md:overflow-visible md:px-0 md:pb-0 ${columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
      {children.map((child, index) => (
        <div key={index} className="w-[78vw] max-w-[21rem] shrink-0 snap-start md:w-auto md:max-w-none md:min-w-0 [&>article]:h-full">{child}</div>
      ))}
    </div>
  )
}

/**
 * The identity cards of a shelf in one row with a value under each (the rise, or the visit rank): a swipe rail on a phone,
 * from md up the whole row, the cards growing to fill the width. When few qualify the row simply ends.
 */
export function IdentityCards({ items, kind }: { items: { identity: Identity; trailing: ReactNode }[]; kind: DiscoveryKind }) {
  const lang = useLocale() as SupportedLang
  return (
    <ul className="-mx-4 -mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:gap-4 md:overflow-visible md:px-0">
      {items.map(({ identity, trailing }) => (
        <li key={identity.id} className="w-24 shrink-0 snap-start md:w-auto md:max-w-[9.5rem] md:min-w-0 md:flex-1">
          <Link href={`${baseOf(kind)}?browse=all&ids=${identity.id}`} className="group block active:scale-[0.97] motion-reduce:active:scale-100" style={{ transition: 'transform 150ms cubic-bezier(0.23,1,0.32,1)' }}>
            <IdentityFrameCard identity={identity} name={getLocalizedName(identity, lang)} sizes="9.5rem" />
            <span className="mt-1.5 flex justify-center">{trailing}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** The recently edited posts: edit date first, then the row. Three, or six when opened. */
export function UpdatedRows({ kind, posts }: { kind: DiscoveryKind; posts: RowPost[] }) {
  const t = useTranslations('discoveryShelf')
  const [open, setOpen] = useState(false)
  const shown = posts.slice(0, open ? 6 : 3)
  return (
    <>
      <ul className="-mx-4 divide-y divide-[#241c14] md:mx-0 lg:grid lg:grid-cols-3 lg:gap-x-4 lg:divide-y-0 [&>li]:min-w-0 [&>li]:lg:border-b [&>li]:lg:border-[#241c14]">
        {shown.map(post => <li key={post.id}><FormationRow kind={kind} post={post} tags={false} lead={<DateLead iso={post.updated_at ?? post.created_at} />} /></li>)}
      </ul>
      {posts.length > 3 && <TextAction onClick={() => setOpen(value => !value)}>{open ? t('less') : t('more')}</TextAction>}
    </>
  )
}
