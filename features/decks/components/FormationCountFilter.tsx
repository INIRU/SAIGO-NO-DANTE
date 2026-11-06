'use client'

import { useTranslations } from 'next-intl'
import { Minus, Plus } from 'lucide-react'
import { FilterTextButton, filterStyles } from '@/components/board/FilterControls'

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
    <div>
      <div className={filterStyles.field} style={{ padding: 0 }}>
        <button type="button" onClick={() => step(-1)} aria-label={t('filters.formationDecrease')} style={{ width: '2.6rem', height: '2.5rem', margin: 0 }}>
          <Minus size={15} aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value ?? ''}
          onChange={e => apply(e.target.value)}
          placeholder="1-12"
          className={filterStyles.fieldInput}
          style={{ textAlign: 'center', fontFamily: 'var(--font-title)', fontSize: '1.25rem', color: value !== null ? 'var(--gold-light)' : undefined }}
          aria-label={t('filters.formationInput')}
        />
        <button type="button" onClick={() => step(1)} aria-label={t('filters.formationIncrease')} style={{ width: '2.6rem', height: '2.5rem', margin: 0 }}>
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-[1.75rem] items-center justify-between gap-2">
        <p className={filterStyles.hint}>{value ? t('filters.formationExact', { count: value }) : t('filters.formationInput')}</p>
        {value !== null && <FilterTextButton onClick={() => onChange(null)}>{t('filters.clear')}</FilterTextButton>}
      </div>
    </div>
  )
}
