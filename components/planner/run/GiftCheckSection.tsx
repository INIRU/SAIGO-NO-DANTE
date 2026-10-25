'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import type { RunState, RunAction } from '@/lib/planner/run-types'
import type { ThemeData, GiftData } from '@/lib/planner/types'
import { getGiftActivationConditionStatus, getGiftConditionCountsForSlots } from '@/lib/planner/gift-condition-status'
import { getGiftsFromThemes, themeExclusiveGiftIds } from '@/lib/planner/fusion'
import { planThemeGiftIds } from '@/lib/planner/run-priority-gifts'
import GiftCatalog, { giftKeywordIcon, toCatalogGift, useGiftCatalogFilters, type GiftCatalogCardProps } from '@/components/gifts/GiftCatalog'
import type { EgoGift } from '@/components/mirror-dungeon/types'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  themes: ThemeData[]
  onChooseTheme: () => void
}

export const runSectionTitle = 'font-[family-name:var(--font-heading)] text-base text-[var(--gold-light)]'

/**
 * The run page's gift record column: one list of this floor's gifts and the plan's final gifts, narrowed by check filters.
 * Groups follow the PiP: this floor's plan, final targets, then gifts only this floor gives outside the plan (red mark),
 * then the rest by keyword. A click records or removes an acquisition; it is how a wrong reading is corrected and how a
 * run is recorded where the screen cannot be connected.
 */
