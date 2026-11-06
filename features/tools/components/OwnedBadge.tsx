'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useOwnedIdentities } from '@/features/catalog/hooks/useOwnedIdentities'

type Slot = { id?: string | null; sinnerId?: string | null; slot_order?: number | null }

/** Sinners whose formed identity (slot_order < 99) is not in the saved collection; null without a collection or formation. */
export function useMissingSinners(slots: readonly Slot[]): Set<string> | null {
  const owned = useOwnedIdentities()
  const formed = slots.filter(slot => slot.id && slot.sinnerId && (slot.slot_order ?? 99) < 99)
  if (!owned || !formed.length) return null
  return new Set(formed.filter(slot => !owned.has(slot.id!)).map(slot => slot.sinnerId!))
}

/**
 * Corner mark on a deck or plan thumbnail: a check when the whole formation is owned. Missing identities are locked on
 * the thumbnail itself; the count is read out for screen readers only.
 */
export default function OwnedBadge({ missing }: { missing: ReadonlySet<string> | null }) {
  const t = useTranslations('ownedBadge')
  if (!missing) return null
  if (missing.size) return <span className="sr-only">{t('missing', { count: missing.size })}</span>
  return (
    <span
      className="pointer-events-none absolute right-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.75rem] font-semibold leading-4"
      style={{ background: 'rgba(13,11,8,0.86)', color: 'var(--gold-light)', boxShadow: 'inset 0 0 0 1px rgba(200,144,10,0.6)' }}
    >
      <Check size={12} strokeWidth={3} aria-hidden="true" />
      {t('owned')}
    </span>
  )
}

