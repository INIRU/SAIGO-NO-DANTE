'use client'

import { memo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowDown, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import type { RunState, RunAction, FloorSubTab } from '@/lib/planner/run-types'
import type { ThemeData, GiftData, RecipeData, IdentityData, SinnerData, SkillSummary, EgoData, PassiveData } from '@/lib/planner/types'
import type { MdEvent, MdEventChoice } from '@/components/mirror-dungeon/types'
import { saveRunToHistory } from '@/lib/planner/encoder'
import DeckSection from './DeckSection'
import ThemeSection from './ThemeSection'
import EventSection from './EventSection'
import GiftCheckSection from './GiftCheckSection'
import InventoryPanel from './InventoryPanel'
import ImageWithFallback from '@/components/ui/ImageWithFallback'
import { getThemePackCompositeImageUrl, getThemePackVisualConfig } from '@/lib/data/theme-pack-visuals'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  themes: ThemeData[]
  gifts: GiftData[]
  giftMap: Map<number, GiftData>
  recipes: RecipeData[]
  identities: IdentityData[]
  sinners: SinnerData[]
  skills: SkillSummary[]
  passives: PassiveData[]
  egos: EgoData[]
  events: MdEvent[]
  eventChoices: MdEventChoice[]
  observedEventIds?: number[]
}

type Tab = 'progress' | FloorSubTab
const tabs: Tab[] = ['progress', 'gift', 'deck', 'theme', 'event']

/** Memoized: capture status ticks (scene, queue, candidates) re-render the run page several times a second. */
export default memo(FloorPanel)

