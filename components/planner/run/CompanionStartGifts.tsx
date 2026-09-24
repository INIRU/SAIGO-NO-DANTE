'use client'

import type { MouseEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { GiftData } from '@/lib/planner/types'

/** Run start in the companion: the plan's start and observation gifts to pick before the first pack selection. */
export default function CompanionStartGifts({ start, observe, owned, width, onAcquire }: {
  start: GiftData[]
  observe: GiftData[]
  owned: ReadonlySet<number>
  width: number
  onAcquire: (id: number, event: MouseEvent<HTMLButtonElement>) => void
}) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const name = (gift: GiftData) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const columns = Math.max(1, Math.floor((width + 6) / 62))
  const cell = Math.max(52, Math.min(76, Math.floor((width - (columns - 1) * 6) / columns)))
  const artwork = Math.max(44, Math.min(64, cell - 8))
  const group = (title: string, gifts: GiftData[]) => gifts.length > 0 && <section>
    <h3 className="text-xs font-bold text-[var(--gold-light)]">{title}</h3>
    <ul className="mt-2 grid justify-center gap-[6px]" style={{ gridTemplateColumns: `repeat(${Math.min(columns, gifts.length)}, ${cell}px)` }} data-start-gifts>{gifts.map(gift => {
      const have = owned.has(gift.game_id)
      const label = have ? `${name(gift)} · ${t('owned')}` : t('pipAcquireGift', { name: name(gift) })
      return <li key={gift.game_id} className="min-w-0"><button type="button" data-gift-id={gift.game_id} data-owned={have || undefined} disabled={have} onClick={event => onAcquire(gift.game_id, event)} title={label} aria-label={label} className="relative w-full rounded-sm p-1 text-center hover:bg-[var(--bg-elevated)] disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]"><span className="mx-auto block" style={{ width: artwork }}><GiftArtwork gift={gift} displayName={name(gift)} sizes={`${artwork}px`} /></span>{have && <Check size={16} aria-hidden="true" className="absolute right-1 top-1 text-[var(--gold-light)]" />}<span className="mt-1 block line-clamp-2 break-words text-[0.65rem] leading-4 text-[var(--text-secondary)]">{name(gift)}</span></button></li>
    })}</ul>
  </section>
  return <div className="space-y-3">
    {start.length || observe.length ? <>{group(t('startingGifts'), start)}{group(t('pipObserveGifts'), observe)}</>
      : <p className="text-xs text-[var(--text-tertiary)]">{t('pipStartGiftsEmpty')}</p>}
    <p role="status" className="text-center text-xs text-[var(--text-secondary)]">{t('pipStartThemeWait')}</p>
  </div>
}
