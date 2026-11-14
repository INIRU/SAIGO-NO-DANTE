'use client'

import { getGameUiAsset } from '@/lib/utils/game-ui'
import { useEffect, useRef, useState } from 'react'
import { useWheelIntent } from '@/lib/hooks/useWheelIntent'
import type { CSSProperties, RefObject } from 'react'
import Image from 'next/image'
import { useLocale } from 'next-intl'
import { blessingEffectSegments } from '@/features/planner/lib/blessing-effects'
import { getBlessingDisplayName, LEVEL_LABELS, type Blessing } from '@/features/planner/lib/blessing'
import seasonPalette from '@/lib/generated/season-palette.json'
import { seasonTileStyle } from '@/features/planner/lib/season-tile'

const BLESSING_UI_ASSET_BASE = '/assets/planner/blessing-ui'
// Mirror Dungeon 8 "시지프 별의 가호" card (game sprites MainUI_MirrorDungeon8_2_2 / 2_4 / 2_9 / 2_10).
const BLESSING_CARD_BASE = `${BLESSING_UI_ASSET_BASE}/blessing-card-base.webp`
const BLESSING_CARD_SELECTED_OVERLAY = `${BLESSING_UI_ASSET_BASE}/blessing-card-selected-overlay.webp`
const BLESSING_BUTTON = `${BLESSING_UI_ASSET_BASE}/blessing-button.webp`
const BLESSING_BUTTON_SELECTED_OVERLAY = `${BLESSING_UI_ASSET_BASE}/blessing-button-selected-overlay.webp`
const BLESSING_PLUS_DANTE_NORMAL = `${BLESSING_UI_ASSET_BASE}/blessing-plus-dante.webp`
const BLESSING_PLUS_DANTE_SELECTED = `${BLESSING_UI_ASSET_BASE}/blessing-plus-dante-normal.webp`
const BLESSING_PLUSPLUS_DANTE_SELECTED = `${BLESSING_UI_ASSET_BASE}/blessing-plusplus-dante-normal.webp`
const CARD_WRAPPER_WIDTH = '272px'
const CARD_WRAPPER_HEIGHT = '312px'
export const CARD_WRAPPER_WIDTH_NUMBER = 272
const CARD_WRAPPER_HEIGHT_NUMBER = 312
const CARD_IMAGE_WIDTH = '264px'
const CARD_IMAGE_HEIGHT = '304px'
const CARD_SELECTED_WIDTH = '277px'
const CARD_SELECTED_HEIGHT = '328px'
const CARD_UPGRADE_LEVELS = [2, 3] as const
// Sizes and places on the card are measured on the game screen (the card drawn 0.742x there, 0.6947x here: game px × 0.936).
const TITLE_MAX_FONT_PX = 25
const TITLE_MIN_FONT_PX = 11
const TITLE_LETTER_SPACING = '0'
const TITLE_LINE_HEIGHT = 1.2
const TITLE_COLOR = '#e2e2e2'
const TITLE_TEXT_SHADOW = '0.125rem 0.125rem 0.0625rem rgba(7, 4, 2, 0.96)'
// Game colours: terms (<k>…</k> in the messages) and values that went up with the level.
const EFFECT_COLORS = { normal: undefined, term: '#627eff', diff: '#f8c200' } as const
const CJK_PATTERN = /[가-힣ぁ-んァ-ヶ一-龯]/

function getBlessingTitleFontFamily(title: string) {
  return CJK_PATTERN.test(title)
    ? 'var(--font-heading)'
    : 'var(--font-mikodacs), Mikodacs, sans-serif'
}

type UpgradeGlyph = {
  src: string
  width: number
  height: number
  count?: number
}

function getUpgradeSlotStyle(): CSSProperties {
  return {
    width: '100%',
    height: '37px',
    minHeight: '37px',
    position: 'relative',
    overflow: 'visible',
    padding: 0,
    borderStyle: 'solid',
    borderWidth: '7.5px',
    borderColor: 'transparent',
    borderImageSource: `url("${BLESSING_BUTTON}")`,
    borderImageSlice: '14 fill',
    borderImageOutset: 0,
    borderImageRepeat: 'stretch',
    borderRadius: 0,
    background: 'transparent',
    cursor: 'pointer',
    touchAction: 'manipulation',
    boxShadow: 'none',
  }
}

