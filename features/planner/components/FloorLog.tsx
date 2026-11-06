'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowDown, Pencil } from 'lucide-react'
import type { RunState, RunAction } from '@/features/planner/lib/run-types'
import type { ThemeData, GiftData } from '@/lib/planner/types'
import type { MdEvent } from '@/features/mirror-dungeon'
import { floorRows, type FloorRow } from '@/features/planner/lib/run-floor-rows'
import { getThemePackCompositeImageUrl, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import { blurPlaceholder } from '@/lib/utils/thumbhash'
import GiftArtwork from '@/components/ui/GiftArtwork'
import QuietImage from '@/components/ui/QuietImage'
import FloorProgress from './FloorProgress'
import { runSectionTitle } from './GiftCheckSection'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  themes: ThemeData[]
  giftMap: Map<number, GiftData>
  events: MdEvent[]
  /** Opens the pack picker for the floor being played. */
  onChooseTheme: () => void
  /** Next floor, or the end of the record on the last floor. */
  onAdvance: () => void
}

/** Gift icons a row shows before it counts the rest. */
const ROW_GIFTS = 12

/**
 * The run's floors, top to bottom: each visited floor with its pack and the gifts taken there. The floor being played
 * carries the pack change, the plan, the memo and the full record; the other rows move the run to their floor.
 * Phones show the floor numbers as one line (FloorProgress) and only the floor being played below it.
 */
