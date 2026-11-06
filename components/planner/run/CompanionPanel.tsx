'use client'

import { createPortal } from 'react-dom'
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { PictureInPicture2 } from 'lucide-react'
import { useCompanionWindow } from '@/lib/hooks/useCompanionWindow'
import { getCurrentFloorPriorityGifts, getFusionTierGifts, giftGameId, nextGiftPromotion, planGiftIds, planThemeGiftIds, type GiftPromotion } from '@/lib/planner/run-priority-gifts'
import { acquisitionAttributionFloor, clearedThemeFloors, floorThemeObservationAction, getRunThemeGuidance, pendingThemeSelectionFloor, planStartGiftIds, runStartEnded } from '@/lib/planner/run-theme-guidance'
import { EVENT_EXIT_SCENES, EVENT_IDLE_EXIT_MS, FORMATION_SCENES, nextEventView, type StableScene } from '@/lib/vision/scene-state'
import { normalizeRunState, runReducer, type RunAction, type RunState } from '@/lib/planner/run-types'
import type { ThemeData, GiftData, SkillSummary, RecipeData, SinnerData, IdentityData, EgoData } from '@/lib/planner/types'
import { committedKeywords, formationRow, fusionGuide } from '@/lib/planner/assist-gift-guide'
import { teamCodeFromPlanSlots } from '@/lib/planner/team-code-import'
import { recipeIngredientsInInventory, recipeOwnedGiftIds, themeExclusiveGiftIds } from '@/lib/planner/fusion'
import { getLocalizedName } from '@/lib/i18n/localize'
import type { SupportedLang } from '@/lib/i18n/types'
import type { FloorThemeObservation, FusionEvidence, GiftSale, PopupAcquisition } from '@/lib/hooks/useAssistCapture'
import { fusionForResult, fusionMaterialsToRemove, returnedMaterials } from '@/lib/vision/fusion-evidence'
import type { MdEvent, MdEventChoice } from '@/features/mirror-dungeon'
import CompanionAcquisitionOverlay, { fusionFeedback, type AcquisitionOverlayEvent } from './CompanionAcquisitionOverlay'
import CompanionNextFloorButton from './CompanionNextFloorButton'
import type { SkillExchangeRead } from '@/lib/vision/skill-exchange'
import { AUTO_ACQUIRE_EXCLUDED_GIFT_IDS } from '@/lib/vision/popup-evidence'
import { recordingAutomatically } from '@/lib/vision/assist-report'
import { cardOfTheme, type ClearBonusOffer } from '@/lib/vision/clear-bonus'
import { giftBadges, pickPipMode } from '@/lib/planner/pip-view'
import { pipTips } from '@/lib/planner/pip-tips'
import CompanionView, { type PipActions, type PipData, type PipView } from './CompanionView'

type HistoryEntry = { before: RunState; after: RunState; beforeKey: string; afterKey: string; pendingFloor: number | null }
const snapshot = (state: RunState): RunState => normalizeRunState(JSON.parse(JSON.stringify(state)))
const keyOf = (state: RunState) => JSON.stringify(normalizeRunState(state))

