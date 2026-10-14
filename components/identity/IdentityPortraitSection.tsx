'use client'

import { getSinnerBadgeRingUrl } from '@/lib/utils/images'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Maximize2, Play } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import {
  Identity,
  Sinner,
  getIdentityInfoUrl,
  getIdentityProfileUrl,
  getSinnerLogoUrl,
  BLUR_PLACEHOLDER,
} from '@/lib/data/sinners'
import { getBlurDataURL } from '@/lib/utils/thumbhash'
import { useTranslations, useLocale } from 'next-intl'
import type { SupportedLang } from '@/lib/i18n'
import { useAutoFontSize } from '@/lib/hooks/useAutoFontSize'
import { getLocalizedName } from '@/lib/i18n/localize'
import styles from '@/styles/components/SinnerDetail.module.css'
import IdentitySdStage from '@/components/identity/IdentitySdStage'
import IllustViewer from '@/components/identity/IllustViewer'
import type { IdentitySpine } from '@/lib/spine/pack'

interface IdentityPortraitSectionProps {
  sinner: Sinner
  identity: Identity
  gacksung: boolean
  setGacksung: (v: boolean) => void
  showFullArt: boolean
  setShowFullArt: (v: boolean) => void
  sinColor: string
  rarityNum: number
  /** The identity's SD figure, when the Spine pack in Storage holds one. */
  sd?: IdentitySpine | null
  /** The uptie illustration as a skeleton, when the Spine pack holds one: the full view plays it. */
  illust?: IdentitySpine | null
}

