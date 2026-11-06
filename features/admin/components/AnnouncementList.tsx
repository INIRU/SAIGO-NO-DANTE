import type { CSSProperties } from 'react'
import { ArrowRight, Megaphone, Pin } from 'lucide-react'
import Link from 'next/link'
import QuietImage from '@/components/ui/QuietImage'
import { announcementDate, type AnnouncementPreview } from '@/lib/announcements'
import './announcements.css'

/** Date and pin mark of an announcement. */
export function AnnouncementMeta({ item, pinnedLabel }: { item: Pick<AnnouncementPreview, 'created_at' | 'pinned'>; pinnedLabel: string }) {
  return (
    <p className="flex items-center gap-2.5">
      <time dateTime={item.created_at} className="font-[family-name:var(--font-title)] text-[1rem] leading-none tracking-[0.04em] text-[var(--text-tertiary)]">{announcementDate(item.created_at)}</time>
      {item.pinned && <span className="inline-flex items-center gap-1 text-[var(--text-xs)] font-semibold text-[var(--gold)]"><Pin size={12} aria-hidden="true" />{pinnedLabel}</span>}
    </p>
  )
}

const rise = (index: number) => ({ '--i': index }) as CSSProperties

export type AnnouncementListLabels = { pinned: string; readMore: string; empty: string }

/**
 * The newest (pinned first) announcement large with its cover, the rest as rows; each opens its own page.
 * Labels and the locale come from the cached page: translations and locale-aware links read inside `use cache` must
 * not touch the request.
 */
export default function AnnouncementList({ lang, items, labels }: { lang: string; items: AnnouncementPreview[]; labels: AnnouncementListLabels }) {
  if (!items.length) return (
    <div className="flex flex-col items-center gap-4 py-20 text-[var(--text-tertiary)]">
      <Megaphone size={28} aria-hidden="true" />
      <p>{labels.empty}</p>
    </div>
  )
  const [first, ...rest] = items
  return (
    <div>
      <Link href={`/${lang}/announcements/${first.id}`} style={rise(0)}
        className="announcement-rise group grid gap-6 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)] md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-center md:gap-10">
        {first.cover && (
          <div className="announcement-cover relative aspect-[16/9] overflow-hidden rounded-xl border border-white/[0.06] bg-[var(--bg-card)]">
            <QuietImage src={first.cover} alt="" fill priority sizes="(min-width: 768px) 34rem, 100vw" className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.03] motion-reduce:transition-none" />
          </div>
        )}
        <div className="min-w-0">
          <AnnouncementMeta item={first} pinnedLabel={labels.pinned} />
          <h2 className="mt-3 text-balance break-keep font-[family-name:var(--font-heading)] text-[1.5rem] leading-snug tracking-[-0.02em] text-[var(--text-primary)] transition-colors group-hover:text-[var(--gold-light)] sm:text-[1.75rem]">{first.title}</h2>
          {first.excerpt && <p className="mt-3 line-clamp-3 text-[0.9375rem] leading-7 text-[var(--text-secondary)]">{first.excerpt}</p>}
          <span className="mt-5 inline-flex items-center gap-1.5 text-[var(--text-sm)] font-semibold text-[var(--gold-light)]">
            {labels.readMore}<ArrowRight size={15} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>

      {rest.length > 0 && (
        <ol className="mt-12 border-t border-[var(--border)]">
          {rest.map((item, index) => (
            <li key={item.id} className="announcement-rise" style={rise(index + 1)}>
              <Link href={`/${lang}/announcements/${item.id}`}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5 border-b border-white/[0.06] py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] sm:gap-8">
                <div className="min-w-0">
                  <AnnouncementMeta item={item} pinnedLabel={labels.pinned} />
                  <h3 className="mt-2 line-clamp-2 break-keep font-[family-name:var(--font-heading)] text-[1.0625rem] leading-snug text-[var(--text-primary)] transition-colors group-hover:text-[var(--gold-light)]">{item.title}</h3>
                  {item.excerpt && <p className="mt-1.5 truncate text-[var(--text-sm)] text-[var(--text-tertiary)]">{item.excerpt}</p>}
                </div>
                {item.cover && (
                  <div className="announcement-cover relative aspect-[16/9] w-24 overflow-hidden rounded-lg border border-white/[0.06] bg-[var(--bg-card)] sm:w-40">
                    <QuietImage src={item.cover} alt="" fill sizes="10rem" className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.04] motion-reduce:transition-none" />
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
