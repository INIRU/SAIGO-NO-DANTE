'use client'

import type { MouseEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { GiftAdvice, GiftReason } from '@/lib/planner/assist-gift-guide'
import type { GiftData } from '@/lib/planner/types'

/** The best gifts on screen for this run, each with its reasons as short tags; a click records the gift as acquired. */
export default function CompanionGiftAdvice({ advice, onAcquire }: { advice: GiftAdvice[]; onAcquire: (giftId: number, event: MouseEvent<HTMLButtonElement>) => void }) {
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
    <ol className="space-y-1">{advice.map(({ gift, reasons }) => <li key={gift.game_id}>
      <button type="button" data-advice-gift={gift.game_id} onClick={event => onAcquire(gift.game_id, event)} aria-label={[t('pipAcquireGift', { name: name(gift) }), ...reasons.map(tag)].join(' · ')}
        className="flex w-full items-center gap-2 rounded-sm p-1 text-left hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
        <span className="w-10 shrink-0"><GiftArtwork gift={gift} displayName={name(gift)} sizes="40px" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-[var(--text-primary)]">{name(gift)}</span>
          <span className="mt-0.5 flex flex-wrap gap-1">{reasons.map(reason => <span key={reason.kind}
            className="rounded-sm bg-[rgba(200,144,10,0.15)] px-1 text-[0.625rem] leading-4 text-[var(--gold-light)]">{tag(reason)}</span>)}</span>
        </span>
      </button>
    </li>)}</ol>
  </section>
}
