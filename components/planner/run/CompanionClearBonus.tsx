'use client'

import { useLocale, useTranslations } from 'next-intl'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { GiftData } from '@/lib/planner/types'

interface Props {
  /** The bonus gifts in the card's order. */
  gifts: GiftData[]
  planned: ReadonlySet<number>
  owned: ReadonlySet<number>
  /** How many the boss lets the player take (one on a normal floor, two on harder ones). */
  picks: number
  /** A heading in front of the row (the pack's name on a selection screen); the plain title otherwise. */
  label?: string
  iconSize?: number
  /** A small window: tighter box. */
  compact?: boolean
}

/**
 * A pack's CLEAR BONUS for a player who may not know it: beating the floor's boss offers these gifts and `picks` of them
 * are taken, so a planned gift among them need not be bought in this floor's shop (unless there are more planned ones
 * than picks).
 */
export default function CompanionClearBonus({ gifts, planned, owned, picks, label, iconSize = 36, compact = false }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const localized = (gift: GiftData) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const wanted = gifts.filter(gift => planned.has(gift.game_id) && !owned.has(gift.game_id))
  const names = wanted.map(localized).join(', ')
  const advice = !wanted.length ? t('clearBonusNoPlan')
    : wanted.length <= picks ? t('clearBonusSkipShop', { names })
    : t('clearBonusTooMany', { planned: wanted.length, count: picks })
  return <section data-clear-bonus aria-label={label ?? t('clearBonusTitle')}
    className={`rounded-md border border-[color-mix(in_srgb,var(--gold)_35%,var(--border))] bg-[var(--bg-card)] ${compact ? 'px-2 py-1.5' : 'px-2.5 py-2'}`}>
    <p className="flex flex-wrap items-baseline gap-x-2 text-[0.6875rem] leading-4">
      <span className="font-bold text-[var(--gold-light)]">{label ?? t('clearBonusTitle')}</span>
      <span className="text-[var(--text-secondary)]">{t('clearBonusPicks', { count: picks })}</span>
    </p>
    <ul className="mt-1.5 flex flex-wrap gap-1">{gifts.map(gift => {
      const want = planned.has(gift.game_id) && !owned.has(gift.game_id)
      const have = owned.has(gift.game_id)
      const name = [localized(gift), want && t('pipPlanGift'), have && t('owned')].filter(Boolean).join(' · ')
      return <li key={gift.game_id} title={name} aria-label={name} data-bonus-planned={want || undefined} data-owned={have || undefined}
        className={`block rounded-sm p-0.5 ${want ? 'ring-2 ring-[var(--gold)]' : ''} ${have ? 'opacity-40' : ''}`} style={{ width: iconSize + 4 }}>
        <GiftArtwork gift={gift} displayName={localized(gift)} sizes={`${iconSize}px`} />
      </li>
    })}</ul>
    <p className={`mt-1.5 break-keep text-[0.6875rem] leading-4 ${wanted.length ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>{advice}</p>
  </section>
}
