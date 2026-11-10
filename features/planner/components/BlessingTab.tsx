'use client'

import { getGameUiAsset } from '@/lib/utils/game-ui'
import { useMemo } from 'react'
import type { CSSProperties, Dispatch } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { type PlannerState, type PlannerAction } from '@/lib/planner/types'
import { getSelectedBlessingCost, getSelectedBlessingLevels, normalizeBlessingMessages } from '@/features/planner/lib/blessing'
import { BlessingCard, CARD_WRAPPER_WIDTH_NUMBER, useBlessingGridMetrics } from '@/features/planner/components/BlessingGrid'

interface Props {
  state: PlannerState
  dispatch: Dispatch<PlannerAction>
}

export default function BlessingTab({ state, dispatch }: Props) {
  const t = useTranslations('planner.blessingTab')
  const { gridRef, cardScale, cardColumnCount } = useBlessingGridMetrics()
  const blessings = useMemo(
    () => normalizeBlessingMessages(t.raw('blessings'), baseId => t('fallbackName', { baseId })),
    [t],
  )

  // 가호 선택 상태: giftInventory에 'blessing_{baseId}_{level}' 형태로 저장
  const selectedBlessings = useMemo(() => {
    return getSelectedBlessingLevels(state.giftInventory)
  }, [state.giftInventory])

  const totalCost = useMemo(() => {
    return getSelectedBlessingCost(blessings, selectedBlessings)
  }, [blessings, selectedBlessings])

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
    blessings.every(b => selectedBlessings.get(b.baseId) === level)

  const selectAll = (level: number) => {
    // 이미 전부 해당 레벨이면 → 전체 해제
    const shouldClear = allSelectedAtLevel(level)
    // 기존 가호 전부 제거
    for (const id of state.giftInventory) {
      if (id.startsWith('blessing_')) dispatch({ type: 'REMOVE_GIFT', giftId: id })
    }
    if (!shouldClear) {
      for (const b of blessings) {
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
            <button type="button" onClick={handlePrimarySelection} className="transition-[background-color,border-color,box-shadow,transform,filter] hover:brightness-110 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[var(--gold-light)]" style={controlButtonStyle(hasSelectedBlessings || allSelectedAtLevel(1))}>
              {hasSelectedBlessings ? t('allClear') : t('selectAll')}
            </button>
            <button type="button" onClick={() => selectAll(2)} aria-label={allSelectedAtLevel(2) ? t('plusClear') : t('allPlus')} className="flex items-center justify-center transition-[background-color,border-color,box-shadow,transform,filter] hover:brightness-110 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[var(--gold-light)]" style={squareControlButtonStyle(allSelectedAtLevel(2))}>
              <span aria-hidden="true" style={toolbarUpgradeGlyphStyle(allSelectedAtLevel(2))}>+</span>
            </button>
            <button type="button" onClick={() => selectAll(3)} aria-label={allSelectedAtLevel(3) ? t('plusplusClear') : t('allPlusPlus')} className="flex items-center justify-center transition-[background-color,border-color,box-shadow,transform,filter] hover:brightness-110 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[var(--gold-light)]" style={squareControlButtonStyle(allSelectedAtLevel(3))}>
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
            <Image src={getGameUiAsset('start-buffs/starlight')} alt="" width={20} height={20} style={{ width: '1.25rem', height: '1.25rem' }} />
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
          gridTemplateColumns: `repeat(${cardColumnCount}, minmax(0, ${Math.floor(CARD_WRAPPER_WIDTH_NUMBER * cardScale)}px))`,
          justifyContent: 'center',
          padding: '1rem 0 0',
        }}
      >
        {blessings.map(blessing => {
          const level = selectedBlessings.get(blessing.baseId) ?? 0

          return (
            <BlessingCard
              key={blessing.baseId}
              blessing={blessing}
              level={level}
              cardScale={cardScale}
              baseLabel={t('base')}
              interactive
              onBaseClick={() => toggleBlessing(blessing.baseId, 1)}
              onUpgradeClick={upgradeLevel => toggleBlessing(blessing.baseId, upgradeLevel)}
            />
          )
        })}
      </div>
    </section>
  )
}
