'use client'

import { useState, useEffect, useCallback } from 'react'
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
            aria-label="닫기"
          >
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={fullArtSrc}
            src={fullArtSrc}
            alt={identity.name_kr || identity.name}
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

      <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
        {/* 인격 이름 헤더 */}
        <div className="flex items-center gap-2">
          <Image
            src={getSinnerLogoUrl(sinner.id)}
            alt=""
            width={28}
            height={28}
            style={{ width: 'auto', height: 'auto', filter: 'drop-shadow(0 0 4px rgba(200,144,10,0.3))', opacity: 0.9 }}
          />
          <div className="flex-1 min-w-0">
            <h1
              className="font-serif font-bold truncate"
              style={{ color: '#e8dcc8', fontSize: '1.125rem', lineHeight: 1.2 }}
            >
              {identity.name_kr || identity.name}
            </h1>
            <p className="truncate" style={{ color: '#a08a60', fontSize: '0.6875rem' }}>
              {identity.name}
            </p>
          </div>
        </div>

        {/* 일반/각성 토글 */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setGacksung(false)}
            className="flex-1 py-1.5 text-xs font-medium rounded transition-all"
            style={{
              background: !gacksung ? sinColor : 'transparent',
              color: !gacksung ? '#0d0b08' : '#666',
              border: `1px solid ${!gacksung ? sinColor : 'var(--border)'}`,
            }}
          >
            일러스트
          </button>
          <button
            onClick={() => setGacksung(true)}
            className="flex-1 py-1.5 text-xs font-medium rounded transition-all"
            style={{
              background: gacksung ? '#ff6b6b' : 'transparent',
              color: gacksung ? '#0d0b08' : '#666',
              border: `1px solid ${gacksung ? '#ff6b6b' : 'var(--border)'}`,
            }}
          >
            동기화 일러스트
          </button>
        </div>

        {/* 인격 정보 이미지 (클릭하면 풀 일러스트) */}
        <div style={{ position: 'relative' }}>
          <div
            className={`game-card rarity-${rarityNum} ${gacksung ? 'gacksung' : ''} overflow-hidden cursor-pointer`}
            onClick={() => {
              if (infoSrc) {
                setShowFullArt(true)
                if (showArtTip) {
                  setShowArtTip(false)
                  localStorage.setItem('art-tip-seen', '1')
                }
              }
            }}
            title={infoSrc ? '클릭하면 풀 일러스트 보기' : undefined}
          >
            {infoSrc ? (
              <Image
                src={infoSrc}
                alt="인격 정보"
                width={480}
                height={320}
                placeholder="blur"
                blurDataURL={BLUR_PLACEHOLDER}
                className="w-full h-auto max-w-[320px] mx-auto"
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
                  maxWidth: '320px',
                  margin: '0 auto',
                  aspectRatio: '3/2',
                  background: `linear-gradient(160deg, #1e1810, #0d0a06)`,
                }}
              >
                <span className="font-serif font-bold" style={{ fontSize: '4rem', color: `${sinColor}18`, lineHeight: 1 }}>
                  {(identity.name_kr || identity.name)[0]}
                </span>
              </div>
            )}
          </div>

          {/* 첫 방문 툴팁: 풀 일러스트 안내 */}
          {showArtTip && (
            <div
              onClick={() => {
                setShowArtTip(false)
                localStorage.setItem('art-tip-seen', '1')
                setShowFullArt(true)
              }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                animation: 'fadeIn 0.4s ease',
              }}
            >
              <div style={{
                background: 'rgba(26,21,16,0.95)',
                border: '1px solid var(--border-gold)',
                borderRadius: '0.5rem',
                padding: '0.625rem 1rem',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}>
                <p style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.75rem',
                  color: 'var(--gold)',
                  marginBottom: '0.25rem',
                }}>
                  이미지를 탭하면
                </p>
                <p style={{
                  fontSize: '0.6875rem',
                  color: '#9e9e9e',
                }}>
                  풀 일러스트를 볼 수 있어요
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 인격 대사 */}
        {identity.quote && (
          <div
            className="text-xs italic px-3 py-2.5 rounded leading-relaxed"
            style={{
              background: `${sinColor}08`,
              borderLeft: `2px solid ${sinColor}60`,
              color: '#9e9e9e',
            }}
          >
            &ldquo;{identity.quote}&rdquo;
          </div>
        )}
      </div>
    </>
  )
}
