'use client'

import TempSaveMenu from '@/components/ui/TempSaveMenu'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import { deleteTempSlot, loadTempSlots, saveTempSlot, type TempSlot } from '@/lib/drafts/temp-slots'
import { normalizeRunState, type RunState } from '@/lib/planner/run-types'

import BackLink from '@/components/navigation/BackLink'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, RotateCcw, MonitorUp, MoreHorizontal } from 'lucide-react'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { buildGiftMap, recipeFusionMaterials, settleResultPopup, type RecipePopupEvidence } from '@/lib/planner/fusion'
import { AUTO_ACQUIRE_EXCLUDED_GIFT_IDS } from '@/lib/vision/popup-evidence'
import { decodedPlanToPlannerState, decodePlan, loadPlanForRun, runStateToPlannerState, saveDraftToLocal } from '@/lib/planner/encoder'
import { enrichIdentitySlotsForGiftConditions } from '@/lib/planner/gift-condition-status'
import { useRunStore } from '@/lib/stores/run'
import type { ThemeData, GiftData, RecipeData, IdentityData, SinnerData, SkillSummary, EgoData, PassiveData } from '@/lib/planner/types'
import type { MdEvent, MdEventChoice } from '@/components/mirror-dungeon/types'
import RunSetup from '@/components/planner/run/RunSetup'
import FloorPanel, { type RunView } from '@/components/planner/run/FloorPanel'
import CompanionPanel from '@/components/planner/run/CompanionPanel'
import RecognitionModeControl from '@/components/planner/run/RecognitionModeControl'
import DetectionToggles, { ToggleSwitch } from '@/components/planner/run/DetectionToggles'
import { DETECTION_STORAGE_KEY, DEFAULT_DETECTION, readDetectionSettings, type DetectionSettings } from '@/lib/vision/detection-settings'
import { readSampleConsent, SAMPLES_STORAGE_KEY } from '@/lib/vision/assist-samples'
import { downloadLog, installConsole, plog } from '@/lib/vision/assist-log'
import { useAssistLog } from '@/lib/hooks/useAssistLog'
import { GAME_LANGUAGE_STORAGE_KEY, GAME_LANGUAGES, readGameLanguage, readRecognitionMode, RECOGNITION_MODE_STORAGE_KEY, type GameLanguage,
  type RecognitionMode } from '@/lib/vision/recognition-profile'
import ConfirmModal from '@/components/ui/ConfirmModal'
import GpuRequiredModal from '@/components/planner/run/GpuRequiredModal'
import { captureEvidence, useAssistCapture } from '@/lib/hooks/useAssistCapture'
import { recognizableEvents } from '@/lib/utils/event-catalog'
import { gameTextForScreen, refNameLabels } from '@/lib/game-text/rich-text'
import { useGameTextRefs } from '@/lib/hooks/useGameTextRefs'

/** Assist temporary saves: five slots of whole runs in this browser. */
const RUN_DRAFTS_KEY = 'md-run-temp-slots'
const isRunState = (value: unknown): value is RunState => !!value && typeof value === 'object' && Array.isArray((value as RunState).floorLogs)
/** The views the bar switches between; the pack picker is reached from the floor log instead. */
const RUN_VIEWS = ['overview', 'deck', 'event'] as const
const RUN_VIEW_LABEL = { overview: 'viewOverview', deck: 'tab_deck', event: 'tab_event' } as const
const DIFFICULTY_NAMES: Record<string, string> = { normal: 'N', hard: 'H', overlap: 'P', extreme: 'EX' }
const runSlotLabel = (state: RunState) => `${state.sourcePlanSnapshot?.title?.trim() || DIFFICULTY_NAMES[state.difficulty] || state.difficulty} · ${state.currentFloor}F · ${state.giftInventory.length}`

interface Props {
  themes: ThemeData[]
  gifts: GiftData[]
  recipes: RecipeData[]
  identities: IdentityData[]
  sinners: SinnerData[]
  skills: SkillSummary[]
  passives: PassiveData[]
  egos: EgoData[]
  events: MdEvent[]
  eventChoices: MdEventChoice[]
  dataError?: boolean
}

