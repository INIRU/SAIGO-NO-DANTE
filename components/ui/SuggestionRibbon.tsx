'use client'

import { useTranslations } from 'next-intl'

/** The first group of a picker: a small gold swallow-tail ribbon, cut like the game's SELECTED/BACKUP banners. */
export default function SuggestionRibbon({ className = '' }: { className?: string }) {
  const t = useTranslations('suggestions')
  return (
    <span
      className={`inline-flex h-6 items-center bg-gradient-to-b from-[var(--gold-light)] to-[var(--gold)] pl-3 pr-4 font-[family-name:var(--font-heading)] text-[0.8125rem] leading-none text-[var(--bg-deep)] drop-shadow-[0_0.125rem_0.25rem_rgba(0,0,0,0.5)] ${className}`}
      style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 0.5rem) 50%, 100% 100%, 0 100%)' }}
    >
      {t('label')}
    </span>
  )
}
