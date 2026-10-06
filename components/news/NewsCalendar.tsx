'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Play, Trash2, X } from 'lucide-react'
import { useRouter } from '@/lib/i18n/navigation'
import PageHeader from '@/components/ui/PageHeader'
import BaseModal from '@/components/ui/BaseModal'
import QuietImage from '@/components/ui/QuietImage'
import LiteYoutube from '@/components/ui/LiteYoutube'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { showError, showSuccess } from '@/lib/toast'
import { groupByDay, monthGrid, pickContent, shiftMonth } from '@/lib/news/calendar'
import { NEWS_FEEDS, type NewsItem, type NewsLang, type NewsMedia, type NewsText } from '@/lib/news/payload'
import { FeedLogo, PlatformIcon } from './news-marks'
import styles from './NewsCalendar.module.css'

type Feed = (typeof NEWS_FEEDS)[number]
type T = ReturnType<typeof useTranslations<'calendar'>>

// Every time on the calendar is Korean time, whatever the viewer's zone.
const stamp = (lang: string, iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang, { timeZone: 'Asia/Seoul', hour12: false, ...options }).format(new Date(iso))
const clock = (lang: string, iso: string) => stamp(lang, iso, { hour: '2-digit', minute: '2-digit' })
// A calendar day or month is already a Korean date; formatting it as UTC keeps it from shifting.
const ofDay = (lang: string, day: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang, { timeZone: 'UTC', ...options }).format(new Date(`${day}T00:00:00Z`))

const digits = 'font-[family-name:var(--font-title)] tabular-nums leading-none tracking-wide'
const chip = (active: boolean) =>
  `inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${active ? 'bg-[var(--gold)]/12 text-[var(--gold-light)]' : 'text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]'}`
const iconButton = 'grid h-9 w-9 place-items-center rounded-md text-[var(--text-secondary)] transition-colors duration-200 hover:bg-white/[0.06] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]'

/** The still that stands for an item on the calendar: its first image, or the still of its first video. */
function stillOf(text: NewsText) {
  for (const media of text.media) {
    if (media.type === 'image') return media.url
    if (media.type === 'youtube') return `https://i.ytimg.com/vi/${media.id}/hqdefault.jpg`
    if (media.thumbnail) return media.thumbnail
  }
  return null
}

function Runner({ className = '' }: { className?: string }) {
  // Pixel art from the Limpi site: never resampled, so it is served as it is.
  return <Image src="/assets/limpi/runner.png" alt="" width={1032} height={1232} unoptimized className={`${styles.runner} ${className}`} />
}