export default function FloorLog({ state, dispatch, themes, giftMap, events, onChooseTheme, onAdvance }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const localized = (item: { name: string; name_en?: string | null; name_jp?: string | null }) => getLocalizedName({ name_kr: item.name, name_en: item.name_en, name_jp: item.name_jp }, locale)
  const rows = useMemo(() => floorRows(state), [state])
  const themeById = useMemo(() => new Map(themes.map(theme => [String(theme.id), theme])), [themes])
  const floor = state.currentFloor
  const log = state.floorLogs[floor - 1]
  const plan = state.sourcePlanSnapshot?.floorPlan?.find(item => item.floor === floor)
  const plannedTheme = plan ? themeById.get(String(plan.theme_id)) : undefined
  const isLastFloor = floor >= state.maxFloors
  const giftName = (id: string) => { const gift = giftMap.get(Number(id.replace(/_(plus|plusplus)$/, ''))); return gift ? localized(gift) : id }

  const pack = (row: FloorRow) => {
    const theme = row.themeId ? themeById.get(String(row.themeId)) : undefined
    if (!theme) return null
    const image = getThemePackVisualConfig(Number(theme.id)) ? getThemePackCompositeImageUrl(Number(theme.id)) : theme.image_url
    return <span className="flex min-w-0 items-center gap-2">
      {image && <span className="relative h-9 w-6 shrink-0 overflow-hidden rounded-sm"><QuietImage src={image} alt="" fill sizes="24px" className="object-contain" {...blurPlaceholder(image)} /></span>}
      <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{localized(theme)}</span>
    </span>
  }
  const taken = (row: FloorRow) => row.giftIds.length > 0 && <span className="mt-2 flex flex-wrap items-center gap-1">
    {row.giftIds.slice(0, ROW_GIFTS).map(id => {
      const gift = giftMap.get(Number(id))
      return gift && <span key={id} className="w-8" title={localized(gift)}><GiftArtwork gift={gift} displayName={localized(gift)} sizes="32px" /></span>
    })}
    {row.giftIds.length > ROW_GIFTS && <span className="pl-1 font-[family-name:var(--font-title)] text-sm text-[var(--text-tertiary)]">+{row.giftIds.length - ROW_GIFTS}</span>}
  </span>
  // The number is drawn large; screen readers get "N층" and then the row's own content.
  const numeral = (row: FloorRow) => <span className={`font-[family-name:var(--font-title)] text-[1.75rem] leading-none ${row.state === 'current' ? 'text-[var(--gold-light)]' : row.state === 'done' ? 'text-[var(--gold-dim)]' : 'text-[var(--text-muted)]'}`}><span aria-hidden="true">{row.floor}</span><span className="sr-only">{t('floorNumber', { floor: row.floor })}</span></span>
  // Moving to a floor replaces its button with the open row: focus follows to that row.
  const goTo = (target: number) => {
    dispatch({ type: 'GO_TO_FLOOR', floor: target })
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-run-floors] [data-floor-state="current"]')?.focus())
  }
  const rowGrid = 'grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3'

  return (
    <section data-run-floors aria-labelledby="run-floors-title" className="flex min-w-0 flex-col lg:order-1 lg:min-h-0 lg:pr-6">
      <div className="mb-3 flex shrink-0 items-baseline gap-2">
        <h2 id="run-floors-title" tabIndex={-1} className={`${runSectionTitle} focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]`}>{t('floorLog')}</h2>
        <span className="text-[0.8125rem] text-[var(--text-secondary)]">{t('floorLogCount', { current: floor, max: state.maxFloors })}</span>
      </div>
      <div className="mb-3 shrink-0 lg:hidden"><FloorProgress state={state} dispatch={dispatch} /></div>
      <ol className="space-y-1 lg:-mr-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
        {rows.map(row => row.state === 'current' ? (
          <li key={row.floor} data-floor-row={row.floor} data-floor-state="current" aria-current="step" tabIndex={-1}
            className={`${rowGrid} rounded-lg border border-[var(--gold-dim)] bg-[var(--bg-panel)] p-3 focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]`}>
            {numeral(row)}
            <div className="min-w-0">
              <div className="flex min-h-9 items-center gap-2">
                <span className="min-w-0 flex-1">{pack(row) ?? <span className="text-sm text-[var(--text-muted)]">{t('unselected')}</span>}</span>
                <button type="button" onClick={onChooseTheme} className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
                  <Pencil size={12} aria-hidden="true" /> {t(row.themeId ? 'editTheme' : 'chooseThemeAction')}
                </button>
              </div>
              {taken(row)}
              <details className="mt-2 text-xs text-[var(--text-secondary)]">
                <summary className="flex min-h-8 cursor-pointer select-none items-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">{t('floorDetails', { count: row.records })}</summary>
                <div className="space-y-3 pb-1 pt-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-[var(--gold-light)]">{t('planned')}</h3>
                    <p className="mt-1 leading-5">{plan && plannedTheme ? localized(plannedTheme) : t('noPlan')}</p>
                    {plan?.memo && <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words leading-5">{plan.memo}</p>}
                    {Array.isArray(plan?.gift_ids) && plan.gift_ids.length > 0 && <p className="mt-1 break-words leading-5">{t('plannedGifts')}: {plan.gift_ids.map(giftName).join(', ')}</p>}
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="run-floor-memo" className="font-bold text-[var(--gold-light)]">{t('floorMemo')}</label>
                    <textarea id="run-floor-memo" value={log?.memo ?? ''} onChange={event => dispatch({ type: 'SET_FLOOR_MEMO', memo: event.target.value })} placeholder={t('floorMemoPlaceholder')} rows={2}
                      className="mt-1 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--bg-deep)] p-2 text-sm text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]" />
                  </div>
                  {(log?.removedGifts.length || log?.selectedEventOptions.length || log?.deckChanges.length) ? (
                    <ul className="divide-y divide-[var(--border)]">
                      {log.removedGifts.map((id, index) => <li key={`remove-${index}`} className="flex gap-3 py-1.5"><span className="min-w-12 text-[var(--text-tertiary)]">{t('removed')}</span><span className="min-w-0 break-words">{giftName(id)}</span></li>)}
                      {log.selectedEventOptions.map((entry, index) => <li key={`event-${index}`} className="flex gap-3 py-1.5"><span className="min-w-12 text-[var(--gold-light)]">{t('event')}</span><span className="min-w-0 break-words">{events.find(item => item.id === entry.eventId)?.name ?? entry.eventId}, {t('choiceNumber', { number: entry.optionIndex + 1 })}</span></li>)}
                      {log.deckChanges.map((change, index) => <li key={`deck-${index}`} className="flex gap-3 py-1.5"><span className="min-w-12 text-[var(--gold-light)]">{t('deck')}</span><span className="min-w-0 break-words">{change.detail}</span></li>)}
                    </ul>
                  ) : null}
                </div>
              </details>
            </div>
          </li>
        ) : (
          <li key={row.floor} className="max-lg:hidden">
            <button type="button" data-floor-row={row.floor} data-floor-state={row.state} onClick={() => goTo(row.floor)}
              className={`${rowGrid} w-full rounded-lg border border-transparent p-3 text-left transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-panel)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]`}>
              {numeral(row)}
              {row.state === 'ahead'
                ? <span className="self-center text-[0.8125rem] text-[var(--text-muted)]">{t('floorAhead')}</span>
                : <span className="min-w-0">
                  {pack(row) ?? <span className="text-sm text-[var(--text-muted)]">{t('unselected')}</span>}
                  {taken(row)}
                  <span className="mt-1.5 block text-xs text-[var(--text-tertiary)]">{t('observedCount', { count: row.records })}</span>
                </span>}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onAdvance} className="mt-3 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--gold)] px-4 text-sm font-bold text-[var(--bg-deep)] hover:bg-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">
        {!isLastFloor && <ArrowDown aria-hidden="true" size={16} />}{t(isLastFloor ? 'completeRun' : 'nextFloor')}
      </button>
    </section>
  )
}
