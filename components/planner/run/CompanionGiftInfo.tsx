'use client'

import { useCallback, useEffect, useState, type FocusEvent, type PointerEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { EffectText, localizedGiftText } from '@/components/ui/GiftDetailModal'
import { getLocalizedName, localizeGiftKeyword } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { getGiftKeywordColor } from '@/lib/constants/gift'
import type { GiftData } from '@/lib/planner/types'
import type { GiftBadge } from '@/lib/planner/pip-view'

type Shown = { gift: GiftData; badges: GiftBadge[]; rect: DOMRect; view: Window }

/**
 * Gift details on hover or keyboard focus, so the PiP's gift cells need no name under them: one card for the whole view,
 * fixed beside the cell (below it, or above when there is no room), kept inside the window it is in (the PiP or a page).
 * `bind(gift, badges)` gives a cell its handlers; `card` is drawn once in the view.
 */
export function useGiftInfo() {
  const [shown, setShown] = useState<Shown | null>(null)
  const show = useCallback((gift: GiftData, badges: GiftBadge[], element: Element) => {
    const view = element.ownerDocument.defaultView
    if (view) setShown({ gift, badges, rect: element.getBoundingClientRect(), view })
  }, [])
  const hide = useCallback(() => setShown(null), [])
  // a scroll moves the cell away from the card
  useEffect(() => {
    if (!shown) return
    const view = shown.view
    view.addEventListener('scroll', hide, true)
    return () => view.removeEventListener('scroll', hide, true)
  }, [shown, hide])
  const bind = (gift: GiftData, badges: GiftBadge[] = []) => ({
    onPointerEnter: (event: PointerEvent<HTMLElement>) => { if (event.pointerType !== 'touch') show(gift, badges, event.currentTarget) },
    onPointerLeave: hide,
    onFocus: (event: FocusEvent<HTMLElement>) => show(gift, badges, event.currentTarget),
    onBlur: hide,
  })
  return { bind, card: shown ? <GiftInfoCard {...shown} /> : null }
}

const CARD_WIDTH = 264

function GiftInfoCard({ gift, badges, rect, view }: Shown) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const name = getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const effect = localizedGiftText(locale, gift.effect_base, gift.effect_base_en, gift.effect_base_jp)
  const color = getGiftKeywordColor(gift.keyword)
  const width = Math.min(CARD_WIDTH, view.innerWidth - 16)
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, view.innerWidth - width - 8))
  // below the cell when the lower half of the window has more room, else above it
  const below = view.innerHeight - rect.bottom >= rect.top
  const room = Math.max(120, (below ? view.innerHeight - rect.bottom : rect.top) - 16)
  return <div role="tooltip" data-gift-info={gift.game_id}
    className="pointer-events-none fixed z-50 overflow-hidden rounded-md border border-[var(--border-gold)] bg-[var(--bg-panel)] p-2.5 text-left shadow-[0_0.5rem_1.5rem_rgba(0,0,0,0.6)]"
    style={{ width, left, maxHeight: room, ...(below ? { top: rect.bottom + 6 } : { bottom: view.innerHeight - rect.top + 6 }) }}>
    <p className="text-sm font-bold leading-5" style={{ color }}>{name}</p>
    <p className="mt-0.5 flex flex-wrap gap-x-2 text-[0.6875rem] leading-4 text-[var(--text-secondary)]">
      {gift.grade && <span>{t('giftInfoTier', { tier: gift.grade })}</span>}
      {gift.keyword && <span>{localizeGiftKeyword(gift.keyword, locale)}</span>}
      {typeof gift.price === 'number' && gift.price > 0 && <span>{t('giftInfoPrice', { price: gift.price })}</span>}
    </p>
    {badges.length > 0 && <ul className="mt-1.5 flex flex-wrap gap-1">{badges.map(badge =>
      <li key={badge.key} className={`rounded-sm px-1.5 text-[0.625rem] font-bold leading-4 ${badge.tone === 'warn' ? 'bg-[color-mix(in_srgb,var(--error)_25%,transparent)] text-[var(--error-text)]'
        : 'bg-[color-mix(in_srgb,var(--gold)_22%,transparent)] text-[var(--gold-light)]'}`}>{badge.label}</li>)}</ul>}
    {effect && <div className="mt-1.5 text-xs leading-5 text-[var(--text-primary)]"><EffectText text={effect} color={color} /></div>}
  </div>
}
