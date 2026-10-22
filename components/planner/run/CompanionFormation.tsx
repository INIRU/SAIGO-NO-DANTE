'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Copy } from 'lucide-react'
import QuietImage from '@/components/ui/QuietImage'
import { getIdentityImageUrl } from '@/lib/utils/images'
import type { FormationCell } from '@/lib/planner/assist-gift-guide'

/**
 * The run's formation on the formation screen: every sinner in game order with its identity's profile and formation
 * number; the bench is dimmed, a sinner without an identity is an empty cell. The code button copies the formation code.
 */
export default function CompanionFormation({ cells, code }: { cells: FormationCell[]; code: string }) {
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
  return <section data-companion-formation className="space-y-2">
    <ol className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(2.75rem, 1fr))' }}>
      {cells.map(({ sinnerId, slot, position, deployed }) => {
        const src = slot?.game_id && slot.folder_name ? getIdentityImageUrl(slot.sinner_id, slot.folder_name, `${slot.game_id}_normal`) : ''
        return <li key={sinnerId} data-formation-sinner={sinnerId} data-bench={slot && !deployed ? 'true' : undefined} data-empty={slot ? undefined : 'true'}
          aria-label={slot ? [slot.name_kr, position].filter(Boolean).join(' · ') : undefined}
          className={`relative aspect-square overflow-hidden rounded-sm border bg-[var(--bg-elevated)] ${deployed ? 'border-[var(--gold-dim)]' : 'border-[var(--border)] opacity-40'}`}>
          {src && <QuietImage src={src} alt="" fill sizes="48px" className="object-cover" />}
          {position !== null && <span data-formation-position={position}
            className="absolute bottom-0 right-0 min-w-4 rounded-tl-sm bg-[var(--bg-deep)] px-0.5 text-center font-[family-name:var(--font-title)] text-[0.6875rem] leading-4 text-[var(--gold-light)]">{position}</span>}
        </li>
      })}
    </ol>
    {code && <button type="button" onClick={() => { void copy() }}
      className="inline-flex min-h-8 items-center gap-1.5 rounded border border-[var(--border-gold)] px-2.5 text-xs font-semibold text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? t('copied') : t('copyDeckCode')}
    </button>}
  </section>
}
