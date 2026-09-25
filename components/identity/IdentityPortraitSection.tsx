'use client'

import { getSinnerBadgeRingUrl } from '@/lib/utils/images'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X } from 'lucide-react'
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

interface IdentityPortraitSectionProps {
  sinner: Sinner
  identity: Identity
  gacksung: boolean
  setGacksung: (v: boolean) => void
  showFullArt: boolean
  setShowFullArt: (v: boolean) => void
  showArtTip: boolean
  setShowArtTip: (v: boolean) => void
  sinColor: string
  rarityNum: number
}

export default function IdentityPortraitSection({
  sinner,
  identity,
  gacksung,
  setGacksung,
  showFullArt,
  setShowFullArt,
  showArtTip,
  setShowArtTip,
  sinColor,
  rarityNum,
}: IdentityPortraitSectionProps) {
  const t = useTranslations()
  const locale = useLocale()
  const localizedName = getLocalizedName(identity, locale as SupportedLang)
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

  // 전체화면 모달: body 스크롤 잠금 + ESC 닫기
  const closeFullArt = useCallback(() => setShowFullArt(false), [setShowFullArt])

  useEffect(() => {
    if (!showFullArt) return
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFullArt() }
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handler)
    }
  }, [showFullArt, closeFullArt])

  return (
    <>
      {/* 풀 일러스트 오버레이 (GSAP transform 우회를 위해 body에 portal) */}
      {showFullArt && fullArtSrc && createPortal(
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={closeFullArt}
        >
          {/* 닫기 버튼 */}
          <button
            className="absolute top-4 right-4 z-10 p-2 rounded-full transition-colors hover:bg-white/10"
            style={{ color: '#aaa', cursor: 'pointer' }}
            onClick={closeFullArt}
            aria-label={t('common.close')}
          >
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={fullArtSrc}
            src={fullArtSrc}
            alt={localizedName}
            className="max-w-full max-h-[90vh] object-contain"
            style={{ opacity: 0, transition: 'opacity 0.3s ease' }}
            onLoad={(ev) => { (ev.target as HTMLImageElement).style.opacity = '1' }}
            onError={() => {
              if (gacksung && !gacksungArtFailed) {
                setGacksungArtFailed(true)
              } else {
                closeFullArt()
              }
            }}
          />
        </div>,
        document.body
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
            {t('identity.portrait.uptieIllustration')}
          </button>
        </div>

        {/* 인격 정보 이미지 (클릭하면 풀 일러스트) */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={`w-full game-card rarity-${rarityNum} ${gacksung ? 'gacksung' : ''} overflow-hidden cursor-pointer`}
            onClick={() => {
              if (infoSrc) {
                setShowFullArt(true)
                if (showArtTip) {
                  setShowArtTip(false)
                  localStorage.setItem('art-tip-seen', '1')
                }
              }
            }}
            title={infoSrc ? `${t('identity.portrait.artTipTitle')} ${t('identity.portrait.artTipDesc')}` : undefined}
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

          {/* 첫 방문 안내: 풀 일러스트 (그림을 가리지 않게 모서리에) */}
          {showArtTip && (
            <button
              type="button"
              onClick={() => {
                setShowArtTip(false)
                localStorage.setItem('art-tip-seen', '1')
                setShowFullArt(true)
              }}
              className="absolute bottom-3 right-3 max-w-[calc(100%-1.5rem)] rounded px-3 py-2 text-left"
              style={{ background: 'rgba(13,11,8,0.88)', border: '1px solid #4a3a22' }}
            >
              <span className="block text-xs" style={{ color: 'var(--gold)' }}>{t('identity.portrait.artTipTitle')}</span>
              <span className="block text-[0.6875rem]" style={{ color: 'var(--text-secondary)' }}>{t('identity.portrait.artTipDesc')}</span>
            </button>
          )}
        </div>

        {/* 인격 대사 */}
        {/* Quotes exist only in Korean; hide them on en/ja pages. */}
        {identity.quote && locale === 'ko' && (
          <blockquote
            className="mx-auto max-w-[42ch] border-t border-white/10 px-2 pt-4 text-[.8125rem] italic leading-[1.85] break-words"
            style={{
              color: 'var(--text-secondary)',
            }}
          >
            &ldquo;{identity.quote}&rdquo;
          </blockquote>
        )}
      </div>
    </>
  )
}