function FloorPanel({ state, dispatch, themes, gifts, giftMap, recipes, identities, sinners, skills, passives, egos, events, eventChoices, observedEventIds }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const localized = (item: { name: string; name_en?: string | null; name_jp?: string | null }) => getLocalizedName({ name_kr: item.name, name_en: item.name_en, name_jp: item.name_jp }, locale)
  const [tab, setTab] = useState<Tab>('gift')
  const floor = state.currentFloor
  const log = state.floorLogs[floor - 1]
  const plan = state.sourcePlanSnapshot?.floorPlan?.find(item => item.floor === floor)
  const theme = themes.find(item => String(item.id) === String(log?.themeId))
  const themeImage = theme && (getThemePackVisualConfig(Number(theme.id)) ? getThemePackCompositeImageUrl(Number(theme.id)) : theme.image_url)
  const plannedTheme = themes.find(item => String(item.id) === String(plan?.theme_id))
  const isLastFloor = floor >= state.maxFloors
  const observedCount = (log?.acquiredGifts.length ?? 0) + (log?.removedGifts.length ?? 0) + (log?.deckChanges.length ?? 0) + (log?.selectedEventOptions.length ?? 0)

  function chooseTab(next: Tab) {
    setTab(next)
    if (next !== 'progress') dispatch({ type: 'SET_SUB_TAB', tab: next })
  }

  function returnToGiftLog() {
    chooseTab('gift')
    requestAnimationFrame(() => document.getElementById('run-tab-gift')?.focus())
  }

  function selectTheme(nextTheme: ThemeData) {
    dispatch({ type: 'SET_FLOOR_THEME', themeId: String(nextTheme.id) })
    toast.success(t('themeSelected', { name: localized(nextTheme) }))
    returnToGiftLog()
  }

  /** Only the current floor's pack is cleared; the floor, inventory, logs and source plan stay. */
  function clearTheme() {
    if (!log?.themeId) return
    dispatch({ type: 'SET_FLOOR_THEME', themeId: null })
    toast.success(t('themeCleared', { floor }))
  }

  function onTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: Tab) {
    const index = tabs.indexOf(current)
    const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (nextIndex < 0) return
    event.preventDefault()
    chooseTab(tabs[nextIndex])
    document.getElementById(`run-tab-${tabs[nextIndex]}`)?.focus()
  }

  function advance() {
    if (isLastFloor) {
      if (!saveRunToHistory({ ...state, phase: 'completed', floorLogs: state.floorLogs.map(item => item.floor === floor ? { ...item, completedAt: item.completedAt ?? new Date().toISOString() } : item) })) {
        toast.error(t('historySaveFailed'))
        return
      }
    }
    dispatch({ type: isLastFloor ? 'COMPLETE_RUN' : 'NEXT_FLOOR' })
  }

  return <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
    {/* The floor being descended is the page's one loud element: a large numeral over the chosen theme pack. */}
    <section className="shrink-0 overflow-hidden border-t-2 border-[var(--gold)] bg-[var(--bg-panel)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-5">
        <p className="flex shrink-0 items-end gap-2 font-[family-name:var(--font-title)] leading-none">
          <span className="text-[2.75rem] leading-[0.85] text-[var(--gold-light)] sm:text-[3.25rem]">{String(floor).padStart(2, '0')}</span>
          <span className="pb-0.5 text-lg leading-none text-[var(--text-muted)]">/ {String(state.maxFloors).padStart(2, '0')}</span>
        </p>
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-2.5">
          {themeImage && <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-sm"><ImageWithFallback src={themeImage} alt="" fill fallbackType="theme" sizes="32px" className="object-contain" /></span>}
          <div className="min-w-0"><p className="text-[0.6875rem] text-[var(--text-secondary)]">{t('currentFloor')}</p><h2 className={`truncate leading-tight ${theme ? 'font-[family-name:var(--font-heading)] text-base text-[var(--text-primary)] sm:text-lg' : 'text-sm text-[var(--text-muted)]'}`}>{theme ? localized(theme) : t('unselected')}</h2></div>
        </div>
        <button type="button" onClick={() => chooseTab('theme')} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--border-gold)] px-2.5 text-xs text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]"><Pencil size={13} /> {t('editTheme')}</button>
      </div>
      <details className="border-t border-[var(--border)] px-4 py-1.5 text-xs text-[var(--text-secondary)] sm:px-5">
        <summary className="flex min-h-8 cursor-pointer select-none flex-wrap items-center gap-x-4 gap-y-1 focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]"><span><span className="font-semibold text-[var(--gold-light)]">{t('planned')}</span> {plan && plannedTheme ? localized(plannedTheme) : t('noPlan')}</span><span className="text-[var(--text-muted)]">{t('observedCount', { count: observedCount })}</span></summary>
        <div className="grid gap-3 pb-2 pt-3 md:grid-cols-2">
          <div className="min-w-0"><h3 className="font-bold">{t('planned')}</h3>{plan?.memo && <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words leading-5">{plan.memo}</p>}{Array.isArray(plan?.gift_ids) && plan.gift_ids.length > 0 && <p className="mt-1 break-words leading-5">{t('plannedGifts')}: {plan.gift_ids.map(id => { const gift = giftMap.get(Number(id.replace(/_(plus|plusplus)$/, ''))); return gift ? localized(gift) : id }).join(' · ')}</p>}</div>
          <div className="min-w-0"><label htmlFor="run-floor-memo" className="font-bold">{t('floorMemo')}</label><textarea id="run-floor-memo" value={log?.memo ?? ''} onChange={event => dispatch({ type: 'SET_FLOOR_MEMO', memo: event.target.value })} placeholder={t('floorMemoPlaceholder')} rows={2} className="mt-1 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--bg-panel)] p-2 text-sm text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]" /></div>
        </div>
      </details>
    </section>

    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      <div role="tablist" aria-label={t('sections')} className="flex shrink-0 overflow-x-auto border-b border-[var(--border)]">
        {tabs.map(item => <button key={item} type="button" role="tab" id={`run-tab-${item}`} aria-selected={tab === item} aria-controls={`run-panel-${item}`} tabIndex={tab === item ? 0 : -1} onKeyDown={event => onTabKeyDown(event, item)} onClick={() => chooseTab(item)} className={`min-h-10 shrink-0 border-b-2 px-3.5 text-[0.8125rem] font-semibold ${tab === item ? 'border-[var(--gold)] text-[var(--gold-light)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>{t(`tab_${item}`)}</button>)}
      </div>
      {/* 기프트 탭은 위 여백을 목록 안에 둔다: 스크롤 상자에 위 여백이 있으면 붙는 필터 줄 위로 카드가 비친다. */}
      <div role="tabpanel" id={`run-panel-${tab}`} aria-labelledby={`run-tab-${tab}`} tabIndex={0} className={`min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--gold-light)] sm:px-4 sm:pb-4 ${tab === 'gift' ? '' : 'pt-3 sm:pt-4'}`}>
        {tab === 'progress' && <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-[family-name:var(--font-heading)] text-base text-[var(--gold-light)]">{t('progressLog')}</h3><p className="mt-1 text-xs text-[var(--text-secondary)]">{t('progressHelp')}</p></div><button onClick={() => chooseTab('gift')} className="min-h-10 rounded-md bg-[var(--gold)] px-4 text-sm font-bold text-[var(--bg-deep)]">{t('recordGift')}</button></div>
          {observedCount === 0 ? <p className="rounded-md border border-dashed border-[var(--border)] p-5 text-sm text-[var(--text-tertiary)]">{t('emptyProgress')}</p> :
            <ul className="divide-y divide-[var(--border)] text-sm">
              {log?.acquiredGifts.map((id, index) => <li key={`acquire-${index}`} className="flex gap-3 py-3"><span className="min-w-16 text-[var(--gold-light)]">{t('acquired')}</span><span className="min-w-0 break-words">{giftMap.has(Number(id)) ? localized(giftMap.get(Number(id))!) : id}</span></li>)}
              {log?.removedGifts.map((id, index) => <li key={`remove-${index}`} className="flex gap-3 py-3"><span className="min-w-16 text-[var(--text-tertiary)]">{t('removed')}</span><span className="min-w-0 break-words">{giftMap.has(Number(id)) ? localized(giftMap.get(Number(id))!) : id}</span></li>)}
              {log?.selectedEventOptions.map((entry, index) => <li key={`event-${index}`} className="flex gap-3 py-3"><span className="min-w-16 text-[var(--gold-light)]">{t('event')}</span><span className="min-w-0 break-words">{events.find(item => item.id === entry.eventId)?.name ?? entry.eventId} · {t('choiceNumber', { number: entry.optionIndex + 1 })}</span></li>)}
              {log?.deckChanges.map((change, index) => <li key={`deck-${index}`} className="flex gap-3 py-3"><span className="min-w-16 text-[var(--gold-light)]">{t('deck')}</span><span className="min-w-0 break-words">{change.detail}</span></li>)}
            </ul>}
        </div>}
        {tab === 'gift' && <GiftCheckSection state={state} dispatch={dispatch} gifts={gifts} giftMap={giftMap} themes={themes} onChooseTheme={() => chooseTab('theme')}
          aside={<InventoryPanel state={state} dispatch={dispatch} giftMap={giftMap} recipes={recipes} />} />}
        {tab === 'deck' && <DeckSection state={state} dispatch={dispatch} identities={identities} sinners={sinners} skills={skills} passives={passives} egos={egos} giftMap={giftMap} />}
        {tab === 'theme' && <ThemeSection state={state} themes={themes} onSelect={selectTheme} onClear={clearTheme} onClose={returnToGiftLog} />}
        {tab === 'event' && <EventSection state={state} dispatch={dispatch} events={events} choices={eventChoices} giftMap={giftMap} themes={themes} observedEventIds={observedEventIds} />}
      </div>
      <div className="flex shrink-0 justify-end border-t border-[var(--border)] p-2"><button type="button" onClick={advance} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--gold)] px-4 text-sm font-bold text-[var(--bg-deep)] hover:bg-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">{!isLastFloor && <ArrowDown aria-hidden="true" size={16} />}{t(isLastFloor ? 'completeRun' : 'nextFloor')}</button></div>
    </section>
  </div>
}
