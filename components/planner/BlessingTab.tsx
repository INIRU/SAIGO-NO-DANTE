'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { type PlannerState, type PlannerAction } from '@/lib/planner/types'
import { STORAGE_BASE } from '@/lib/constants/game'

const S = STORAGE_BASE
const BLESSING_UI_ASSET_BASE = '/assets/planner/blessing-ui'
const BLESSING_CARD_BASE = `${BLESSING_UI_ASSET_BASE}/blessing-card-dante-base.webp`
const BLESSING_CARD_SELECTED_OVERLAY = `${BLESSING_UI_ASSET_BASE}/blessing-card-dante-selected-overlay.webp`
const BLESSING_BUTTON_DANTE_RED = `${BLESSING_UI_ASSET_BASE}/blessing-button-dante-red.webp`
const BLESSING_PLUS_DANTE_NORMAL = `${BLESSING_UI_ASSET_BASE}/blessing-plus-dante.webp`
const BLESSING_PLUS_DANTE_SELECTED = `${BLESSING_UI_ASSET_BASE}/blessing-plus-dante-normal.webp`
const BLESSING_PLUSPLUS_DANTE_SELECTED = `${BLESSING_UI_ASSET_BASE}/blessing-plusplus-dante-normal.webp`
const CARD_WRAPPER_WIDTH = '272px'
const CARD_WRAPPER_HEIGHT = '320px'
const CARD_WRAPPER_WIDTH_NUMBER = 272
const CARD_WRAPPER_HEIGHT_NUMBER = 320
const CARD_IMAGE_WIDTH = '264px'
const CARD_IMAGE_HEIGHT = '320px'
const CARD_SELECTED_WIDTH = '270px'
const CARD_SELECTED_HEIGHT = '324px'
const CARD_UPGRADE_LEVELS = [2, 3] as const
const TITLE_MAX_FONT_PX = 22
const TITLE_MIN_FONT_PX = 11
const TITLE_LETTER_SPACING = '0.05em'
const TITLE_LINE_HEIGHT = 1.5
const TITLE_COLOR = '#e5d7d7'
const TITLE_TEXT_SHADOW = '0.125rem 0.125rem 0.0625rem rgba(7, 4, 2, 0.96)'
const GAME_TERM_PATTERN = /(코스트|테마팩|상점|기프트|인격 레벨|레벨|속도 최댓값|합 위력|피해량|보호|키워드|새로고침|전투 보상|별빛|등급|합성|잔영)/g
const NUMERIC_DIFF_PATTERN = /([+-]?\d+(?:\/\d+)*(?:~\d+)?%?(?:층|회|개|등급)?)/g
const NUMERIC_TOKEN_PATTERN = /[+-]?\d+(?:\/\d+)*(?:~\d+)?%?(?:층|회|개|등급)?/g

// 가호 데이터 (게임 추출 기반)
interface Blessing {
  baseId: number
  name: string
  costs: [number, number, number]  // [기본, +, ++]
  effectsByLevel: [string[], string[], string[]]  // [기본, +, ++]
}

