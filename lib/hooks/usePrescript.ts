'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyEvent, createPrescriptRun, penance, endPrescriptRun, eventPrescript, feasible, gradeOf, missOffer, offer, receive, resist, reroll as rerollRun, wanted, type PrescriptCard, type PrescriptContext, type PrescriptGrade,
  type PrescriptEvent, type PrescriptRun, type PrescriptScope } from '@/lib/fun/prescript'
import { fusionResultFollows } from '@/lib/vision/fusion-evidence'
import { EVENT_EXIT_SCENES } from '@/lib/vision/scene-state'
import { HISTORY_KEY, readHistory, summarizeRun, withRun } from '@/lib/fun/prescript-history'
import type { FloorThemeObservation, FusionEvidence, GiftSale, PopupAcquisition } from '@/lib/hooks/useAssistCapture'
import type { OwnedGridRead } from '@/lib/vision/owned-grid'
import type { FormationRead } from '@/lib/vision/formation-bar'

/** The last finished run's record in this browser. A run not yet ended is never kept: a reload or a break starts over
 * (USER 2026-11-04: turned off or cut before the dungeon ends, its score and record are reset). */
export const PRESCRIPT_STORAGE_KEY = 'md-prescript-run'

const load = (): PrescriptRun | null => {
  try {
    const value = JSON.parse(window.localStorage.getItem(PRESCRIPT_STORAGE_KEY) ?? 'null')
    return value && Array.isArray(value.prescripts) && value.ended ? value as PrescriptRun : null
  } catch { return null }
}

/** A new dungeon run begins on these screens: a closed record gives way to a fresh one. */
const RUN_START = new Set(['run_setup', 'start_gift'])

export const LEFT_SHOP: ReadonlySet<string> = new Set(['exploration', 'battle', 'battle_setup', 'event', 'theme_select', 'loading', 'reward_choice'])

/**
 * `issuedAt`: when the terminal put it up. `shownAt`: when it came to the front of the stage (offers come one at a time,
 * so one put up with another waits its turn); unanswered for the reply time from then, the terminal answers for the player.
 */
export interface PrescriptOffer { scope: PrescriptScope; floor: number; cards: PrescriptCard[]; issuedAt: number; shownAt?: number }

/**
 * Turns the Assist capture's evidence into prescript events: each acquisition popup, sale and confirmed floor once (by
 * its token), a popup that follows a fusion dialog as that fusion's result, and the capture leaving `running` as a break.
 * Offers a card choice whenever a kind wants one; the player only chooses, never marks a prescript done.
 */