function getUpgradeGlyph(level: number, active: boolean): UpgradeGlyph {
  if (level === 3) {
    return {
      src: active ? BLESSING_PLUSPLUS_DANTE_SELECTED : BLESSING_PLUS_DANTE_NORMAL,
      width: active ? 38 : 16,
      height: active ? 21 : 16,
      count: active ? 1 : 2,
    }
  }

  return {
    src: active ? BLESSING_PLUS_DANTE_SELECTED : BLESSING_PLUS_DANTE_NORMAL,
    width: active ? 17 : 16,
    height: active ? 17 : 16,
  }
}

function getUpgradeGlyphStyle(active: boolean): CSSProperties {
  return {
    gap: active ? 0 : '0.0625rem',
  }
}

function getUpgradePressedOverlayStyle(active: boolean): CSSProperties {
  return {
    position: 'absolute',
    inset: '-4.5px -5.5px',
    zIndex: 20,
    pointerEvents: 'none',
    opacity: active ? 1 : 0,
    overflow: 'visible',
    transform: 'translate(-0.5px, -0.5px)',
    borderStyle: 'solid',
    borderWidth: '6px',
    borderColor: 'transparent',
    borderImageSource: `url("${BLESSING_BUTTON_SELECTED_OVERLAY}")`,
    borderImageSlice: '14 fill',
    borderImageOutset: 0,
    borderImageRepeat: 'stretch',
    background: 'transparent',
    boxShadow: 'none',
    mixBlendMode: 'normal',
    transition: 'opacity 160ms ease',
  }
}

interface BlessingTitleProps {
  title: string
}

function BlessingTitle({ title }: BlessingTitleProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [fontSizePx, setFontSizePx] = useState(TITLE_MAX_FONT_PX)
  const fontFamily = getBlessingTitleFontFamily(title)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const availableWidth = container.clientWidth - 2
      if (availableWidth <= 0) return

      const probe = document.createElement('span')
      probe.textContent = title
      probe.style.position = 'fixed'
      probe.style.left = '-9999px'
      probe.style.top = '0'
      probe.style.visibility = 'hidden'
      probe.style.whiteSpace = 'nowrap'
      probe.style.fontFamily = fontFamily
      probe.style.fontWeight = '400'
      probe.style.lineHeight = String(TITLE_LINE_HEIGHT)
      probe.style.letterSpacing = TITLE_LETTER_SPACING
      probe.style.fontSize = `${TITLE_MAX_FONT_PX}px`
      document.body.appendChild(probe)
      // Width scales linearly with font size (letter-spacing is in em), so one layout read fits the
      // title; the old 9-step search forced 9 full layouts per card and cost ~2s on plan pages.
      const fullWidth = probe.getBoundingClientRect().width
      document.body.removeChild(probe)
      const fitted = fullWidth > 0 ? Math.floor(TITLE_MAX_FONT_PX * availableWidth / fullWidth * 10) / 10 : TITLE_MAX_FONT_PX
      const nextSize = Math.max(TITLE_MIN_FONT_PX, Math.min(TITLE_MAX_FONT_PX, fitted))
      setFontSizePx(prev => Math.abs(prev - nextSize) < 0.1 ? prev : nextSize)
    }

    // ResizeObserver reports the initial size after layout, so no synchronous first measure.
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    window.addEventListener('resize', measure)
    // The title fonts load on demand; a title measured in the fallback font is refitted once they arrive.
    document.fonts.addEventListener('loadingdone', measure)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      document.fonts.removeEventListener('loadingdone', measure)
    }
  }, [fontFamily, title])

  return (
    <div
      ref={containerRef}
      className="planner-blessing-title text-center"
      style={{
        color: TITLE_COLOR,
        fontFamily,
        fontSize: `${fontSizePx}px`,
        fontWeight: 400,
        lineHeight: TITLE_LINE_HEIGHT,
        letterSpacing: TITLE_LETTER_SPACING,
        whiteSpace: 'nowrap',
        textShadow: TITLE_TEXT_SHADOW,
      }}
    >
      {title}
    </div>
  )
}

type BlessingGridMetrics = {
  gridRef: RefObject<HTMLDivElement | null>
  cardScale: number
  cardColumnCount: number
}

