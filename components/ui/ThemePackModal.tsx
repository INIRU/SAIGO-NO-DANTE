'use client'

import BaseModal from '@/components/ui/BaseModal'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import ThemePackCard from '@/components/ui/ThemePackCard'
import { Search, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { SupportedLang } from '@/lib/i18n/types'

interface ThemePackModalShellProps {
  title: string
  onClose: () => void
  children: ReactNode
  imageUrl?: string | null
  imageAlt?: string
  eyebrow?: ReactNode
  meta?: ReactNode
  maxWidth?: string
  closeLabel: string
  /** Pack poster shown beside the title; replaces the faded banner image. */
  poster?: ReactNode
}

export function ThemePackModalShell({
  title,
  onClose,
  children,
  imageUrl,
  imageAlt,
  eyebrow,
  meta,
  maxWidth = '52rem',
  closeLabel,
  poster,
}: ThemePackModalShellProps) {
  return (
    <BaseModal open={true} onClose={onClose} maxWidth={maxWidth} padding="1rem" title={title} sheet>
      <div
        className="relative w-full overflow-hidden rounded-t-xl sm:rounded-xl"
        style={{
          maxHeight: '88dvh',
          background: '#17120c',
          border: '1px solid #2e2417',
          boxShadow: '0 1.5rem 4rem rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ maxHeight: '88dvh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="absolute top-3 right-3 z-20 rounded-full transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
            style={{
              minWidth: '2.75rem',
              minHeight: '2.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>

          {poster ? (
            <div className="flex items-end gap-4 px-5 pb-4 pr-14 pt-5 sm:gap-6">
              <div className="w-[5.5rem] shrink-0 sm:w-[8.5rem]">{poster}</div>
              <div className="min-w-0 flex-1 pb-1">
                {eyebrow && <div className="mb-2">{eyebrow}</div>}
                <h3 className="text-pretty" style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.375rem, 4vw, 1.875rem)', lineHeight: 1.25, color: '#e8dcc8' }}>
                  {title}
                </h3>
                {meta && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{meta}</div>}
              </div>
            </div>
          ) : (
          <div className="relative overflow-hidden" style={{ minHeight: imageUrl ? '11rem' : '7.5rem' }}>
            {imageUrl ? (
              <>
                <ImageWithFallback
                  src={imageUrl}
                  alt={imageAlt ?? title}
                  fill
                  fallbackType="theme"
                  sizes="(max-width: 768px) 100vw, 52rem"
                  className="object-cover object-center"
                  style={{ opacity: 0.42 }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, #131110 0%, rgba(19,17,16,0.68) 52%, rgba(19,17,16,0.28) 100%)',
                  }}
                />
              </>
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(135deg, rgba(200,144,10,0.08) 0%, transparent 72%)' }}
              />
            )}

            <div className="relative z-10 flex min-h-[7.5rem] flex-col justify-end px-5 pb-4 pr-16 pt-12 sm:pr-20">
              {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
              <h3
                className="font-serif text-xl font-bold text-pretty md:text-2xl"
                style={{
                  color: '#e8d8c0',
                  lineHeight: 1.32,
                  WebkitTextStroke: 0,
                  textShadow: '0 0.125rem 0.5rem rgba(0,0,0,0.6)',
                }}
              >
                {title}
              </h3>
              {meta && <div className="mt-1.5 flex flex-wrap items-center gap-2">{meta}</div>}
            </div>
          </div>
          )}

          <div className="px-5 pb-5">{children}</div>
        </div>
      </div>
    </BaseModal>
  )
}

interface ThemePackModalPillProps {
  children: ReactNode
  tone?: 'gold' | 'red' | 'purple' | 'neutral'
}

export function ThemePackModalPill({ children, tone = 'neutral' }: ThemePackModalPillProps) {
  const styles = {
    gold: {
      background: 'rgba(200,144,10,0.16)',
      border: '1px solid rgba(200,144,10,0.28)',
      color: '#e8b030',
    },
    red: {
      background: 'rgba(224,64,64,0.18)',
      border: '1px solid rgba(224,64,64,0.28)',
      color: '#e04040',
    },
    purple: {
      background: 'rgba(144,112,176,0.16)',
      border: '1px solid rgba(144,112,176,0.34)',
      color: '#b090d0',
    },
    neutral: {
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#aaa',
    },
  }[tone]

  return (
    <span
      className="inline-flex items-center rounded-sm"
      style={{
        minHeight: '1.75rem',
        padding: '0.125rem 0.5rem',
        fontSize: '0.8125rem',
        ...styles,
      }}
    >
      {children}
    </span>
  )
}

interface ThemePackModalSectionProps {
  title: ReactNode
  count?: number
  icon?: ReactNode
  children: ReactNode
  tone?: 'gold' | 'purple' | 'neutral'
}

export function ThemePackModalSection({
  title,
  count,
  icon,
  children,
  tone = 'gold',
}: ThemePackModalSectionProps) {
  const color = tone === 'purple' ? '#b090d0' : tone === 'gold' ? 'var(--gold)' : '#aaa'

  return (
    <section className="mb-5">
      <div className="mb-2.5 flex items-center gap-1.5">
        {icon && (
          <span aria-hidden="true" style={{ color, fontSize: '0.9375rem' }}>
            {icon}
          </span>
        )}
        <span className="font-serif font-medium" style={{ color, fontSize: '0.9375rem' }}>
          {title}
        </span>
        {typeof count === 'number' && (
          <span style={{ color: '#666', fontSize: '0.875rem', fontFamily: 'var(--font-mono)' }}>
            ({count})
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

interface ThemePackModalGridProps {
  children: ReactNode
  minColumnWidth?: string
}

export function ThemePackModalGrid({ children, minColumnWidth = '3.75rem' }: ThemePackModalGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}, 1fr))`,
        gap: '0.5rem',
        position: 'relative',
        zIndex: 0,
      }}
    >
      {children}
    </div>
  )
}

interface ThemePackModalEmptyProps {
  children: ReactNode
}

export function ThemePackModalEmpty({ children }: ThemePackModalEmptyProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '2rem 1rem',
        color: '#6b7280',
        fontSize: '0.9375rem',
        border: '1px dashed rgba(255,255,255,0.08)',
        borderRadius: '0.5rem',
        background: 'rgba(255,255,255,0.025)',
      }}
    >
      {children}
    </div>
  )
}

interface ThemePackPickerTheme {
  id: number | string
  name: string
  name_en?: string | null
  name_jp?: string | null
  image_url?: string | null
  ego_gift_ids?: number[] | null
  specific_ego_gift_ids?: number[] | null
}

interface ThemePackPickerModalProps<TTheme extends ThemePackPickerTheme> {
  title: string
  closeLabel: string
  emptyLabel: string
  searchLabel: string
  noResultsLabel: string
  countLabel: (count: number) => string
  themes: TTheme[]
  selectedThemeId?: string | number | null
  onClose: () => void
  onSelectTheme: (theme: TTheme) => void
  lang?: SupportedLang
  meta?: ReactNode
  /** Text the search matches; defaults to the pack's names. */
  searchText?: (theme: TTheme) => string
}

/** Picks a theme pack: a compact header, a search over the packs, and the pack posters. */
export function ThemePackPickerModal<TTheme extends ThemePackPickerTheme>({
  title,
  closeLabel,
  emptyLabel,
  searchLabel,
  noResultsLabel,
  countLabel,
  themes,
  selectedThemeId,
  onClose,
  onSelectTheme,
  lang,
  meta,
  searchText = theme => [theme.name, theme.name_en, theme.name_jp].join(' '),
}: ThemePackPickerModalProps<TTheme>) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase()
  const shown = needle ? themes.filter(theme => searchText(theme).toLocaleLowerCase().includes(needle)) : themes

  return (
    <BaseModal open={true} onClose={onClose} maxWidth="60rem" title={title} sheet>
      <div className="flex h-[min(86dvh,56rem)] flex-col overflow-hidden rounded-t-xl border border-[rgba(200,144,10,0.22)] bg-[#17120c] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)] sm:rounded-xl">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[#2e2417] py-3 pl-5 pr-3">
          <h2 className="min-w-0 truncate font-[family-name:var(--font-heading)] text-[1.125rem] text-[#e8dcc8]">{title}</h2>
          {meta}
          <button type="button" onClick={onClose} aria-label={closeLabel}
            className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded text-[#9c8b73] transition-colors hover:bg-white/5 hover:text-[#e8dcc8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {themes.length > 0 && (
          <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-4">
            <label className="relative min-w-0 flex-1 sm:max-w-[22rem]">
              <span className="sr-only">{searchLabel}</span>
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6a6058]" />
              <input type="text" enterKeyHint="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={searchLabel}
                className="min-h-10 w-full rounded-md border border-[#2e2417] bg-[#0d0b08] pl-9 pr-3 text-[0.9375rem] text-[#e8dcc8] placeholder:text-[#6a6058] focus-visible:border-[var(--gold)] focus-visible:outline-none" />
            </label>
            <span className="shrink-0 text-sm tabular-nums text-[#9c8b73]">{countLabel(shown.length)}</span>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {themes.length === 0 ? (
            <div className="pt-4"><ThemePackModalEmpty>{emptyLabel}</ThemePackModalEmpty></div>
          ) : shown.length === 0 ? (
            <p className="py-12 text-center text-[0.9375rem] text-[#9c8b73]">{noResultsLabel}</p>
          ) : (
            <div
              className="grid gap-3"
              style={{ alignItems: 'start', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 8.5rem), 1fr))' }}
            >
              {shown.map(theme => (
                <ThemePackCard
                  key={String(theme.id)}
                  theme={theme}
                  onClick={() => onSelectTheme(theme)}
                  isSelected={selectedThemeId != null && String(selectedThemeId) === String(theme.id)}
                  showGiftCount
                  imageSurface="bare"
                  lang={lang}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  )
}