export function usePrescript({ enabled, grade = 'proselyte', status, acquisitions, sales, fusions, floorObservation, ownedGrid, eventRoom, eventOutcome, eventPick, formation, scene, inShop, context }: {
  enabled: boolean
  /** The grade a new run starts at (a run keeps the grade it began with). */
  grade?: PrescriptGrade
  status: string
  acquisitions: readonly PopupAcquisition[]
  sales: readonly GiftSale[]
  fusions: readonly FusionEvidence[] | null
  floorObservation: FloorThemeObservation | null
  /** The sell window's owned list as read: gifts held before the terminal was connected are learned from it. */
  ownedGrid?: OwnedGridRead | null
  /** A ? room's choice screen on screen: the event and the options anyone may take (a mandatory prescript names one). */
  eventRoom?: { eventId: number; options: number[] } | null
  /** A ? room's result page: the option taken. */
  // the room's option read from the screen after it (its result text or the next stage)
  eventOutcome?: { eventId: number; option: number; at: number } | null
  // the option the cursor clicked (or last rested on) when the choice list went
  eventPick?: { eventId: number; option: number; at: number } | null
  /** The formation read from the shop's bar. */
  formation?: FormationRead | null
  /** The capture's stable scene label: leaving the shop's screens for the map, a battle or a room settles shop prescripts. */
  scene: string | null
  /** The shop shelf is on screen and read (a shop prescript may be offered). */
  inShop: boolean
  context: PrescriptContext
}) {
  // read once when first drawn (the page renders in the browser only): a load in an effect lost the run to the first save
  const [run, setRun] = useState<PrescriptRun>(() => load() ?? createPrescriptRun(grade))
  const [offers, setOffers] = useState<PrescriptOffer[]>([])
  useEffect(() => {
    try { window.localStorage.setItem(PRESCRIPT_STORAGE_KEY, JSON.stringify(run)) } catch { /* kept for this page only */ }
  }, [run])
  // The gifts held, counted from the same evidence (the prescript page keeps no run record of its own): an acquisition
  // adds, a sale takes one away, a fusion takes its dialog's materials
  const [owned, setOwned] = useState<string[]>([])

  const contextRef = useRef(context)
  contextRef.current = context
  const apply = useCallback((event: PrescriptEvent) => setRun(current => current.ended ? current : applyEvent(current, event, contextRef.current)), [])
  const gradeRef = useRef(grade)
  gradeRef.current = grade
  const restart = useCallback(() => { setRun(createPrescriptRun(gradeRef.current)); setOffers([]); setOwned([]); issuedEvents.current.clear(); activeEvent.current = null }, [])

  // a break in the capture before the dungeon ends: the run's score and record are gone, the next one starts from nothing
  const running = useRef(false)
  useEffect(() => {
    if (!enabled) return
    if (status === 'running') running.current = true
    else if (running.current) {
      running.current = false
      setRun(current => current.ended ? current : createPrescriptRun(gradeRef.current))
      setOffers([])
      setOwned([])
    }
  }, [enabled, status])

  // a closed run goes into my records once (its end time is its key, so a reload does not add it again)
  useEffect(() => {
    if (!run.ended || !run.endedAt) return
    try {
      const history = readHistory(window.localStorage.getItem(HISTORY_KEY))
      if (!history.some(row => row.endedAt === run.endedAt))
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(withRun(history, summarizeRun(run, contextRef.current.floor, run.endedAt))))
    } catch { /* kept on screen only */ }
  }, [run])

  // the dungeon's end screen closes the record; the next run's first screens open a new one
  useEffect(() => {
    if (!enabled || !scene) return
    if (scene === 'run_end') { setRun(current => current.ended ? current : endPrescriptRun(current, Date.now())); setOffers([]) }
    else if (RUN_START.has(scene) && run.ended) restart()
  }, [enabled, scene, run.ended, restart])
  const without = (list: string[], ids: readonly string[]) => { const rest = [...list]; for (const id of ids) { const at = rest.indexOf(id); if (at >= 0) rest.splice(at, 1) } return rest }
  const seen = useRef(new Set<string>())
  const once = (token: string) => !seen.current.has(token) && !!seen.current.add(token)
  useEffect(() => {
    if (!enabled) return
    for (const item of acquisitions) {
      if (!once(`a:${item.token}`)) continue
      const giftId = Number(item.giftId), at = item.capturedAt ?? item.observedAt
      if (!Number.isInteger(giftId)) continue
      apply({ type: 'acquire', giftId, at })
      const fusion = (fusions ?? []).find(evidence => fusionResultFollows(evidence, item.capturedAt))
      if (fusion) apply({ type: 'fusion', resultId: giftId, at })
      setOwned(list => [...without(list, fusion?.materials ?? []), String(giftId)])
    }
  }, [enabled, acquisitions, fusions, apply])
  useEffect(() => {
    if (!enabled) return
    for (const sale of sales) {
      const giftId = Number(sale.giftId)
      if (once(`s:${sale.token}`) && Number.isInteger(giftId)) { apply({ type: 'sale', giftId, at: sale.capturedAt }); setOwned(list => without(list, [String(giftId)])) }
    }
  }, [enabled, sales, apply])
  // what the owned list shows is held, whenever it came: a run joined midway learns its gifts here (a sale still takes one away)
  useEffect(() => {
    if (!enabled || !ownedGrid?.gifts.length) return
    setOwned(list => { const missing = ownedGrid.gifts.filter(id => !list.includes(id)); return missing.length ? [...list, ...missing] : list })
  }, [enabled, ownedGrid])
  useEffect(() => {
    if (enabled && floorObservation && once(`f:${floorObservation.token}`))
      apply({ type: 'floor', floor: floorObservation.floor, themeIds: floorObservation.themeIds, at: floorObservation.observedAt })
  }, [enabled, floorObservation, apply])

  // A ? room: on its choice screen the terminal gives a mandatory prescript at once (no choice, no refusal), one a room;
  // the result page judges it, leaving without one read recalls it
  // one a room visit: the same event on a later floor is another room (keyed by floor and event)
  const issuedEvents = useRef(new Set<string>())
  const activeEvent = useRef<number | null>(null)
  const roomId = eventRoom?.eventId ?? null
  useEffect(() => {
    const visit = `${contextRef.current.floor}:${roomId}`
    if (!enabled || status !== 'running' || run.ended || roomId === null || issuedEvents.current.has(visit)) return
    issuedEvents.current.add(visit)
    const card = eventPrescript(roomId, eventRoom?.options ?? [], Math.random)
    if (!card) return
    activeEvent.current = roomId
    setRun(current => receive(current, card, contextRef.current.floor, Date.now()))
  }, [enabled, status, run.ended, roomId, eventRoom?.options])
  // a violation answered at once with a penance (forced, heavier, this floor)
  const lastViolation = run.prescripts.filter(p => p.status === 'failed' && !p.penance).at(-1)?.settledAt ?? 0
  useEffect(() => {
    if (!enabled || status !== 'running' || !lastViolation || lastViolation <= (run.penanceAt ?? 0)) return
    setRun(current => penance(current, contextRef.current, Date.now()))
  }, [enabled, status, lastViolation, run.penanceAt])
  useEffect(() => {
    if (enabled && formation) apply({ type: 'formation', ids: formation.ids, at: formation.observedAt })
  }, [enabled, formation, apply])
  // The screen after the room decides; the cursor's pick only when nothing after it was read. Both read and different:
  // recalled (a misjudged room costs more than a missed one)
  const picks = useRef(new Map<number, number>())
  useEffect(() => {
    if (enabled && eventPick) picks.current.set(eventPick.eventId, eventPick.option)
  }, [enabled, eventPick])
  useEffect(() => {
    if (!enabled || !eventOutcome) return
    const picked = picks.current.get(eventOutcome.eventId)
    apply({ type: 'event-outcome', eventId: eventOutcome.eventId, option: eventOutcome.option, at: eventOutcome.at,
      conflict: picked !== undefined && picked !== eventOutcome.option })
  }, [enabled, eventOutcome, apply])
  useEffect(() => {
    if (!enabled || !scene || activeEvent.current === null || !EVENT_EXIT_SCENES.has(scene)) return
    const eventId = activeEvent.current, picked = picks.current.get(eventId), at = Date.now()
    apply(picked === undefined ? { type: 'leave-event', eventId, at } : { type: 'event-outcome', eventId, option: picked, at })
    activeEvent.current = null
  }, [enabled, scene, apply])

  // the shop's own screens (its windows, the sale and fusion panels, the acquired popup) are still the shop
  const wasInShop = useRef(false)
  useEffect(() => {
    if (!enabled || !scene) return
    if (inShop) wasInShop.current = true
    else if (wasInShop.current && LEFT_SHOP.has(scene)) {
      wasInShop.current = false
      const at = Date.now()
      // a shop offer still unanswered when the shop is left was let pass: a violation
      const unanswered = offersRef.current.find(o => o.scope === 'shop' && o.cards.length)
      if (unanswered) setRun(current => missOffer(current, 'shop', unanswered.floor, at))
      setOffers(current => current.filter(o => o.scope !== 'shop'))
      apply({ type: 'leave-shop', at })
    }
  }, [enabled, scene, inShop, apply])

  // cards: one choice a kind, drawn once (a reroll draws again), no weaker than the player's refusals allow
  const floor = context.floor
  const offersRef = useRef(offers)
  offersRef.current = offers
  // the shop visit, not only its shelf screen: fusing, selling and the acquired popup happen in the shop (the shelf is hidden
  // then), so its prescripts stay open until a screen outside the shop comes
  const inVisit = inShop || wasInShop.current
  const inShopRef = useRef(inVisit)
  inShopRef.current = inVisit
  useEffect(() => {
    if (!enabled || status !== 'running' || run.ended) return
    // a floor's special and shop offers end with it; one still unanswered was let pass (a standing offer carries on)
    const passed = offers.filter(o => o.scope !== 'standing' && o.floor !== floor)
    const want = wanted(run, floor, inVisit).filter(scope => !offers.some(o => o.scope === scope && (o.scope === 'standing' || o.floor === floor)))
    if (!want.length && !passed.length) return
    const at = Date.now()
    for (const o of passed) if (o.cards.length) setRun(current => missOffer(current, o.scope, o.floor, at))
    setOffers(current => [...current.filter(o => o.scope === 'standing' || o.floor === floor),
      // kept even with no card, so a kind with nothing to offer is not drawn again every render
      ...want.map(scope => ({ scope, floor, issuedAt: at, cards: offer(scope, contextRef.current, 3, 1 + (run.resisted ?? 0)) }))])
  }, [enabled, status, run, floor, inVisit, offers])

  const canChoose = useCallback((card: PrescriptCard) => feasible(card, contextRef.current, inShopRef.current), [])
  const choose = useCallback((card: PrescriptCard) => {
    // checked again now: the offer may have waited past the card's occasion
    if (!feasible(card, contextRef.current, inShopRef.current)) return false
    setRun(current => receive(current, card, contextRef.current.floor, Date.now()))
    setOffers(current => current.filter(o => o.scope !== card.scope))
    return true
  }, [])
  // unanswered for PRESCRIPT_REPLY_MS: the terminal chooses one of the cards still possible (waiting buys nothing)
  useEffect(() => {
    if (!enabled || status !== 'running') return
    const timer = window.setInterval(() => {
      const now = Date.now()
      for (const o of offersRef.current) {
        if (!o.cards.length || o.shownAt === undefined || now - o.shownAt < gradeOf(runRef.current).replyMs) continue
        const open = o.cards.filter(card => feasible(card, contextRef.current, inShopRef.current))
        if (open.length) choose(open[Math.floor(Math.random() * open.length)])
        else setOffers(current => current.map(item => item === o ? { ...item, cards: [] } : item))
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [enabled, status, choose])
  const runRef = useRef(run)
  runRef.current = run
  const reroll = useCallback((scope: PrescriptScope) => {
    const next = rerollRun(run)
    if (!next) return false
    setRun(next)
    setOffers(current => current.map(o => o.scope === scope ? { ...o, issuedAt: Date.now(), shownAt: Date.now(), cards: offer(scope, contextRef.current, 3, 1 + (run.resisted ?? 0)) } : o))
    return true
  }, [run])
  // 거부: no prescript this time, but the terminal answers resistance with heavier ones from then on
  const refuse = useCallback((scope: PrescriptScope) => {
    if (!gradeOf(runRef.current).refuse) return
    setRun(current => resist(current))
    setOffers(current => current.map(o => o.scope === scope ? { ...o, cards: [] } : o))
  }, [])
  const reset = useCallback(() => { restart(); seen.current.clear() }, [restart])

  // a pack card for a floor already picked is no choice any more
  const open = offers.map(o => ({ ...o, cards: o.cards.filter(c => c.goal.kind !== 'pick-theme' || c.goal.floor > floor) }))
  // the reply time runs from when an offer comes to the front, not from when it was put up behind another
  const front = open.find(o => o.cards.length)
  const frontKey = front ? `${front.scope}:${front.floor}:${front.issuedAt}` : ''
  useEffect(() => {
    if (!frontKey) return
    setOffers(current => current.map(o => `${o.scope}:${o.floor}:${o.issuedAt}` === frontKey && o.shownAt === undefined ? { ...o, shownAt: Date.now() } : o))
  }, [frontKey])
  return { run, owned, offers: open.filter(o => o.cards.length), choose, canChoose, reroll, refuse, reset }
}
