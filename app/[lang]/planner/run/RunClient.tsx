'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, RotateCcw, MonitorUp } from 'lucide-react'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { buildGiftMap } from '@/lib/planner/fusion'
import { decodedPlanToPlannerState, decodePlan, loadPlanForRun, runStateToPlannerState, saveDraftToLocal } from '@/lib/planner/encoder'
import { enrichIdentitySlotsForGiftConditions } from '@/lib/planner/gift-condition-status'
import { useRunStore } from '@/lib/stores/run'
import type { ThemeData, GiftData, RecipeData, IdentityData, SinnerData, SkillSummary, EgoData, PassiveData } from '@/lib/planner/types'
import type { MdEvent, MdEventChoice } from '@/components/mirror-dungeon/types'
import RunSetup from '@/components/planner/run/RunSetup'
import FloorProgress from '@/components/planner/run/FloorProgress'
import FloorPanel from '@/components/planner/run/FloorPanel'
import CompanionPanel from '@/components/planner/run/CompanionPanel'
import RecognitionModeControl from '@/components/planner/run/RecognitionModeControl'
import DetectionToggles from '@/components/planner/run/DetectionToggles'
import { DETECTION_STORAGE_KEY, DEFAULT_DETECTION, readDetectionSettings, type DetectionSettings } from '@/lib/vision/detection-settings'
import { readRecognitionMode, RECOGNITION_MODE_STORAGE_KEY, type RecognitionMode } from '@/lib/vision/recognition-profile'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { captureEvidence, useAssistCapture } from '@/lib/hooks/useAssistCapture'

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
  const [confirmReset, setConfirmReset] = useState(false)
  const giftReferences = useMemo(() => gifts.map(gift => ({ id: String(gift.game_id), imageUrl: gift.image_url })), [gifts])
  const eventReferences = useMemo(() => events.map(event => ({ id: String(event.id), imageUrl: event.image_url })), [events])
  const ocrCatalog = useMemo(() => ({
    gifts: gifts.map(gift => ({
      id: String(gift.game_id),
      texts: [gift.name, gift.name_en, gift.name_jp].filter((value): value is string => Boolean(value)),
      effectTexts: [gift.effect_base, gift.effect_base_en, gift.effect_base_jp,
        gift.effect_plus, gift.effect_plus_en, gift.effect_plus_jp,
        gift.effect_plusplus, gift.effect_plusplus_en, gift.effect_plusplus_jp]
        .filter((value): value is string => Boolean(value)),
    })),
    events: events.map(event => ({ id: String(event.id), texts: [event.name, event.desc_text, event.name_en, event.desc_text_en, event.name_jp, event.desc_text_jp].filter((value): value is string => Boolean(value)) })),
    choices: eventChoices.map(choice => ({ id: String(choice.id), eventId: String(choice.event_id), texts: [choice.message, choice.message_en, choice.message_jp].filter((value): value is string => Boolean(value)),
      resultTexts: [choice.result_text, choice.result_text_en, choice.result_text_jp].filter((value): value is string => Boolean(value)) })),
  }), [gifts, events, eventChoices])
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
  const capture = useAssistCapture({ giftReferences, eventReferences, ocrCatalog, themeCatalog, mode: recognitionMode, detection,
    language: locale === 'en' || locale === 'ja' ? locale : 'ko', floor: state.phase === 'playing' ? state.currentFloor : null })
  const { visualCandidates, ocrCandidates, eventChoiceEvidence } =
    captureEvidence(capture, state.phase === 'playing' ? state.currentFloor : null, Date.now())
  // The stable scene switches a capture or two after a battle starts; frames already classified as combat never
  // promote gifts, so the order stays frozen from the first battle frame.
  const combatFrame = ['battle', 'battle_setup', 'loading'].includes(capture.prediction?.label ?? '')
  const observedGiftIds = combatFrame ? [] : [...new Set([
    ...(visualCandidates?.gifts.map(item => Number(item.id)) ?? []),
    ...(ocrCandidates?.gifts.map(item => Number(item.id)) ?? []),
  ].filter(Number.isInteger))]
  const observedEventIds = [...new Set([
    ...(visualCandidates?.events.map(item => Number(item.id)) ?? []),
    ...(ocrCandidates?.events.map(item => Number(item.id)) ?? []),
    ...(ocrCandidates?.choices.map(item => Number(item.eventId)) ?? []),
  ].filter(Number.isInteger))]
  const giftMap = useMemo(() => buildGiftMap(gifts), [gifts])
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

  return <div data-assist-run className="min-h-screen bg-[var(--bg-deep)] text-[var(--text-primary)]">
    <div className="mx-auto max-w-[90rem] px-4 pb-12 pt-20 sm:px-6 sm:pt-24 lg:px-8">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/planner" aria-label={t('backToPlanner')} title={t('backToPlanner')} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--gold-light)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]"><ArrowLeft size={18} /></Link>
          <h1 className="font-[family-name:var(--font-heading)] text-lg leading-tight text-[var(--gold-light)] sm:text-xl">{t('title')}</h1>
        </div>
        {state.phase === 'playing' && <div className="flex flex-wrap gap-2">
          {/* Owns the PiP window and every capture-driven record (acquisitions, packs, events, Undo); renders only its button here. */}
          <CompanionPanel state={state} dispatch={dispatch} themes={themes} giftMap={giftMap}
            observedGiftIds={observedGiftIds} popupAcquisitions={capture.status === 'running' ? capture.popupAcquisitions : []}
            events={events} eventChoices={eventChoices} eventChoiceEvidence={eventChoiceEvidence}
            captureRunning={capture.status === 'running'} scene={capture.status === 'running' ? capture.scene : null}
            prediction={capture.status === 'running' ? capture.prediction : null}
            giftSales={capture.status === 'running' ? capture.giftSales : []}
            skillExchange={capture.status === 'running' ? capture.skillExchange : null}
            skills={skills}
            themeSelectionFloor={capture.status === 'running' ? capture.themeSelectionFloor : null}
            floorThemeObservation={capture.status === 'running' ? capture.floorThemeObservation : null}
            observedFloor={capture.status === 'running' ? capture.observedFloor : null}
            fusionEvidence={capture.status === 'running' ? capture.fusionEvidence : null}
            />
          <button type="button" disabled={capture.mobile} title={capture.mobile ? t('captureMobileBlocked') : undefined} onClick={() => { if (capture.status === 'running' || capture.status === 'loading' || capture.status === 'requesting') capture.stop(); else void capture.start() }} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border-gold)] px-3 text-xs text-[var(--gold-light)] hover:bg-[var(--bg-elevated)] disabled:border-[var(--border)] disabled:text-[var(--text-muted)] disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
            <MonitorUp size={16} /> {t(capture.status === 'running' || capture.status === 'loading' || capture.status === 'requesting' ? 'stopScreenPreview' : 'screenPreview')}
          </button>
          <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--gold-light)]">
            <RotateCcw size={15} /> {t('reset')}
          </button>
        </div>}
      </header>
      {state.phase === 'playing' && !capture.mobile && <div className="mb-4 max-w-3xl" data-recognition-mode-control>
        <RecognitionModeControl value={recognitionMode} onChange={changeRecognitionMode} label={t('recognitionModeLabel')}
          note={capture.status === 'running' ? t('recognitionModeLiveNote') : undefined}
          options={{ fastest: { label: t('recognitionModeFastest'), description: t('recognitionModeFastestHint') },
            performance: { label: t('recognitionModePerformance'), description: t('recognitionModePerformanceHint') },
            balanced: { label: t('recognitionModeBalanced'), description: t('recognitionModeBalancedHint') },
            quality: { label: t('recognitionModeQuality'), description: t('recognitionModeQualityHint') } }} />
        <div className="mt-3">
          <DetectionToggles value={detection} onChange={changeDetection} label={t('detectionLabel')}
            options={{ gifts: { label: t('detectionGifts'), description: t('detectionGiftsHint') },
              themes: { label: t('detectionThemes'), description: t('detectionThemesHint') },
              events: { label: t('detectionEvents'), description: t('detectionEventsHint') } }} />
        </div>
      </div>}
      {state.phase === 'playing' && capture.mobile && <p role="note" className="mb-5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-3 text-sm text-[var(--text-secondary)]" data-capture-mobile>{t('captureMobileBlocked')}</p>}
      {state.phase === 'playing' && !capture.mobile && <div data-capture-state={capture.status} role={capture.status === 'error' ? 'alert' : 'status'}
        className="mb-5 flex min-w-0 items-start gap-2.5">
        {/* Static state dot: gold while connected, red on failure, muted otherwise. */}
        <span aria-hidden="true" className={`mt-[0.4rem] h-2 w-2 shrink-0 rounded-full ${capture.status === 'running' ? 'bg-[var(--gold)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]'
          : capture.status === 'error' || capture.status === 'unsupported' ? 'bg-[var(--error)]' : 'bg-[var(--text-muted)]'}`} />
        <p className="min-w-0 break-keep text-sm leading-6">
          <span className={`font-semibold ${capture.status === 'error' || capture.status === 'unsupported' ? 'text-[var(--error)]' : 'text-[var(--gold-light)]'}`}>{t(`capture_${capture.status}`)}</span>
          <span className="block text-[var(--text-secondary)]">{t('captureFramesPrivacy')}</span>
        </p>
      </div>}

      {dataError && <p role="alert" className="mb-5 rounded-md border border-[var(--error)] p-3 text-sm text-[var(--error)]">{t('dataError')}</p>}
      {loadingPlan ? <div role="status" className={`${card} animate-pulse p-8 text-center text-[var(--text-secondary)]`}>{t('loadingPlan')}</div> : state.phase === 'setup' ?
        <div className="max-w-3xl">
          <RunSetup state={state} dispatch={dispatch} gifts={gifts} giftMap={giftMap} identities={identities} sinners={sinners} egos={egos} />
        </div> : state.phase === 'completed' ?
        <section className={`${card} mx-auto max-w-xl p-8 text-center`}>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--gold-light)]">{t('completed')}</h2>
          <p className="mt-4 text-[var(--text-secondary)]">{t('completedSummary', { floors: state.floorLogs.filter(log => log.completedAt).length, gifts: state.giftInventory.length })}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><button onClick={reset} className="min-h-11 rounded-md border border-[var(--border-gold)] px-5 text-[var(--gold-light)]">{t('newRun')}</button><button onClick={reviewDraft} className="min-h-11 rounded-md bg-[var(--gold)] px-5 font-bold text-[var(--bg-deep)]">{t('reviewDraft')}</button></div>
        </section> : <>
          <FloorProgress state={state} dispatch={dispatch} />
          <div className="mt-3">
            <main className="min-w-0"><FloorPanel state={giftConditionState} dispatch={dispatch} themes={themes} gifts={gifts} giftMap={giftMap} recipes={recipes} identities={identities} sinners={sinners} skills={skills} passives={passives} egos={egos} events={events} eventChoices={eventChoices} observedEventIds={observedEventIds} /></main>
          </div>
        </>}
    </div>
    <ConfirmModal open={confirmReset} title={t('resetTitle')} message={t('resetMessage')} confirmLabel={t('reset')} cancelLabel={t('cancel')} variant="danger" onCancel={() => setConfirmReset(false)} onConfirm={() => { setConfirmReset(false); reset() }} />
  </div>
}
