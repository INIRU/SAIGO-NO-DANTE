'use client'

import { useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { Beaker } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { GiftData, RecipeData } from '@/lib/planner/types'
import { committedKeywords, fusionGuide } from '@/lib/planner/assist-gift-guide'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import FusionGuideList from './FusionGuideList'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
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

/** Held gifts in the order they were recorded (click for details, × to remove), then the fusions they can make (fusionGuide order). */
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
  // Final gifts first, then their materials, the deck's keywords and the rest, and finals one material short.
  const guide = useMemo(() => fusionGuide({ inventory: state.giftInventory, targets: state.targetGifts, recipes, giftMap,
    committed: committedKeywords(state.identitySlots, state.giftInventory, giftMap) }), [state.giftInventory, state.targetGifts, state.identitySlots, recipes, giftMap])
  const conditionCounts = useMemo(() => getGiftConditionCountsForSlots(state.identitySlots), [state.identitySlots])
  const conditionOf = (gift: GiftData) => getGiftActivationConditionStatus({ gift, ...conditionCounts })

  return (
    <>
      <section className="min-w-0" aria-labelledby="run-held-gifts">
        <h2 id="run-held-gifts" className={`mb-3 ${runSectionTitle}`}>{t('heldGiftsCount', { count: inventoryGifts.length })}</h2>
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

      {(guide.ready.length > 0 || guide.nearly.length > 0) && (
        <section aria-labelledby="run-craftable" className="rounded-md border border-[rgba(200,144,10,0.3)] bg-[rgba(200,144,10,0.07)] p-3">
          <h2 id="run-craftable" className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--gold-light)]">
            <Beaker aria-hidden="true" size={14} /> {t('craftableCount', { count: guide.ready.length })}
          </h2>
          <FusionGuideList guide={guide} onCraft={fusion => dispatch({ type: 'CRAFT_FUSION', materialIds: fusion.materials.map(material => String(material.game_id)), resultId: fusion.result ? String(fusion.result.game_id) : '' })} />
        </section>
      )}

      {modalGift && <PlannerGiftModal gift={modalGift} onClose={closeGiftModal} conditionStatus={conditionOf(modalGift)} />}
    </>
  )
}