export function useBlessingGridMetrics(): BlessingGridMetrics {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [cardScale, setCardScale] = useState(1)
  const [cardColumnCount, setCardColumnCount] = useState(5)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const updateCardScale = () => {
      const width = grid.clientWidth
      const viewportWidth = window.innerWidth
      const compactTwoColumnScale = 0.64
      const gap = viewportWidth >= 1024 ? 8 : 6
      const canFitTwoCompactColumns = width >= (CARD_WRAPPER_WIDTH_NUMBER * compactTwoColumnScale * 2) + gap
      // Tablet widths: as many columns as fit at 0.8 scale or more (3 or 4), instead of two narrow columns with empty sides.
      const roomyColumns = Math.min(5, Math.floor((width + gap) / (CARD_WRAPPER_WIDTH_NUMBER * 0.8 + gap)))
      const columnCount = viewportWidth >= 1024 ? 5 : roomyColumns >= 3 ? roomyColumns : canFitTwoCompactColumns ? 2 : 1
      const trackWidth = (width - gap * (columnCount - 1)) / columnCount
      const minimumScale = columnCount === 1 ? 0.68 : compactTwoColumnScale
      const nextScale = Math.min(1, Math.max(minimumScale, trackWidth / CARD_WRAPPER_WIDTH_NUMBER))
      setCardColumnCount(prev => prev === columnCount ? prev : columnCount)
      setCardScale(prev => Math.abs(prev - nextScale) < 0.005 ? prev : nextScale)
    }

    updateCardScale()
    const observer = new ResizeObserver(updateCardScale)
    observer.observe(grid)
    window.addEventListener('resize', updateCardScale)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateCardScale)
    }
  }, [])

  return { gridRef, cardScale, cardColumnCount }
}

interface BlessingCardProps {
  blessing: Blessing
  level: number
  cardScale: number
  baseLabel: string
  interactive?: boolean
  onBaseClick?: () => void
  onUpgradeClick?: (level: number) => void
}

