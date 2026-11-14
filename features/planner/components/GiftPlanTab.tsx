'use client'

import { observationCost, maxObserved, type Observation } from '@/lib/planner/observation'
import { getGameUiAsset } from '@/lib/utils/game-ui'
import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { PlannerState, PlannerAction, GiftData } from '@/lib/planner/types'
import { GRADE_ORDER } from '@/lib/planner/gift-plan-constants'
import type { GiftSubTab } from '@/lib/planner/gift-plan-constants'
import { maxStartGiftCount, pickGiftsByIds } from '@/features/planner/lib/gift-plan-selection'
import { useGiftPlanSelection } from '@/features/planner/hooks/useGiftPlanSelection'
import GiftGridPanel from './GiftGridPanel'
import SelectedPanel from './SelectedPanel'
import GiftSubTabBar from './GiftSubTabBar'
import GiftObserveInfoBar from './GiftObserveInfoBar'
import GiftStartPicker from './GiftStartPicker'
import GiftPlanTabStyles from './GiftPlanTabStyles'

interface Props {
  state: PlannerState
  dispatch: React.Dispatch<PlannerAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  /** The current season's start observation (md_observation). */
  observation: Observation
}

// ── Main component ───────────────────────────────────────────────────────────
export default function GiftPlanTab({ state, dispatch, gifts, giftMap, observation }: Props) {
  const t = useTranslations('planner.giftTab')
  const tFloor = useTranslations('planner.floorTab')
  const [subTab, setSubTab] = useState<GiftSubTab>('observe')

  const { observeIds, startIds, toggleObserve, observeGifts } = useGiftPlanSelection(state.giftInventory, dispatch, gifts, observation)

  const subTabs: { key: GiftSubTab; label: string; count: number }[] = [
    { key: 'observe', label: t('tabs.observe'), count: observeIds.size },
    { key: 'start', label: t('tabs.start'), count: startIds.size },
  ]
  const maxStartGifts = maxStartGiftCount(state.giftInventory)

  return (
    <div className="planner-gift-tab" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <GiftSubTabBar tabs={subTabs} active={subTab} onSelect={setSubTab} />

      {/* ── Observe tab ─────────────────────────────────────────────────── */}
      {subTab === 'observe' && (
        <div className="planner-gift-observe" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <GiftObserveInfoBar count={observeIds.size} max={maxObserved(observation)} cost={observationCost(observation, observeIds.size)} />

          {/* 3-column layout: sidebar + grid + selected */}
          <div className="planner-gift-observe-layout" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <GiftGridPanel
              gifts={observeGifts}
              selectedIds={observeIds}
              maxSelect={3}
              gradeOrder={GRADE_ORDER}
              onToggle={toggleObserve}
            />
            <SelectedPanel
              title={t('observe.selectedTitle')}
              bandLabel={tFloor('finalAutoObserveTag')}
              selectedGifts={pickGiftsByIds(observeIds, giftMap)}
              onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `observe_${gift.game_id}` })}
              badge={
                <span style={{
                  fontSize: '0.5625rem',
                  color: 'var(--gold)',
                  background: 'rgba(200,144,10,0.12)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.25rem',
                  border: '1px solid rgba(200,144,10,0.2)',
                }}>
                  {observeIds.size}/{maxObserved(observation)}
                </span>
              }
              footer={
                observeIds.size > 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.25rem',
                    paddingTop: '0.375rem',
                    borderTop: '1px solid #1f1a14',
                    fontSize: '0.6875rem',
                    color: 'var(--gold-dim)',
                  }}>
                    <Image
                      src={getGameUiAsset('start-buffs/starlight')}
                      alt={t('observe.starlightAlt')}
                      width={14}
                      height={14}
                      style={{ width: '0.875rem', height: '0.875rem' }}
                    />
                    {t('observe.starlightCost', { count: observationCost(observation, observeIds.size) })}
                  </div>
                ) : undefined
              }
            />
          </div>
        </div>
      )}

      {/* ── Start tab ───────────────────────────────────────────────────── */}
      {subTab === 'start' && (
        <div className="planner-gift-start-layout" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <GiftStartPicker gifts={gifts} startIds={startIds} maxStartGifts={maxStartGifts} dispatch={dispatch} />
          <SelectedPanel
            title={t('start.selectedTitle')}
            bandLabel={tFloor('finalAutoStartTag')}
            selectedGifts={pickGiftsByIds(startIds, giftMap)}
            onRemove={gift => dispatch({ type: 'REMOVE_GIFT', giftId: `start_${gift.game_id}` })}
            badge={
              <span style={{
                fontSize: '0.5625rem',
                color: startIds.size >= maxStartGifts ? '#dc2626' : 'var(--gold)',
                background: startIds.size >= maxStartGifts ? 'rgba(220,38,38,0.1)' : 'rgba(200,144,10,0.1)',
                padding: '0.125rem 0.375rem',
                borderRadius: '0.25rem',
                border: `1px solid ${startIds.size >= maxStartGifts ? 'rgba(220,38,38,0.25)' : 'rgba(200,144,10,0.25)'}`,
                fontWeight: 600,
              }}>
                {t('start.selected', { count: startIds.size, max: maxStartGifts })}
              </span>
            }
          />
        </div>
      )}

      <GiftPlanTabStyles />
    </div>
  )
}
