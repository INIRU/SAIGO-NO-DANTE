'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Search } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { ThemeData, GiftData } from '@/lib/planner/types'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import { getGiftsFromThemes, themeExclusiveGiftIds } from '@/lib/planner/fusion'
import { visibleTargetGifts } from '@/lib/planner/run-priority-gifts'
import GiftCatalog, { giftKeywordIcon, toCatalogGift, useGiftCatalogFilters, type GiftCatalogCardProps } from '@/components/gifts/GiftCatalog'
import type { EgoGift } from '@/components/mirror-dungeon/types'
import GiftCard from '@/components/ui/GiftCard'
import GiftArtwork from '@/components/ui/GiftArtwork'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  themes: ThemeData[]
  onChooseTheme: () => void
  /** Held gifts and fusions, under the planned final gifts in the side column. */
  aside?: ReactNode
}

export const runSectionTitle = 'font-[family-name:var(--font-heading)] text-base text-[var(--gold-light)]'

/**
 * The run's gift tab: this floor's gifts as the shared catalog on the wide side (click records or removes an acquisition),
 * and the plan's final gifts with held gifts on the narrow side.
 */
export default function GiftCheckSection({ state, dispatch, gifts, giftMap, themes, onChooseTheme, aside }: Props) {
  const t = useTranslations('planner.run')
  const tPicker = useTranslations('floorGiftPicker')
  const locale = useLocale() as SupportedLang
  const localized = (item: { name: string; name_en?: string | null; name_jp?: string | null }) => getLocalizedName({ name_kr: item.name, name_en: item.name_en, name_jp: item.name_jp }, locale)
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const currentTheme = currentLog?.themeId ? themes.find(theme => String(theme.id) === String(currentLog.themeId)) ?? null : null

  const ownedSet = useMemo(() => new Set(state.giftInventory.map(Number)), [state.giftInventory])
  const ownedIds = useMemo(() => new Set(state.giftInventory.map(String)), [state.giftInventory])
  const conditionCounts = useMemo(() => getGiftConditionCountsForSlots(state.identitySlots), [state.identitySlots])

  // 이번 층 목록: 기본은 이 테마팩 기프트, 끄면 합성·조합식까지 이 층에서 얻을 수 있는 전체(다른 팩 전용 제외)
  const [onlyFloor, setOnlyFloor] = useState(true)
  const themeGifts = useMemo(() => currentTheme ? getGiftsFromThemes([String(currentTheme.id)], themes, giftMap) : [], [currentTheme, themes, giftMap])
  const reachableGifts = useMemo(() => {
    const own = new Set(currentTheme ? themeExclusiveGiftIds(currentTheme) : [])
    const others = new Set(themes.flatMap(theme => themeExclusiveGiftIds(theme)).filter(id => !own.has(id)))
    return gifts.filter(gift => !others.has(gift.game_id))
  }, [currentTheme, gifts, themes])
  const source = currentTheme && onlyFloor ? themeGifts : reachableGifts
  const catalog = useMemo(() => source.map(toCatalogGift), [source])
  const filters = useGiftCatalogFilters()
  // 칸마다 같은 객체를 돌려줘야 누를 때 격자 전체가 다시 그려지지 않는다
  const conditionProps = useMemo(() => new Map(source.map(gift => [String(gift.game_id), { conditionStatus: getGiftActivationConditionStatus({ gift, ...conditionCounts }), conditionDetail: false } satisfies GiftCatalogCardProps])), [source, conditionCounts])
  const toggleOwned = (gift: EgoGift) => dispatch({ type: ownedIds.has(gift.id) ? 'REMOVE_GIFT' : 'ACQUIRE_GIFT', giftId: gift.id })

  // 계획된 최종 기프트: 보유는 켜고 미보유는 꺼 둔 채 시작한다. 필요할 때 사용자가 미보유를 켠다.
  const targetSet = useMemo(() => new Set((state.targetGifts ?? []).map(Number)), [state.targetGifts])
  const targetGiftList = useMemo(() => {
    const list = (state.targetGifts ?? []).map(id => giftMap.get(Number(id))).filter(Boolean) as GiftData[]
    return list.sort((a, b) => Number(ownedSet.has(a.game_id)) - Number(ownedSet.has(b.game_id)))
  }, [state.targetGifts, giftMap, ownedSet])
  const [showOwned, setShowOwned] = useState(true)
  const [showMissing, setShowMissing] = useState(false)
  const ownedTargetCount = targetGiftList.filter(gift => ownedSet.has(gift.game_id)).length
  const filteredTargets = visibleTargetGifts(targetGiftList, ownedSet, { owned: showOwned, missing: showMissing })
  const [showAllTargets, setShowAllTargets] = useState(false)
  const shownTargets = showAllTargets ? filteredTargets : filteredTargets.slice(0, 12)
  const hiddenTargetCount = filteredTargets.length - shownTargets.length

  const [targetSearch, setTargetSearch] = useState('')
  const targetSearchResults = useMemo(() => {
    const needle = targetSearch.trim().toLocaleLowerCase()
    if (!needle) return []
    return gifts.filter(gift => localized(gift).toLocaleLowerCase().includes(needle))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSearch, gifts, locale])

  const toggleButton = (pressed: boolean, onClick: () => void, label: string) => (
    <button type="button" aria-pressed={pressed} onClick={onClick}
      className={`min-h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] ${pressed ? 'border-[var(--gold)] bg-[rgba(200,144,10,0.18)] text-[var(--gold-light)]' : 'border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
      {label}
    </button>
  )

  const onlyFloorToggle = currentTheme && (
    <label className="ml-auto inline-flex min-h-10 cursor-pointer select-none items-center gap-2 text-sm text-[var(--text-primary)]">
      <input type="checkbox" checked={onlyFloor} onChange={event => setOnlyFloor(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="grid h-[1.125rem] w-[1.125rem] place-items-center rounded-[0.25rem] border border-[#5a4526] bg-[#0d0b08] text-transparent transition-colors peer-checked:border-[#c8900a] peer-checked:bg-[#c8900a] peer-checked:text-[#0d0b08] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#e8b030]">
        <Check size={13} strokeWidth={3} />
      </span>
      {tPicker('onlyFloor')}
    </label>
  )

  return (
    <div className="grid items-start gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
      <section className="min-w-0" aria-labelledby="run-floor-gifts">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 id="run-floor-gifts" className={runSectionTitle}>{t('floorGifts')}</h3>
          {currentTheme && <span className="text-sm text-[var(--text-secondary)]">{localized(currentTheme)}</span>}
        </div>
        {!currentTheme && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-dashed border-[var(--border)] px-4 py-3">
            <p className="min-w-0 flex-1 basis-48 text-sm text-[var(--text-secondary)]">{t('chooseThemeHint')}</p>
            <button type="button" onClick={onChooseTheme} className="min-h-10 rounded-md border border-[var(--border-gold)] px-4 text-sm font-semibold text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">{t('chooseThemeAction')}</button>
          </div>
        )}
        <GiftCatalog compact gifts={catalog} getGiftKeywordIcon={giftKeywordIcon} filters={filters}
          markedIds={ownedIds} markedLabel={t('acquired')} onGiftClick={toggleOwned}
          cardProps={gift => ownedIds.has(gift.id) ? undefined : conditionProps.get(gift.id)}
          toolbarEnd={onlyFloorToggle || undefined} />
      </section>

      <div className="order-first flex min-w-0 flex-col gap-8 lg:order-none lg:border-l lg:border-[var(--border)] lg:pl-6">
        <section className="min-w-0" aria-labelledby="run-target-gifts">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 id="run-target-gifts" className={runSectionTitle}>{t('targetGifts')}</h3>
            {targetGiftList.length > 0 && (
              <span className="text-xs tabular-nums text-[var(--text-secondary)]">
                {t('targetProgress', { acquired: ownedTargetCount, total: targetGiftList.length })}
              </span>
            )}
          </div>
          {targetGiftList.length > 0 && (
            <>
              <div aria-hidden="true" className="mb-3 h-1 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-300" style={{ width: `${(ownedTargetCount / targetGiftList.length) * 100}%` }} />
              </div>
              <div className="mb-3 flex gap-2">
                {toggleButton(showOwned, () => setShowOwned(value => !value), t('targetShowOwned', { count: ownedTargetCount }))}
                {toggleButton(showMissing, () => setShowMissing(value => !value), t('targetShowMissing', { count: targetGiftList.length - ownedTargetCount }))}
              </div>
            </>
          )}

          <div role="region" aria-label={t('targetGifts')}>
            {targetGiftList.length === 0 ? (
              <p className="text-xs leading-5 text-[var(--text-tertiary)]">{t('noTargetsHint')}</p>
            ) : filteredTargets.length === 0 ? (
              <p className="text-xs leading-5 text-[var(--text-tertiary)]">{t('targetFilterEmpty')}</p>
            ) : (
              <>
                <div className="flex flex-wrap content-start gap-2">
                  {shownTargets.map(gift => {
                    const owned = ownedSet.has(gift.game_id)
                    return (
                      <GiftCard key={gift.game_id} gift={gift} size="4rem" isSelected={owned}
                        onClick={() => dispatch({ type: owned ? 'REMOVE_GIFT' : 'ACQUIRE_GIFT', giftId: String(gift.game_id) })}
                        onRemove={() => dispatch({ type: 'REMOVE_TARGET_GIFT', giftId: String(gift.game_id) })}
                        conditionStatus={owned ? null : getGiftActivationConditionStatus({ gift, ...conditionCounts })} conditionDetail={false} />
                    )
                  })}
                </div>
                {hiddenTargetCount > 0 && (
                  <button type="button" onClick={() => setShowAllTargets(true)} className="mt-2 min-h-9 w-full rounded-md border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
                    {t('showAllTargets', { count: hiddenTargetCount })}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="relative mt-3">
            <Search aria-hidden="true" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input aria-label={t('addTargetGift')} value={targetSearch} onChange={event => setTargetSearch(event.target.value)} placeholder={t('addTargetGift')}
              className="min-h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:border-[var(--gold)] focus-visible:outline-none" />
            {targetSearch.trim() && <p role="status" className="sr-only">{t('giftSearchCount', { count: targetSearchResults.length })}</p>}
            {targetSearchResults.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_0.5rem_1.5rem_rgba(0,0,0,0.5)]">
                {targetSearchResults.map(gift => {
                  const isTarget = targetSet.has(gift.game_id)
                  return (
                    <li key={gift.game_id}>
                      <button type="button" disabled={isTarget}
                        onClick={() => { dispatch({ type: 'ADD_TARGET_GIFT', giftId: String(gift.game_id) }); setTargetSearch('') }}
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

        {aside}
      </div>
    </div>
  )
}
