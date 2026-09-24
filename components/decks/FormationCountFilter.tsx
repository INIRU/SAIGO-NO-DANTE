'use client'

import { useTranslations } from 'next-intl'
import { Minus, Plus } from 'lucide-react'

/** Exact formation member count (1-12) stepper shared by the deck and plan boards; null clears the filter. */
export default function FormationCountFilter({ value, onChange }: { value: number | null; onChange: (count: number | null) => void }) {
  const t = useTranslations('decks')
  const apply = (rawValue: string) => {
    const trimmed = rawValue.trim()
    if (!trimmed) {
      onChange(null)
      return
    }

    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isNaN(parsed)) return
    onChange(Math.min(12, Math.max(1, parsed)))
  }
  const step = (delta: number) => {
    const current = value ?? (delta > 0 ? 0 : 13)
    onChange(Math.min(12, Math.max(1, current + delta)))
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div
        className="flex items-stretch rounded"
        style={{
          minHeight: '2.75rem',
          background: 'rgba(255,255,255,0.035)',
          border: `1px solid ${value !== null ? 'var(--deck-filter-border-active)' : 'var(--deck-filter-border)'}`,
          boxShadow: value !== null ? 'inset 0 1px 0 rgba(200,144,10,0.08)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={() => step(-1)}
          className="flex w-11 shrink-0 items-center justify-center rounded-l transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
          style={{ color: value !== null ? 'var(--gold)' : '#777', cursor: 'pointer' }}
          aria-label={t('filters.formationDecrease')}
        >
          <Minus size={15} aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value ?? ''}
          onChange={e => apply(e.target.value)}
          placeholder="1-12"
          className="min-w-0 flex-1 border-x text-center outline-none"
          style={{
            background: 'transparent',
            borderColor: 'var(--deck-filter-border)',
            color: value !== null ? 'var(--gold)' : 'var(--deck-filter-text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '1rem',
            fontWeight: 600,
          }}
          aria-label={t('filters.formationInput')}
        />
        <button
          type="button"
          onClick={() => step(1)}
          className="flex w-11 shrink-0 items-center justify-center rounded-r transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
          style={{ color: value !== null ? 'var(--gold)' : '#777', cursor: 'pointer' }}
          aria-label={t('filters.formationIncrease')}
        >
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-[1.75rem] items-center justify-between gap-2">
        <span style={{ color: 'var(--deck-filter-text-muted)', fontSize: 'var(--deck-filter-label-text)', lineHeight: 1.35 }}>
          {value ? t('filters.formationExact', { count: value }) : t('filters.formationInput')}
        </span>
        {value !== null && (
          <button
            onClick={() => onChange(null)}
            className="rounded transition-colors hover:bg-white/5"
            style={{ minHeight: '1.75rem', padding: '0 0.5rem', color: 'var(--deck-filter-text-soft)', border: '1px solid var(--deck-filter-border)', fontSize: '0.75rem' }}
          >
            {t('filters.clear')}
          </button>
        )}
      </div>
    </div>
  )
}