interface Props {
  state: RunState
  dispatch: React.Dispatch<RunAction>
  themes: ThemeData[]
  giftMap: Map<number, GiftData>
  observedGiftIds?: number[]
  popupAcquisitions?: PopupAcquisition[]
  /** Confirmed shop sales, latest last. */
  giftSales?: GiftSale[]
  /** Shop skill replacement window on screen. */
  skillExchange?: SkillExchangeRead | null
  /** Identity skills for the skill replacement guide. */
  skills?: SkillSummary[]
  /** Fixed recipes: an owned result counts its ingredients as owned in the lists. */
  recipes?: RecipeData[]
  events?: MdEvent[]
  eventChoices?: MdEventChoice[]
  eventChoiceEvidence?: { eventId: number; observedAt: number; floor: number | null } | null
  captureRunning?: boolean
  scene?: StableScene | null
  /** Latest raw classifier frame; only used to leave the run start quickly. */
  prediction?: { label: string; confidence: number } | null
  themeSelectionFloor?: { floor: number; observedAt: number } | null
  floorThemeObservation?: FloorThemeObservation | null
  /** Exploration floor read in two separate captures while capture runs. */
  observedFloor?: number | null
  /** Fusion materials identified on each confirmation dialog, latest last. */
  fusionEvidence?: FusionEvidence[] | null
  /** For the formation screen: sinner order, and the catalog the formation code is written from. */
  sinners?: SinnerData[]
  identities?: IdentityData[]
  egos?: EgoData[]
  /** The pack selection's CLEAR BONUS rows, as read on the screen. */
  clearBonus?: ClearBonusOffer | null
}
export default function CompanionPanel({ state, dispatch, themes, giftMap, observedGiftIds = [], popupAcquisitions = [],
  events = [], eventChoices = [], eventChoiceEvidence = null, captureRunning = false, scene = null,
  themeSelectionFloor = null, floorThemeObservation = null, observedFloor = null, fusionEvidence = null, prediction = null, giftSales = [],
  skillExchange = null, skills = [], recipes = [], sinners = [], identities = [], egos = [], clearBonus = null }: Props) {
  const t = useTranslations('planner.run')
  const locale = useLocale() as SupportedLang
  const localized = (item: { name: string; name_en?: string | null; name_jp?: string | null }) => getLocalizedName({ name_kr: item.name, name_en: item.name_en, name_jp: item.name_jp }, locale)
  const { container, open, close, size, actualSize, updateSize } = useCompanionWindow()
  // Document Picture-in-Picture exists only in some desktop browsers; known after mount (the server cannot tell).
  const [pipSupported, setPipSupported] = useState(true)
  useEffect(() => { setPipSupported('documentPictureInPicture' in window) }, [])
  const pipNoteId = useId()
  // While the window is open the settings show its real content size, not the stored default.
  const shownSize = container ? actualSize : size
  const [historyVersion, setHistoryVersion] = useState(0)
  const [eventView, setEventView] = useState<{ eventId: number; observedAt: number; floor: number | null } | null>(null)
  const undoStack = useRef<HistoryEntry[]>([])
  const redoStack = useRef<HistoryEntry[]>([])
  const consumedPopupTokens = useRef(new Set<string>())
  const consumedThemeTokens = useRef(new Set<string>())
  const consumedFusionTokens = useRef(new Set<string>())
  // Recent fusion dialogs: a result popup belongs to the latest one confirmed before it in capture time.
  const recentFusions = useRef<FusionEvidence[]>([])
  // Popups skipped because their gift was still listed; a fusion applied later that removes it makes them real acquisitions.
  const listedPopups = useRef<PopupAcquisition[]>([])
  // The latest result-like popup, recorded as an automatic acquisition (afterKey) or skipped because the gift was already
  // listed (listedKey), so a fusion confirmed just after it can still be applied.
  const lastResultPopup = useRef<{ giftId: string; capturedAt: number | undefined; afterKey?: string; listedKey?: string } | null>(null)
  for (const evidence of fusionEvidence ?? []) recentFusions.current = [...recentFusions.current.filter(item => item.token !== evidence.token), evidence].slice(-8)
  const fusionTokens = (fusionEvidence ?? []).map(item => item.token).join('|')
  // Floors whose pack the user cleared (outside this panel's own history) during this run phase.
  const userClearedFloors = useRef(new Set<number>())
  const previousState = useRef(state)
  const [acquisitionEvents, setAcquisitionEvents] = useState<AcquisitionOverlayEvent[]>([])
  const acquisitionSeq = useRef(0)
  const expected = useRef<string | null>(null)
  const current = useRef(state)
  current.current = state
  const stateKey = keyOf(state)
  if (expected.current && expected.current !== stateKey) { undoStack.current = []; redoStack.current = []; expected.current = null }
  const log = state.floorLogs[state.currentFloor - 1]
  // On a pack selection screen the floor being chosen is shown with its plan, before any banner confirms entry.
  // A pack picked on this selection screen settles it; the same screen must not move on to choose a further floor.
  const [chosenInScene, setChosenInScene] = useState<number | null>(null)
  // Kept after the selection screen ends, so a pack the game picked but capture missed still targets that floor; a
  // stably observed later floor sets it too, and late reads of the previous floor never lower it.
  const pendingFloor = useRef<number | null>(null)
  pendingFloor.current = pendingThemeSelectionFloor(pendingFloor.current, { state, running: captureRunning, scene,
    header: themeSelectionFloor, chosenInScene, observedFloor: captureRunning ? observedFloor : null })
  const selectionFloor = pendingFloor.current
  // The latest pending floor and since when: popups captured since then belong to it, also once it became current.
  const pendingSince = useRef<{ floor: number | null; at: number | null }>({ floor: null, at: null })
  if (selectionFloor !== null && pendingSince.current.floor !== selectionFloor) pendingSince.current = { floor: selectionFloor, at: Date.now() }
  const viewFloor = selectionFloor ?? state.currentFloor
  // Run start: until the first pack selection screen is recognized, capture shows the plan's start and observation gifts.
  const startEnded = useRef(false)
  startEnded.current = runStartEnded(startEnded.current, { state, scene, header: themeSelectionFloor, selectionFloor, prediction })
  const startPhase = captureRunning && state.phase === 'playing' && !startEnded.current
  const theme = selectionFloor === null ? themes.find(item => item.id === log?.themeId) : undefined
  // Sightings only promote gifts on confirmed non-combat screens; battle and uncertain scenes keep the order.
  const giftPromotion = useRef<GiftPromotion | null>(null)
  giftPromotion.current = nextGiftPromotion(giftPromotion.current, { state, running: captureRunning, scene, observedGiftIds })
  // The fusion screen lists tier IV+ gifts, which are mostly fused; its result popups keep that list, any other screen ends it.
  const fusionView = useRef(false)
  if (!captureRunning) fusionView.current = false
  else if (scene?.label === 'fusion' && state.sourcePlanSnapshot) fusionView.current = true
  else if (scene && scene.label !== 'gift_acquired') fusionView.current = false
  // Lists judge ownership with recipe ingredients of owned results; records always use the real inventory.
  const ownedIds = useMemo(() => recipeOwnedGiftIds(state.giftInventory, recipes, giftMap), [state.giftInventory, recipes, giftMap])
  const listState = useMemo(() => ({ ...state, giftInventory: [...ownedIds].map(String) }), [state, ownedIds])
  const availableGifts = fusionView.current ? getFusionTierGifts(listState, themes, giftMap)
    : getCurrentFloorPriorityGifts(listState, themes, giftMap, giftPromotion.current?.ids)
  const guidance = useMemo(() => getRunThemeGuidance(viewFloor === state.currentFloor ? state : { ...state, currentFloor: viewFloor }, themes),
    [state, themes, viewFloor])
  const committed = useMemo(() => committedKeywords(state.identitySlots, state.giftInventory, giftMap), [state.identitySlots, state.giftInventory, giftMap])
  const guide = useMemo(() => fusionView.current ? fusionGuide({ inventory: state.giftInventory, targets: state.targetGifts, recipes, giftMap, committed }) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fusionView.current, state.giftInventory, state.targetGifts, recipes, giftMap, committed])
  // The plan author's memo for a floor (runs started from a plan only).
  const planMemo = (floor: number) => state.sourcePlanSnapshot?.floorPlan?.find(entry => entry.floor === floor)?.memo
  const formationScreen = captureRunning && !!scene && FORMATION_SCENES.has(scene.label)
  const formationCode = useMemo(() => {
    if (!formationScreen || !sinners.length) return ''
    try { return teamCodeFromPlanSlots(state.identitySlots, state.egoSlots, sinners, identities, egos) } catch { return '' }
  }, [formationScreen, state.identitySlots, state.egoSlots, sinners, identities, egos])
  const canUndo = undoStack.current.length > 0 && undoStack.current[undoStack.current.length - 1].afterKey === stateKey
  const canRedo = redoStack.current.length > 0 && redoStack.current[redoStack.current.length - 1].beforeKey === stateKey

  useEffect(() => {
    if (!container) return
    const body = container.ownerDocument.body
    body.style.scrollBehavior = 'auto'
    container.ownerDocument.documentElement.style.scrollBehavior = 'auto'
    container.ownerDocument.documentElement.style.scrollbarGutter = 'stable'
    // Assist-only scrollbar and input styles in globals.css apply to this window through this marker.
    container.ownerDocument.documentElement.setAttribute('data-assist-pip', '')
  }, [container])
  useEffect(() => {
    const apply = () => setEventView(view => nextEventView(view, { running: captureRunning, floor: state.currentFloor,
      evidence: eventChoiceEvidence, scene, now: Date.now() }))
    apply()
    // Another non-event scene held for a while also ends the event; re-check when that delay passes.
    if (!scene || scene.label === 'event' || EVENT_EXIT_SCENES.has(scene.label)) return
    const timeout = setTimeout(apply, Math.max(0, scene.since + EVENT_IDLE_EXIT_MS - Date.now()) + 50)
    return () => clearTimeout(timeout)
  }, [captureRunning, eventChoiceEvidence?.eventId, eventChoiceEvidence?.observedAt, eventChoiceEvidence?.floor,
    scene?.label, scene?.since, state.currentFloor])

  /**
   * Applies an action with an Undo entry and reports whether the run changed. The computed state itself is loaded, so
   * time-stamped actions (NEXT_FLOOR) store exactly the snapshot kept for Undo/Redo.
   */
  function record(action: RunAction, automatic = false): boolean {
    const before = snapshot(current.current)
    const beforeKey = keyOf(before)
    if (expected.current && expected.current !== beforeKey) { undoStack.current = []; redoStack.current = [] }
    const after = runReducer(before, action)
    const afterKey = keyOf(after)
    if (afterKey === beforeKey) return false
    undoStack.current = [...undoStack.current.slice(-19), { before, after, beforeKey, afterKey, pendingFloor: pendingFloor.current }]
    redoStack.current = []
    expected.current = afterKey
    current.current = after
    // Recognized actions are marked so the recognition report tells them from the user's own edits.
    if (automatic) recordingAutomatically(() => dispatch({ type: 'LOAD_RUN', state: after }))
    else dispatch({ type: 'LOAD_RUN', state: after })
    setHistoryVersion(value => value + 1)
    return true
  }
  // A confirmed sale removes one copy of the gift as its own Undo step, announced like consumed materials.
  const consumedSaleTokens = useRef(new Set<string>())
  const saleTokens = giftSales.map(sale => sale.token).join('|')
  useEffect(() => {
    if (current.current.phase !== 'playing') return
    for (const sale of giftSales) {
      if (consumedSaleTokens.current.has(sale.token)) continue
      consumedSaleTokens.current.add(sale.token)
      const gift = giftMap.get(Number(sale.giftId))
      if (!gift || !current.current.giftInventory.includes(sale.giftId)) continue
      if (record({ type: 'REMOVE_GIFT', giftId: sale.giftId }, true))
        announce([{ kind: 'consumed', token: `${sale.token}:sold`, at: Date.now(), materials: [{ gift, name: localized(gift) }], label: t('giftSold') }])
    }
  }, [saleTokens])
  /** floor: omitted = current floor (manual picks); from a screen observation, its floor or null for inventory only. */
  function acquire(id: number, event?: MouseEvent<HTMLButtonElement>, automatic = false, floor?: number | null) {
    const nextId = availableGifts[availableGifts.findIndex(gift => gift.game_id === id) + 1]?.game_id
      ?? availableGifts[availableGifts.findIndex(gift => gift.game_id === id) - 1]?.game_id
    const surface = event?.currentTarget.closest('[data-companion-content]')?.getAttribute('data-companion-content')
    const owner = event?.currentTarget.ownerDocument
    if (current.current.giftInventory.includes(String(id))) return
    if (!record({ type: 'ACQUIRE_GIFT', giftId: String(id), ...(floor === undefined ? {} : { floor }) }, automatic)) return
    // The one place both manual and confirmed automatic acquisitions pass; Undo/Redo and restores never animate.
    const gift = giftMap.get(id)!
    setAcquisitionEvents(items => [...items.slice(-31), { token: `${id}-${++acquisitionSeq.current}`, at: Date.now(), gift, name: localized(gift) }])
    if (owner && surface && nextId) owner.defaultView?.requestAnimationFrame(() => owner.querySelector<HTMLButtonElement>(`[data-companion-content="${surface}"] [data-gift-id="${nextId}"]`)?.focus({ preventScroll: true }))
    toast.success(t(automatic ? 'popupGiftAutoAcquired' : 'pipGiftAcquired', { name: localized(giftMap.get(id)!) }))
  }
  function acquireAutomatically(id: number, capturedAt: number | undefined, floor: number | null) {
    const before = undoStack.current.length
    acquire(id, undefined, true, floor)
    const entry = undoStack.current.at(-1)
    lastResultPopup.current = undoStack.current.length > before && entry ? { giftId: String(id), capturedAt, afterKey: entry.afterKey } : null
  }
  function acquireFromPopup(evidence: PopupAcquisition) {
    acquireAutomatically(Number(evidence.giftId), evidence.capturedAt, acquisitionAttributionFloor(current.current, { evidenceFloor: evidence.floor,
      pendingFloor: pendingSince.current.floor, pendingSince: pendingSince.current.at,
      pendingActive: pendingFloor.current !== null && pendingFloor.current === pendingSince.current.floor, capturedAt: evidence.capturedAt }))
  }
  /** A material that came back with the fusion's result (e.g. by a blessing) and was skipped as still listed is acquired again. */
  function restoreReturned(fusion: FusionEvidence, removed: string[]) {
    const returned = returnedMaterials(fusion, removed, listedPopups.current)
    listedPopups.current = listedPopups.current.filter(item => !returned.includes(item))
    for (const evidence of returned) acquireFromPopup(evidence)
  }
  /**
   * Fusion evidence that arrives after its result popup was already handled. An acquisition that is still the latest
   * step, with nothing changed since, is replaced by one fusion step from the same starting state (one Undo restores the
   * materials and removes the result); otherwise, while the result is still listed and every material is present, the
   * materials leave as their own step. Anything else leaves the inventory as it is. Only the latest fusion confirmed before
   * that popup (in capture time) can claim it.
   */
  useEffect(() => {
    const last = lastResultPopup.current
    const fusion = last && fusionForResult(recentFusions.current, last.capturedAt)
    if (!fusion || !last || consumedFusionTokens.current.has(fusion.token)) return
    if (last.listedKey !== undefined) {
      if (keyOf(current.current) !== last.listedKey) return
      const materials = fusionMaterialsToRemove(fusion.materials, current.current.giftInventory, AUTO_ACQUIRE_EXCLUDED_GIFT_IDS)
      if (!materials?.length) return
      consumedFusionTokens.current.add(fusion.token)
      lastResultPopup.current = null
      if (fuse(Number(last.giftId), materials, fusion.token)) restoreReturned(fusion, materials)
      return
    }
    const entry = undoStack.current.at(-1)
    if (!entry || entry.afterKey !== last.afterKey || keyOf(current.current) !== entry.afterKey) {
      // Something was recorded since (e.g. a second popup): the materials still leave, as their own step, if all present.
      const materials = fusionMaterialsToRemove(fusion.materials, current.current.giftInventory, AUTO_ACQUIRE_EXCLUDED_GIFT_IDS)
      if (!materials?.length || !current.current.giftInventory.includes(last.giftId)) return
      consumedFusionTokens.current.add(fusion.token)
      lastResultPopup.current = null
      if (fuse(Number(last.giftId), materials, fusion.token)) restoreReturned(fusion, materials)
      return
    }
    const materials = fusionMaterialsToRemove(fusion.materials, entry.before.giftInventory, AUTO_ACQUIRE_EXCLUDED_GIFT_IDS)
    if (!materials?.length) return
    consumedFusionTokens.current.add(fusion.token)
    lastResultPopup.current = null
    undoStack.current.pop()
    current.current = entry.before
    expected.current = entry.beforeKey
    if (!record({ type: 'CRAFT_FUSION', materialIds: materials, resultId: last.giftId }, true)) {
      undoStack.current.push(entry)
      current.current = entry.after
      expected.current = entry.afterKey
      return
    }
    // Against what was shown (the result already announced when its popup was recorded): only the materials leave.
    announce(fusionFeedback(fusion.token, Date.now(), entry.after.giftInventory, current.current.giftInventory, last.giftId, describeGift))
    const gift = giftMap.get(Number(last.giftId))
    if (gift) toast.success(t('fusionAutoApplied', { name: localized(gift), count: materials.length }))
    restoreReturned(fusion, materials)
  }, [fusionTokens])
  const describeGift = (id: string) => { const gift = giftMap.get(Number(id)); return gift ? { gift, name: localized(gift) } : null }
  const announce = (events: AcquisitionOverlayEvent[]) => { if (events.length) setAcquisitionEvents(items => [...items.slice(-31), ...events]) }
  /**
   * A recognized fusion: materials removed and the result added as one Undo step, announced from that step's own
   * inventory change (consumed materials, then the result if it was added). Only recognition reaches here.
   * A vestige result is never recorded (several can be held): only the materials leave.
   */
  function fuse(resultId: number, materials: string[], token: string): boolean {
    const before = current.current.giftInventory
    const recorded = !AUTO_ACQUIRE_EXCLUDED_GIFT_IDS.has(String(resultId))
    if (!record({ type: 'CRAFT_FUSION', materialIds: materials, resultId: recorded ? String(resultId) : null }, true)) return false
    announce(fusionFeedback(token, Date.now(), before, current.current.giftInventory, String(resultId), describeGift))
    const gift = giftMap.get(resultId)!
    toast.success(recorded ? t('fusionAutoApplied', { name: localized(gift), count: materials.length })
      : t('fusionMaterialsApplied', { name: localized(gift), count: materials.length }))
    return true
  }
  useEffect(() => {
    if (state.phase !== 'playing') {
      consumedThemeTokens.current.clear(); consumedFusionTokens.current.clear(); recentFusions.current = []; listedPopups.current = []
    }
  }, [state.phase])
  useEffect(() => {
    const before = previousState.current
    previousState.current = state
    if (state.phase !== 'playing') { userClearedFloors.current.clear(); return }
    // Changes made through this panel (record, Undo, Redo) match the expected key; anything else came from the user.
    if (expected.current === stateKey) return
    for (const floor of clearedThemeFloors(before, state)) userClearedFloors.current.add(floor)
  }, [stateKey])
  useEffect(() => {
    if (!floorThemeObservation) return
    const action = floorThemeObservationAction(current.current, themes, floorThemeObservation, consumedThemeTokens.current, Date.now(),
      userClearedFloors.current)
    const observedTheme = action && themes.find(item => String(item.id) === action.themeId)
    if (!action || !observedTheme) return
    record(action, true)
    toast.success(t('floorThemeObserved', { floor: action.floor, name: localized(observedTheme) }))
  }, [floorThemeObservation, state.phase, themes])
  // The floor's pack is known and its card's CLEAR BONUS was read on the selection screen: the floor log keeps it.
  const bonusFloor = clearBonus ? clearBonus.floor ?? selectionFloor : null
  const bonusTheme = bonusFloor !== null ? state.floorLogs[bonusFloor - 1]?.themeId ?? null : null
  useEffect(() => {
    if (state.phase !== 'playing' || !clearBonus || bonusFloor === null || !bonusTheme) return
    const pack = themes.find(item => String(item.id) === bonusTheme)
    const pool = pack ? new Set([...(pack.ego_gift_ids ?? []), ...(pack.specific_ego_gift_ids ?? [])].map(String)) : null
    const card = cardOfTheme(clearBonus.cards, bonusTheme, pool)
    if (!card || current.current.floorLogs[bonusFloor - 1]?.clearBonus?.join(',') === card.gifts.join(',')) return
    record({ type: 'SET_FLOOR_CLEAR_BONUS', floor: bonusFloor, giftIds: card.gifts }, true)
  }, [clearBonus, bonusFloor, bonusTheme, state.phase, themes]) // eslint-disable-line react-hooks/exhaustive-deps -- record reads the latest state
  useEffect(() => {
    // Inventory comes first: a confirmed acquisition is recorded whatever the run's floor state; the evidence only
    // decides which floor log (or none) it belongs to.
    if (current.current.phase !== 'playing') return
    for (const evidence of popupAcquisitions) {
      if (consumedPopupTokens.current.has(evidence.token) || Date.now() - evidence.observedAt > 8000) continue
      consumedPopupTokens.current.add(evidence.token)
      const id = Number(evidence.giftId)
      if (!Number.isInteger(id) || !giftMap.has(id)) continue
      // The result popup of a confirmed fusion: the identified materials leave the inventory in the same step, even when
      // the result is already listed (an earlier fusion's materials were not all seen). Further popups of an applied
      // fusion (a material returned with its result) are plain acquisitions and never claim an older fusion.
      const fusion = fusionForResult(recentFusions.current, evidence.capturedAt)
      // A vestige is never recorded, bought or fused. As a fusion's result, the gifts it was made from still leave; when
      // the fusion's evidence comes after this popup, the effect above removes them.
      if (AUTO_ACQUIRE_EXCLUDED_GIFT_IDS.has(evidence.giftId)) {
        if (fusion && !consumedFusionTokens.current.has(fusion.token)) {
          consumedFusionTokens.current.add(fusion.token)
          const materials = fusionMaterialsToRemove(fusion.materials, current.current.giftInventory, AUTO_ACQUIRE_EXCLUDED_GIFT_IDS)
          if (materials?.length) fuse(id, materials, fusion.token)
        } else if (!fusion) lastResultPopup.current = { giftId: evidence.giftId, capturedAt: evidence.capturedAt, listedKey: keyOf(current.current) }
        continue
      }
      // A fixed-recipe result is only made by fusing its ingredients: they leave with it even when no dialog was read.
      const recipe = recipeIngredientsInInventory(id, current.current.giftInventory, recipes, giftMap, fusion?.materials ?? [])
      if (recipe && !current.current.giftInventory.includes(evidence.giftId)) {
        const token = fusion && !consumedFusionTokens.current.has(fusion.token) ? fusion.token : `recipe:${evidence.token}`
        if (fusion) consumedFusionTokens.current.add(fusion.token)
        if (fuse(id, recipe, token)) continue
      }
      if (fusion && !consumedFusionTokens.current.has(fusion.token)) {
        consumedFusionTokens.current.add(fusion.token)
        const materials = fusionMaterialsToRemove(fusion.materials, current.current.giftInventory, AUTO_ACQUIRE_EXCLUDED_GIFT_IDS)
        if (materials?.length && fuse(id, materials, fusion.token)) { restoreReturned(fusion, materials); continue }
      }
      if (current.current.giftInventory.includes(evidence.giftId)) {
        lastResultPopup.current = { giftId: evidence.giftId, capturedAt: evidence.capturedAt, listedKey: keyOf(current.current) }
        listedPopups.current = [...listedPopups.current.slice(-7), evidence]
        continue
      }
      acquireFromPopup(evidence)
    }
  }, [popupAcquisitions, state.phase, giftMap])
  function undo() {
    const entry = undoStack.current.at(-1)
    if (!entry || keyOf(current.current) !== entry.afterKey) return
    setChosenInScene(null)
    // Back to the floor that was awaiting its pack, e.g. after undoing a pick for it.
    pendingFloor.current = entry.pendingFloor
    undoStack.current.pop()
    redoStack.current.push(entry)
    current.current = entry.before
    expected.current = entry.beforeKey
    dispatch({ type: 'LOAD_RUN', state: entry.before })
    setHistoryVersion(value => value + 1)
  }
  function redo() {
    const entry = redoStack.current.at(-1)
    if (!entry || keyOf(current.current) !== entry.beforeKey) return
    redoStack.current.pop()
    undoStack.current.push(entry)
    current.current = entry.after
    expected.current = entry.afterKey
    dispatch({ type: 'LOAD_RUN', state: entry.after })
    setHistoryVersion(value => value + 1)
  }
  void historyVersion

  /** A pack picked by the user: for the current floor, or entering the floor being chosen on a selection screen. */
  function chooseTheme(themeId: string) {
    const chosen = viewFloor === state.currentFloor ? record({ type: 'SET_FLOOR_THEME', themeId })
      : record({ type: 'OBSERVE_FLOOR_THEME', floor: viewFloor, themeId, completedAt: new Date().toISOString() })
    if (chosen && selectionFloor !== null && scene?.label === 'theme_select') setChosenInScene(scene.since)
    return chosen
  }
  // Manual fallback when floor detection misses; PiP only, recorded through the same Undo history.
  const nextFloor = <CompanionNextFloorButton floor={state.currentFloor} maxFloors={state.maxFloors} label={t('nextFloor')}
    disabled={state.phase !== 'playing'} onAdvance={() => { record({ type: 'NEXT_FLOOR' }) }} />
  // What the window shows (lib/planner/pip-view: one priority table) and its data; CompanionView draws it.
  const mode = pickPipMode({
    event: captureRunning && eventView?.floor === state.currentFloor,
    selectingPack: selectionFloor !== null && scene?.label === 'theme_select',
    skillExchange: !!skillExchange && !!state.sourcePlanSnapshot,
    formation: formationScreen && sinners.length > 0 && state.identitySlots.length > 0,
    start: startPhase,
    packChosen: !!theme,
    fusion: fusionView.current,
  })
  const plannedGiftIds = new Set(mode === 'fusion' ? planGiftIds(state)
    : planThemeGiftIds(state, themes, log?.themeId ?? '', state.currentFloor))
  const finalIds = new Set(state.targetGifts.map(giftGameId))
  const wanted = new Set([...planGiftIds(state), ...plannedGiftIds])
  // Marks on a gift cell, strongest first (lib/planner/pip-view giftBadges): add a mark by adding a row.
  const floorOnlyIds = new Set(theme && mode === 'floor' ? themeExclusiveGiftIds(theme) : [])
  const bonusIds = new Set((log?.clearBonus ?? []).map(Number))
  const badgeRows = [
    { ids: plannedGiftIds, badge: { key: 'plan', label: t('pipPlanGift'), tone: 'plan' as const } },
    { ids: floorOnlyIds, badge: { key: 'floor-only', label: t('pipFloorOnly'), tone: 'warn' as const } },
    { ids: bonusIds, badge: { key: 'clear-bonus', label: t('clearBonusMark'), short: t('clearBonusMarkShort'), tone: 'info' as const } },
  ]
  const pack = guidance[0]
  const startIds = startPhase ? planStartGiftIds(state) : null
  const giftsOf = (ids: number[]) => ids.flatMap(id => giftMap.get(id) ?? [])
  // Groups follow getCurrentFloorPriorityGifts' order: this floor's plan, final targets, then the rest led by
  // floor-only gifts outside the plan. The headings replace the neon outline the plan gifts had.
  const groups = mode !== 'floor' ? [] : [
    { key: 'planned', label: t('groupFloorPlan'), list: availableGifts.filter(gift => plannedGiftIds.has(gift.game_id)) },
    { key: 'final', label: t('groupTargets'), list: availableGifts.filter(gift => !plannedGiftIds.has(gift.game_id) && finalIds.has(gift.game_id)) },
    { key: 'others', label: t('pipGroupOthers'), list: availableGifts.filter(gift => !plannedGiftIds.has(gift.game_id) && !finalIds.has(gift.game_id)) },
  ].filter(group => group.list.length > 0)
  const view: PipView = {
    mode, floor: viewFloor, theme,
    memo: planMemo(mode === 'start' ? state.startFloor : state.currentFloor),
    tips: pipTips({ mode, state, viewFloor, planned: wanted, owned: ownedIds, offer: clearBonus, offerFloor: selectionFloor }),
    eventId: eventView?.eventId,
    exchange: skillExchange, slots: state.sourcePlanSnapshot?.identitySlots ?? [],
    formation: mode === 'formation' ? { cells: formationRow(state.identitySlots, sinners), code: formationCode } : undefined,
    start: startIds ? { start: giftsOf(startIds.start), observe: giftsOf(startIds.observe) } : undefined,
    pack: pack ? { guidance: pack, gifts: giftsOf(planThemeGiftIds(state, themes, pack.theme.id)) } : null,
    gifts: { all: availableGifts, groups }, guide,
    owned: ownedIds, planned: wanted,
    badges: id => giftBadges(id, badgeRows),
  }
  const viewData: PipData = { giftMap, themes, events, eventChoices, skills }
  const viewActions: PipActions = {
    acquire: (id, event) => acquire(id, event),
    chooseTheme: themeId => {
      const chosen = themes.find(item => String(item.id) === themeId)
      if (!chooseTheme(themeId) || !chosen) return
      const owner = container?.ownerDocument
      owner?.defaultView?.requestAnimationFrame(() => owner.querySelector<HTMLElement>('[data-companion-content="pip"] [data-theme-title]')?.focus({ preventScroll: true }))
      toast.success(t('themeSelected', { name: localized(chosen) }))
    },
    undo, redo, canUndo, canRedo, nextFloor,
    size: { width: shownSize.width, height: shownSize.height, onChange: updateSize },
  }

  return <>
    <button type="button" data-pip-mode={container ? 'open' : pipSupported ? 'closed' : 'unsupported'} aria-pressed={!!container} disabled={!pipSupported}
      aria-describedby={pipSupported ? undefined : pipNoteId} title={pipSupported ? undefined : t('pipModeUnsupported')}
      onClick={() => { if (container) close(); else void open().catch(() => toast.error(t('pipUnavailable'))) }}
      className={`inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[var(--gold-light)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-[var(--text-muted)] ${container ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--bg-deep)] hover:brightness-110' : 'border-[var(--border-gold)] text-[var(--gold-light)] hover:bg-[var(--bg-elevated)]'}`}>
      <PictureInPicture2 size={16} aria-hidden="true" /><span className="max-sm:sr-only">{t(container ? 'pipModeClose' : 'pipModeButton')}</span>
    </button>
    {!pipSupported && <span id={pipNoteId} className="sr-only">{t('pipModeUnsupported')}</span>}
    {container && createPortal(<div className="min-h-full bg-[var(--bg-deep)] p-3 text-[var(--text-primary)]" style={{ scrollbarGutter: 'stable' }}><CompanionView view={view} data={viewData} actions={viewActions} width={actualSize.width} height={actualSize.height} /><CompanionAcquisitionOverlay events={acquisitionEvents} label={t('acquired')} consumedLabel={t('fusionConsumed')} /></div>, container)}
  </>
}