export default function IdentityPortraitSection({
  sinner,
  identity,
  gacksung,
  setGacksung,
  showFullArt,
  setShowFullArt,
  sinColor,
  rarityNum,
  sd,
  illust,
}: IdentityPortraitSectionProps) {
  const t = useTranslations()
  const locale = useLocale()
  const localizedName = getLocalizedName(identity, locale as SupportedLang)
  const quote = identity.quote?.trim()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [titleWidth, setTitleWidth] = useState(0)
  const titleSize = useAutoFontSize(localizedName, 2.25, 0.625, titleWidth)
  useEffect(() => {
    const title = titleRef.current
    if (!title) return
    const measure = () => setTitleWidth(title.clientWidth)
    const observer = new ResizeObserver(measure)
    observer.observe(title)
    measure()
    return () => observer.disconnect()
  }, [])
  const infoUrl = getIdentityInfoUrl(identity, gacksung)
  const fallbackInfoUrl = gacksung ? getIdentityInfoUrl(identity, false) : ''

  const [infoSrc, setInfoSrc] = useState(infoUrl)
  const [infoKey, setInfoKey] = useState(infoUrl)

  if (infoKey !== infoUrl) {
    setInfoSrc(infoUrl)
    setInfoKey(infoUrl)
  }

  const fullArtNormal = getIdentityProfileUrl(identity, false)
  const fullArtGacksung = getIdentityProfileUrl(identity, true)
  const [gacksungArtFailed, setGacksungArtFailed] = useState(false)

  const fullArtSrc = gacksung && !gacksungArtFailed ? fullArtGacksung : fullArtNormal

  // Only the uptie illustration has a skeleton. It plays in the full view; with reduced motion the still stays.
  const animated = !!illust?.forms.length
  const reduceMotion = useReducedMotion()
  const [liveFailed, setLiveFailed] = useState(false)
  const live = gacksung && animated && !reduceMotion && !liveFailed

  const closeFullArt = useCallback(() => setShowFullArt(false), [setShowFullArt])

  return (
    <>
      {/* 풀 일러스트: 동기화 일러스트에 뼈대가 있으면 그 자리에서 재생한다 */}
      {showFullArt && fullArtSrc && (
        <IllustViewer
          onClose={closeFullArt}
          name={localizedName}
          src={fullArtSrc}
          illust={live ? illust : null}
          onImageError={() => {
            if (gacksung && !gacksungArtFailed) setGacksungArtFailed(true)
            else closeFullArt()
          }}
          onStageError={() => setLiveFailed(true)}
        />
      )}

      <div className="space-y-4">
        {/* 인격 이름 헤더 */}
        <div className="flex items-center gap-2">
          {/* 등급 프레임 + 수감자 로고 */}
          <div className="relative shrink-0" style={{ width: '2.5rem', height: '2.5rem' }}>
            <Image
              src={getSinnerBadgeRingUrl(rarityNum)}
              alt="" width={40} height={40}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <Image
              src={getSinnerLogoUrl(sinner.id)}
              alt="" width={24} height={24}
              className="absolute inset-0 m-auto"
              style={{ width: '55%', height: '55%', objectFit: 'contain' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              ref={titleRef}
              className="whitespace-nowrap"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', fontSize: `${titleSize}rem`, lineHeight: 1.25, fontWeight: 400 }}
            >
              {localizedName}
            </h1>
            <p className="truncate" style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              {getLocalizedName({ name_kr: sinner.name_kr, name_en: sinner.name, name_jp: sinner.name_jp }, locale as SupportedLang)}
            </p>
          </div>
        </div>

        {/* 일반/각성 토글 */}
        <div className={`${styles.segment} ${styles.segmentFill}`} role="group">
          <button type="button" aria-pressed={!gacksung} onClick={() => setGacksung(false)}>
            {t('identity.portrait.illustration')}
          </button>
          <button type="button" aria-pressed={gacksung} onClick={() => setGacksung(true)}>
            {animated && (
              <span role="img" aria-label={t('identity.portrait.animated')} className="mr-1.5 inline-flex">
                <Play size={11} fill="currentColor" aria-hidden />
              </span>
            )}
            {t('identity.portrait.uptieIllustration')}
          </button>
        </div>

        {/* 인격 정보 이미지 (클릭하면 풀 일러스트) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={`w-full game-card rarity-${rarityNum} ${gacksung ? 'gacksung' : ''} overflow-hidden cursor-pointer`}
            onClick={() => { if (infoSrc) setShowFullArt(true) }}
            title={infoSrc ? t('identity.portrait.viewFull') : undefined}
          >
            {infoSrc ? (
              <Image
                src={infoSrc}
                alt={localizedName}
                width={480}
                height={320}
                quality={90}
                placeholder="blur"
                blurDataURL={getBlurDataURL(infoSrc) ?? BLUR_PLACEHOLDER}
                className="w-full h-auto max-h-[32rem] object-contain mx-auto"
                preload
                onError={() => {
                  if (fallbackInfoUrl && infoSrc !== fallbackInfoUrl) {
                    setInfoSrc(fallbackInfoUrl)
                  } else {
                    setInfoSrc('')
                  }
                }}
              />
            ) : (
              <div
                className="w-full flex items-center justify-center"
                style={{
                  maxWidth: '32rem',
                  margin: '0 auto',
                  aspectRatio: '3/2',
                  background: `linear-gradient(160deg, #1e1810, #0d0a06)`,
                }}
              >
                <span className="font-serif font-light" style={{ fontSize: '4rem', color: `${sinColor}18`, lineHeight: 1 }}>
                  {localizedName[0]}
                </span>
              </div>
            )}
          </button>

          {/* 풀 일러스트로 가는 길은 늘 보인다 (동기화 일러스트에 뼈대가 있으면 재생 표시) */}
          {fullArtSrc && (
            <button type="button" className={styles.artOpen} onClick={() => setShowFullArt(true)}>
              {live ? <Play size={11} fill="currentColor" aria-hidden /> : <Maximize2 size={13} aria-hidden />}
              {t('identity.portrait.viewFull')}
            </button>
          )}
        </div>

        {/* SD와 인격 대사 */}
        {(sd || quote) && (
          <div className="flex flex-col items-center gap-3 border-t border-white/10 pt-4">
            {sd && <IdentitySdStage sd={sd} name={localizedName} className="[--sd-height:9rem] sm:[--sd-height:11rem]" />}
            {/* The game is voiced in Korean only, so the quote is Korean on every page. */}
            {quote && (
              <blockquote
                lang="ko"
                className="max-w-[42ch] px-2 text-[.8125rem] italic leading-[1.85] break-words"
                style={{
                  color: 'var(--text-secondary)',
                }}
              >
                &ldquo;{quote}&rdquo;
              </blockquote>
            )}
          </div>
        )}
      </div>
    </>
  )
}
