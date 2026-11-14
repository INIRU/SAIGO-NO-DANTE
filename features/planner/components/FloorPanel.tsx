'use client'

import { memo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import type { RunState, RunAction } from '@/features/planner/lib/run-types'
import type { ThemeData, GiftData, RecipeData, IdentityData, SinnerData, SkillSummary, EgoData, PassiveData } from '@/lib/planner/types'
import type { MdEvent, MdEventChoice } from '@/features/mirror-dungeon'
import { saveRunToHistory } from '@/features/planner/lib/encoder'
import DeckSection from './DeckSection'
import ThemeSection from './ThemeSection'
import EventSection from './EventSection'
import GiftCheckSection from './GiftCheckSection'
import FloorLog from './FloorLog'
import RunStatus from './RunStatus'
import { localizeRowName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'

/** What the run page shows under its bar: the run overview, or one of the views reached from it. */
export type RunView = 'overview' | 'deck' | 'event' | 'theme'

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
  view: RunView
  onView: (view: RunView) => void
}

/** Memoized: capture status ticks (scene, queue, candidates) re-render the run page several times a second. */
export default memo(FloorPanel)

/**
 * The body of a run in progress. The PiP is what the player watches during the game; this is where the whole run is seen
 * and corrected: the floor log, where the run stands (final gifts, held gifts, fusions), and this floor's gift record.
 * Deck, events and the pack picker replace the three columns while they are open.
 */
function FloorPanel({ state, dispatch, themes, gifts, giftMap, recipes, identities, sinners, skills, passives, egos, events, eventChoices, observedEventIds, view, onView }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const localized = (item: { name: string; name_en?: string | null; name_jp?: string | null }) => localizeRowName(item, locale)
  const floor = state.currentFloor
  const log = state.floorLogs[floor - 1]
  const isLastFloor = floor >= state.maxFloors

  function backToOverview() {
    onView('overview')
    requestAnimationFrame(() => document.getElementById('run-floors-title')?.focus())
  }

  function selectTheme(nextTheme: ThemeData) {
    dispatch({ type: 'SET_FLOOR_THEME', themeId: String(nextTheme.id) })
    toast.success(t('themeSelected', { name: localized(nextTheme) }))
    backToOverview()
  }

  /** Only the current floor's pack is cleared; the floor, inventory, logs and source plan stay. */
  function clearTheme() {
    if (!log?.themeId) return
    dispatch({ type: 'SET_FLOOR_THEME', themeId: null })
    toast.success(t('themeCleared', { floor }))
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

  if (view !== 'overview') return (
    <div data-run-view={view} className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain pb-4">
      {view === 'deck' && <DeckSection state={state} dispatch={dispatch} identities={identities} sinners={sinners} skills={skills} passives={passives} egos={egos} giftMap={giftMap} />}
      {view === 'theme' && <ThemeSection state={state} themes={themes} onSelect={selectTheme} onClear={clearTheme} onClose={backToOverview} />}
      {view === 'event' && <EventSection state={state} dispatch={dispatch} events={events} choices={eventChoices} giftMap={giftMap} themes={themes} observedEventIds={observedEventIds} />}
    </div>
  )

  // Wide screens: three columns (floors, status, record), each scrolling on its own. Phones: one scroll in reading order,
  // which is also the document order: the floor, then the record (the main thing there), then the status.
  return (
    <div data-run-view="overview" className="flex h-full min-h-0 min-w-0 flex-col gap-8 overflow-y-auto overscroll-contain pb-4 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)_26rem] lg:grid-rows-[minmax(0,1fr)] lg:gap-0 lg:overflow-hidden lg:pb-0 xl:grid-cols-[19rem_minmax(0,1fr)_32rem]">
      <FloorLog state={state} dispatch={dispatch} themes={themes} giftMap={giftMap} events={events} onChooseTheme={() => onView('theme')} onAdvance={advance} />
      <div data-run-record className="min-w-0 lg:order-3 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-[var(--border)] lg:pl-6">
        <GiftCheckSection state={state} dispatch={dispatch} gifts={gifts} giftMap={giftMap} themes={themes} onChooseTheme={() => onView('theme')} />
      </div>
      <RunStatus state={state} dispatch={dispatch} gifts={gifts} giftMap={giftMap} recipes={recipes} />
    </div>
  )
}
