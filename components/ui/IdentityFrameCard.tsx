'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import { RARITY_ICON_MAP } from '@/lib/constants/game'
import { getFormationBannerUrl, getIdentityCardFrameUrl, getIdentityPortraitUrl, getSinnerBadgeRingUrl, getSinnerLogoUrl } from '@/lib/utils/images'
import { identityCardFrame } from '@/lib/decks/identity-card-frame'
import { identityNameLines } from '@/lib/decks/identity-name-lines'
import { isAwakenedUptie } from '@/lib/decks/deck-identity-uptie'
import type { SupportedLang } from '@/lib/i18n/types'
import styles from './IdentityFrameCard.module.css'

export type IdentityFrameCardIdentity = {
  sinner_id: string
  rarity: number
  game_id?: string | null
  folder_name?: string | null
}

const FRONTLINE_SLOT_COUNT = 7
const SELECTED_BANNER_URL = getFormationBannerUrl('selected')
const BACKUP_BANNER_URL = getFormationBannerUrl('backup')

/** 0-based slot_order → SELECTED (1–7) / BACKUP (8–12) banner; 99 or null = not deployed. */
export function getFormationOverlay(slotOrder: number | null) {
  if (slotOrder == null || slotOrder < 0 || slotOrder >= 99) return undefined
  const isFrontline = slotOrder < FRONTLINE_SLOT_COUNT
  return {
    kind: isFrontline ? 'selected' as const : 'backup' as const,
    order: slotOrder + 1,
    bannerUrl: isFrontline ? SELECTED_BANNER_URL : BACKUP_BANNER_URL,
  }
}

/** Uptie I–II: normal art; III–IV: awakened art. */
function artUrl(identity: IdentityFrameCardIdentity, awakened: boolean) {
  if (!identity.game_id || !identity.folder_name) return ''
  return getIdentityPortraitUrl(identity.sinner_id, identity.folder_name, identity.game_id, awakened)
}

/** The standard identity card, laid out like the in-game formation card. Fills its container's width. */
export default function IdentityFrameCard({ identity, uptie = 4, name, order, selected = false, giftBadgeUrls = [], sizes = '10rem' }: {
  identity: IdentityFrameCardIdentity
  /** 1–4; frame and art follow it. Missing = IV. */
  uptie?: number
  /** Localized identity name. */
  name: string
  /** 0-based formation slot; null/99 = not deployed. */
  order?: number | null
  /** Currently equipped (picker): SELECTED banner without a slot number. */
  selected?: boolean
  giftBadgeUrls?: string[]
  sizes?: string
}) {
  const locale = useLocale() as SupportedLang
  const frame = identityCardFrame(identity.rarity, uptie)
  // Some identities have no awakened art; fall back to the normal one.
  const [missingArt, setMissingArt] = useState<string | null>(null)
  const awakenedArt = isAwakenedUptie(frame.uptie) ? artUrl(identity, true) : ''
  const art = awakenedArt && awakenedArt !== missingArt ? awakenedArt : artUrl(identity, false)
  const overlay = getFormationOverlay(order ?? null) ?? (selected ? { kind: 'selected' as const, order: null, bannerUrl: SELECTED_BANNER_URL } : undefined)
  const frameUrl = getIdentityCardFrameUrl(frame.rarity, frame.uptie)
  return (
    <span className={styles.card} data-deployed={overlay?.kind}>
      <span className={styles.art}>
        <span className={styles.portrait}>
          {art && <Image key={art} src={art} alt="" fill sizes={sizes} onError={() => { if (art === awakenedArt) setMissingArt(art) }} />}
        </span>
      </span>
      {/* key: remount on uptie change, otherwise the previous frame stays visible in the new frame's box until the new one loads */}
      <Image key={frameUrl} src={frameUrl} alt="" width={frame.width} height={frame.height} unoptimized loading="eager" className={styles.frame} style={frame.box} />
      <Image src={RARITY_ICON_MAP[frame.rarity]} alt="" width={frame.rarity * 24} height={24} loading="eager" className={styles.rarity} />
      <span className={styles.badge} aria-hidden="true">
        <Image src={getSinnerBadgeRingUrl(frame.rarity)} alt="" width={64} height={64} loading="eager" className={styles.ring} />
        <Image src={getSinnerLogoUrl(identity.sinner_id)} alt="" width={48} height={48} loading="eager" className={styles.logo} />
      </span>
      <span className={styles.label}>
        <span className={styles.name} data-locale={locale}>
          {identityNameLines(name, identity.game_id, locale).map((line, i) => <span key={i}>{line}</span>)}
        </span>
      </span>
      {overlay && (
        <span className={styles.order} aria-hidden="true">
          <Image src={overlay.bannerUrl} alt="" width={260} height={66} className={styles.banner} />
          {overlay.order != null && <span className={styles.number}>{overlay.order}</span>}
          {giftBadgeUrls.length > 0 && (
            <span className={styles.gifts}>
              {giftBadgeUrls.slice(0, 3).map((url, i) => <Image key={i} src={url} alt="" width={20} height={20} />)}
              {giftBadgeUrls.length > 3 && <span>+{giftBadgeUrls.length - 3}</span>}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
