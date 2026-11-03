'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { applyEvent, createPrescriptRun, offer, receive, reroll as rerollRun, wanted, type PrescriptCard, type PrescriptContext,
  type PrescriptEvent, type PrescriptRun, type PrescriptScope } from '@/lib/fun/prescript'
import { fusionResultFollows } from '@/lib/vision/fusion-evidence'
import type { FloorThemeObservation, FusionEvidence, GiftSale, PopupAcquisition } from '@/lib/hooks/useAssistCapture'

/** The run's prescripts in this browser: a reload keeps them (the capture stopping on reload voids what was active). */
export const PRESCRIPT_STORAGE_KEY = 'md-prescript-run'

const load = (): PrescriptRun | null => {
  try {
    const value = JSON.parse(window.localStorage.getItem(PRESCRIPT_STORAGE_KEY) ?? 'null')
    return value && Array.isArray(value.prescripts) ? value as PrescriptRun : null
  } catch { return null }
}

const LEFT_SHOP = new Set(['exploration', 'battle', 'battle_setup', 'event', 'theme_select', 'loading', 'reward_choice'])

export interface PrescriptOffer { scope: PrescriptScope; floor: number; cards: PrescriptCard[] }

/**
 * Turns the Assist capture's evidence into prescript events: each acquisition popup, sale and confirmed floor once (by
 * its token), a popup that follows a fusion dialog as that fusion's result, and the capture leaving `running` as a break.
 * Offers a card choice whenever a kind wants one; the player only chooses, never marks a prescript done.
 */
export function usePrescript({ enabled, status, acquisitions, sales, fusions, floorObservation, scene, inShop, context }: {
  enabled: boolean
  status: string
  acquisitions: readonly PopupAcquisition[]
  sales: readonly GiftSale[]
  fusions: readonly FusionEvidence[] | null
  floorObservation: FloorThemeObservation | null
  /** The capture's stable scene label: leaving the shop's screens for the map, a battle or a room settles shop prescripts. */
  scene: string | null
  /** The shop shelf is on screen and read (a shop prescript may be offered). */
  inShop: boolean
  context: PrescriptContext
}) {
  const [run, setRun] = useState<PrescriptRun>(createPrescriptRun)
  const [offers, setOffers] = useState<PrescriptOffer[]>([])
  const loaded = useRef(false)
  useEffect(() => { const saved = load(); if (saved) setRun(saved); loaded.current = true }, [])
  useEffect(() => {
    if (!loaded.current) return
    try { window.localStorage.setItem(PRESCRIPT_STORAGE_KEY, JSON.stringify(run)) } catch { /* kept for this page only */ }
  }, [run])

  const contextRef = useRef(context)
  contextRef.current = context
  const apply = useCallback((event: PrescriptEvent) => setRun(current => applyEvent(current, event, contextRef.current)), [])

  // a break in the capture: what is in progress cannot be judged any more
  const running = useRef(false)
  useEffect(() => {
    if (!enabled) return
    if (status === 'running') running.current = true
    else if (running.current) { running.current = false; apply({ type: 'gap', at: Date.now(), reason: 'capture-stopped' }) }
  }, [enabled, status, apply])

  // The gifts held, counted from the same evidence (the prescript page keeps no run record of its own): an acquisition
  // adds, a sale takes one away, a fusion takes its dialog's materials
  const [owned, setOwned] = useState<string[]>([])
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
  useEffect(() => {
    if (enabled && floorObservation && once(`f:${floorObservation.token}`))
      apply({ type: 'floor', floor: floorObservation.floor, themeIds: floorObservation.themeIds, at: floorObservation.observedAt })
  }, [enabled, floorObservation, apply])

  // the shop's own screens (its windows, the sale and fusion panels, the acquired popup) are still the shop
  const wasInShop = useRef(false)
  useEffect(() => {
    if (!enabled || !scene) return
    if (inShop) wasInShop.current = true
    else if (wasInShop.current && LEFT_SHOP.has(scene)) { wasInShop.current = false; apply({ type: 'leave-shop', at: Date.now() }) }
  }, [enabled, scene, inShop, apply])

  // cards: one choice a kind, drawn once (a reroll draws again)
  const floor = context.floor
  useEffect(() => {
    if (!enabled || status !== 'running') return
    const want = wanted(run, floor, inShop).filter(scope => !offers.some(o => o.scope === scope && o.floor === floor))
    if (!want.length) return
    setOffers(current => [...current.filter(o => o.floor === floor),
      // kept even with no card, so a kind with nothing to offer is not drawn again every render
      ...want.map(scope => ({ scope, floor, cards: offer(scope, contextRef.current) }))])
  }, [enabled, status, run, floor, inShop, offers])

  const choose = useCallback((card: PrescriptCard) => {
    setRun(current => receive(current, card, contextRef.current.floor, Date.now()))
    setOffers(current => current.filter(o => o.scope !== card.scope))
  }, [])
  const reroll = useCallback((scope: PrescriptScope) => {
    const next = rerollRun(run)
    if (!next) return false
    setRun(next)
    setOffers(current => current.map(o => o.scope === scope ? { ...o, cards: offer(scope, contextRef.current) } : o))
    return true
  }, [run])
  // 거부: this floor's choice of that kind is put away without a prescript (no points, the streak is kept)
  const refuse = useCallback((scope: PrescriptScope) =>
    setOffers(current => current.map(o => o.scope === scope ? { ...o, cards: [] } : o)), [])
  const reset = useCallback(() => { setRun(createPrescriptRun()); setOffers([]); setOwned([]); seen.current.clear() }, [])

  return { run, owned, offers: offers.filter(o => o.cards.length), choose, reroll, refuse, reset }
}
