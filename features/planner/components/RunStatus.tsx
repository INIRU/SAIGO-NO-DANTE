'use client'

import { useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { Search } from 'lucide-react'
import type { RunState, RunAction } from '@/features/planner/lib/run-types'
import type { GiftData, RecipeData } from '@/lib/planner/types'
import GiftArtwork from '@/components/ui/GiftArtwork'
import GiftCard from '@/features/mirror-dungeon/components/GiftCard'
import { localizeRowName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { runSectionTitle } from './GiftCheckSection'
import InventoryPanel from './InventoryPanel'
const PlannerGiftModal = dynamic(() => import('@/features/planner/components/PlannerGiftModal'), { ssr: false })

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  recipes: RecipeData[]
}

/**
 * Where the run stands, which the PiP has no room for: the plan's final gifts and how many are in hand (missing ones
 * dimmed; a click opens the gift's details, × takes it off the plan, the search adds one), then the held gifts and the
 * fusions they can make.
 */
export default function RunStatus({ state, dispatch, gifts, giftMap, recipes }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const localized = (gift: GiftData) => localizeRowName(gift, locale)
  const ownedIds = useMemo(() => new Set(state.giftInventory.map(String)), [state.giftInventory])
  const targets = useMemo(() => [...new Set((state.targetGifts ?? []).map(id => String(Number(id))))].map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[],
    [state.targetGifts, giftMap])
  const targetIds = useMemo(() => new Set(targets.map(gift => gift.game_id)), [targets])
  const owned = targets.filter(gift => ownedIds.has(String(gift.game_id))).length
  const [search, setSearch] = useState('')
  const [modalGift, setModalGift] = useState<GiftData | null>(null)
  const modalTrigger = useRef<HTMLElement | null>(null)
  const closeModal = () => {
    setModalGift(null)
    const trigger = modalTrigger.current
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus() })
  }
  const results = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return needle ? gifts.filter(gift => localized(gift).toLocaleLowerCase().includes(needle)) : []
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, gifts, locale])

  return (
    <div data-run-status role="region" aria-label={t('viewOverview')} className="flex min-w-0 flex-col gap-8 lg:order-2 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-[var(--border)] lg:px-6">
      <section className="min-w-0" aria-labelledby="run-target-gifts">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 id="run-target-gifts" className={runSectionTitle}>{t('targetGifts')}</h2>
          {targets.length > 0 && <span className="text-[0.8125rem] tabular-nums text-[var(--text-secondary)]">{t('targetProgress', { acquired: owned, total: targets.length })}</span>}
        </div>
        {targets.length > 0 ? <>
          <div aria-hidden="true" className="mb-3 h-1 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div className="h-full origin-left rounded-full bg-[var(--gold)] transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${owned / targets.length})` }} />
          </div>
          <ul className="mb-3 flex flex-wrap gap-2">
            {targets.map(gift => {
              const have = ownedIds.has(String(gift.game_id))
              const label = have ? `${localized(gift)}, ${t('acquired')}` : localized(gift)
              return <li key={gift.game_id} data-owned={have || undefined} className={have ? undefined : 'opacity-40'}>
                <GiftCard gift={gift} size="3.25rem" showName={false} title={label} ariaLabel={label}
                  onClick={() => { modalTrigger.current = document.activeElement as HTMLElement | null; setModalGift(gift) }}
                  onRemove={() => dispatch({ type: 'REMOVE_TARGET_GIFT', giftId: String(gift.game_id) })} />
              </li>
            })}
          </ul>
        </> : <p className="mb-3 text-xs leading-5 text-[var(--text-tertiary)]">{t('noTargetsHint')}</p>}
        <div className="relative max-w-sm">
          <Search aria-hidden="true" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input aria-label={t('addTargetGift')} value={search} onChange={event => setSearch(event.target.value)} placeholder={t('addTargetGift')}
            className="min-h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--gold)] focus-visible:outline-none" />
          {search.trim() && <p role="status" className="sr-only">{t('giftSearchCount', { count: results.length })}</p>}
          {results.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_0.5rem_1.5rem_rgba(0,0,0,0.5)]">
              {results.map(gift => {
                const isTarget = targetIds.has(gift.game_id)
                return (
                  <li key={gift.game_id}>
                    <button type="button" disabled={isTarget} onClick={() => { dispatch({ type: 'ADD_TARGET_GIFT', giftId: String(gift.game_id) }); setSearch('') }}
                      className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-[var(--text-primary)] hover:bg-[rgba(200,144,10,0.1)] disabled:opacity-50">
                      <span className="w-8 shrink-0"><GiftArtwork gift={gift} displayName={localized(gift)} sizes="32px" /></span>
                      <span className="min-w-0 flex-1 truncate">{localized(gift)}</span>
                      {isTarget && <span className="text-xs text-[var(--gold)]">{t('added')}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
      <InventoryPanel state={state} dispatch={dispatch} giftMap={giftMap} recipes={recipes} />
      {modalGift && <PlannerGiftModal gift={modalGift} onClose={closeModal} />}
    </div>
  )
}
