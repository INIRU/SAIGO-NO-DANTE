'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { CalendarDays, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import BaseModal from '@/components/ui/BaseModal'
import type { SupportedLang } from '@/lib/i18n/types'

interface OfficialNewsEvent {
  id: string
  source: 'steam' | 'x'
  source_item_id: string
  source_url: string
  title: string
  summary: string
  body: string
  starts_at: string
  ends_at: string | null
  published_at: string | null
  image_url: string | null
  image_urls?: string[] | null
  image_paths?: string[] | null
  raw_payload?: Record<string, unknown> | null
  tags: string[] | null
}

type CalendarEntryType = 'post' | 'schedule'

interface CalendarDisplayEntry {
  id: string
  type: CalendarEntryType
  event: OfficialNewsEvent
  date: Date
  dateKey: string
  title: string
}

interface CalendarDay {
  key: string
  dayNumber: number
  date: Date
  inMonth: boolean
  isToday: boolean
  entries: CalendarDisplayEntry[]
}

const LOCALES: Record<SupportedLang, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
}

const WEEK_START_SUNDAY = 0

function normalizeLocale(locale: string): SupportedLang {
  return locale === 'ko' || locale === 'ja' ? locale : 'en'
}

function getDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildCalendarDays(year: number, monthIndex: number, entries: CalendarDisplayEntry[]): CalendarDay[] {
  const firstOfMonth = new Date(year, monthIndex, 1)
  const startOffset = (firstOfMonth.getDay() - WEEK_START_SUNDAY + 7) % 7
  const gridStart = new Date(year, monthIndex, 1 - startOffset)
  const todayKey = getDateKey(new Date())
  const entriesByDate = entries.reduce<Record<string, CalendarDisplayEntry[]>>((acc, entry) => {
    acc[entry.dateKey] = [...(acc[entry.dateKey] ?? []), entry]
    return acc
  }, {})

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const key = getDateKey(date)

    return {
      key,
      date,
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
      isToday: key === todayKey,
      entries: entriesByDate[key] ?? [],
    }
  })
}

function isDateInMonth(date: Date, year: number, monthIndex: number): boolean {
  return date.getFullYear() === year && date.getMonth() === monthIndex
}