function Media({ media, title, watch }: { media: NewsMedia; title: string; watch: string }) {
  const frame = 'relative block aspect-video overflow-hidden rounded-md bg-[var(--bg-deep)]'
  if (media.type === 'youtube') return <div className={frame}><LiteYoutube id={media.id} title={title} label={watch} /></div>
  if (media.type === 'video')
    return (
      <a href={media.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={`${watch}: ${title}`} className={`${frame} group focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]`}>
        {media.thumbnail && <QuietImage src={media.thumbnail} alt="" fill unoptimized sizes="(min-width: 1024px) 28rem, 100vw" className="object-cover" />}
        <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[rgba(13,11,8,0.78)] text-[var(--gold-light)] ring-1 ring-[var(--gold)] transition-colors group-hover:bg-[var(--gold)] group-hover:text-[var(--bg-deep)]">
          <Play size={22} fill="currentColor" aria-hidden="true" />
        </span>
      </a>
    )
  return (
    <a href={media.url} target="_blank" rel="noopener noreferrer nofollow" className={`${frame} focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]`}>
      <QuietImage src={media.url} alt={title} fill unoptimized sizes="(min-width: 1024px) 28rem, 100vw" className="object-contain" />
    </a>
  )
}

function NewsCard({ item, lang, t, onDelete }: { item: NewsItem; lang: NewsLang; t: T; onDelete?: () => void }) {
  const text = pickContent(item.content, lang)
  const [expanded, setExpanded] = useState(false)
  const [revealed, setRevealed] = useState(!item.spoiler)
  const long = text.body.length > 280 || text.body.split('\n').length > 6
  const day = { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' } as const
  return (
    <article className="min-w-0 rounded-lg bg-[var(--bg-panel)] p-4 sm:p-5" data-news-item={item.feed}>
      <div className="flex items-center gap-2 text-xs">
        <FeedLogo feed={item.feed} size="1.5rem" />
        <span className="text-[var(--gold-light)]">{t(`feed.${item.feed}`)}</span>
        <span className="text-[var(--text-secondary)]">{t(`category.${item.category}`)}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[var(--text-secondary)]"><PlatformIcon platform={item.platform} />{t(`platform.${item.platform}`)}</span>
        <time dateTime={item.published_at} className="tabular-nums text-[var(--text-secondary)]">{clock(lang, item.published_at)}</time>
      </div>
      <h3 className="mt-2.5 break-words font-[family-name:var(--font-heading)] text-[1.0625rem] leading-snug text-[var(--text-primary)]">{text.title}</h3>
      {item.author && <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.author.name}{item.author.handle && <span className="ml-1.5 text-[var(--text-muted)]">@{item.author.handle}</span>}</p>}
      {item.starts_at && <p className="mt-1.5 text-xs tabular-nums text-[var(--gold-light)]">{stamp(lang, item.starts_at, day)}{item.ends_at && ` – ${stamp(lang, item.ends_at, day)}`}</p>}
      {text.body && <p className={`mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-[var(--text-secondary)] ${long && !expanded ? 'line-clamp-6' : ''}`}>{text.body}</p>}
      {long && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="mt-1 min-h-9 text-xs text-[var(--gold)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--gold)]">{expanded ? t('less') : t('more')}</button>}
      {text.media.length > 0 && (revealed ? (
        <div className={`mt-3 grid gap-2 ${text.media.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {text.media.map((media, index) => <Media key={index} media={media} title={text.title} watch={t('watch')} />)}
        </div>
      ) : (
        <button type="button" onClick={() => setRevealed(true)} className="mt-3 flex aspect-video w-full items-center justify-center rounded-md bg-[var(--bg-deep)] text-sm text-[var(--text-secondary)] ring-1 ring-inset ring-white/10 transition-colors duration-200 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]">{t('spoiler')}</button>
      ))}
      {(text.url || text.translated || onDelete) && (
        <div className="mt-3 flex min-h-9 items-center gap-4 text-xs">
          {text.url && <a href={text.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-[var(--gold)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--gold)]">{t('original')}<ArrowUpRight size={14} aria-hidden="true" /></a>}
          {text.translated && <span className="text-[var(--text-muted)]">{t('translated')}</span>}
          {onDelete && <button type="button" onClick={onDelete} className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-[#cf8076] transition-colors duration-200 hover:bg-[#cf8076]/10 focus-visible:outline-2 focus-visible:outline-[var(--gold)]"><Trash2 size={14} aria-hidden="true" />{t('delete')}</button>}
        </div>
      )}
    </article>
  )
}

/**
 * The news partners posted, by Korean day: a month calendar, and the news of a day in a dialog when that day is opened.
 * `items` is one month, already loaded; null when it could not be read. `date` and `feed` come from the address.
 */
export default function NewsCalendar({ month, today, date, feed: startFeed, items, variant = '3' }: { month: string; today: string; date: string | null; feed: Feed | 'all'; items: NewsItem[] | null; variant?: '1' | '2' | '3' }) {
  const t = useTranslations('calendar')
  const tc = useTranslations('common')
  const lang = useLocale() as NewsLang
  const router = useRouter()
  const admin = !!(useSession().data?.user as { isAdmin?: boolean } | undefined)?.isAdmin
  const [moving, startMove] = useTransition()
  const [feed, setFeed] = useState(startFeed)
  const [picked, setPicked] = useState(date)
  const [removing, setRemoving] = useState<NewsItem | null>(null)

  const byDay = groupByDay((items ?? []).filter(item => feed === 'all' || item.feed === feed))
  // A day from another month no longer applies once the month changes.
  const opened = picked?.startsWith(month) ? picked : null
  const dayItems = opened ? byDay[opened] ?? [] : []

  // The address keeps the day, month and feed, so a link opens the same view. Nothing here needs loading.
  const address = (change: Record<string, string | null>) => {
    const query = new URLSearchParams(window.location.search)
    for (const [name, value] of Object.entries(change)) if (value === null) query.delete(name); else query.set(name, value)
    return `${window.location.pathname}${query.size ? `?${query}` : ''}`
  }
  const open = (day: string | null) => {
    setPicked(day)
    window.history.replaceState(null, '', address({ date: day, month: day ? null : month }))
  }
  const pickFeed = (next: Feed | 'all') => {
    setFeed(next)
    window.history.replaceState(null, '', address({ feed: next === 'all' ? null : next }))
  }
  const goMonth = (next: string) => {
    setPicked(null)
    startMove(() => router.push(`/calendar?month=${next}${feed === 'all' ? '' : `&feed=${feed}`}`, { scroll: false }))
  }
  async function remove(item: NewsItem) {
    setRemoving(null)
    try {
      const response = await fetch(`/api/admin/news?id=${item.id}`, { method: 'DELETE' })
      if (!response.ok) throw Error()
      showSuccess(t('deleted'))
      router.refresh()
    } catch {
      showError(t('deleteFailed'))
    }
  }

  const fullDay = (day: string) => ofDay(lang, day, { month: 'long', day: 'numeric', weekday: 'long' })
  const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(lang, { timeZone: 'UTC', weekday: 'short' }).format(new Date(Date.UTC(2023, 0, 1 + index))))

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-[5.5rem] text-[var(--text-primary)] sm:px-6" data-news-calendar={variant}>
      <PageHeader title={t('title')} actions={
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="group" aria-label={t('title')}>
          {(['all', ...NEWS_FEEDS] as const).map(key => <button key={key} type="button" aria-pressed={feed === key} onClick={() => pickFeed(key)} className={chip(feed === key)}>{key !== 'all' && <FeedLogo feed={key} size="1.125rem" />}{t(`feed.${key}`)}</button>)}
        </div>
      } />

      <section className="rounded-lg bg-[var(--bg-panel)] p-3 sm:p-4">
        <div className="flex items-center gap-1">
          <button type="button" className={iconButton} aria-label={t('prevMonth')} onClick={() => goMonth(shiftMonth(month, -1))}><ChevronLeft size={18} aria-hidden="true" /></button>
          <h2 className="min-w-[9rem] text-center font-[family-name:var(--font-heading)] text-[1.25rem] text-[var(--gold-light)]">{ofDay(lang, `${month}-01`, { year: 'numeric', month: 'long' })}</h2>
          <button type="button" className={iconButton} aria-label={t('nextMonth')} onClick={() => goMonth(shiftMonth(month, 1))}><ChevronRight size={18} aria-hidden="true" /></button>
          {!today.startsWith(month) && <button type="button" className={chip(false)} onClick={() => goMonth(today.slice(0, 7))}>{t('today')}</button>}
          <p className="ml-auto flex items-end gap-2 text-xs text-[var(--text-secondary)]"><span className="pb-1">{t('from')}</span><Runner className="h-11" /></p>
        </div>

        {/* Lines come from the gap over a line-coloured ground, so every cell keeps the same size. */}
        <div className={`mt-3 overflow-hidden rounded-md bg-[#2e2417] p-px transition-opacity duration-200 motion-reduce:transition-none ${moving ? 'opacity-50' : ''}`} aria-busy={moving}>
          <div className="grid grid-cols-7 gap-px text-center text-xs" aria-hidden="true">
            {weekdays.map((name, index) => <span key={name} className={`bg-[var(--bg-card)] py-2 ${index === 0 ? 'text-[#cf8076]' : 'text-[var(--text-secondary)]'}`}>{name}</span>)}
          </div>
          <div className="mt-px grid grid-cols-7 gap-px">
            {monthGrid(month).map((day, index) => {
              const cell = 'relative flex min-h-[3.75rem] flex-col gap-1 overflow-hidden bg-[var(--bg-panel)] p-1.5 text-left lg:min-h-[8.25rem] lg:p-2'
              if (!day) return <span key={index} className={`${cell} bg-[#0f0c08]`} />
              const news = byDay[day] ?? [], active = day === opened, sunday = index % 7 === 0
              const number = (
                <span className={`${digits} relative grid h-6 min-w-6 place-items-center rounded-full px-1 text-[1.0625rem] ${active ? 'bg-[var(--gold)] text-[var(--bg-deep)]' : day === today ? 'bg-[var(--gold)]/18 text-[var(--gold-light)] ring-1 ring-[var(--gold)]' : sunday ? 'text-[#cf8076]' : news.length ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{Number(day.slice(8))}</span>
              )
              // A day without news has nothing to open.
              if (!news.length) return <div key={day} className={cell} aria-current={day === today ? 'date' : undefined}>{number}{variant === '2' && day === today && <Runner className="absolute bottom-1 right-1 h-10" />}</div>
              const texts = news.map(item => ({ id: item.id, item, text: pickContent(item.content, lang) }))
              const still = variant === '1' ? texts.map(entry => stillOf(entry.text)).find(Boolean) : null
              // Whose news the day has, then how many when there is more than one.
              const count = (
                <span className="relative ml-auto flex items-center gap-1">
                  <span className="flex -space-x-1.5">{[...new Set(news.map(item => item.feed))].map(name => <FeedLogo key={name} feed={name} size="1.125rem" />)}</span>
                  {news.length > 1 && <span className={`${digits} text-sm text-[var(--gold-light)]`}>{news.length}</span>}
                </span>
              )
              return (
                <button key={day} type="button" aria-pressed={active} aria-current={day === today ? 'date' : undefined} aria-label={`${fullDay(day)}, ${t('count', { count: news.length })}`} onClick={() => open(day)}
                  className={`${cell} group transition-colors duration-200 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--gold)] ${active ? 'bg-[#2a1f0c]' : 'hover:bg-[var(--bg-elevated)]'}`}>
                  {still && <>
                    <QuietImage src={still} alt="" fill unoptimized sizes="12rem" className="object-cover opacity-60 transition-[opacity,transform] duration-300 group-hover:scale-[1.03] group-hover:opacity-85 motion-reduce:transition-none" />
                    <span className="absolute inset-0 bg-gradient-to-t from-[rgba(13,11,8,0.92)] via-[rgba(13,11,8,0.25)] to-[rgba(13,11,8,0.55)]" />
                  </>}
                  <span className="flex w-full items-center">{number}{count}</span>
                  {variant === '1' && <span className="relative mt-auto hidden w-full text-xs font-medium leading-snug text-[var(--text-primary)] lg:line-clamp-2">{texts[0].text.title}</span>}
                  {variant === '2' && <>
                    {texts.slice(0, 3).map((entry, order) => (
                      <span key={entry.id} className="hidden w-full items-center gap-1.5 rounded-[2px] bg-[#e6e2d8] px-1.5 py-1 text-[0.6875rem] font-medium leading-tight text-[#1b1611] shadow-[0_2px_6px_rgba(0,0,0,0.45)] lg:flex" style={{ rotate: `${[-1.2, 0.9, -0.6][order]}deg` }}>
                        <PlatformIcon platform={entry.item.platform} size="0.75rem" /><span className="truncate">{entry.text.title}</span>
                      </span>
                    ))}
                    {news.length > 3 && <span className="hidden text-[0.6875rem] text-[var(--text-muted)] lg:block">+{news.length - 3}</span>}
                    {day === today && <Runner className="absolute bottom-1 right-1 hidden h-10 lg:block" />}
                  </>}
                  {variant === '3' && <>
                    {texts.slice(0, 3).map(entry => (
                      <span key={entry.id} className="hidden w-full items-baseline gap-1.5 border-l-2 border-[var(--gold)] bg-white/[0.045] py-0.5 pl-1.5 pr-1 text-[0.6875rem] leading-tight lg:flex">
                        <PlatformIcon platform={entry.item.platform} size="0.75rem" className="self-center text-[var(--text-secondary)]" />
                        <span className="truncate text-[var(--text-primary)]">{entry.text.title}</span>
                      </span>
                    ))}
                    {news.length > 3 && <span className="hidden text-[0.6875rem] text-[var(--text-muted)] lg:block">+{news.length - 3}</span>}
                  </>}
                </button>
              )
            })}
          </div>
        </div>
        {items === null && <p role="alert" className="py-6 text-center text-sm text-[#cf8076]">{t('loadFailed')}</p>}
      </section>

      <BaseModal open={!!opened} onClose={() => open(null)} title={opened ? fullDay(opened) : t('title')} maxWidth="44rem" sheet initialFocus="dialog">
        {opened && (
          <div className="relative w-full overflow-hidden rounded-t-xl border border-[#2e2417] bg-[#17120c] shadow-[0_1.5rem_4rem_rgba(0,0,0,0.6)] sm:rounded-xl">
            <div className="max-h-[88dvh] overflow-y-auto overscroll-contain p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <div className={`${styles.slipWrap} min-w-0 flex-1`}>
                  <div className={styles.slip}>
                    <span className={styles.slipText}><strong>{fullDay(opened)}</strong><small>{t('from')}</small></span>
                    <span className={styles.slipCount}>{dayItems.length}</span>
                  </div>
                  <Runner />
                </div>
                <button type="button" onClick={() => open(null)} aria-label={tc('close')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"><X size={18} aria-hidden="true" /></button>
              </div>
              {dayItems.length
                ? <ul className="mt-4 space-y-3">{dayItems.map(item => <li key={item.id}><NewsCard item={item} lang={lang} t={t} onDelete={admin ? () => setRemoving(item) : undefined} /></li>)}</ul>
                : <p className="py-10 text-center text-sm text-[var(--text-muted)]">{t('empty')}</p>}
            </div>
          </div>
        )}
      </BaseModal>
      <ConfirmModal open={!!removing} message={t('deleteConfirm')} confirmLabel={t('delete')} variant="danger" onConfirm={() => removing && remove(removing)} onCancel={() => setRemoving(null)} />
    </div>
  )
}
