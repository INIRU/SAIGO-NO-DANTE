'use client'

import BaseModal from '@/components/ui/BaseModal'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import ThemePackCard from '@/components/ui/ThemePackCard'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
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
}: ThemePackModalShellProps) {
  return (
    <BaseModal open={true} onClose={onClose} maxWidth={maxWidth} padding="1rem" title={title}>
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxHeight: '85vh',
          borderRadius: '0.75rem',
          background: '#131110',
          border: '1px solid rgba(200,144,10,0.12)',
          boxShadow: '0 0 3rem rgba(200,144,10,0.08), 0 1.5rem 4rem rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ maxHeight: '85vh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
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
      className="inline-flex items-center rounded-full font-mono font-semibold"
      style={{
        minHeight: '2rem',
        padding: '0.125rem 0.625rem',
        fontSize: '0.875rem',
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
  themes: TTheme[]
  selectedThemeId?: string | number | null
  onClose: () => void
  onSelectTheme: (theme: TTheme) => void
  lang?: SupportedLang
  meta?: ReactNode
}

export function ThemePackPickerModal<TTheme extends ThemePackPickerTheme>({
  title,
  closeLabel,
  emptyLabel,
  themes,
  selectedThemeId,
  onClose,
  onSelectTheme,
  lang,
  meta,
}: ThemePackPickerModalProps<TTheme>) {
  return (
    <ThemePackModalShell
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
      maxWidth="56rem"
      meta={meta}
    >
      <div className="mt-4">
        {themes.length === 0 ? (
          <ThemePackModalEmpty>{emptyLabel}</ThemePackModalEmpty>
        ) : (
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            style={{ alignItems: 'start' }}
          >
            {themes.map(theme => (
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
    </ThemePackModalShell>
  )
}