function isUnsuitableTitle(title: string): boolean {
  const trimmed = title.trim()
  if (!trimmed) return true
  if (/^https?:\/\//i.test(trimmed)) return true
  if (/^www\./i.test(trimmed)) return true
  if (/^[\w.-]+\.[a-z]{2,}(?:[/?#][^\s]*)?$/i.test(trimmed)) return true

  const withoutHashtags = trimmed.replace(/#[\p{L}\p{N}_-]+/gu, '').trim()
  if (!withoutHashtags) return true

  const meaningfulText = trimmed.replace(/https?:\/\/\S+/gi, '').replace(/#[\p{L}\p{N}_-]+/gu, '')
  return !/[\p{L}\p{N}]/u.test(meaningfulText)
}

function getSourcePostTitle(event: OfficialNewsEvent, fallbackTitle: string): string {
  if (event.source === 'x') return fallbackTitle
  return isUnsuitableTitle(event.title) ? fallbackTitle : event.title.trim()
}

function getScheduleTitle(event: OfficialNewsEvent, fallbackTitle: string): string {
  return isUnsuitableTitle(event.title) ? fallbackTitle : event.title.trim()
}

function getCalendarDateSource(event: OfficialNewsEvent): string | null {
  const value = event.raw_payload?.calendar_date_source
  return typeof value === 'string' ? value : null
}

function buildDisplayEntries(
  events: OfficialNewsEvent[],
  year: number,
  monthIndex: number,
  fallbackTitles: Record<OfficialNewsEvent['source'], string>,
): CalendarDisplayEntry[] {
  const entries: CalendarDisplayEntry[] = []

  for (const event of events) {
    const fallbackTitle = fallbackTitles[event.source]
    const startsAt = new Date(event.starts_at)
    const publishedAt = event.published_at ? new Date(event.published_at) : null
    const postDate = publishedAt ?? startsAt
    const postDateKey = getDateKey(postDate)
    const startsDateKey = getDateKey(startsAt)

    if (isDateInMonth(postDate, year, monthIndex)) {
      entries.push({
        id: `${event.id}:post:${postDateKey}`,
        type: 'post',
        event,
        date: postDate,
        dateKey: postDateKey,
        title: getSourcePostTitle(event, fallbackTitle),
      })
    }

    if (
      startsDateKey !== postDateKey
      && getCalendarDateSource(event) !== 'published_at_fallback'
      && isDateInMonth(startsAt, year, monthIndex)
    ) {
      entries.push({
        id: `${event.id}:schedule:${startsDateKey}`,
        type: 'schedule',
        event,
        date: startsAt,
        dateKey: startsDateKey,
        title: getScheduleTitle(event, fallbackTitle),
      })
    }
  }

  return entries.sort((a, b) => a.date.getTime() - b.date.getTime())
}

function getEventImages(event: OfficialNewsEvent): string[] {
  const images = event.image_urls?.filter((url): url is string => typeof url === 'string' && url.trim().length > 0) ?? []
  if (images.length > 0) return images
  return event.image_url ? [event.image_url] : []
}

function formatRange(
  event: OfficialNewsEvent,
  formatter: Intl.DateTimeFormat,
  dateTimeFormatter: Intl.DateTimeFormat,
): string {
  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null
  const published = event.published_at ? new Date(event.published_at) : null

  if (end && getDateKey(end) !== getDateKey(start)) {
    return `${formatter.format(start)} - ${formatter.format(end)}`
  }
  if (published) {
    return dateTimeFormatter.format(published)
  }
  return formatter.format(start)
}

function formatPostReference(
  event: OfficialNewsEvent,
  formatter: Intl.DateTimeFormat,
  dateTimeFormatter: Intl.DateTimeFormat,
): string {
  if (event.published_at) {
    return dateTimeFormatter.format(new Date(event.published_at))
  }
  return formatter.format(new Date(event.starts_at))
}

function SteamIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
    </svg>
  )
}

function XBrandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  )
}

export default function CalendarClient() {
  const locale = normalizeLocale(useLocale())
  const t = useTranslations('calendar')
  const now = useMemo(() => new Date(), [])
  const [events, setEvents] = useState<OfficialNewsEvent[]>([])
  const [selectedEntry, setSelectedEntry] = useState<CalendarDisplayEntry | null>(null)
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const shouldReduceMotion = useReducedMotion()

  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  const month = monthIndex + 1
  const intlLocale = LOCALES[locale]

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { year: 'numeric', month: 'long' }),
    [intlLocale],
  )
  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { day: 'numeric', weekday: 'short' }),
    [intlLocale],
  )
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { year: 'numeric', month: 'short', day: 'numeric' }),
    [intlLocale],
  )
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    [intlLocale],
  )

  const weekdays = useMemo(() => {
    const base = new Date(2026, 5, 7)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(base)
      date.setDate(base.getDate() + index)
      return new Intl.DateTimeFormat(intlLocale, { weekday: 'short' }).format(date)
    })
  }, [intlLocale])

  function loadEvents() {
    setIsLoading(true)
    setError(null)
    fetch(`/api/calendar/events?year=${year}&month=${month}`, { headers: { Accept: 'application/json' } })
      .then(async response => {
        const payload = await response.json().catch(() => null) as { data?: OfficialNewsEvent[]; error?: string } | null
        if (!response.ok) {
          throw new Error(payload?.error ?? t('errorDescription'))
        }
        setEvents(payload?.data ?? [])
      })
      .catch(() => {
        setEvents([])
        setError(t('errorDescription'))
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadEvents()
    // current month is fixed for this mounted view; loadEvents captures localized copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, locale])

  const sourcePostTitles = useMemo(() => ({
    steam: t('sourcePostTitles.steam'),
    x: t('sourcePostTitles.x'),
  }), [t])
  const displayEntries = useMemo(
    () => buildDisplayEntries(events, year, monthIndex, sourcePostTitles),
    [events, monthIndex, sourcePostTitles, year],
  )
  const days = useMemo(() => buildCalendarDays(year, monthIndex, displayEntries), [displayEntries, monthIndex, year])
  const visibleEntries = useMemo(
    () => displayEntries,
    [displayEntries],
  )
  const sourceCounts = useMemo(() => ({
    steam: visibleEntries.filter(entry => entry.event.source === 'steam').length,
    x: visibleEntries.filter(entry => entry.event.source === 'x').length,
  }), [visibleEntries])

  const sourceLabel = (source: OfficialNewsEvent['source']) => source === 'steam' ? t('sources.steam') : t('sources.x')
  const sourceClass = (source: OfficialNewsEvent['source']) => (
    source === 'steam'
      ? 'border-[rgba(102,192,244,0.34)] bg-[rgba(102,192,244,0.11)] text-[#9bd4f5]'
      : 'border-[rgba(232,176,48,0.32)] bg-[rgba(200,144,10,0.1)] text-[#e8b030]'
  )
  const sourceMark = (source: OfficialNewsEvent['source']) => (
    source === 'steam'
      ? <SteamIcon className="h-3 w-3" />
      : <XBrandIcon className="h-3 w-3" />
  )
  const entryTypeLabel = (type: CalendarEntryType) => (
    type === 'post' ? t('entryTypes.post') : t('entryTypes.schedule')
  )
  const buttonMotion = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 2 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.16 } }

  function openEntry(entry: CalendarDisplayEntry) {
    setSelectedEntry(entry)
  }

  function chooseDayEntry(entry: CalendarDisplayEntry) {
    setSelectedDay(null)
    setSelectedEntry(entry)
  }

  const selectedEvent = selectedEntry?.event ?? null
  const selectedImages = selectedEvent ? getEventImages(selectedEvent) : []
  const selectedTitle = selectedEntry?.title ?? t('detailTitle')

  return (
    <section aria-labelledby="calendar-month-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border border-[rgba(200,144,10,0.18)] bg-[#1a1510] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[rgba(200,144,10,0.24)] bg-[rgba(200,144,10,0.08)]">
            <CalendarDays className="h-5 w-5 text-[#e8b030]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="calendar-month-title" className="text-[1.5rem] leading-tight text-[#e8b030]">
              {monthFormatter.format(now)}
            </h2>
            <p className="mt-1 text-[0.875rem] leading-5 text-[#8f7a55]">
              {t('summary', { count: visibleEntries.length, steam: sourceCounts.steam, x: sourceCounts.x })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadEvents}
          disabled={isLoading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[rgba(200,144,10,0.24)] bg-[rgba(13,11,8,0.72)] px-4 text-[0.9375rem] text-[#d8c7a0] transition-[background-color,border-color,color,transform] duration-150 hover:border-[rgba(232,176,48,0.45)] hover:text-[#e8b030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)] disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          {t('retry')}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-[rgba(180,82,54,0.36)] bg-[rgba(180,82,54,0.08)] p-4" role="status" aria-live="polite">
          <p className="text-[1rem] leading-6 text-[#d79a7e]">{t('errorTitle')}</p>
          <p className="mt-1 text-[0.875rem] leading-6 text-[#a89468]">{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-[rgba(200,144,10,0.18)] bg-[#14100c]">
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-b border-[rgba(200,144,10,0.16)] bg-[#0f0c09]">
          {weekdays.map(weekday => (
            <div key={weekday} className="px-1 py-3 text-center font-mono text-[0.875rem] text-[#8a6010]">
              {weekday}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-[repeat(7,minmax(0,1fr))]" aria-label={t('loading')}>
            {Array.from({ length: 14 }, (_, index) => (
              <div key={index} className="min-h-[6.5rem] animate-pulse rounded-md border border-[rgba(200,144,10,0.1)] bg-[rgba(255,255,255,0.025)]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(7,minmax(0,1fr))]">
            {days.map(day => (
              <article
                key={day.key}
                aria-label={dayFormatter.format(day.date)}
                className={`min-h-[5.25rem] border-b border-[rgba(200,144,10,0.12)] p-2 sm:block sm:min-h-[7.25rem] sm:border-r ${day.inMonth ? 'bg-[#14100c]' : 'hidden bg-[#0f0c09] opacity-55'}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span
                    className={`flex h-8 min-w-8 items-center justify-center rounded-sm font-mono text-[0.875rem] ${day.isToday ? 'bg-[rgba(200,144,10,0.18)] text-[#e8b030]' : 'text-[#8f7a55]'}`}
                  >
                    {day.dayNumber}
                  </span>
                  {day.entries.length > 0 && (
                    <span className="font-mono text-[0.875rem] text-[#8a6010]">
                      {day.entries.length}
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-1">
                  {day.entries.slice(0, 3).map(entry => (
                    <motion.button
                      key={entry.id}
                      type="button"
                      onClick={() => openEntry(entry)}
                      title={`${sourceLabel(entry.event.source)} · ${entryTypeLabel(entry.type)} · ${entry.title}`}
                      aria-label={t('openEvent', { source: sourceLabel(entry.event.source), title: entry.title })}
                      className="group flex min-h-11 w-full min-w-0 items-center gap-2 overflow-hidden rounded-sm border border-[rgba(200,144,10,0.14)] bg-[rgba(26,21,16,0.72)] px-2 text-left transition-[background-color,border-color,transform] duration-150 hover:border-[rgba(232,176,48,0.38)] hover:bg-[rgba(200,144,10,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.5)] active:scale-[0.99] sm:h-7 sm:min-h-0 sm:gap-1.5 sm:px-1.5"
                      {...buttonMotion}
                    >
                      <span
                        className={`inline-flex h-4 min-w-[1.25rem] shrink-0 items-center justify-center rounded-sm border px-1 font-mono text-[0.625rem] leading-none ${sourceClass(entry.event.source)}`}
                        title={sourceLabel(entry.event.source)}
                        aria-hidden="true"
                      >
                        {sourceMark(entry.event.source)}
                      </span>
                      <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[0.8125rem] leading-none text-[#d8c7a0] group-hover:text-[#e8b030]">
                        {entry.title}
                      </span>
                    </motion.button>
                  ))}
                  {day.entries.length > 3 && (
                    <motion.button
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      aria-label={t('openDayEvents', {
                        date: dateFormatter.format(day.date),
                        count: day.entries.length - 3,
                      })}
                      className="flex min-h-11 w-full min-w-0 items-center rounded-sm px-2 text-left font-mono text-[0.875rem] leading-none text-[#8a6010] transition-[background-color,color] duration-150 hover:bg-[rgba(200,144,10,0.08)] hover:text-[#e8b030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.5)] sm:h-6 sm:min-h-0 sm:px-1.5 sm:text-[0.75rem]"
                      {...buttonMotion}
                    >
                      <span className="truncate">
                        {t('moreEvents', { count: day.entries.length - 3 })}
                      </span>
                    </motion.button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {!isLoading && !error && visibleEntries.length === 0 && (
        <div className="rounded-md border border-dashed border-[rgba(200,144,10,0.24)] bg-[rgba(26,21,16,0.54)] p-6 text-center">
          <p className="text-[1rem] leading-7 text-[#d8c7a0]">{t('emptyTitle')}</p>
          <p className="mx-auto mt-2 max-w-[34rem] text-[0.875rem] leading-6 text-[#8f7a55]">
            {t('emptyDescription')}
          </p>
        </div>
      )}

      <BaseModal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? t('dayEventsTitle', { date: dateFormatter.format(selectedDay.date) }) : t('dayEventsFallbackTitle')}
        description={selectedDay ? t('dayEventsDescription', { count: selectedDay.entries.length }) : undefined}
        maxWidth="34rem"
        padding="calc(env(safe-area-inset-top) + 1rem) calc(env(safe-area-inset-right) + 1rem) calc(env(safe-area-inset-bottom) + 1rem) calc(env(safe-area-inset-left) + 1rem)"
      >
        {selectedDay && (
          <section className="max-h-[min(38rem,calc(100dvh-2rem))] overflow-y-auto overscroll-contain rounded-md border border-[rgba(200,144,10,0.22)] bg-[#1a1510] shadow-[0_1rem_3rem_rgba(0,0,0,0.42)]">
            <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-[rgba(200,144,10,0.16)] bg-[#1a1510] p-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.875rem] leading-5 text-[#8a6010]">
                  {dateFormatter.format(selectedDay.date)}
                </p>
                <h3 className="mt-1 text-[1.25rem] leading-tight text-[#e8b030]">
                  {t('dayEventsTitle', { date: dateFormatter.format(selectedDay.date) })}
                </h3>
                <p className="mt-1 text-[0.875rem] leading-5 text-[#8f7a55]">
                  {t('dayEventsDescription', { count: selectedDay.entries.length })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[rgba(200,144,10,0.2)] text-[#a89468] transition-[border-color,color,background-color] duration-150 hover:border-[rgba(232,176,48,0.42)] hover:bg-[rgba(200,144,10,0.08)] hover:text-[#e8b030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)]"
                aria-label={t('close')}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="divide-y divide-[rgba(200,144,10,0.12)]">
              {selectedDay.entries.map(entry => (
                <motion.button
                  key={entry.id}
                  type="button"
                  onClick={() => chooseDayEntry(entry)}
                  className="grid w-full min-w-0 grid-cols-[4.75rem_minmax(0,1fr)] gap-3 px-4 py-3 text-left transition-[background-color] duration-150 hover:bg-[rgba(200,144,10,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(232,176,48,0.5)] sm:grid-cols-[5.5rem_4.5rem_minmax(0,1fr)]"
                  aria-label={t('openEvent', { source: sourceLabel(entry.event.source), title: entry.title })}
                  {...buttonMotion}
                >
                  <time className="font-mono text-[0.875rem] leading-5 text-[#8a6010]" dateTime={entry.date.toISOString()}>
                    {dateFormatter.format(entry.date)}
                  </time>
                  <span className={`inline-flex h-7 w-fit items-center rounded-sm border px-2 font-mono text-[0.875rem] leading-none ${sourceClass(entry.event.source)}`}>
                    {entryTypeLabel(entry.type)}
                  </span>
                  <span className="col-span-2 min-w-0 truncate text-[0.9375rem] leading-7 text-[#d8c7a0] sm:col-span-1">
                    {entry.title}
                  </span>
                </motion.button>
              ))}
            </div>
          </section>
        )}
      </BaseModal>

      <BaseModal
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title={selectedTitle}
        description={selectedEntry ? `${sourceLabel(selectedEntry.event.source)} · ${entryTypeLabel(selectedEntry.type)}` : undefined}
        maxWidth="46rem"
        padding="calc(env(safe-area-inset-top) + 1rem) calc(env(safe-area-inset-right) + 1rem) calc(env(safe-area-inset-bottom) + 1rem) calc(env(safe-area-inset-left) + 1rem)"
      >
        {selectedEntry && selectedEvent && (
          <article className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-md border border-[rgba(200,144,10,0.22)] bg-[#1a1510] shadow-[0_1rem_3rem_rgba(0,0,0,0.42)]">
            <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-[rgba(200,144,10,0.16)] bg-[#1a1510] p-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-sm border px-2 py-1 font-mono text-[0.875rem] leading-none ${sourceClass(selectedEvent.source)}`}>
                    {sourceLabel(selectedEvent.source)}
                  </span>
                  <span className="rounded-sm border border-[rgba(200,144,10,0.18)] px-2 py-1 font-mono text-[0.875rem] leading-none text-[#a89468]">
                    {entryTypeLabel(selectedEntry.type)}
                  </span>
                  <time className="font-mono text-[0.875rem] text-[#8a6010]" dateTime={selectedEntry.date.toISOString()}>
                    {dateFormatter.format(selectedEntry.date)}
                  </time>
                </div>
                <h3 className="break-words text-[1.5rem] leading-tight text-[#e8b030]">
                  {selectedTitle}
                </h3>
                {selectedEntry.type === 'schedule' && (
                  <p className="mt-2 font-mono text-[0.875rem] leading-5 text-[#8f7a55]">
                    {t('publishedContext', { date: formatPostReference(selectedEvent, dateFormatter, dateTimeFormatter) })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[rgba(200,144,10,0.2)] text-[#a89468] transition-[border-color,color,background-color] duration-150 hover:border-[rgba(232,176,48,0.42)] hover:bg-[rgba(200,144,10,0.08)] hover:text-[#e8b030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)]"
                aria-label={t('close')}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            {selectedImages.length > 0 && (
              <section className="border-b border-[rgba(200,144,10,0.14)] bg-[#0f0c09] p-3 sm:p-4" aria-label={t('galleryLabel')}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-mono text-[0.875rem] leading-5 text-[#8a6010]">
                    {t('galleryCount', { count: selectedImages.length })}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {selectedImages.map((imageUrl, index) => (
                    <button
                      key={`${imageUrl}-${index}`}
                      type="button"
                      onClick={() => setLightboxImage(imageUrl)}
                      className="group flex min-h-44 w-full items-center justify-center overflow-hidden rounded-sm border border-[rgba(200,144,10,0.18)] bg-[#090806] p-2 transition-[border-color,background-color,transform] duration-150 hover:border-[rgba(232,176,48,0.42)] hover:bg-[rgba(200,144,10,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)] active:scale-[0.99]"
                      aria-label={t('openImage', { index: index + 1, title: selectedTitle })}
                    >
                      <Image
                        src={imageUrl}
                        alt={t('imageAlt', { title: selectedTitle, index: index + 1 })}
                        width={960}
                        height={540}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        sizes="(max-width: 768px) calc(100vw - 4rem), 21rem"
                        className="h-auto max-h-[22rem] w-auto max-w-full object-contain transition-transform duration-150 group-hover:scale-[1.01]"
                      />
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="flex flex-col gap-4 p-4 sm:p-5">
              {selectedEvent.summary && (
                <p className="break-words border-l border-[rgba(232,176,48,0.34)] pl-4 text-[1rem] leading-7 text-[#d8c7a0]">
                  {selectedEvent.summary}
                </p>
              )}
              {selectedEvent.body && (
                <div className="whitespace-pre-wrap break-words text-[1rem] leading-8 text-[#b8a47b]">
                  {selectedEvent.body}
                </div>
              )}
              {!selectedEvent.summary && !selectedEvent.body && (
                <p className="text-[1rem] leading-7 text-[#8f7a55]">
                  {t('noBody')}
                </p>
              )}
              {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                <div className="flex flex-wrap gap-2" aria-label={t('tags')}>
                  {selectedEvent.tags.map(tag => (
                    <span key={tag} className="rounded-sm border border-[rgba(200,144,10,0.18)] px-2 py-1 text-[0.875rem] leading-none text-[#8f7a55]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <a
                href={selectedEvent.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-md border border-[rgba(232,176,48,0.34)] bg-[rgba(200,144,10,0.1)] px-4 text-[0.9375rem] text-[#e8b030] transition-[background-color,border-color,transform] duration-150 hover:border-[rgba(232,176,48,0.58)] hover:bg-[rgba(200,144,10,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)] active:scale-[0.99]"
              >
                {t('sourceLink')}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </article>
        )}
      </BaseModal>

      <BaseModal
        open={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
        title={t('imageViewerTitle')}
        description={selectedTitle}
        zIndex={60}
        maxWidth="min(96vw, 86rem)"
        padding="calc(env(safe-area-inset-top) + 0.75rem) calc(env(safe-area-inset-right) + 0.75rem) calc(env(safe-area-inset-bottom) + 0.75rem) calc(env(safe-area-inset-left) + 0.75rem)"
        blur={false}
      >
        {lightboxImage && (
          <section className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-md border border-[rgba(200,144,10,0.24)] bg-[#090806] shadow-[0_1rem_3rem_rgba(0,0,0,0.5)]">
            <header className="flex items-center justify-between gap-3 border-b border-[rgba(200,144,10,0.16)] bg-[#14100c] px-3 py-2 sm:px-4">
              <p className="min-w-0 truncate text-[1rem] leading-6 text-[#d8c7a0]">
                {selectedTitle}
              </p>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[rgba(200,144,10,0.2)] text-[#a89468] transition-[border-color,color,background-color] duration-150 hover:border-[rgba(232,176,48,0.42)] hover:bg-[rgba(200,144,10,0.08)] hover:text-[#e8b030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,176,48,0.55)]"
                aria-label={t('close')}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            <div className="min-h-0 overflow-auto overscroll-contain p-3 sm:p-4">
              <div className="flex min-h-[60dvh] w-full items-center justify-center">
                <Image
                  src={lightboxImage}
                  alt={t('imageAlt', { title: selectedTitle, index: 1 })}
                  width={1600}
                  height={1000}
                  sizes="96vw"
                  className="h-auto max-h-none w-auto max-w-none object-contain"
                  priority
                />
              </div>
            </div>
          </section>
        )}
      </BaseModal>
    </section>
  )
}
