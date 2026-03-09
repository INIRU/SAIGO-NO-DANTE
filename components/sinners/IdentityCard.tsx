'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Identity, getIdentityInfoUrl, getIdentitySinColor, SIN_COLORS, RARITY_ICON_MAP, RARITY_FRAME_MAP, RARITY_COLORS, BLUR_PLACEHOLDER } from '@/lib/data/sinners'
import { useKeywordData } from '@/components/providers/KeywordProvider'
import styles from '@/styles/components/IdentityCard.module.css'


interface IdentityCardProps {
  identity: Identity
  onClick?: () => void
  selected?: boolean
  gacksung?: boolean
  compact?: boolean
}

export default function IdentityCard({ identity, onClick, selected = false, gacksung = false, compact = false }: IdentityCardProps) {
  const { sinMap: kwSinMap, getIconUrl } = useKeywordData()
  const sinColor = getIdentitySinColor(identity, kwSinMap)
  const rarity = RARITY_COLORS[identity.rarity] || RARITY_COLORS[1]
  const rarityNum = identity.rarity
  const infoUrl = getIdentityInfoUrl(identity, gacksung)
  const fallbackUrl = gacksung ? getIdentityInfoUrl(identity, false) : ''
  const [imgSrc, setImgSrc] = useState(infoUrl)
  const [imgKey, setImgKey] = useState(infoUrl)
  const cardRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLImageElement>(null)
  const gsapRef = useRef<typeof import('gsap')['default'] | null>(null)

  // gacksung prop이 바뀌면 이미지 URL 갱신
  if (imgKey !== infoUrl) {
    setImgSrc(infoUrl)
    setImgKey(infoUrl)
  }

  // GSAP 모듈 캐싱 로드
  const getGsap = useCallback(async () => {
    if (!gsapRef.current) {
      const mod = await import('gsap')
      gsapRef.current = mod.default
    }
    return gsapRef.current
  }, [])

  const handleMouseEnter = useCallback(async () => {
    const gsap = await getGsap()
    if (cardRef.current) {
      gsap.to(cardRef.current, { scale: 1.04, duration: 0.3, ease: 'power2.out' })
    }
    if (frameRef.current) {
      gsap.to(frameRef.current, {
        filter: `drop-shadow(0 0 8px ${rarity.glow}) brightness(1.3)`,
        duration: 0.3,
        ease: 'power2.out',
      })
    }
  }, [rarity.glow, getGsap])

  const handleMouseLeave = useCallback(async () => {
    const gsap = await getGsap()
    if (cardRef.current) {
      gsap.to(cardRef.current, { scale: 1, duration: 0.25, ease: 'power2.inOut' })
    }
    if (frameRef.current) {
      gsap.to(frameRef.current, {
        filter: 'drop-shadow(0 0 0px transparent) brightness(1)',
        duration: 0.25,
        ease: 'power2.inOut',
      })
    }
  }, [getGsap])

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      data-rarity={rarityNum}
      data-gacksung={gacksung || undefined}
      style={{ transformOrigin: 'center center' }}
    >
      {/* 포트레이트 영역 */}
      <div className={styles.portrait} style={{ aspectRatio: '2/3' }}>

        {/* 일러스트 */}
        <div className={styles.portraitInner}>
          {imgSrc ? (
            <Image
              src={imgSrc}
              alt={identity.name_kr || identity.name}
              fill
              placeholder="blur"
              blurDataURL={BLUR_PLACEHOLDER}
              className="object-cover object-top"
              onError={() => {
                if (fallbackUrl && imgSrc !== fallbackUrl) {
                  setImgSrc(fallbackUrl)
                } else {
                  setImgSrc('')
                }
              }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(160deg, #1e1810 0%, #0d0a06 100%)` }}
            >
              <span
                className="font-serif font-bold"
                style={{ fontSize: '2.25rem', color: `${sinColor}18`, lineHeight: 1 }}
              >
                {identity.name[0]}
              </span>
            </div>
          )}
          <div className={styles.gradient} />
        </div>

        {/* 인격명 */}
        <div className={`${styles.name} font-semibold`}>
          {identity.name_kr || identity.name}
        </div>

        {/* 등급 아이콘 */}
        <div className={styles.rarityIcon}>
          {RARITY_ICON_MAP[identity.rarity] ? (
            <Image
              src={RARITY_ICON_MAP[identity.rarity]}
              alt={`${identity.rarity}성`}
              width={identity.rarity === 1 ? 20 : identity.rarity === 2 ? 34 : 46}
              height={14}
             
              style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.9))' }}
            />
          ) : (
            <span
              className="font-mono font-bold"
              style={{
                color: rarity.border,
                fontSize: '0.625rem',
                background: 'rgba(13,11,8,0.85)',
                padding: '0.0625rem 0.3125rem',
                borderRadius: '0.125rem',
                border: `1px solid ${rarity.border}40`,
              }}
            >
              {identity.rarity}성
            </span>
          )}
        </div>

        {/* 등급 프레임 오버레이 */}
        {RARITY_FRAME_MAP[identity.rarity] && (
          <Image
            ref={frameRef}
            src={RARITY_FRAME_MAP[identity.rarity]}
            alt=""
            width={200}
            height={300}
           
            className={styles.frame}
          />
        )}
      </div>

      {/* 스탯 바 (compact 모드에서는 숨김) */}
      {!compact && (
        <div
          className="px-2 py-1.5"
          style={{
            borderTop: `1px solid ${sinColor}30`,
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          <div className="grid grid-cols-3 gap-1 text-center">
            {[
              { label: 'HP', value: identity.hp },
              { label: '속도', value: `${identity.speed_min}-${identity.speed_max}` },
              { label: '방어', value: identity.def_level },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="font-mono font-semibold" style={{ color: sinColor, fontSize: '0.625rem' }}>
                  {value}
                </div>
                <div style={{ color: '#7a6840', fontSize: '0.5rem' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* 키워드 배지 */}
          {identity.keywords && identity.keywords.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {identity.keywords.filter(kw => kwSinMap[kw]).slice(0, 3).map(kw => {
                const kwColor = SIN_COLORS[kwSinMap[kw]] || sinColor
                const iconUrl = getIconUrl(kw)
                return (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-0.5"
                    style={{
                      background: `${kwColor}18`,
                      color: kwColor,
                      border: `1px solid ${kwColor}35`,
                      borderRadius: '2px',
                      fontSize: '0.5rem',
                      padding: '0.0625rem 0.1875rem',
                    }}
                  >
                    {iconUrl && (
                      <Image src={iconUrl} alt="" width={10} height={10} style={{ display: 'inline-block' }} />
                    )}
                    {kw}
                  </span>
                )
              })}
            </div>
          )}

          {/* 소속 */}
          {identity.affiliation && (
            <div className="mt-1">
              <span
                style={{
                  background: `${sinColor}18`,
                  color: sinColor,
                  border: `1px solid ${sinColor}40`,
                  borderRadius: '2px',
                  fontSize: '0.5rem',
                  padding: '0 0.25rem',
                }}
              >
                {identity.affiliation}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
