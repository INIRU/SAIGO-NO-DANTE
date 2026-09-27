'use client'

import { useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { Beaker } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { GiftData, RecipeData } from '@/lib/planner/types'
import { findAvailableFusions } from '@/lib/planner/fusion'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import GiftArtwork from '@/components/ui/GiftArtwork'
import GiftCard from '@/components/ui/GiftCard'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { runSectionTitle } from './GiftCheckSection'
const PlannerGiftModal = dynamic(() => import('@/components/planner/PlannerGiftModal'), { ssr: false })

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  giftMap: Map<number, GiftData>
  recipes: RecipeData[]
}

/** Held gifts in the order they were recorded (click for details, × to remove), with the fusions they can make. */
export default function InventoryPanel({ state, dispatch, giftMap, recipes }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const giftName = (gift: GiftData) => getLocalizedName({ name_kr: gift.name, name_en: gift.name_en, name_jp: gift.name_jp }, locale)
  const [modalGift, setModalGift] = useState<GiftData | null>(null)
  const modalTriggerRef = useRef<HTMLElement | null>(null)

  function closeGiftModal() {
    setModalGift(null)
    const trigger = modalTriggerRef.current
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus() })
  }

  const inventoryGifts = useMemo(() =>
    [...new Set(state.giftInventory)].map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[]
  , [state.giftInventory, giftMap])
  const craftable = useMemo(() =>
    findAvailableFusions(state.giftInventory, recipes, giftMap).filter(fusion => fusion.canCraft)
  , [state.giftInventory, recipes, giftMap])
  const conditionCounts = useMemo(() => getGiftConditionCountsForSlots(state.identitySlots), [state.identitySlots])
  const conditionOf = (gift: GiftData) => getGiftActivationConditionStatus({ gift, ...conditionCounts })

  return (
    <>
      {craftable.length > 0 && (
        <section aria-labelledby="run-craftable" className="rounded-md border border-[rgba(200,144,10,0.3)] bg-[rgba(200,144,10,0.07)] p-3">
          <h3 id="run-craftable" className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--gold-light)]">
            <Beaker aria-hidden="true" size={14} /> {t('craftableCount', { count: craftable.length })}
          </h3>
          <ul className="space-y-2">
            {craftable.slice(0, 5).map(fusion => (
              <li key={fusion.recipe.id} className="flex items-center gap-1.5">
                <span className="flex shrink-0 gap-0.5">
                  {fusion.materials.map(material => <span key={material.game_id} className="w-7" title={giftName(material)}><GiftArtwork gift={material} displayName={giftName(material)} sizes="28px" /></span>)}
                </span>
                <span aria-hidden="true" className="text-xs text-[var(--text-muted)]">→</span>
                {fusion.result && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="w-8 shrink-0"><GiftArtwork gift={fusion.result} displayName={giftName(fusion.result)} sizes="32px" /></span>
                    <span className="truncate text-xs text-[var(--text-primary)]">{giftName(fusion.result)}</span>
                  </span>
                )}
                <button type="button"
                  onClick={() => dispatch({ type: 'CRAFT_FUSION', materialIds: fusion.materials.map(material => String(material.game_id)), resultId: fusion.result ? String(fusion.result.game_id) : '' })}
                  className="ml-auto min-h-8 shrink-0 rounded-md bg-[rgba(200,144,10,0.2)] px-2.5 text-xs font-semibold text-[var(--gold-light)] hover:bg-[rgba(200,144,10,0.3)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
                  {t('craft')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="min-w-0" aria-labelledby="run-held-gifts">
        <h3 id="run-held-gifts" className={`mb-3 ${runSectionTitle}`}>{t('heldGiftsCount', { count: inventoryGifts.length })}</h3>
        {inventoryGifts.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">{t('noHeldGifts')}</p>
        ) : (
          <div className="flex flex-wrap content-start gap-2">
            {inventoryGifts.map(gift => (
              <GiftCard key={gift.game_id} gift={gift} size="3.5rem" showName={false} title={giftName(gift)} ariaLabel={giftName(gift)}
                onClick={() => { modalTriggerRef.current = document.activeElement as HTMLElement | null; setModalGift(gift) }}
                onRemove={() => dispatch({ type: 'REMOVE_GIFT', giftId: String(gift.game_id) })}
                conditionStatus={conditionOf(gift)} conditionDetail={false} />
            ))}
          </div>
        )}
      </section>

      {modalGift && <PlannerGiftModal gift={modalGift} onClose={closeGiftModal} conditionStatus={conditionOf(modalGift)} />}
    </>
  )
}