const BLESSINGS: Blessing[] = [
  { baseId: 100, name: '시작의 별', costs: [10, 20, 30], effectsByLevel: [
    ['시작 코스트 +150', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 1회 무료'],
    ['시작 코스트 +250', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 1회 무료'],
    ['시작 코스트 +250', '테마팩 목록 +1', '상점 기프트 목록 +1', '상점 일반 새로고침 2회 무료'],
  ]},
  { baseId: 101, name: '쌓여가는 별무리', costs: [10, 20, 30], effectsByLevel: [
    ['층 이동 시, 보유 코스트 10% 증가 (최대 100)', '기프트 판매 비용 50% 증가 (상점별 1회)'],
    ['층 이동 시, 보유 코스트 20% 증가 (최대 125)', '기프트 판매 비용 75% 증가 (상점별 1회)'],
    ['층 이동 시, 보유 코스트 30% 증가 (최대 150)', '기프트 판매 비용 100% 증가 (상점별 1회)'],
  ]},
  { baseId: 102, name: '성간여행', costs: [20, 40, 60], effectsByLevel: [
    ['테마팩 목록 +1', '테마팩 새로고침 횟수 +2', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3 (최대 9)'],
    ['테마팩 목록 +1', '테마팩 새로고침 횟수 +3', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3 (최대 9)', '테마팩 해금 수에 따라 라운드 시작 시 버프'],
    ['테마팩 목록 +1', '테마팩 새로고침 횟수 +4', '기록 없는 테마팩 선택 시, 모든 인격 레벨 +3 (최대 9)', '테마팩 해금 수에 따라 라운드 시작 시 버프'],
  ]},
  { baseId: 103, name: '쏟아지는 유성우', costs: [20, 40, 60], effectsByLevel: [
    ['시작 코스트 +400', '시작 기프트 수 +1'],
    ['시작 코스트 +500', '시작 기프트 수 +1', '별빛 전투 보상 선택 시 코스트 +75'],
    ['시작 코스트 +700', '시작 기프트 수 +1', '별빛 전투 보상 선택 시 코스트 +150'],
  ]},
  { baseId: 104, name: '쌍성계 상점', costs: [30, 60, 90], effectsByLevel: [
    ['상점 기프트 목록 +1', '전투 보급 코스트 +20', '상점에서 높은 등급 기프트 등장 확률 상승'],
    ['상점 기프트 목록 +1', '전투 보급 코스트 +30', '상점에서 높은 등급 기프트 등장 확률 상승', '상점 입장 시 기프트 등급 합 기반 코스트 획득'],
    ['상점 기프트 목록 +1', '전투 보급 코스트 +40', '상점에서 높은 등급 기프트 등장 확률 상승', '상점 입장 시 기프트 등급 합 기반 코스트 획득'],
  ]},
  { baseId: 105, name: '위성계 상점', costs: [30, 60, 90], effectsByLevel: [
    ['상점 키워드 새로고침 1회 무료', '1층 입장 시, 무작위 1등급 기프트 1개 획득'],
    ['상점 키워드 새로고침 1회 무료', '1층 입장 시, 무작위 1등급 기프트 2개 획득', '강화 상점 출현 확률 증가'],
    ['상점 키워드 새로고침 2회 무료', '1층 입장 시, 무작위 1등급 기프트 3개 획득', '강화 상점 출현 확률 증가'],
  ]},
  { baseId: 106, name: '성운의 총애', costs: [40, 80, 120], effectsByLevel: [
    ['1층 입장 시, 인격 레벨 +3', '층 클리어 시, 인격 레벨 +1 (최대 5)'],
    ['1층 입장 시, 인격 레벨 +3', '층 클리어 시, 인격 레벨 +1 (최대 9)'],
    ['1층 입장 시, 인격 레벨 +3', '6층 입장 시, 인격 레벨 +3', '층 클리어 시, 인격 레벨 +1 (최대 9)'],
  ]},
  { baseId: 107, name: '별빛의 인도', costs: [40, 80, 120], effectsByLevel: [
    ['속도 최댓값 +2', '합 위력 증가 1', '피해량 증가 1', '보호 1'],
    ['속도 최댓값 +3', '합 위력 증가 1', '피해량 증가 1', '보호 1'],
    ['속도 최댓값 +3', '합 위력 증가 1', '피해량 증가 1', '보호 1'],
  ]},
  { baseId: 108, name: '우연한 혜성', costs: [50, 100, 150], effectsByLevel: [
    ['상점 입장 시 합성 판매용 기프트 1개 획득', '3층 입장 시, 무작위 3등급 기프트 1개 획득', '합성 시, 2단계 낮은 무작위 기프트 획득 (상점별 1회)'],
    ['상점 입장 시 합성 판매용 기프트 2개 획득', '3/5층 입장 시, 무작위 3등급 기프트 1개 획득', '합성 시, 2단계 낮은 무작위 기프트 획득 (상점별 1회)'],
    ['상점 입장 시 합성 판매용 기프트 3개 획득', '3/5/7층 입장 시, 무작위 4등급 기프트 1개 획득', '합성 시, 1단계 낮은 무작위 기프트 획득 (상점별 1회)'],
  ]},
  { baseId: 109, name: '완전한 가능성', costs: [60, 120, 180], effectsByLevel: [
    ['테마팩 목록 +1', '시작 기프트 수 +1', '입장 시, 키워드 3등급 기프트 1개 선택 획득', '입장 시, 어두운 잔영 1개 획득'],
    ['테마팩 목록 +1', '시작 기프트 수 +1', '입장 시, 키워드 3등급 기프트 2개 선택 획득', '입장 시, 1~2등급 합성 재료 기프트 획득'],
    ['테마팩 목록 +1', '시작 기프트 수 +1', '입장 시, 키워드 3등급 기프트 3개 선택 획득', '입장 시, 1~3등급 합성 재료 기프트 획득'],
  ]},
]

type EffectSegment = {
  text: string
  changed: boolean
}

type EffectTone = 'normal' | 'term' | 'diff'

type StyledEffectSegment = {
  text: string
  tone: EffectTone
}

const LEVEL_LABELS = ['', '+', '++'] as const
const CJK_PATTERN = /[가-힣ぁ-んァ-ヶ一-龯]/

function getBlessingDisplayName(blessing: Blessing, selectedLevel: number) {
  return selectedLevel > 1 ? `${blessing.name}${LEVEL_LABELS[selectedLevel - 1]}` : blessing.name
}

function getBlessingTitleFontFamily(title: string) {
  return CJK_PATTERN.test(title)
    ? 'var(--font-kotra-bold), var(--font-noto-jp), var(--font-pretendard), sans-serif'
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
    height: '28px',
    minHeight: '28px',
    position: 'relative',
    overflow: 'visible',
    padding: 0,
    borderStyle: 'solid',
    borderWidth: '6px',
    borderColor: 'transparent',
    borderImageSource: `url("${BLESSING_BUTTON_DANTE_RED}")`,
    borderImageSlice: '8 fill',
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

function findChangedSegments(current: string, previous: string | undefined, isDiffLevel: boolean): EffectSegment[] {
  if (!isDiffLevel) return [{ text: current, changed: false }]
  if (!previous) return [{ text: current, changed: true }]
  if (current === previous) return [{ text: current, changed: false }]

  let prefixLength = 0
  const maxPrefix = Math.min(current.length, previous.length)
  while (prefixLength < maxPrefix && current[prefixLength] === previous[prefixLength]) {
    prefixLength += 1
  }

  let suffixLength = 0
  const maxSuffix = Math.min(current.length - prefixLength, previous.length - prefixLength)
  while (
    suffixLength < maxSuffix
    && current[current.length - 1 - suffixLength] === previous[previous.length - 1 - suffixLength]
  ) {
    suffixLength += 1
  }

  let changedStart = prefixLength
  let changedEnd = current.length - suffixLength

  NUMERIC_TOKEN_PATTERN.lastIndex = 0
  for (const match of current.matchAll(NUMERIC_TOKEN_PATTERN)) {
    const tokenStart = match.index ?? 0
    const tokenEnd = tokenStart + match[0].length
    if (tokenStart < changedEnd && tokenEnd > changedStart) {
      changedStart = Math.min(changedStart, tokenStart)
      changedEnd = Math.max(changedEnd, tokenEnd)
    }
  }

  const before = current.slice(0, changedStart)
  const changed = current.slice(changedStart, changedEnd)
  const after = current.slice(changedEnd)

  return [
    before ? { text: before, changed: false } : null,
    changed ? { text: changed, changed: true } : null,
    after ? { text: after, changed: false } : null,
  ].filter((segment): segment is EffectSegment => Boolean(segment))
}

function getEffectDiffSegments(blessing: Blessing, selectedLevel: number, effect: string, index: number) {
  if (selectedLevel <= 1) return [{ text: effect, changed: false }]
  const previousEffects = blessing.effectsByLevel[selectedLevel - 2] ?? []
  if (previousEffects.includes(effect)) return [{ text: effect, changed: false }]
  return findChangedSegments(effect, previousEffects[index], true)
}

function splitTextByPattern(text: string, pattern: RegExp, tone: EffectTone): StyledEffectSegment[] {
  const segments: StyledEffectSegment[] = []
  let lastIndex = 0

  pattern.lastIndex = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) segments.push({ text: text.slice(lastIndex, index), tone: 'normal' })
    segments.push({ text: match[0], tone })
    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), tone: 'normal' })
  return segments
}

function getStyledEffectSegments(segments: EffectSegment[]): StyledEffectSegment[] {
  return segments.flatMap(segment => {
    if (segment.changed) {
      const numericParts = splitTextByPattern(segment.text, NUMERIC_DIFF_PATTERN, 'diff')
      return numericParts.some(part => part.tone === 'diff')
        ? numericParts
        : [{ text: segment.text, tone: 'diff' }]
    }

    return splitTextByPattern(segment.text, GAME_TERM_PATTERN, 'term')
  })
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
      document.body.appendChild(probe)

      let low = TITLE_MIN_FONT_PX
      let high = TITLE_MAX_FONT_PX

      for (let i = 0; i < 9; i += 1) {
        const mid = (low + high) / 2
        probe.style.fontSize = `${mid}px`
        if (probe.getBoundingClientRect().width <= availableWidth) {
          low = mid
        } else {
          high = mid
        }
      }

      document.body.removeChild(probe)
      const nextSize = Math.max(TITLE_MIN_FONT_PX, Math.min(TITLE_MAX_FONT_PX, low))
      setFontSizePx(prev => Math.abs(prev - nextSize) < 0.1 ? prev : nextSize)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    window.addEventListener('resize', measure)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
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

interface Props {
  state: PlannerState
  dispatch: Dispatch<PlannerAction>
}

export default function BlessingTab({ state, dispatch }: Props) {
  const t = useTranslations('planner.blessingTab')
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [cardScale, setCardScale] = useState(1)
  const [cardColumnCount, setCardColumnCount] = useState(5)

  // 가호 선택 상태: giftInventory에 'blessing_{baseId}_{level}' 형태로 저장
  const selectedBlessings = useMemo(() => {
    const map = new Map<number, number>() // baseId → level (0=미선택, 1=기본, 2=+, 3=++)
    for (const id of state.giftInventory) {
      if (id.startsWith('blessing_')) {
        const parts = id.split('_')
        const baseId = parseInt(parts[1])
        const level = parseInt(parts[2])
        map.set(baseId, level)
      }
    }
    return map
  }, [state.giftInventory])

  const totalCost = useMemo(() => {
    let cost = 0
    for (const [baseId, level] of selectedBlessings) {
      const blessing = BLESSINGS.find(b => b.baseId === baseId)
      if (blessing && level > 0) cost += blessing.costs[level - 1]
    }
    return cost
  }, [selectedBlessings])

  const hasSelectedBlessings = selectedBlessings.size > 0

  const toggleBlessing = (baseId: number, targetLevel: number) => {
    // 기존 선택 제거
    const existingKey = state.giftInventory.find(id => id.startsWith(`blessing_${baseId}_`))
    if (existingKey) {
      dispatch({ type: 'REMOVE_GIFT', giftId: existingKey })
    }

    const currentLevel = selectedBlessings.get(baseId) ?? 0
    // 같은 레벨 클릭 → 해제, 다른 레벨 → 변경
    if (currentLevel !== targetLevel) {
      dispatch({ type: 'ADD_GIFT', giftId: `blessing_${baseId}_${targetLevel}` })
    }
  }

  const allSelectedAtLevel = (level: number) =>
    BLESSINGS.every(b => selectedBlessings.get(b.baseId) === level)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const updateCardScale = () => {
      const width = grid.clientWidth
      const viewportWidth = window.innerWidth
      const compactTwoColumnScale = 0.64
      const gap = viewportWidth >= 1024 ? 8 : 6
      const canFitTwoCompactColumns = width >= (CARD_WRAPPER_WIDTH_NUMBER * compactTwoColumnScale * 2) + gap
      const columnCount = viewportWidth >= 1024 ? 5 : canFitTwoCompactColumns ? 2 : 1
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

  const selectAll = (level: number) => {
    // 이미 전부 해당 레벨이면 → 전체 해제
    const shouldClear = allSelectedAtLevel(level)
    // 기존 가호 전부 제거
    for (const id of state.giftInventory) {
      if (id.startsWith('blessing_')) dispatch({ type: 'REMOVE_GIFT', giftId: id })
    }
    if (!shouldClear) {
      for (const b of BLESSINGS) {
        dispatch({ type: 'ADD_GIFT', giftId: `blessing_${b.baseId}_${level}` })
      }
    }
  }

  const clearAll = () => {
    for (const id of state.giftInventory) {
      if (id.startsWith('blessing_')) dispatch({ type: 'REMOVE_GIFT', giftId: id })
    }
  }

  const handlePrimarySelection = () => {
    if (hasSelectedBlessings) {
      clearAll()
      return
    }

    selectAll(1)
  }

  const controlButtonStyle = (active: boolean): CSSProperties => ({
    height: 'max(2.75rem, 44px)',
    minHeight: 'max(2.75rem, 44px)',
    padding: '0 0.875rem',
    background: active
      ? 'rgba(38, 30, 20, 0.86)'
      : 'rgba(18, 15, 12, 0.72)',
    color: active ? '#ead8b0' : '#d8c8ad',
    border: `1px solid ${active ? 'rgba(160, 119, 39, 0.68)' : 'rgba(92, 73, 54, 0.86)'}`,
    borderRadius: '0.375rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: active
      ? 'inset 0 0 0 0.0625rem rgba(232, 176, 48, 0.08)'
      : 'none',
    textShadow: 'none',
    touchAction: 'manipulation',
  })

  const squareControlButtonStyle = (active: boolean): CSSProperties => ({
    ...controlButtonStyle(active),
    width: 'max(2.75rem, 44px)',
    minWidth: 'max(2.75rem, 44px)',
    padding: 0,
  })

  const toolbarUpgradeGlyphStyle = (active: boolean): CSSProperties => ({
    color: active ? '#ead8b0' : '#d8c8ad',
    fontFamily: 'var(--font-kotra-bold), var(--font-scdream), sans-serif',
    fontSize: '1.0625rem',
    fontWeight: 500,
    lineHeight: 1,
    opacity: active ? 0.98 : 0.86,
    textShadow: 'none',
  })

  return (
    <section
      className="relative"
      style={{
        padding: 0,
      }}
    >
      <div className="relative z-10 flex flex-col gap-4">
        <h2 className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>{t('title')}</h2>

        <div className="flex flex-wrap items-center gap-2" style={{ borderBottom: '1px solid rgba(92, 73, 54, 0.66)', paddingBottom: '1rem', rowGap: '0.625rem' }}>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handlePrimarySelection} className="transition-[background-color,border-color,box-shadow,transform,filter] hover:brightness-110 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[#e8b030]" style={controlButtonStyle(hasSelectedBlessings || allSelectedAtLevel(1))}>
              {hasSelectedBlessings ? t('allClear') : t('selectAll')}
            </button>
            <button type="button" onClick={() => selectAll(2)} aria-label={allSelectedAtLevel(2) ? t('plusClear') : t('allPlus')} className="flex items-center justify-center transition-[background-color,border-color,box-shadow,transform,filter] hover:brightness-110 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[#e8b030]" style={squareControlButtonStyle(allSelectedAtLevel(2))}>
              <span aria-hidden="true" style={toolbarUpgradeGlyphStyle(allSelectedAtLevel(2))}>+</span>
            </button>
            <button type="button" onClick={() => selectAll(3)} aria-label={allSelectedAtLevel(3) ? t('plusplusClear') : t('allPlusPlus')} className="flex items-center justify-center transition-[background-color,border-color,box-shadow,transform,filter] hover:brightness-110 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[#e8b030]" style={squareControlButtonStyle(allSelectedAtLevel(3))}>
              <span aria-hidden="true" style={toolbarUpgradeGlyphStyle(allSelectedAtLevel(3))}>++</span>
            </button>
          </div>

          <div
            className="ml-auto flex items-center gap-2"
            style={{
              minHeight: 'max(2.75rem, 44px)',
              padding: '0 0.75rem',
              background: 'rgba(18, 15, 12, 0.72)',
              border: '1px solid rgba(92, 73, 54, 0.86)',
              borderRadius: '0.375rem',
              boxShadow: 'none',
            }}
          >
            <Image src={`${S}/icons/start-buffs/starlight.webp`} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem' }} />
            <span style={{ color: '#d8c1a0', fontSize: '0.9375rem', fontWeight: 500 }}>{t('usedStarlight')}</span>
            <span style={{ color: '#d8c1a0', fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{totalCost}</span>
          </div>
        </div>
      </div>

      {/* 가호 카드 그리드 */}
      <div
        ref={gridRef}
        className="planner-blessing-grid relative z-10 grid grid-cols-1 overflow-visible sm:grid-cols-2 lg:grid-cols-5"
        style={{
          gap: cardColumnCount >= 5 ? '8px' : '6px',
          gridTemplateColumns: `repeat(${cardColumnCount}, minmax(0, ${CARD_WRAPPER_WIDTH_NUMBER * cardScale}px))`,
          justifyContent: 'center',
          padding: '1rem 0 0',
        }}
      >
        {BLESSINGS.map(blessing => {
          const level = selectedBlessings.get(blessing.baseId) ?? 0
          const isSelected = level > 0
          const currentCost = level > 0 ? blessing.costs[level - 1] : blessing.costs[0]
          const selectedLevel = Math.max(1, level)
          const currentEffects = blessing.effectsByLevel[selectedLevel - 1] ?? blessing.effectsByLevel[0]
          const displayName = getBlessingDisplayName(blessing, level)

          return (
            <div
              key={blessing.baseId}
              className="relative min-w-0 overflow-visible"
              style={{
                width: `${CARD_WRAPPER_WIDTH_NUMBER * cardScale}px`,
                height: `${CARD_WRAPPER_HEIGHT_NUMBER * cardScale}px`,
                justifySelf: 'center',
              }}
            >
              <div
                className="planner-blessing-card group relative min-w-0 overflow-visible transition-[filter] hover:brightness-105"
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
                <button
                  type="button"
                  onClick={() => toggleBlessing(blessing.baseId, 1)}
                  aria-label={`${blessing.name} ${t('base')}`}
                  className="absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf35]"
                  style={{
                    left: '4.5%',
                    top: '4.5%',
                    right: '4.5%',
                    bottom: '13.5%',
                    zIndex: 3,
                    border: 0,
                    padding: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                />
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
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute overflow-visible opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{
                    left: '-0.125rem',
                    top: '-0.0625rem',
                    width: CARD_SELECTED_WIDTH,
                    height: CARD_SELECTED_HEIGHT,
                    opacity: isSelected ? 1 : undefined,
                    zIndex: 2,
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

              {/* 헤더: 아이콘 + 이름 + 코스트 */}
                <div className="pointer-events-none absolute min-w-0" style={{ left: '1.625rem', top: '2.8125rem', width: '4.25rem', aspectRatio: '1 / 1', zIndex: 4 }}>
                <Image
                  src={`${S}/icons/start-buffs/${blessing.baseId}.webp`}
                  alt=""
                  fill
                  sizes="4rem"
                  style={{ objectFit: 'contain', opacity: isSelected ? 1 : 0.86 }}
                />
                </div>
                <div className="pointer-events-none absolute min-w-0 overflow-hidden" style={{ left: '5.5rem', top: '3.125rem', width: '10rem', zIndex: 4 }}>
                  <BlessingTitle title={displayName} />
                </div>
                <div
                className="pointer-events-none absolute flex items-center justify-end gap-1"
                style={{
                  top: '1.7%',
                  right: '1.875rem',
                  width: '4.25rem',
                  height: '2.8125rem',
                  padding: 0,
                  zIndex: 4,
                }}
              >
                  <Image src={`${S}/icons/start-buffs/starlight.webp`} alt="" width={24} height={24} style={{ width: '1.5rem', height: '1.5rem' }} />
                <span style={{ color: '#f4c84a', fontSize: '1.625rem', fontWeight: 400, lineHeight: 1, fontFamily: 'var(--font-mikodacs), var(--font-mono)', textShadow: '0 0.125rem 0.125rem rgba(7, 4, 2, 0.96)' }}>{currentCost}</span>
                </div>

              {/* 효과 목록 */}
                <div className="pointer-events-none absolute overflow-hidden" style={{ left: '1.5rem', top: '7.1875rem', width: '13.875rem', height: '7.25rem', zIndex: 4 }}>
                <div className="space-y-0.5">
                  {currentEffects.map((eff: string, i: number) => {
                    const segments = getStyledEffectSegments(getEffectDiffSegments(blessing, selectedLevel, eff, i))
                    return (
                      <div key={`${i}-${eff}`} className="flex min-w-0 items-start gap-1.5" style={{ color: '#ded5c7', fontSize: '0.9375rem', lineHeight: 1.16, fontWeight: 500, textShadow: '0 0.0625rem 0.25rem rgba(0,0,0,0.95)' }}>
                        <span aria-hidden="true" style={{ color: '#d7c2aa', lineHeight: 1.25 }}>•</span>
                        <span className="min-w-0 break-words">
                          {segments.map((segment, segmentIndex) => (
                            <span
                              key={segmentIndex}
                              style={{
                                color: segment.tone === 'diff'
                                  ? '#eac335'
                                  : segment.tone === 'term'
                                    ? '#f12d22'
                                    : '#ded5c7',
                                fontWeight: segment.tone === 'normal' ? 500 : 700,
                              }}
                            >
                              {segment.text}
                            </span>
                          ))}
                        </span>
                      </div>
                    )
                  })}
                </div>
                </div>

              {/* +/++ 버튼 */}
                <div
                className="absolute flex overflow-visible"
                style={{
                  left: '22px',
                  right: '30px',
                  bottom: '20px',
                  gap: '10px',
                  height: '28px',
                  zIndex: 5,
                }}
              >
                {CARD_UPGRADE_LEVELS.map(lvl => {
                  const isActive = level === lvl
                  const levelLabel = LEVEL_LABELS[lvl - 1]
                  const glyph = getUpgradeGlyph(lvl, isActive)
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleBlessing(blessing.baseId, lvl)
                      }}
                      aria-label={`${blessing.name} ${levelLabel}`}
                      aria-pressed={isActive}
                      className="planner-blessing-upgrade-button group relative flex min-w-0 flex-1 items-center justify-center overflow-visible text-center transition-[filter,transform] hover:brightness-110 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3cf35] focus-visible:ring-offset-2 focus-visible:ring-offset-[#130806]"
                      style={getUpgradeSlotStyle()}
                    >
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
                    </button>
                  )
                })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