export function BlessingCard({
  blessing,
  level,
  cardScale,
  baseLabel,
  interactive = false,
  onBaseClick,
  onUpgradeClick,
}: BlessingCardProps) {
  const isSelected = level > 0
  const currentCost = level > 0 ? blessing.costs[level - 1] : blessing.costs[0]
  const selectedLevel = Math.max(1, level)
  const currentEffects = blessing.effectsByLevel[selectedLevel - 1] ?? blessing.effectsByLevel[0]
  const previousEffects = selectedLevel > 1 ? blessing.effectsByLevel[selectedLevel - 2] : undefined
  const locale = useLocale()
  const displayName = getBlessingDisplayName(blessing, level)
  // The effect text scrolls inside the card; a page scroll passing over the cards keeps scrolling the page.
  const effectsRef = useRef<HTMLDivElement>(null)
  useWheelIntent(effectsRef)

  const cardContent = (
    <>
      {interactive && (
        <button
          type="button"
          onClick={onBaseClick}
          aria-label={`${blessing.name} ${baseLabel}`}
          className="absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf35]"
          style={{
            left: '4.5%',
            top: '3.5%',
            right: '9.5%',
            bottom: '21%',
            zIndex: 3,
            border: 0,
            padding: 0,
            background: 'transparent',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: 0,
          top: 0,
          width: CARD_IMAGE_WIDTH,
          height: CARD_IMAGE_HEIGHT,
          zIndex: 1,
        }}
      >
        <Image
          src={BLESSING_CARD_BASE}
          alt=""
          fill
          sizes="(min-width: 1024px) 19vw, (min-width: 640px) 45vw, 92vw"
          className="select-none"
          style={{ objectFit: 'fill' }}
          priority={blessing.baseId < 105}
        />
      </div>

      <div className="pointer-events-none absolute min-w-0" style={{ left: '27px', top: '28px', width: '67px', height: '60px', zIndex: 4 }}>
        <Image
          src={getGameUiAsset(`start-buffs/${blessing.baseId}`)}
          alt=""
          fill
          sizes="4rem"
          style={{ objectFit: 'contain', opacity: isSelected ? 1 : 0.86 }}
        />
      </div>
      <div className="pointer-events-none absolute min-w-0 overflow-hidden" style={{ left: '105px', top: '37px', width: '140px', height: '44px', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 4 }}>
        <BlessingTitle title={displayName} />
      </div>
      <div
        className="pointer-events-none absolute flex items-center justify-end gap-1"
        style={{
          top: '3px',
          right: '43px',
          width: '76px',
          height: '27px',
          padding: 0,
          zIndex: 4,
        }}
      >
        <Image
          src={getGameUiAsset('start-buffs/starlight')}
          alt=""
          width={26}
          height={26}
          style={{ width: '26px', height: '26px' }}
        />
        <span style={{ color: isSelected ? '#f4c84a' : '#e8d3a2', fontSize: '27px', fontWeight: 400, lineHeight: 1, fontFamily: 'var(--font-title)', textShadow: '0 0.125rem 0.125rem rgba(7, 4, 2, 0.96)' }}>{currentCost}</span>
      </div>

      <div
        ref={effectsRef}
        className="planner-blessing-effects absolute overflow-y-auto overflow-x-hidden pr-1"
        style={{
          left: '25px',
          top: '99px',
          width: '213px',
          height: '151px',
          zIndex: 4,
          color: '#d8d8d8',
          fontFamily: 'var(--font-game-text)',
          fontSize: '16.7px',
          lineHeight: 1.23,
          textShadow: '0 0.0625rem 0.25rem rgba(0,0,0,0.95)',
          // Like the game: the bullet is part of the line, Korean words do not split, wrapped lines start under the bullet.
          wordBreak: locale === 'ko' ? 'keep-all' : 'normal',
          overflowWrap: 'anywhere',
          pointerEvents: 'auto',
        }}
      >
        {currentEffects.map((effect: string, i: number) => (
          <p key={`${i}-${effect}`}>
            <span aria-hidden="true" style={{ display: 'inline-block', width: '4px', height: '4px', margin: '0 6.5px 0.15em 0', borderRadius: '50%', background: 'currentColor', verticalAlign: 'middle' }} />
            {blessingEffectSegments(effect, previousEffects, i).map((segment, segmentIndex) => (
              <span key={segmentIndex} style={{ color: EFFECT_COLORS[segment.tone] }}>{segment.text}</span>
            ))}
          </p>
        ))}
      </div>

      <div
        className="absolute flex overflow-visible"
        style={{
          left: '22px',
          width: '221px',
          top: '252px',
          gap: '4.5px',
          height: '37px',
          zIndex: 5,
        }}
      >
        {CARD_UPGRADE_LEVELS.map(lvl => {
          const isActive = level === lvl
          const levelLabel = LEVEL_LABELS[lvl - 1]
          const glyph = getUpgradeGlyph(lvl, isActive)
          const buttonContent = (
            <>
              <span
                aria-hidden="true"
                className="planner-blessing-upgrade-pressed-overlay"
                style={getUpgradePressedOverlayStyle(isActive)}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none relative z-10 flex min-w-0 items-center justify-center"
                style={{
                  opacity: isActive ? 1 : 0.9,
                  ...getUpgradeGlyphStyle(isActive),
                }}
              >
                {Array.from({ length: glyph.count ?? 1 }, (_, index) => (
                  <Image
                    key={index}
                    src={glyph.src}
                    alt=""
                    width={glyph.width}
                    height={glyph.height}
                    sizes={`${glyph.width}px`}
                    style={{
                      width: `${glyph.width}px`,
                      height: `${glyph.height}px`,
                    }}
                  />
                ))}
              </span>
            </>
          )

          return interactive ? (
            <button
              key={lvl}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onUpgradeClick?.(lvl)
              }}
              aria-label={`${blessing.name} ${levelLabel}`}
              aria-pressed={isActive}
              className="planner-blessing-upgrade-button hit-target group relative flex min-w-0 flex-1 items-center justify-center overflow-visible text-center transition-[filter,transform] hover:brightness-110 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf35] focus-visible:ring-offset-2 focus-visible:ring-offset-[#130806]"
              style={getUpgradeSlotStyle()}
            >
              {buttonContent}
            </button>
          ) : (
            <div
              key={lvl}
              role="presentation"
              className="planner-blessing-upgrade-button relative flex min-w-0 flex-1 items-center justify-center overflow-visible text-center"
              style={{ ...getUpgradeSlotStyle(), cursor: 'default' }}
            >
              {buttonContent}
            </div>
          )
        })}
      </div>
      <div
        aria-hidden="true"
        className={`planner-blessing-selected-overlay pointer-events-none absolute overflow-visible opacity-0 transition-opacity duration-200${interactive ? ' group-hover:opacity-100' : ''}`}
        style={{
          left: '-7px',
          top: '-14px',
          width: CARD_SELECTED_WIDTH,
          height: CARD_SELECTED_HEIGHT,
          opacity: isSelected ? 1 : undefined,
          zIndex: 30,
          mixBlendMode: 'normal',
          filter: 'none',
        }}
      >
        <Image
          src={BLESSING_CARD_SELECTED_OVERLAY}
          alt=""
          fill
          sizes="(min-width: 1024px) 16.875rem, (min-width: 640px) 44vw, 90vw"
          style={{ objectFit: 'fill' }}
        />
      </div>
    </>
  )

  return (
    <div
      className="relative min-w-0 overflow-visible"
      style={{
        width: `${Math.floor(CARD_WRAPPER_WIDTH_NUMBER * cardScale)}px`,
        height: `${Math.floor(CARD_WRAPPER_HEIGHT_NUMBER * cardScale)}px`,
        justifySelf: 'center',
      }}
    >
      <div
        className="planner-blessing-card group relative min-w-0 overflow-visible transition-[filter] hover:brightness-105"
        aria-label={interactive ? undefined : displayName}
        style={{
          width: CARD_WRAPPER_WIDTH,
          height: CARD_WRAPPER_HEIGHT,
          backgroundColor: 'transparent',
          border: '0',
          borderRadius: 0,
          filter: isSelected ? 'brightness(1.02)' : 'none',
          boxShadow: 'none',
          transform: `scale(${cardScale})`,
          transformOrigin: 'top left',
        }}
      >
        {cardContent}
      </div>
    </div>
  )
}

