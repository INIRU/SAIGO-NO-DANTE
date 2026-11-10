'use client'

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import Image from 'next/image'
import { Activity, Crosshair, Gift, UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { splitPlaceholders, type PlaceholderMatch, type PlaceholderToken } from '@/lib/game-text/placeholders'
import { GIFT_KEYWORD_COLORS } from '@/lib/constants/gift'
import styles from './PlaceholderLabel.module.css'

/** A gift a {{gift:<game id>}} token names, as the page knows it. */
export interface PlaceholderGift {
  name: string
  image_url?: string | null
  /** Korean keyword key, for the label colour. */
  keyword?: string | null
  /** Opens the gift (e.g. in the same modal); without it the chip is not a button. */
  onClick?: () => void
}

type GiftLookup = (gameId: number) => PlaceholderGift | null | undefined

const PlaceholderGiftContext = createContext<GiftLookup | null>(null)

/** Lets {{gift:<id>}} labels below show the gift's name (and open it) instead of the generic "gift" label. */
export function PlaceholderGiftProvider({ lookup, children }: { lookup: GiftLookup | null; children: ReactNode }) {
  return <PlaceholderGiftContext.Provider value={lookup}>{children}</PlaceholderGiftContext.Provider>
}

const ICONS: Partial<Record<PlaceholderToken, typeof Activity>> = {
  live: Activity,
  sinner: UserRound,
  target: Crosshair,
  gift: Gift,
}

/**
 * A value the game fills in while playing ({{live}}, {{potency}} … in DB text), drawn as a small inline label. Wording
 * comes from messages `placeholder.*`; the hover title says what the value is.
 */
export default function PlaceholderLabel({ token, giftId }: PlaceholderMatch) {
  const t = useTranslations('placeholder')
  const lookup = useContext(PlaceholderGiftContext)
  const gift = token === 'gift' && giftId != null ? lookup?.(giftId) : null
  const Icon = ICONS[token]
  const hint = t(`hint.${token}`)

  if (gift) {
    // The notes' gift label (globals.css .note-gift-label): icon and name in the keyword colour, no box.
    const style = { '--gift-color': GIFT_KEYWORD_COLORS[gift.keyword ?? ''] ?? '#c8b898', textIndent: 0 } as CSSProperties
    const content = (
      <>
        {gift.image_url && <Image src={gift.image_url} alt="" width={40} height={40} />}
        <strong>{gift.name}</strong>
      </>
    )
    return gift.onClick
      ? <button type="button" data-placeholder="gift" className="note-gift-label" style={style} title={hint} onClick={gift.onClick}>{content}</button>
      : <span data-placeholder="gift" className="note-gift-label" style={style} title={hint}>{content}</span>
  }

  return (
    <span data-placeholder={token} className={styles.chip} title={hint}>
      {Icon && <Icon aria-hidden="true" className={styles.icon} strokeWidth={2.25} />}
      {t(token)}
    </span>
  )
}

/** Plain text with its placeholder tokens drawn as labels (previews that do not highlight keywords). */
export function PlaceholderText({ text }: { text: string | null | undefined }) {
  if (!text) return null
  return <>{splitPlaceholders(text).map((part, i) => typeof part === 'string' ? part : <PlaceholderLabel key={i} {...part} />)}</>
}
