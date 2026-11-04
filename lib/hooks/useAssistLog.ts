'use client'

import { useEffect, useRef } from 'react'
import { plog } from '@/lib/vision/assist-log'
import type { useAssistCapture } from '@/lib/hooks/useAssistCapture'

type Capture = ReturnType<typeof useAssistCapture>

/**
 * What the screen reading reports, into the Assist's log (lib/vision/assist-log): the connection, the text reader's engine,
 * the scene, floors, and each acquisition, sale, fusion, formation and blessing read once. Both the run page and the
 * prescript terminal use it.
 */
export function useAssistLog(capture: Capture) {
  useEffect(() => { plog('capture', capture.status) }, [capture.status])
  useEffect(() => { if (capture.error) plog('capture-error', capture.error) }, [capture.error])
  useEffect(() => { plog('reader', { status: capture.ocrStatus, engine: capture.ocrEngine?.engine ?? null, loading: capture.ocrEngine?.loading ?? null }) },
    [capture.ocrStatus, capture.ocrEngine?.engine, capture.ocrEngine?.loading])
  const scene = capture.scene?.label ?? null
  useEffect(() => { if (scene) plog('scene', scene) }, [scene])
  useEffect(() => { if (capture.observedFloor) plog('floor-read', capture.observedFloor) }, [capture.observedFloor])
  useEffect(() => {
    if (capture.floorThemeObservation) plog('floor-theme', { floor: capture.floorThemeObservation.floor, themes: capture.floorThemeObservation.themeIds })
  }, [capture.floorThemeObservation])
  useEffect(() => { if (capture.formation) plog('formation', capture.formation.ids) }, [capture.formation])
  useEffect(() => { if (capture.blessings) plog('blessings', { levels: capture.blessings.levels.join(''), spent: capture.blessings.spent }) }, [capture.blessings])
  useEffect(() => { if (capture.clearBonus) plog('clear-bonus', { floor: capture.clearBonus.floor, cards: capture.clearBonus.cards }) }, [capture.clearBonus])
  // lists that grow: each item once, by its token
  const seen = useRef(new Set<string>())
  useEffect(() => {
    for (const item of capture.popupAcquisitions) if (!seen.current.has(`a:${item.token}`)) { seen.current.add(`a:${item.token}`); plog('acquired', { gift: item.giftId, floor: item.floor }) }
  }, [capture.popupAcquisitions])
  useEffect(() => {
    for (const item of capture.giftSales) if (!seen.current.has(`s:${item.token}`)) { seen.current.add(`s:${item.token}`); plog('sold', { gift: item.giftId }) }
  }, [capture.giftSales])
  useEffect(() => {
    for (const item of capture.fusionEvidence ?? []) if (!seen.current.has(`f:${item.token}`)) { seen.current.add(`f:${item.token}`); plog('fusion', { materials: item.materials }) }
  }, [capture.fusionEvidence])
}