export default function RunClient({ themes, gifts, recipes, identities, sinners, skills, passives, egos, events, eventChoices, dataError }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale()
  const router = useRouter()
  const state = useRunStore()
  const dispatch = useRunStore(s => s.dispatch)
  const [loadingPlan, setLoadingPlan] = useState(true)
  const tTempSaves = useTranslations('planner.tempSaves')
  const [runSlots, setRunSlots] = useState<TempSlot<RunState>[]>([])
  useEffect(() => { setRunSlots(loadTempSlots(RUN_DRAFTS_KEY, isRunState)) }, [])
  const [confirmReset, setConfirmReset] = useState(false)
  const [view, setView] = useState<RunView>('overview')
  // A run that ended or was reset starts again from the overview (the bar that switches views is hidden outside a run).
  useEffect(() => { if (state.phase !== 'playing') setView('overview') }, [state.phase])
  const giftReferences = useMemo(() => gifts.map(gift => ({ id: String(gift.game_id), imageUrl: gift.image_url })), [gifts])
  // Recognition skips exact copies of another event (their text would name several events at once); lookups keep them.
  const recognizable = useMemo(() => recognizableEvents(events, eventChoices), [events, eventChoices])
  const eventReferences = useMemo(() => recognizable.events.map(event => ({ id: String(event.id), imageUrl: event.image_url })), [recognizable])
  // The game client's language (the site's until chosen): it picks the OCR model, and its gift names go first.
  const siteLanguage: GameLanguage = locale === 'en' || locale === 'ja' ? locale : 'ko'
  const [gameLanguage, setGameLanguage] = useState<GameLanguage>(siteLanguage)
  useEffect(() => { setGameLanguage(readGameLanguage(window.localStorage, siteLanguage)) }, [siteLanguage])
  const changeGameLanguage = (next: GameLanguage) => {
    setGameLanguage(next)
    try { window.localStorage.setItem(GAME_LANGUAGE_STORAGE_KEY, next) } catch { /* applies to this session */ }
  }
  // The page carries the site language's long texts only; another game language's are loaded once they are needed.
  type ExtraTexts = { gifts: { id: string; texts: string[] }[]; events: { id: string; texts: string[] }[];
    choices: { id: string; texts: string[]; resultTexts: string[] }[] }
  const [extraTexts, setExtraTexts] = useState<{ language: GameLanguage; data: ExtraTexts } | null>(null)
  useEffect(() => {
    if (gameLanguage === siteLanguage || extraTexts?.language === gameLanguage) return
    let live = true
    fetch(`/api/assist/texts/${gameLanguage}`).then(response => response.ok ? response.json() : null)
      .then((data: ExtraTexts | null) => { if (live && data) setExtraTexts({ language: gameLanguage, data }) })
      .catch(() => { if (live) toast.error(t('gameLanguageLoadFailed')) })
    return () => { live = false }
  }, [gameLanguage, siteLanguage, extraTexts?.language, t])
  // Gift effects are game text with [Id]s; the screen shows their names, so OCR is compared with the text carrying those.
  const { names: refNames } = useGameTextRefs()
  const refLabels = useMemo(() => (refNames ? refNameLabels(refNames) : undefined), [refNames])
  const ocrCatalog = useMemo(() => {
    const extra = extraTexts && extraTexts.language === gameLanguage && gameLanguage !== siteLanguage ? extraTexts.data : null
    const more = <T extends { id: string },>(rows: T[] | undefined) => new Map((rows ?? []).map(row => [row.id, row]))
    const giftMore = more(extra?.gifts), eventMore = more(extra?.events), choiceMore = more(extra?.choices)
    return {
    gifts: gifts.map(gift => ({
      id: String(gift.game_id),
      texts: (gameLanguage === 'en' ? [gift.name_en, gift.name, gift.name_jp] : gameLanguage === 'ja' ? [gift.name_jp, gift.name, gift.name_en]
        : [gift.name, gift.name_en, gift.name_jp]).filter((value): value is string => Boolean(value)),
      effectTexts: [...giftMore.get(String(gift.game_id))?.texts ?? [], gift.effect_base, gift.effect_base_en, gift.effect_base_jp,
        gift.effect_plus, gift.effect_plus_en, gift.effect_plus_jp,
        gift.effect_plusplus, gift.effect_plusplus_en, gift.effect_plusplus_jp]
        .filter((value): value is string => Boolean(value)).map(text => gameTextForScreen(text, refLabels)),
    })),
    events: recognizable.events.map(event => ({ id: String(event.id), texts: [event.name, event.desc_text, event.name_en, event.desc_text_en, event.name_jp, event.desc_text_jp,
      ...eventMore.get(String(event.id))?.texts ?? []].filter((value): value is string => Boolean(value)) })),
    choices: recognizable.choices.map(choice => ({ id: String(choice.id), eventId: String(choice.event_id),
      texts: [choice.message, choice.message_en, choice.message_jp, ...choiceMore.get(String(choice.id))?.texts ?? []].filter((value): value is string => Boolean(value)),
      resultTexts: [choice.result_text, choice.result_text_en, choice.result_text_jp, ...choiceMore.get(String(choice.id))?.resultTexts ?? []]
        .filter((value): value is string => Boolean(value)) })),
    }
  }, [gifts, recognizable, gameLanguage, siteLanguage, extraTexts, refLabels])
  const themeCatalog = useMemo(() => themes.map(theme => ({ id: String(theme.id),
    texts: [theme.name, theme.name_en, theme.name_jp].filter((value): value is string => Boolean(value)) })), [themes])
  // Balanced unless the user chose another mode in this browser; read after mount (the server cannot see storage).
  const [recognitionMode, setRecognitionMode] = useState<RecognitionMode>('balanced')
  useEffect(() => { setRecognitionMode(readRecognitionMode(window.localStorage)) }, [])
  const changeRecognitionMode = (next: RecognitionMode) => {
    setRecognitionMode(next)
    try { window.localStorage.setItem(RECOGNITION_MODE_STORAGE_KEY, next) } catch { /* the choice still applies to this session */ }
  }
  const [detection, setDetection] = useState<DetectionSettings>(DEFAULT_DETECTION)
  useEffect(() => { setDetection(readDetectionSettings(window.localStorage)) }, [])
  const changeDetection = (next: DetectionSettings) => {
    setDetection(next)
    try { window.localStorage.setItem(DETECTION_STORAGE_KEY, JSON.stringify(next)) } catch { /* applies to this session */ }
  }
  // Recognition samples: off until chosen; undefined until this browser's choice is read, null while never asked.
  const [samples, setSamples] = useState<boolean | null | undefined>(undefined)
  useEffect(() => { setSamples(readSampleConsent(window.localStorage)) }, [])
  const changeSamples = (next: boolean) => {
    setSamples(next)
    try { window.localStorage.setItem(SAMPLES_STORAGE_KEY, next ? 'on' : 'off') } catch { /* applies to this session */ }
  }
  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
  // The sale dialog's price is checked against the gift's own (game value): half to the whole price.
  const giftPrice = useCallback((id: string) => giftMap.get(Number(id))?.price, [giftMap])
  // Fixed-recipe fusions: their materials decide the result, and a popup the recognizer cannot settle may still be the
  // only recipe result the current inventory can make.
  const resolvePopup = useCallback((evidence: RecipePopupEvidence, verdict: string | null, inFusion: boolean) =>
    settleResultPopup(evidence, verdict, useRunStore.getState().giftInventory, recipes, giftMap, inFusion), [recipes, giftMap])
  // A fixed-recipe fusion whose dialog closed before its icons showed: the result names the rest of the materials.
  const completeFusion = useCallback((read: readonly string[], count: number, resultId: string) =>
    recipeFusionMaterials(read, count, resultId, useRunStore.getState().giftInventory, recipes, giftMap, AUTO_ACQUIRE_EXCLUDED_GIFT_IDS), [recipes, giftMap])
  const capture = useAssistCapture({ giftReferences, eventReferences, ocrCatalog, themeCatalog, mode: recognitionMode, detection, resolvePopup, completeFusion, samples: samples === true,
    heldGiftIds: state.giftInventory,
    giftPrice,
    language: gameLanguage, floor: state.phase === 'playing' ? state.currentFloor : null })
  const { visualCandidates, ocrCandidates, eventChoiceEvidence } =
    captureEvidence(capture, state.phase === 'playing' ? state.currentFloor : null, Date.now())
  const { reportInventoryChange } = capture
  // the Assist's log (recognition settings → 로그 내보내기, F12 → assist.help())
  useAssistLog(capture)
  const snapshot = useRef<() => unknown>(() => null)
  snapshot.current = () => ({ status: capture.status, reader: { status: capture.ocrStatus, engine: capture.ocrEngine }, gpu: capture.gpu,
    scene: capture.scene?.label ?? null, mode: recognitionMode, detection, language: gameLanguage, phase: state.phase,
    floor: state.phase === 'playing' ? state.currentFloor : null, gifts: state.giftInventory.length })
  useEffect(() => installConsole(() => snapshot.current()), [])
  // Inventory edits during a run feed the opt-in recognition report (a no-op unless capturing with consent).
  useEffect(() => useRunStore.subscribe((next, previous) => {
    if (next.phase === 'playing' && previous.phase === 'playing' && next.giftInventory !== previous.giftInventory)
      reportInventoryChange(previous.giftInventory, next.giftInventory)
  }), [reportInventoryChange])
  // The stable scene switches a capture or two after a battle starts; frames already classified as combat never
  // promote gifts, so the order stays frozen from the first battle frame.
  const combatFrame = ['battle', 'battle_setup', 'loading'].includes(capture.prediction?.label ?? '')
  const observedGiftIds = combatFrame ? [] : [...new Set([
    ...(visualCandidates?.gifts.map(item => Number(item.id)) ?? []),
    ...(ocrCandidates?.gifts.map(item => Number(item.id)) ?? []),
  ].filter(Number.isInteger))]
  const observedEventList = [...new Set([
    ...(visualCandidates?.events.map(item => Number(item.id)) ?? []),
    ...(ocrCandidates?.events.map(item => Number(item.id)) ?? []),
    ...(ocrCandidates?.choices.map(item => Number(item.eventId)) ?? []),
  ].filter(Number.isInteger))]
  // Same ids keep the same array, so the memoized floor panel skips capture ticks that changed nothing it shows.
  const observedEventKey = observedEventList.join(',')
  const observedEventIds = useMemo(() => observedEventList, [observedEventKey])
  useEffect(() => { if (observedEventKey) plog('events-seen', observedEventKey) }, [observedEventKey])
  const roomId = eventChoiceEvidence?.eventId ?? null
  useEffect(() => { if (roomId !== null) plog('room', eventChoiceEvidence) }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps -- once a room
  const giftConditionState = useMemo(() => ({
    ...state,
    identitySlots: enrichIdentitySlotsForGiftConditions(state.identitySlots, identities),
  }), [state, identities])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams(window.location.search)
    const consumeImportQuery = () => {
      const url = new URL(window.location.href)
      url.searchParams.delete('plan')
      url.searchParams.delete('from-plan')
      url.searchParams.delete('entry')
      window.history.replaceState(window.history.state, '', url)
    }
    // Opened from the board without a plan: a draft that was never started must not carry an earlier plan into
    // setup; a started run is left as is and resumes (it can still be reset from the run header).
    if (params.get('entry') === 'board') {
      const current = useRunStore.getState()
      if (current.phase === 'setup' && (current.sourcePlanSnapshot || current.sourcePlanEncoded)) dispatch({ type: 'RESET' })
      consumeImportQuery()
    }
    const handoff = params.get('from-plan') === '1' ? loadPlanForRun() : null
    if (handoff) { dispatch({ type: 'LOAD_FROM_PLAN', planState: handoff }); consumeImportQuery() }
    const encoded = !handoff && params.get('plan')
    if (encoded) {
      decodePlan(encoded)
        .then(decoded => {
          if (active) { dispatch({ type: 'LOAD_FROM_PLAN', planState: decodedPlanToPlannerState(decoded, identities, egos) }); consumeImportQuery() }
        })
        .catch(() => { if (active) toast.error(t('invalidPlan')) })
        .finally(() => { if (active) setLoadingPlan(false) })
    } else {
      setLoadingPlan(false)
    }
    return () => { active = false }
  }, [dispatch, identities, egos, t])

  useEffect(() => { if (state.phase !== 'playing') capture.stop() }, [state.phase, capture.stop])

  const reset = () => { capture.stop(); dispatch({ type: 'RESET' }); toast.success(t('resetDone')) }
  const reviewDraft = () => {
    if (!saveDraftToLocal(runStateToPlannerState(state))) { toast.error(t('draftSaveFailed')); return }
    toast.success(t('draftReady'))
    router.push('/planner')
  }
  const card = 'rounded-lg border border-[var(--border)] bg-[var(--bg-card)]'
  const captureActive = capture.status === 'running' || capture.status === 'loading' || capture.status === 'requesting'
  // A browser without WebGPU cannot connect; a GPU that failed mid-run may work on the next try.
  const gpuRefused = capture.gpu === 'unsupported' || capture.gpu === 'unavailable'
  // How to get WebGPU: opened by connecting without it, and when a running capture stops for lack of it.
  const [gpuHelp, setGpuHelp] = useState(false)
  useEffect(() => { if (capture.gpu === 'failed') setGpuHelp(true) }, [capture.gpu])
  const connect = () => {
    if (gpuRefused) { setGpuHelp(true); return }
    void capture.start().then(block => { if (block) setGpuHelp(true) })
  }
  // 더보기 팝오버(인식 설정, 초기화)는 바깥을 누르거나 Esc로 닫는다
  const recognitionRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const close = (event: Event) => {
      const el = recognitionRef.current
      if (!el?.open) return
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !el.contains(event.target as Node)) el.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [])

  const recognitionControls = <div className="space-y-3" data-recognition-mode-control>
    <fieldset className="min-w-0" data-game-language>
      <legend className="mb-1.5 text-xs font-bold text-[var(--gold-light)]">{t('gameLanguageLabel')}</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {GAME_LANGUAGES.map(language => <label key={language} className={`flex min-h-10 cursor-pointer items-center justify-center rounded-md border px-2 text-sm font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--gold-light)] ${gameLanguage === language ? 'border-[var(--gold)] bg-[var(--deck-filter-surface-active)] text-[var(--gold-light)]' : 'border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-primary)] hover:border-[var(--border-hover)]'}`}>
          <input type="radio" name="assist-game-language" value={language} checked={gameLanguage === language} onChange={() => changeGameLanguage(language)} className="sr-only" />
          {{ ko: '한국어', en: 'English', ja: '日本語' }[language]}
        </label>)}
      </div>
      <p className="mt-1.5 break-keep text-[0.6875rem] leading-4 text-[var(--text-secondary)]">{t(capture.status === 'running' ? 'gameLanguageLiveNote' : 'gameLanguageHint')}</p>
    </fieldset>
    <RecognitionModeControl value={recognitionMode} onChange={changeRecognitionMode} label={t('recognitionModeLabel')}
      note={capture.status === 'running' ? t('recognitionModeLiveNote') : undefined}
      options={{ fastest: { label: t('recognitionModeFastest'), description: t('recognitionModeFastestHint') },
        performance: { label: t('recognitionModePerformance'), description: t('recognitionModePerformanceHint') },
        balanced: { label: t('recognitionModeBalanced'), description: t('recognitionModeBalancedHint') },
        quality: { label: t('recognitionModeQuality'), description: t('recognitionModeQualityHint') } }} />
    <DetectionToggles value={detection} onChange={changeDetection} label={t('detectionLabel')}
      options={{ gifts: { label: t('detectionGifts'), description: t('detectionGiftsHint') },
        themes: { label: t('detectionThemes'), description: t('detectionThemesHint') },
        events: { label: t('detectionEvents'), description: t('detectionEventsHint') } }} />
    <ToggleSwitch data-assist-samples="" on={samples === true} onChange={() => changeSamples(samples !== true)}
      label={t('samplesLabel')} description={t('samplesHint')} />
    <div>
      <button type="button" data-assist-export-log onClick={() => downloadLog(snapshot.current())}
        className="min-h-9 rounded-md border border-[var(--border)] px-3 text-sm text-[var(--text-primary)] hover:border-[var(--border-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">{t('exportLog')}</button>
      <p className="mt-1.5 break-keep text-[0.6875rem] leading-4 text-[var(--text-secondary)]">{t('exportLogHint')}</p>
    </div>
  </div>
  const recognitionSummary = { fastest: t('recognitionModeFastest'), performance: t('recognitionModePerformance'),
    balanced: t('recognitionModeBalanced'), quality: t('recognitionModeQuality') }[recognitionMode]
  const saveRunSlot = (slot: TempSlot<RunState>) => {
    const slots = saveTempSlot(RUN_DRAFTS_KEY, slot.slotNumber, state, runSlotLabel(state), isRunState)
    if (!slots) { toast.error(tTempSaves('saveFailed')); return }
    setRunSlots(slots)
    toast.success(tTempSaves(slot.draft ? 'overwritten' : 'savedToSlot', { slot: slot.slotNumber }))
  }
  const loadRunSlot = (slot: TempSlot<RunState>) => {
    if (!slot.draft) return
    capture.stop()
    dispatch({ type: 'LOAD_RUN', state: normalizeRunState(slot.draft.state) })
    setView('overview')
    toast.success(tTempSaves('loadedFromSlot', { slot: slot.slotNumber }))
  }
  const deleteRunSlot = (slot: TempSlot<RunState>) => {
    setRunSlots(deleteTempSlot(RUN_DRAFTS_KEY, slot.slotNumber, isRunState))
    toast.success(tTempSaves('deletedFromSlot', { slot: slot.slotNumber }))
  }

  // The whole Assist page (setup included) is a tool screen without site chrome; a started run fills exactly one screen.
  const running = !loadingPlan && state.phase === 'playing'
  useHtmlFlag('with-assist-run')
  useHtmlFlag('with-assist-running', running)
  return <div data-assist-run data-assist-running={running || undefined} className={`bg-[var(--bg-deep)] text-[var(--text-primary)] ${running ? 'flex h-dvh flex-col overflow-hidden' : 'min-h-dvh lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden'}`}>
    <div className={`mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8 ${running ? 'flex min-h-0 flex-1 flex-col py-2 sm:py-3' : 'pb-12 pt-4 sm:pt-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:pb-6'}`}>
      {/* One bar: where the page is, its views, then what a run needs once (connect, PiP) and the rest behind "more". */}
      <header className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] ${running ? 'mb-3 pb-2' : 'mb-4 pb-3'}`}>
        <div className="flex min-w-0 items-center gap-3">
          <BackLink href="/" aria-label={t('backToPlanner')} title={t('backToPlanner')} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]"><ArrowLeft size={18} /></BackLink>
          <h1 className="truncate font-[family-name:var(--font-heading)] text-lg leading-tight text-[var(--gold-light)] sm:text-xl">{t('title')}</h1>
        </div>
        {state.phase === 'playing' && <nav aria-label={t('sections')} data-run-views className="flex max-sm:order-last max-sm:w-full sm:ml-2">
          {RUN_VIEWS.map(item => {
            // The pack picker is opened from the overview's floor log and returns to it.
            const current = view === item || (item === 'overview' && view === 'theme')
            return <button key={item} type="button" aria-current={current ? 'true' : undefined} onClick={() => setView(item)}
              className={`min-h-10 border-b-2 px-3 text-[0.8125rem] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--gold-light)] ${current ? 'border-[var(--gold)] text-[var(--gold-light)]' : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>{t(RUN_VIEW_LABEL[item])}</button>
          })}
        </nav>}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {state.phase === 'playing' && !capture.mobile && <div data-capture-state={capture.status} role={capture.status === 'error' ? 'alert' : 'status'} title={t(samples ? 'captureFramesPrivacySamples' : 'captureFramesPrivacy')}
          className="flex min-w-0 items-center gap-2 md:mr-1">
          {/* Static state dot: gold while connected, red on failure, muted otherwise. */}
          <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${capture.status === 'running' ? 'bg-[var(--gold)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]'
            : capture.status === 'error' || capture.status === 'unsupported' ? 'bg-[var(--error)]' : 'bg-[var(--text-muted)]'}`} />
          <p className="min-w-0 break-keep text-[0.8125rem] leading-5 max-sm:sr-only">
            <span className={`font-semibold ${capture.status === 'error' || capture.status === 'unsupported' ? 'text-[var(--error-text)]' : 'text-[var(--text-secondary)]'}`}>{t(`capture_${capture.status}`)}</span>
            {/* the text reader down or slow while the screen still comes in: rooms, packs and popups are not being read */}
            {capture.status === 'running' && (capture.ocrStatus === 'error' || capture.ocrEngine?.engine === 'tesseract') &&
              <span data-reader-state={capture.ocrStatus === 'error' ? 'down' : 'slow'} className={capture.ocrStatus === 'error' ? 'text-[var(--error-text)]' : 'text-[var(--text-secondary)]'}>
                {' · '}{t(capture.ocrStatus === 'error' ? 'readerDown' : capture.ocrEngine?.loading ? 'readerRecovering' : 'readerSlow')}</span>}
            <span className="sr-only"> {t(samples ? 'captureFramesPrivacySamples' : 'captureFramesPrivacy')}</span>
          </p>
        </div>}
        {state.phase === 'playing' && <>
          {/* Filled while idle: connecting the screen is the next thing a new run needs. */}
          <button type="button" disabled={capture.mobile} title={capture.mobile ? t('captureMobileBlocked') : undefined} onClick={() => { if (captureActive) capture.stop(); else connect() }} className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)] disabled:border-[var(--border)] disabled:bg-transparent disabled:text-[var(--text-muted)] ${captureActive ? 'border-[var(--border-gold)] text-[var(--gold-light)] hover:bg-[var(--bg-elevated)]' : 'border-[var(--gold)] bg-[var(--gold)] text-[var(--bg-deep)] hover:bg-[var(--gold-light)]'}`}>
            <MonitorUp size={16} aria-hidden="true" /> <span className="max-sm:sr-only">{t(captureActive ? 'stopScreenPreview' : 'screenPreview')}</span>
          </button>
          {/* Owns the PiP window and every capture-driven record (acquisitions, packs, events, Undo); renders only its button here. */}
          <CompanionPanel state={state} dispatch={dispatch} themes={themes} giftMap={giftMap}
            observedGiftIds={observedGiftIds} popupAcquisitions={capture.status === 'running' ? capture.popupAcquisitions : []}
            events={events} eventChoices={eventChoices} eventChoiceEvidence={eventChoiceEvidence}
            captureRunning={capture.status === 'running'} scene={capture.status === 'running' ? capture.scene : null}
            prediction={capture.status === 'running' ? capture.prediction : null}
            giftSales={capture.status === 'running' ? capture.giftSales : []}
            skillExchange={capture.status === 'running' ? capture.skillExchange : null}
            skills={skills}
            recipes={recipes}
            sinners={sinners} identities={identities} egos={egos}
            themeSelectionFloor={capture.status === 'running' ? capture.themeSelectionFloor : null}
            floorThemeObservation={capture.status === 'running' ? capture.floorThemeObservation : null}
            observedFloor={capture.status === 'running' ? capture.observedFloor : null}
            fusionEvidence={capture.status === 'running' ? capture.fusionEvidence : null}
            />
        </>}
          <TempSaveMenu title={tTempSaves('runMenuLabel')} slots={runSlots} onSave={saveRunSlot} onLoad={loadRunSlot} onDelete={deleteRunSlot} />
        {/* 떠 있는 팝오버: 열어도 아래 화면을 밀지 않는다. 런 중에 자주 쓰지 않는 것(인식 설정, 초기화)을 모은다. */}
        {state.phase === 'playing' && <details ref={recognitionRef} data-run-more className="group relative shrink-0">
          <summary aria-label={t('more')} title={t('more')} className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] group-open:border-[var(--border-gold)] group-open:text-[var(--gold-light)] [&::-webkit-details-marker]:hidden">
            <MoreHorizontal aria-hidden="true" size={16} /><span className="max-lg:sr-only">{t('more')}</span>
          </summary>
          <div className="absolute right-0 top-[calc(100%+0.375rem)] z-40 max-h-[75dvh] w-[min(48rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] p-3 shadow-[0_1rem_2.5rem_rgba(0,0,0,0.55)]">
            {!capture.mobile && <>
              <h2 className="mb-3 flex items-baseline justify-between gap-3 text-sm font-bold text-[var(--text-primary)]">{t('setupRecognitionTitle')}<span className="text-xs font-normal text-[var(--gold-light)]">{recognitionSummary}</span></h2>
              {recognitionControls}
            </>}
            {/* The menu closes first: the confirmation resets the run, which removes this menu. */}
            <button type="button" onClick={() => { if (recognitionRef.current) recognitionRef.current.open = false; setConfirmReset(true) }} className={`inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] ${capture.mobile ? '' : 'mt-3'}`}>
              <RotateCcw size={15} aria-hidden="true" /> {t('reset')}
            </button>
          </div>
        </details>}
        </div>
      </header>
      {state.phase === 'playing' && capture.mobile && <p role="note" className="mb-3 shrink-0 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-secondary)]" data-capture-mobile>{t('captureMobileBlocked')}</p>}
      {/* No WebGPU: capture is refused (or stopped) rather than run on the CPU, with the browser setting that usually fixes it. */}
      {state.phase === 'playing' && !capture.mobile && capture.gpu && <div role="alert" data-capture-gpu={capture.gpu}
        className="mb-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-[var(--warning)] bg-[var(--bg-card)] px-3 py-2 text-xs">
        <p className="min-w-0 flex-1 basis-64 break-keep font-semibold leading-5 text-[var(--warning)]">{t(`captureGpu_${capture.gpu}`)}</p>
        <button type="button" onClick={() => setGpuHelp(true)} className="min-h-9 shrink-0 rounded-md border border-[var(--warning)] px-3 font-semibold text-[var(--warning)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">{t('gpuHelpOpen')}</button>
      </div>}
      {capture.gpu && <GpuRequiredModal block={capture.gpu} open={gpuHelp} onClose={() => setGpuHelp(false)}
        onReconnect={() => { setGpuHelp(false); connect() }} />}
      {/* Asked once, the first time the screen is connected; the switch in the recognition settings changes it later. */}
      {state.phase === 'playing' && !capture.mobile && captureActive && samples === null && <div role="group" aria-label={t('samplesLabel')} data-assist-samples-prompt
        className="mb-3 flex w-full shrink-0 flex-wrap items-center gap-2 rounded-md border border-[var(--border-gold)] bg-[var(--bg-card)] px-3 py-2 text-xs">
        <p className="min-w-0 flex-1 basis-64 break-keep leading-5 text-[var(--text-secondary)]"><span className="font-semibold text-[var(--gold-light)]">{t('samplesPrompt')}</span> {t('samplesHint')}</p>
        <button type="button" onClick={() => changeSamples(true)} className="min-h-9 rounded-md bg-[var(--gold)] px-3 font-semibold text-[var(--bg-deep)] hover:bg-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">{t('samplesYes')}</button>
        <button type="button" onClick={() => changeSamples(false)} className="min-h-9 rounded-md border border-[var(--border)] px-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">{t('samplesNo')}</button>
      </div>}

      {dataError && <p role="alert" className="mb-5 shrink-0 rounded-md border border-[var(--error)] p-3 text-sm text-[var(--error-text)]">{t('dataError')}</p>}
      {loadingPlan ? <div role="status" className={`${card} animate-pulse p-8 text-center text-[var(--text-secondary)]`}>{t('loadingPlan')}</div> : state.phase === 'setup' ?
        <RunSetup state={state} dispatch={dispatch} gifts={gifts} giftMap={giftMap} identities={identities} sinners={sinners} egos={egos}
          recognition={capture.mobile || gpuRefused ? undefined : recognitionControls} recognitionSummary={recognitionSummary} /> : state.phase === 'completed' ?
        <section className={`${card} mx-auto max-w-xl p-8 text-center`}>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--gold-light)]">{t('completed')}</h2>
          <p className="mt-4 text-[var(--text-secondary)]">{t('completedSummary', { floors: state.floorLogs.filter(log => log.completedAt).length, gifts: state.giftInventory.length })}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><button onClick={reset} className="min-h-11 rounded-md border border-[var(--border-gold)] px-5 text-[var(--gold-light)]">{t('newRun')}</button><button onClick={reviewDraft} className="min-h-11 rounded-md bg-[var(--gold)] px-5 font-bold text-[var(--bg-deep)]">{t('reviewDraft')}</button></div>
        </section> : <>
          <div className="min-h-0 min-w-0 flex-1">
            <FloorPanel state={giftConditionState} dispatch={dispatch} themes={themes} gifts={gifts} giftMap={giftMap} recipes={recipes} identities={identities} sinners={sinners} skills={skills} passives={passives} egos={egos} events={events} eventChoices={eventChoices} observedEventIds={observedEventIds} view={view} onView={setView} />
          </div>
        </>}
    </div>
    <ConfirmModal open={confirmReset} title={t('resetTitle')} message={t('resetMessage')} confirmLabel={t('reset')} cancelLabel={t('cancel')} variant="danger" onCancel={() => setConfirmReset(false)} onConfirm={() => { setConfirmReset(false); reset() }} />
  </div>
}
