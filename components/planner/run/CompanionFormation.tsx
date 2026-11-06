'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Copy } from 'lucide-react'
import IdentityFrameCard from '@/features/catalog/components/IdentityFrameCard'
import QuietImage from '@/components/ui/QuietImage'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import type { FormationCell } from '@/lib/planner/assist-gift-guide'

const CARD_ASPECT = 290 / 428
const GAP = 6

/** Card width for 6 × 2 cards in a `width` × `height` area: the tighter of the two fits. */
export function formationCardWidth(width: number, height: number) {
  return Math.max(24, Math.floor(Math.min((width - 5 * GAP) / 6, ((height - GAP) / 2) * CARD_ASPECT)))
}

/**
 * The run's formation on the formation screen as the game shows it: 6 × 2 formation cards in sinner order, each with its
 * SELECTED/BACKUP banner and number; a sinner without an identity keeps an empty card. Sized to the window's free area.
 */
export default function CompanionFormation({ cells, code, width, height }: { cells: FormationCell[]; code: string; width: number; height: number }) {
  const t = useTranslations('planner.detail')
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success(t('copied'))
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('copyDeckCodeFailed'))
    }
  }
  const card = formationCardWidth(width, height - (code ? 40 : 0))
  return <section data-companion-formation className="flex flex-col items-center gap-2">
    <ol className="grid justify-center" style={{ gridTemplateColumns: `repeat(6, ${card}px)`, gap: GAP }}>
      {cells.map(({ sinnerId, slot, position, deployed }) => <li key={sinnerId} data-formation-sinner={sinnerId}
        data-bench={slot && !deployed ? 'true' : undefined} data-empty={slot ? undefined : 'true'} data-formation-position={position ?? undefined}
        aria-label={slot ? [slot.name_kr, position].filter(Boolean).join(' · ') : undefined} className={slot && !deployed ? 'opacity-75' : undefined}>
        {slot ? <IdentityFrameCard identity={slot} uptie={slot.uptie} name={slot.name_kr} order={slot.slot_order} sizes={`${card}px`} />
          : <span className="relative grid w-full place-items-center rounded-sm border border-[var(--border)] bg-[var(--bg-elevated)]" style={{ aspectRatio: CARD_ASPECT }}>
            <span className="relative w-1/2 opacity-25" style={{ aspectRatio: 1 }}><QuietImage src={getSinnerLogoUrl(sinnerId)} alt="" fill sizes="48px" className="object-contain" /></span>
          </span>}
      </li>)}
    </ol>
    {code && <button type="button" onClick={() => { void copy() }}
      className="inline-flex min-h-8 items-center gap-1.5 self-end rounded border border-[var(--border-gold)] px-2.5 text-xs font-semibold text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? t('copied') : t('copyDeckCode')}
    </button>}
  </section>
}
