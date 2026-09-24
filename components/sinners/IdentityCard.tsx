'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { Identity, getIdentityInfoUrl, getIdentitySinColor, getSinnerLogoUrl, SIN_COLORS, RARITY_ICON_MAP, BLUR_PLACEHOLDER } from '@/lib/data/sinners'
import { getFormationBannerUrl, getIdentityCardFrameUrl, getSinnerBadgeRingUrl } from '@/lib/utils/images'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import { identityNameLines } from '@/lib/decks/identity-name-lines'
import { identityCardFrame } from '@/lib/decks/identity-card-frame'
import { getLocalizedAffiliation } from '@/lib/i18n'
import type { SupportedLang } from '@/lib/i18n/types'
import styles from '@/styles/components/IdentityCard.module.css'

interface IdentityCardProps {
  identity: Identity
  onClick?: () => void
  selected?: boolean
  gacksung?: boolean
  uptieLevel?: 1 | 2 | 3 | 4
  showName?: boolean
  compact?: boolean
  board?: boolean
  disableHoverEffects?: boolean
  formationOverlay?: {
    kind: 'selected' | 'backup'
    order: number | null
    bannerUrl: string
  }
  giftBadgeUrls?: string[]
}

type IdentityWithRepresentativeKeywords = Identity & {
  skill_keyword_list?: string[] | null
  keywords?: string[] | null
}

const SELECTED_BANNER_URL = getFormationBannerUrl('selected')

function getRepresentativeKeywords(identity: IdentityWithRepresentativeKeywords) {
  return identity.skill_keyword_list && identity.skill_keyword_list.length > 0
    ? identity.skill_keyword_list
    : (identity.keywords ?? [])
}

function getAssociationChips(identity: Identity, locale: SupportedLang) {
  const associations = identity.association_list
    ?.map(association => association.trim())
    .filter(Boolean)

  if (associations && associations.length > 0) {
    return associations.map(association => getLocalizedAffiliation(association, locale))
  }
  return identity.affiliation ? [getLocalizedAffiliation(identity.affiliation, locale)] : []
}

/** Identity card laid out like the in-game formation card (same geometry as the planner's FramedIdentity). */
export default function IdentityCard({
  identity,
  onClick,
  selected = false,
  gacksung = false,
  uptieLevel = 4,
  compact = false,
  showName = true,
  board = false,
  disableHoverEffects = false,
  formationOverlay,
  giftBadgeUrls = [],
}: IdentityCardProps) {
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const t = useTranslations()
  const locale = useLocale() as SupportedLang
  const displayName = (locale === 'en' ? identity.name_en : locale === 'ja' ? identity.name_jp : null) ?? identity.name_kr ?? ''
  const nameLines = identityNameLines(displayName, identity.game_id, locale)
  const associationChips = getAssociationChips(identity, locale)
  const representativeKeywords = getRepresentativeKeywords(identity)
  const sinColor = getIdentitySinColor({ ...identity, keywords: representativeKeywords }, kwSinMap)
  const frame = identityCardFrame(identity.rarity, uptieLevel)
  const frameUrl = getIdentityCardFrameUrl(frame.rarity, frame.uptie)
  const hoverEnabled = !disableHoverEffects && !board
  const overlay = formationOverlay ?? (selected && !board ? { kind: 'selected' as const, order: null, bannerUrl: SELECTED_BANNER_URL } : undefined)

  const infoUrl = getIdentityInfoUrl(identity, gacksung)
  const fallbackUrl = gacksung ? getIdentityInfoUrl(identity, false) : ''
  const [imgSrc, setImgSrc] = useState(infoUrl)
  const [imgKey, setImgKey] = useState(infoUrl)
  // gacksung prop이 바뀌면 이미지 URL 갱신
  if (imgKey !== infoUrl) {
    setImgSrc(infoUrl)
    setImgKey(infoUrl)
  }

  const keywordChips = [...new Set(representativeKeywords.map(normalizeThemeKeyword))].filter(kw => kwSinMap[kw]).slice(0, 3)

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? displayName : undefined}
      onKeyDown={onClick ? event => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() }
      } : undefined}
      className={[styles.card, compact && styles.compact, board && styles.board, hoverEnabled && styles.hoverable].filter(Boolean).join(' ')}
      data-rarity={frame.rarity}
      data-uptie={frame.uptie}
      data-gacksung={gacksung || undefined}
      data-dimmed={overlay || selected ? '' : undefined}
    >
      <div className={styles.face}>
        <span className={styles.art}>
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={displayName}
              fill
              placeholder="blur"
              blurDataURL={getBlurDataURL(imgSrc) ?? BLUR_PLACEHOLDER}
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 160px"
              onError={() => setImgSrc(fallbackUrl && imgSrc !== fallbackUrl ? fallbackUrl : '')}
            />
          ) : (
            <span className={styles.artFallback} style={{ color: `${sinColor}30` }}>{displayName[0]}</span>
          )}
        </span>
        {/* key: remount on uptie change so the previous frame never shows in the new frame's box */}
        <Image key={frameUrl} src={frameUrl} alt="" width={frame.width} height={frame.height} unoptimized className={styles.frame} style={frame.box} />
        {RARITY_ICON_MAP[frame.rarity] && (
          <Image src={RARITY_ICON_MAP[frame.rarity]} alt={(t.raw('identity.rarity') as string[])[frame.rarity] ?? ''} width={frame.rarity * 24} height={24} className={styles.rarity} />
        )}
        <span className={styles.badge} aria-hidden="true">
          <Image src={getSinnerBadgeRingUrl(frame.rarity)} alt="" width={64} height={64} className={styles.ring} />
          <Image src={getSinnerLogoUrl(identity.sinner_id)} alt="" width={48} height={48} className={styles.logo} />
        </span>
        {showName && (
          <span className={styles.label} aria-hidden="true">
            <span className={styles.name} data-locale={locale}>
              {nameLines.map((line, index) => <span key={index}>{line}</span>)}
            </span>
          </span>
        )}
        {overlay && (
          <span className={styles.order} data-kind={overlay.kind} aria-hidden="true">
            <Image src={overlay.bannerUrl} alt="" width={260} height={66} className={styles.banner} />
            {overlay.order != null && <span className={styles.number}>{overlay.order}</span>}
            {giftBadgeUrls.length > 0 && (
              <span className={styles.gifts}>
                {giftBadgeUrls.slice(0, 4).map((url, index) => <Image key={`${url}-${index}`} src={url} alt="" width={24} height={24} />)}
              </span>
            )}
          </span>
        )}
      </div>

      {!compact && (
        <div className={styles.meta}>
          <dl className={styles.stats}>
            {[
              { label: t('identity.stat.hp'), value: identity.hp },
              { label: t('identity.stat.speed'), value: `${identity.speed_min}–${identity.speed_max}` },
              { label: t('identity.stat.defense'), value: identity.def_level },
            ].map(({ label, value }) => (
              <div key={label}>
                <dd>{value}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
          {keywordChips.length > 0 && (
            <div className={styles.chips}>
              {keywordChips.map(kw => {
                const iconUrl = getIconUrl(kw)
                return (
                  <span key={kw} style={{ color: SIN_COLORS[kwSinMap[kw]] || sinColor }}>
                    {iconUrl && <Image src={iconUrl} alt="" width={12} height={12} unoptimized />}
                    {kw}
                  </span>
                )
              })}
            </div>
          )}
          {associationChips.length > 0 && (
            <div className={styles.chips}>
              {associationChips.map(association => <span key={association}>{association}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
