import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../../..')
const hook = readFileSync(resolve(root, 'features/assist/hooks/useAssistCapture.ts'), 'utf8')

/** The body of `const resetReadings = useCallback(() => { ... }, [])`. */
function resetBody() {
  const start = hook.indexOf('const resetReadings = useCallback(')
  expect(start, 'resetReadings is defined').toBeGreaterThan(-1)
  const end = hook.indexOf('}, [])', start)
  return hook.slice(start, end)
}

describe('REQ-ASSIST-084 resetReadings', () => {
  it('REQ-ASSIST-084 clears blessings, clear bonus, popup acquisitions and their refs in one place', () => {
    const body = resetBody()
    for (const part of ['setBlessings(null)', 'lastBlessingRead.current = \'\'', 'blessingRequest.current = null',
      'setClearBonus(null)', 'lastBonusRead.current = \'\'', 'bonusRequest.current = null', 'bonusNames.current = null', 'selectionHeader.current = null',
      'setPopupAcquisitions([])', 'setPrediction(null)', 'setVisualCandidates(null)', 'setOcrCandidates(null)', "setOcrStatus('idle')",
      'setFloorThemeObservation(null)', 'setQueueStatus(IDLE_QUEUE)', 'setInference(null)', 'setOcrEngine(null)', 'setOcrWorkers(0)',
      'setFusionEvidence([])', 'setShopShelf(null)', 'setOwnedGrid(null)', 'setFormation(null)', 'setEventPick(null)', 'pickState.current = EMPTY_PICK',
      'cursorSamples.current = []', 'setGiftSales([])', 'setSkillExchange(null)', 'saleState.current = EMPTY_SALE_STATE', 'setObservedFloor(null)',
      'setScene(null)', 'setThemeSelectionFloor(null)']) expect(body, part).toContain(part)
  })

  it('REQ-ASSIST-084 stop, start and both error paths call it instead of listing the resets again', () => {
    expect(hook.match(/resetReadings\(\)/g)?.length).toBe(4)
    // the reset list exists once: in resetReadings
    expect(hook.match(/setThemeSelectionFloor\(null\)/g)?.length).toBe(1)
    expect(hook.match(/setBlessings\(null\)/g)?.length).toBe(1)
  })
})
