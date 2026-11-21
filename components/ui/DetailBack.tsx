'use client'

import Image from 'next/image'
import { ChevronLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

/** The window a detail window was opened from. */
export interface DetailBackTarget {
  name: string
  image?: string | null
  onClick: () => void
}

/** Goes back to the window this one was opened from, shown as its picture and name. */
export default function DetailBack({ back, className = '' }: { back: DetailBackTarget; className?: string }) {
  const t = useTranslations('giftDetail')
  return (
    <button
      type="button"
      onClick={back.onClick}
      aria-label={t('back', { gift: back.name })}
      className={`inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg pl-1 pr-2.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--gold-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-light)] sm:min-h-9 ${className}`}
      style={{ fontFamily: 'var(--font-heading)', fontSize: '0.875rem', cursor: 'pointer' }}
    >
      <ChevronLeft size={18} aria-hidden="true" className="shrink-0" />
      {back.image && <Image src={back.image} alt="" width={48} height={48} className="h-6 w-auto max-w-6 shrink-0 object-contain" />}
      <span className="truncate">{back.name}</span>
    </button>
  )
}