interface ReadOnlyBlessingGridProps {
  blessings: Blessing[]
  selectedBlessings: Map<number, number>
  emptyText: string
}

export function ReadOnlyBlessingGrid({ blessings, selectedBlessings, emptyText }: ReadOnlyBlessingGridProps) {
  const { gridRef, cardScale, cardColumnCount } = useBlessingGridMetrics()
  const displayCards = blessings
    .map(blessing => ({ blessing, level: selectedBlessings.get(blessing.baseId) ?? 0 }))

  if (selectedBlessings.size === 0) {
    return (
      <div className="rounded-md border border-[#241c14] bg-[var(--bg-panel)] px-4 py-5 text-center text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
        {emptyText}
      </div>
    )
  }

  return (
    <>
    {/* 모바일: 고른 가호만 아이콘과 이름의 작은 타일로 간결하게. 색은 이번 시즌 가호 카드 그림에서 빌드 때 뽑는다 */}
    <ul className="grid grid-cols-3 gap-1.5 pt-3 sm:hidden">
      {displayCards.filter(({ level }) => level > 0).map(({ blessing, level }) => (
        <li
          key={blessing.baseId}
          className="flex aspect-[17/15] flex-col items-center justify-between rounded-md border px-1.5 pb-1.5 pt-2 text-center"
          style={seasonTileStyle(seasonPalette.blessing)}
        >
          <span className="relative block h-7 w-7">
            <Image src={getGameUiAsset(`start-buffs/${blessing.baseId}`)} alt="" fill sizes="28px" style={{ objectFit: 'contain' }} />
          </span>
          <span aria-hidden="true" className="block h-px w-full bg-[rgba(232,200,180,0.25)]" />
          <span className="flex min-h-[2.25rem] items-center break-keep text-[0.75rem] font-bold leading-tight text-[#f3e6dc]">
            {getBlessingDisplayName(blessing, level)}
          </span>
        </li>
      ))}
    </ul>
    <div
      ref={gridRef}
      className="planner-blessing-grid relative z-10 hidden grid-cols-1 overflow-visible sm:grid sm:grid-cols-2 lg:grid-cols-5"
      style={{
        gap: cardColumnCount >= 5 ? '8px' : '6px',
        gridTemplateColumns: `repeat(${cardColumnCount}, minmax(0, ${Math.floor(CARD_WRAPPER_WIDTH_NUMBER * cardScale)}px))`,
        justifyContent: 'center',
        padding: '0.75rem 0 0',
      }}
    >
      {displayCards.map(({ blessing, level }) => (
        <BlessingCard
          key={blessing.baseId}
          blessing={blessing}
          level={level}
          cardScale={cardScale}
          baseLabel=""
        />
      ))}
    </div>
    </>
  )
}
