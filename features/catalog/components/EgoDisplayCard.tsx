'use client'

import { getFormationBannerUrl } from '@/lib/utils/images'
import { getGameUiAsset } from '@/lib/utils/game-ui'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import IntentLink from '@/components/ui/IntentLink'
import { GRADE_COLORS, type SinType, getSinnerLogoUrl, normalizeSin } from '@/lib/data/sinners'
import type { SupportedLang } from '@/lib/i18n/types'
import {
  EGO_NAME_FIT_BUFFER_PX,
  EGO_NAME_FONT_FAMILY,
  EGO_NAME_MAX_FONT_REM,
  cachedEgoNameLayout,
  watchEgoNameBox,
  whenEgoNameReady,
  type EgoNameLineLayout,
} from '../lib/ego-name-layout'
import { getBlurDataURL } from '@/lib/utils/thumbhash'

type EgoDisplayCardProps = {
  ego: {
    grade: string
    max_construe_level?: number
    image_url?: string | null
    sin_affinity?: string | null
  }
  href?: string
  name: string
  onClick?: () => void
  sinnerId: string
  className?: string
  lang?: SupportedLang
  selected?: boolean
  displayOnly?: boolean
  /** Load the artwork ahead of other images (cards in the first row of a page). */
  preload?: boolean
}

const EGO_UI_BASE = '/assets/ego-ui'
const EGO_FRAME_OUTER_SRC = `${EGO_UI_BASE}/common-frame/ego-frame-outer.webp`
const EGO_SIN_FRAME_SRC: Record<SinType, string> = {
  wrath: `${EGO_UI_BASE}/sin-frames/sin-frame-candidate-01.webp`,
  lust: `${EGO_UI_BASE}/sin-frames/sin-frame-candidate-07.webp`,
  sloth: `${EGO_UI_BASE}/sin-frames/sin-frame-candidate-03.webp`,
  gluttony: `${EGO_UI_BASE}/sin-frames/sin-frame-candidate-06.webp`,
  gloom: `${EGO_UI_BASE}/sin-frames/sin-frame-candidate-04.webp`,
  pride: `${EGO_UI_BASE}/sin-frames/sin-frame-candidate-05.webp`,
  envy: `${EGO_UI_BASE}/sin-frames/sin-frame-candidate-02.webp`,
}

const EGO_GRADE_SYMBOLS: Record<string, { src: string; width: number; height: number }> = {
  ZAYIN: { src: `${EGO_UI_BASE}/grade-symbols/grade-zayin-symbol.webp`, width: 80, height: 134 },
  TETH: { src: `${EGO_UI_BASE}/grade-symbols/grade-teth-symbol.webp`, width: 118, height: 128 },
  HE: { src: `${EGO_UI_BASE}/grade-symbols/grade-he-symbol.webp`, width: 118, height: 138 },
  WAW: { src: `${EGO_UI_BASE}/grade-symbols/grade-waw-symbol.webp`, width: 71, height: 138 },
  ALEPH: { src: `${EGO_UI_BASE}/grade-symbols/grade-aleph-symbol.webp`, width: 137, height: 136 },
}
const EGO_RANK_BANNER_SRC_BY_GRADE: Record<string, string> = {
  ZAYIN: `${EGO_UI_BASE}/rank-banners/zayin.webp`,
  TETH: `${EGO_UI_BASE}/rank-banners/teth.webp`,
  HE: `${EGO_UI_BASE}/rank-banners/he.webp`,
  WAW: `${EGO_UI_BASE}/rank-banners/waw.webp`,
  ALEPH: `${EGO_UI_BASE}/rank-banners/aleph.webp`,
}
const EGO_SELECTED_BANNER_SRC = getFormationBannerUrl('selected')
const EGO_HOVER_URL = getGameUiAsset('formation/ego-hover')
const ROMAN_STAGES = ['', 'I', 'II', 'III', 'IV', 'V']
const EGO_BADGE_RING_SRC = `${EGO_UI_BASE}/common-frame/sinner-badge.webp`

