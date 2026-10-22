'use client'

import type { MouseEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { GiftAdvice, GiftReason } from '@/lib/planner/assist-gift-guide'
import type { GiftData } from '@/lib/planner/types'

/**
 * The gifts on screen, best first, as artwork only (name and reasons in the title and label); a click records the gift
 * as acquired. One row on the gift grid's own columns, cell and artwork size, so it lines up with the grid below; the
 * row is held for the whole offering screen (three empty cells until gifts are read), so nothing below moves.
 */
export default function CompanionGiftAdvice({ advice, columns, cell, artwork, onAcquire }: { advice: GiftAdvice[]; columns: number; cell: number; artwork: number
  onAcquire: (giftId: number, event: MouseEvent<HTMLButtonElement>) => void }) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const name = (gift: GiftData) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const tag = (reason: GiftReason) => reason.kind === 'final' ? t('adviceFinal')
    : reason.kind === 'material' ? t(reason.complete ? 'adviceMaterialComplete' : 'adviceMaterial', { name: name(reason.result) })
    : reason.kind === 'keyword' ? t('deckKeyword')
    : reason.kind === 'synergy' ? t('adviceSynergy')
    : t('advicePopular', { percent: Math.round(reason.share * 100) })
  return <section data-gift-advice aria-label={t('pipGiftAdvice')}>
    <h3 className="mb-1.5 flex items-center gap-2 text-[0.6875rem] font-bold text-[var(--gold-light)]"><span>{t('pipGiftAdvice')}</span><span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" /></h3>
    <ol className="grid justify-center gap-[6px]" style={{ gridTemplateColumns: `repeat(${columns}, ${cell}px)` }}>{Array.from({ length: advice.length || Math.min(columns, 3) }, (_, index) => {
      const item = advice[index]
      if (!item) return <li key={index} aria-hidden="true" className="p-1"><span className="mx-auto block rounded-sm border border-dashed border-[var(--border)]" style={{ width: artwork, height: artwork }} /></li>
      const { gift, reasons } = item
      return <li key={index}>
        <button type="button" data-advice-gift={gift.game_id} onClick={event => onAcquire(gift.game_id, event)} title={[name(gift), ...reasons.map(tag)].join('\n')}
          aria-label={[t('pipAcquireGift', { name: name(gift) }), ...reasons.map(tag)].join(', ')}
          className="w-full rounded-sm p-1 transition-transform duration-150 ease-out hover:bg-[var(--bg-elevated)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] motion-reduce:transition-none">
          <span className="relative mx-auto block" style={{ width: artwork }}><GiftArtwork gift={gift} displayName={name(gift)} sizes={`${artwork}px`} />
            <span aria-hidden="true" data-advice-rank={index + 1} className="absolute -bottom-0.5 -left-0.5 z-40 min-w-4 rounded-tr-sm bg-[var(--bg-deep)] px-0.5 text-center font-[family-name:var(--font-title)] text-[0.8125rem] leading-4 tabular-nums text-[var(--gold-light)]">{index + 1}</span></span>
        </button>
      </li>
    })}</ol>
  </section>
}