export default function GiftCheckSection({ state, dispatch, gifts, giftMap, themes, onChooseTheme }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const localized = (item: { name: string; name_en?: string | null; name_jp?: string | null }) => getLocalizedName({ name_kr: item.name, name_en: item.name_en, name_jp: item.name_jp }, locale)
  const currentLog = state.floorLogs[state.currentFloor - 1]
  const currentTheme = currentLog?.themeId ? themes.find(theme => String(theme.id) === String(currentLog.themeId)) ?? null : null

  const ownedIds = useMemo(() => new Set(state.giftInventory.map(String)), [state.giftInventory])
  const conditionCounts = useMemo(() => getGiftConditionCountsForSlots(state.identitySlots), [state.identitySlots])

  // 체크 필터: 이 층(기본 켬), 계획 기프트만(끔), 보유 숨기기(끔)
  const [onlyFloor, setOnlyFloor] = useState(true)
  const [onlyPlanned, setOnlyPlanned] = useState(false)
  const [hideOwned, setHideOwned] = useState(false)

  const themeId = currentTheme ? String(currentTheme.id) : ''
  const floorPlanIds = useMemo(() => new Set(themeId ? planThemeGiftIds(state, themes, themeId, state.currentFloor).map(String) : []), [state, themes, themeId])
  const floorOnlyIds = useMemo(() => new Set(currentTheme ? themeExclusiveGiftIds(currentTheme).map(String) : []), [currentTheme])
  const targetIds = useMemo(() => new Set((state.targetGifts ?? []).map(id => String(Number(id)))), [state.targetGifts])
  const plannedIds = useMemo(() => new Set([...floorPlanIds, ...targetIds]), [floorPlanIds, targetIds])

  const themeGifts = useMemo(() => currentTheme ? getGiftsFromThemes([themeId], themes, giftMap) : [], [currentTheme, themeId, themes, giftMap])
  // 이 층을 끄면 이 층에서 얻을 수 있는 전체(합성·조합식 포함, 다른 팩 전용 제외)에 최종 목표를 더한다
  const reachableGifts = useMemo(() => {
    const own = new Set(currentTheme ? themeExclusiveGiftIds(currentTheme) : [])
    const others = new Set(themes.flatMap(theme => themeExclusiveGiftIds(theme)).filter(id => !own.has(id)))
    return gifts.filter(gift => !others.has(gift.game_id) || targetIds.has(String(gift.game_id)))
  }, [currentTheme, gifts, themes, targetIds])
  const base = currentTheme && onlyFloor ? themeGifts : reachableGifts
  const source = useMemo(() => base.filter(gift => (!onlyPlanned || plannedIds.has(String(gift.game_id))) && (!hideOwned || !ownedIds.has(String(gift.game_id)))),
    [base, onlyPlanned, plannedIds, hideOwned, ownedIds])
  const catalog = useMemo(() => source.map(toCatalogGift), [source])
  const filters = useGiftCatalogFilters()

  const floorOnlyLabel = t('pipFloorOnly')
  // A gift sits in the first group that has it, so floor-only gifts in the plan stay with the plan (still red-marked).
  const pinned = useMemo(() => [
    { ids: floorPlanIds, label: t('groupFloorPlan') },
    { ids: targetIds, label: t('groupTargets') },
    { ids: floorOnlyIds, label: floorOnlyLabel, warning: true },
  ], [floorPlanIds, floorOnlyIds, targetIds, floorOnlyLabel, t])
  // 칸마다 같은 객체를 돌려줘야 누를 때 격자 전체가 다시 그려지지 않는다
  const cardPropsById = useMemo(() => new Map(source.map(gift => {
    const id = String(gift.game_id)
    const owned = ownedIds.has(id)
    const props: GiftCatalogCardProps = {
      ...(owned ? {} : { conditionStatus: getGiftActivationConditionStatus({ gift, ...conditionCounts }), conditionDetail: false }),
      ...(floorOnlyIds.has(id) ? { warning: floorOnlyLabel } : {}),
      ...(onlyPlanned && targetIds.has(id) ? { onRemove: () => dispatch({ type: 'REMOVE_TARGET_GIFT', giftId: id }) } : {}),
    }
    return [id, props]
  })), [source, ownedIds, conditionCounts, floorOnlyIds, floorOnlyLabel, onlyPlanned, targetIds, dispatch])
  const toggleOwned = (gift: EgoGift) => dispatch({ type: ownedIds.has(gift.id) ? 'REMOVE_GIFT' : 'ACQUIRE_GIFT', giftId: gift.id })

  const count = (list: GiftData[], test: (id: string) => boolean) => list.filter(gift => test(String(gift.game_id))).length
  const check = (checked: boolean, onChange: (value: boolean) => void, label: string, total: number) => (
    <label className="inline-flex min-h-9 cursor-pointer select-none items-center gap-2 whitespace-nowrap text-[0.8125rem] text-[var(--text-primary)]">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="grid h-[1.125rem] w-[1.125rem] place-items-center rounded-[0.25rem] border border-[#5a4526] bg-[var(--bg-deep)] text-transparent transition-colors peer-checked:border-[var(--gold)] peer-checked:bg-[var(--gold)] peer-checked:text-[var(--bg-deep)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--gold-light)]">
        <Check size={13} strokeWidth={3} />
      </span>
      {label}<span className="tabular-nums text-xs text-[var(--text-tertiary)]">{total}</span>
    </label>
  )
  // "This floor only" is the filter changed most (a gift from a fusion or an event is not in the pack's list): it stays
  // on the search row. The other two wait behind the filter button with the grades.
  const floorCheck = currentTheme && <div role="group" aria-label={t('giftFilters')}>{check(onlyFloor, setOnlyFloor, t('filterFloor'), themeGifts.length)}</div>
  const moreChecks = <>
    {check(onlyPlanned, setOnlyPlanned, t('filterPlanned'), count(base, id => plannedIds.has(id)))}
    {check(hideOwned, setHideOwned, t('filterHideOwned'), count(base, id => ownedIds.has(id)))}
  </>

  return (
    <section className="min-w-0" aria-labelledby="run-floor-gifts" style={{ '--gift-catalog-bg': 'var(--bg-deep)' } as React.CSSProperties}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 id="run-floor-gifts" className={runSectionTitle}>{t('floorGiftRecord', { floor: state.currentFloor })}</h2>
        {currentTheme && <span className="text-[0.8125rem] text-[var(--text-secondary)]">{localized(currentTheme)}</span>}
      </div>
      {!currentTheme && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-dashed border-[var(--border)] px-4 py-3">
          <p className="min-w-0 flex-1 basis-48 text-sm text-[var(--text-secondary)]">{t('chooseThemeHint')}</p>
          <button type="button" onClick={onChooseTheme} className="min-h-10 rounded-md border border-[var(--border-gold)] px-4 text-sm font-semibold text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">{t('chooseThemeAction')}</button>
        </div>
      )}
      <GiftCatalog compact gifts={catalog} getGiftKeywordIcon={giftKeywordIcon} filters={filters} pinned={pinned}
        markedIds={ownedIds} markedLabel={t('acquired')} onGiftClick={toggleOwned}
        cardProps={gift => cardPropsById.get(gift.id)}
        collapsed toolbarEnd={floorCheck} moreFilters={moreChecks} moreFiltersActive={(onlyPlanned ? 1 : 0) + (hideOwned ? 1 : 0)} />
      {catalog.length === 0 && <p className="py-8 text-center text-sm text-[var(--text-tertiary)]">{t('targetFilterEmpty')}</p>}
    </section>
  )
}
