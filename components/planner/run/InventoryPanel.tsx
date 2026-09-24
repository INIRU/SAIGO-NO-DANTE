'use client'

import { useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { X, Beaker } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { GiftData, RecipeData } from '@/lib/planner/types'
import { findAvailableFusions, computeKeywordDistribution } from '@/lib/planner/fusion'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots, getIdentityGiftConditionKeywords } from '@/lib/planner/gift-condition-status'
import KeywordChart from '@/components/planner/KeywordChart'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
const PlannerGiftModal = dynamic(() => import('@/components/planner/PlannerGiftModal'), { ssr: false })

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  recipes: RecipeData[]
}

export default function InventoryPanel({ state, dispatch, giftMap, recipes }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const giftName = (gift: GiftData) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const [modalGift, setModalGift] = useState<GiftData | null>(null)
  const modalTriggerRef = useRef<HTMLButtonElement | null>(null)

  function closeGiftModal() {
    setModalGift(null)
    const trigger = modalTriggerRef.current
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus() })
  }

  const inventoryGifts = useMemo(() =>
    state.giftInventory.map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[]
  , [state.giftInventory, giftMap])

  const keywordDist = useMemo(() =>
    computeKeywordDistribution(state.identitySlots.map(getIdentityGiftConditionKeywords))
  , [state.identitySlots])

  const craftable = useMemo(() =>
    findAvailableFusions(state.giftInventory, recipes, giftMap).filter(f => f.canCraft)
  , [state.giftInventory, recipes, giftMap])

  const conditionCounts = useMemo(
    () => getGiftConditionCountsForSlots(state.identitySlots),
    [state.identitySlots],
  )

  function getConditionStatus(gift: GiftData): { level: 'warn' | 'unmet'; text: string } | null {
    return getGiftActivationConditionStatus({ gift, ...conditionCounts })
  }

  // ── 공유 콘텐츠 ──
  const content = (
    <>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#999', marginBottom: '0.5rem' }}>
        {t('heldGiftsCount', { count: inventoryGifts.length })}
      </p>
      {inventoryGifts.length === 0 ? (
        <p style={{ fontSize: '0.6875rem', color: '#555', padding: '0.5rem 0' }}>{t('noHeldGifts')}</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.75rem' }}>
          {inventoryGifts.map((gift, i) => {
            const cond = getConditionStatus(gift)
            return (
              <div key={`${gift.game_id}-${i}`} className="group relative w-12 shrink-0">
                <button type="button" aria-label={giftName(gift)} title={`${giftName(gift)}${cond ? ` (${t(cond.level === 'unmet' ? 'conditionUnmet' : 'conditionWarn')}: ${cond.text})` : ''}`} onClick={event => { modalTriggerRef.current = event.currentTarget; setModalGift(gift) }} className="block w-full focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
                  <GiftArtwork gift={gift} displayName={giftName(gift)} sizes="48px">
                  {cond && (
                    <div style={{
                      position: 'absolute', inset: 0, zIndex: 15,
                      background: cond.level === 'unmet' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '0.4375rem', fontWeight: 700, color: cond.level === 'unmet' ? '#ef4444' : '#e8b030', textShadow: '0 0 0.25rem rgba(0,0,0,0.9)' }}>
                        {t(cond.level === 'unmet' ? 'unmet' : 'warn')}
                      </span>
                    </div>
                  )}
                  </GiftArtwork>
                </button>
                <button aria-label={t('removeGift', { name: giftName(gift) })} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REMOVE_GIFT', giftId: String(gift.game_id) }) }}
                  className="absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-red-800 text-white opacity-100 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <X size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {keywordDist.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#999', marginBottom: '0.5rem' }}>{t('keywordDistribution')}</p>
          <KeywordChart distribution={keywordDist} />
        </div>
      )}

      {craftable.length > 0 && (
        <div className="rounded-lg" style={{ background: 'rgba(200,144,10,0.08)', border: '1px solid rgba(200,144,10,0.25)', padding: '0.625rem' }}>
          <p className="flex items-center gap-1" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e8b030', marginBottom: '0.5rem' }}>
            <Beaker style={{ width: '0.75rem', height: '0.75rem' }} /> {t('craftableCount', { count: craftable.length })}
          </p>
          <div className="space-y-2">
            {craftable.slice(0, 5).map(fusion => (
              <div key={fusion.recipe.id} className="flex items-center gap-1 flex-wrap" style={{ fontSize: '0.5625rem' }}>
                <div className="flex gap-0.5 shrink-0">
                  {fusion.materials.map(m => <span key={m.game_id} className="w-8" title={giftName(m)}><GiftArtwork gift={m} displayName={giftName(m)} sizes="32px" /></span>)}
                </div>
                <span style={{ color: '#666' }}>→</span>
                {fusion.result && (
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="w-8 shrink-0"><GiftArtwork gift={fusion.result} displayName={giftName(fusion.result)} sizes="32px" /></span>
                    <span className="truncate" style={{ color: '#ccc' }}>{giftName(fusion.result)}</span>
                  </div>
                )}
                <button onClick={() => dispatch({ type: 'CRAFT_FUSION', materialIds: fusion.materials.map(m => String(m.game_id)), resultId: fusion.result ? String(fusion.result.game_id) : '' })}
                  className="ml-auto rounded shrink-0" style={{ background: 'rgba(200,144,10,0.2)', padding: '0.375rem 0.5rem', color: '#e8b030', fontSize: '0.5625rem', fontWeight: 600, minHeight: '1.75rem' }}>
                  {t('craft')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      <div className="min-w-0 border-t border-[var(--border)] pt-5">
        {content}
      </div>

      {/* 기프트 상세 모달 */}
      {modalGift && <PlannerGiftModal gift={modalGift} onClose={closeGiftModal} conditionStatus={getConditionStatus(modalGift)} />}
    </>
  )
}