const getEgoCgImageUrl = (imageUrl?: string | null) => {
  if (!imageUrl) return null

  const cgUrl = imageUrl.replace(/_(?:awaken|corrosion)_profile\.webp(?=$|[?#])/, '_cg.webp')

  return cgUrl === imageUrl ? imageUrl : cgUrl
}

const isFinalEgoArtworkLoad = (loadedSrc: string, expectedSrc: string) => {
  if (!loadedSrc || !expectedSrc) return false

  let decodedLoadedSrc = loadedSrc
  try {
    decodedLoadedSrc = decodeURIComponent(loadedSrc)
  } catch {
    decodedLoadedSrc = loadedSrc
  }


  return expectedSrc.includes('_cg.') && decodedLoadedSrc.includes(expectedSrc)
}

function EgoCardName({ lang, name }: { lang: SupportedLang; name: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<EgoNameLineLayout>({
    allowAnywhere: false,
    fontSizeRem: EGO_NAME_MAX_FONT_REM,
    lineHeight: 1,
    lines: [name],
  })

  useEffect(() => {
    const box = boxRef.current
    if (!box) return

    const updateLayout = () => {
      const width = Math.max(1, box.clientWidth - EGO_NAME_FIT_BUFFER_PX)
      if (width <= 0) return

      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const nextLayout = cachedEgoNameLayout(name, lang, width, rootFontSize)

      setLayout(previous => {
        const sameLines = previous.lines.length === nextLayout.lines.length &&
          previous.lines.every((line, index) => line === nextLayout.lines[index])
        if (
          sameLines &&
          previous.fontSizeRem === nextLayout.fontSizeRem &&
          previous.lineHeight === nextLayout.lineHeight &&
          previous.allowAnywhere === nextLayout.allowAnywhere
        ) {
          return previous
        }
        return nextLayout
      })
    }

    let cancelled = false
    let stopWatching: (() => void) | undefined
    const start = () => {
      if (cancelled) return
      updateLayout()
      stopWatching = watchEgoNameBox(box, updateLayout)
    }
    // the first card waits for the library; the rest start at once
    whenEgoNameReady(start)
    return () => { cancelled = true; stopWatching?.() }
  }, [lang, name])

  return (
    <div
      ref={boxRef}
      className="absolute left-[20%] right-[20%] top-[62%] z-[35] flex -translate-y-1/2 items-center justify-center"
    >
      <span
        className="min-w-0 text-center"
        title={name}
        style={{
          color: '#fff0b8',
          display: 'inline-flex',
          flexDirection: 'column',
          fontFamily: EGO_NAME_FONT_FAMILY,
          fontSize: `${layout.fontSizeRem}rem`,
          fontWeight: 500,
          lineHeight: layout.lineHeight,
          maxHeight: '1.75rem',
          overflow: 'visible',
          overflowWrap: 'break-word',
          textShadow: '0 0.0625rem 0.0625rem rgba(0,0,0,0.9)',
          whiteSpace: 'normal',
          wordBreak: 'keep-all',
        }}
      >
        {layout.lines.slice(0, 2).map((line, lineIndex) => (
          <span
            key={`${line}-${lineIndex}`}
            style={{
              display: 'block',
              maxWidth: '100%',
              overflow: 'visible',
              overflowWrap: layout.allowAnywhere ? 'anywhere' : 'normal',
              whiteSpace: layout.allowAnywhere ? 'normal' : 'nowrap',
            }}
          >
            {line}
          </span>
        ))}
      </span>
    </div>
  )
}

function EgoDisplayCardBody({ ego, name, selected, sinnerId, lang, preload }: Required<Pick<EgoDisplayCardProps, 'ego' | 'name' | 'selected' | 'sinnerId' | 'lang' | 'preload'>>) {
  const stage = [1, 2, 3, 4, 5].includes(ego.max_construe_level ?? 4) ? (ego.max_construe_level ?? 4) : 4
  const gradeColor = GRADE_COLORS[ego.grade] ?? '#667788'
  const sinType = normalizeSin(ego.sin_affinity ?? null)
  const sinFrameSrc = sinType ? EGO_SIN_FRAME_SRC[sinType] : EGO_SIN_FRAME_SRC.gloom
  const gradeSymbol = EGO_GRADE_SYMBOLS[ego.grade] ?? EGO_GRADE_SYMBOLS.ZAYIN
  const rankBannerSrc = EGO_RANK_BANNER_SRC_BY_GRADE[ego.grade]
  const egoArtworkSrc = getEgoCgImageUrl(ego.image_url)
  const artworkBlurDataURL = getBlurDataURL(egoArtworkSrc)
  const [artLoaded, setArtLoaded] = useState(false)

  useEffect(() => {
    setArtLoaded(false)
  }, [egoArtworkSrc])

  return (
    <div
      className="relative flex w-full max-w-[9.5rem] flex-col items-center sm:max-w-[10rem]"
      style={{
        filter: 'drop-shadow(0 0.25rem 0.375rem rgba(0,0,0,0.7))',
        paddingTop: '1.05rem',
      }}
    >
      <div
        className="absolute left-1/2 top-0 z-50 flex -translate-x-1/2 items-center justify-center"
        style={{
          width: '2.45rem',
          height: '2.45rem',
        }}
      >
        <Image
          src={getSinnerLogoUrl(sinnerId)}
          alt=""
          width={44}
          height={44}
          className="relative z-10 select-none object-contain"
          style={{
            width: '1.52rem',
            height: '1.52rem',
            filter: 'drop-shadow(0 0 0.1875rem rgba(0,0,0,0.9))',
          }}
        />
        <Image
          src={EGO_BADGE_RING_SRC}
          alt=""
          fill
          className="pointer-events-none select-none object-contain"
          sizes="2.45rem"
          unoptimized
        />
      </div>

      <div
        className="relative z-10"
        style={{
          width: '8.35rem',
          height: '8.35rem',
        }}
      >
        <div
          className="absolute"
          style={{
            inset: '0.2rem',
            borderRadius: '9999px',
            clipPath: 'circle(47.5% at 50% 50%)',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 1rem rgba(0,0,0,0.72), 0 0.28rem 0.55rem rgba(0,0,0,0.42)',
          }}
        >
          {egoArtworkSrc ? (
            <>
              {artworkBlurDataURL ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute"
                  style={{
                    backgroundImage: `url(${artworkBlurDataURL})`,
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'cover',
                    clipPath: 'circle(47% at 50% 50%)',
                    filter: 'saturate(1.05)',
                    inset: '0.25rem',
                    opacity: artLoaded ? 0 : 1,
                    transition: 'opacity 160ms ease-out',
                  }}
                />
              ) : null}
              <Image
                src={egoArtworkSrc}
                alt=""
                fill
                className="object-contain"
                sizes="8.35rem"
                preload={preload}
                style={{
                  filter: selected ? 'brightness(0.58) saturate(0.86)' : 'none',
                  transition: 'filter 160ms ease-out',
                }}
                onError={() => setArtLoaded(false)}
                onLoad={event => {
                  if (isFinalEgoArtworkLoad(event.currentTarget.currentSrc, egoArtworkSrc)) {
                    setArtLoaded(true)
                  }
                }}
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ filter: selected ? 'brightness(0.58) saturate(0.86)' : 'none' }}>
              <span style={{ fontFamily: 'monospace', color: gradeColor, fontSize: '0.875rem' }}>{ego.grade?.[0]}</span>
            </div>
          )}
          {selected && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'linear-gradient(180deg, rgba(5,3,2,0.2) 0%, rgba(5,3,2,0.08) 42%, rgba(5,3,2,0.34) 100%)',
                }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 justify-center overflow-hidden"
                style={{
                  width: '7.95rem',
                  height: '2.35rem',
                }}
              >
                <Image
                  src={EGO_SELECTED_BANNER_SRC}
                  alt=""
                  width={320}
                  height={96}
                  className="select-none object-contain"
                  sizes="7.95rem"
                  style={{
                    width: '7.95rem',
                    height: 'auto',
                    filter: 'drop-shadow(0 0.25rem 0.65rem rgba(0,0,0,0.58))',
                  }}
                  aria-hidden="true"
                />
              </div>
            </>
          )}
        </div>
        <Image
          src={EGO_FRAME_OUTER_SRC}
          alt=""
          fill
          className="pointer-events-none select-none object-contain"
          sizes="8.35rem"
        />
        {/* FormationSwitchableEgoUIScrollViewItem ClickedFrame / SelectedFrame (MainUI_Formation_9_4): its ring is 1.66% wider
            than the frame's, centred on it. Hover tints it with the item's hover colour (0.784 grey); selected shows it full. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={EGO_HOVER_URL}
          alt=""
          aria-hidden="true"
          draggable={false}
          className={`pointer-events-none absolute max-w-none select-none transition-opacity duration-100 ease-linear motion-reduce:transition-none ${selected ? 'opacity-100' : 'opacity-0 brightness-[0.784] group-hover:opacity-100 group-focus-visible:opacity-100'}`}
          style={{ left: '-0.47%', top: '-0.47%', width: '100.74%', height: '100.74%' }}
        />
      </div>

      <div
        className="relative z-20 -mt-8 flex items-end justify-center"
        style={{
          width: '7.75rem',
          maxWidth: '100%',
          aspectRatio: '358 / 155',
          filter: selected ? 'brightness(0.62) saturate(0.86)' : 'none',
          transition: 'filter 160ms ease-out',
        }}
      >
        <Image
          src={sinFrameSrc}
          alt=""
          fill
          className="pointer-events-none select-none object-contain"
          sizes="7.75rem"
        />
        <div
          className="absolute left-[6.5%] top-[39%] z-30 flex items-center justify-center"
          style={{
            width: '1rem',
            height: '1rem',
          }}
        >
          <Image
            src={gradeSymbol.src}
            alt={ego.grade}
            width={gradeSymbol.width}
            height={gradeSymbol.height}
            className="select-none object-contain"
            style={{
              maxWidth: '1rem',
              maxHeight: '1rem',
              width: 'auto',
              height: 'auto',
              filter: 'drop-shadow(0 0.125rem 0.125rem rgba(0,0,0,0.85))',
              transform: 'skewY(20deg)',
              transformOrigin: '50% 50%',
            }}
          />
        </div>
        <div
          className="absolute right-[5%] top-[38%] z-30 flex items-center justify-center"
          style={{
            width: '1.25rem',
            height: '1.25rem',
          }}
        >
          <Image
            src={`/assets/ego-stages/${stage}.webp`}
            alt={ROMAN_STAGES[stage]}
            width={224}
            height={192}
            className="select-none object-contain"
            style={{
              width: '1.4rem', maxWidth: 'none', flexShrink: 0,
              height: '1.2rem',
              filter: 'drop-shadow(0 0.125rem 0.125rem rgba(0,0,0,0.9))',
              transform: stage === 4 ? 'translateX(0.1rem) skewY(-20deg)' : 'skewY(-20deg)',
              transformOrigin: '50% 50%',
            }}
            unoptimized
          />
        </div>
        <div
          className="absolute left-1/2 top-0 z-40 flex -translate-x-1/2 -translate-y-[12%] items-center justify-center"
          style={{
            minWidth: '3.5rem',
            height: '1.45rem',
          }}
        >
          {rankBannerSrc ? (
            <Image
              src={rankBannerSrc}
              alt={ego.grade}
              width={86}
              height={36}
              className="select-none object-contain"
              style={{
                width: '2.85rem',
                height: '2.85rem',
                filter: 'drop-shadow(0 0.0625rem 0.125rem rgba(0,0,0,0.75))',
              }}
              unoptimized
            />
          ) : (
            <span
              className="font-mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '3.4rem',
                height: '1.15rem',
                padding: '0 0.35rem',
                background: `linear-gradient(180deg, ${gradeColor} 0%, rgba(16,10,8,0.95) 100%)`,
                border: `0.0625rem solid ${gradeColor}`,
                color: '#f9e6b0',
                fontSize: '0.5rem',
                lineHeight: 1,
                letterSpacing: '0.08em',
                textShadow: '0 0.0625rem 0.0625rem rgba(0,0,0,0.85)',
                boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.5)',
              }}
            >
              {ego.grade}
            </span>
          )}
        </div>
        <EgoCardName lang={lang} name={name} />
      </div>
    </div>
  )
}

export default function EgoDisplayCard({
  className,
  displayOnly = false,
  ego,
  href,
  lang = 'ko',
  name,
  onClick,
  selected = false,
  sinnerId,
  preload = false,
}: EgoDisplayCardProps) {
  const rootClassName = [
    'group flex min-w-0 flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
    className,
  ].filter(Boolean).join(' ')
  const rootStyle = { cursor: 'pointer', borderRadius: '0.875rem' }
  const body = <EgoDisplayCardBody ego={ego} lang={lang} name={name} selected={selected} sinnerId={sinnerId} preload={preload} />

  if (displayOnly) return <div className={rootClassName} aria-label={name}>{body}</div>

  if (href) {
    return (
      <IntentLink
        href={href}
        className={rootClassName}
        style={rootStyle}
        aria-label={name}
      >
        {body}
      </IntentLink>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={rootClassName}
      style={rootStyle}
      aria-label={name}
      aria-pressed={selected || undefined}
    >
      {body}
    </button>
  )
}
