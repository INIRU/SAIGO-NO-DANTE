import { expect, it } from 'vitest'
import { acquisitionSeq, acquisitionsToRelease, ACQUISITION_ORDER_WAIT_MS, continuesFusionDialog, fusionForResult, fusionMaterialsToRemove,
  returnedMaterials } from '@/features/assist/lib/fusion-evidence'
import { createInitialRunState, runReducer, type RunState } from '@/features/planner/lib/run-types'

// Rapid fusions ("우다다다") in capture time (ms): each dialog is up ~0.6 s, its result popup follows at once and a blessing
// returns material A in a second popup; the next dialog opens about a second later with the same 3/3.
const F1 = { token: 'f1', materials: ['A', 'B', 'C'], observedAt: 1_000, lastSeenAt: 1_600 }
const F2 = { token: 'f2', materials: ['A', 'E', 'F'], observedAt: 3_200, lastSeenAt: 3_800 }

it('starts a new dialog for the next fusion with the same N/M once its result or another screen was captured', () => {
  const dialog = { count: 3, capacity: 3, lastSeenAt: 1_600 }
  // Re-reads of the dialog itself continue it.
  expect(continuesFusionDialog(dialog, 3, 3, 2_000, 0)).toBe(true)
  // Its result popup was captured at 1 900: a dialog read at 3 200 is the next fusion, though within 2 s of the last sighting.
  expect(continuesFusionDialog({ ...dialog, resultAt: 1_900 }, 3, 3, 3_200, 0)).toBe(false)
  // The result popup was not confirmed yet, but a screen read at 2 400 showed the selection screen without the dialog.
  expect(continuesFusionDialog(dialog, 3, 3, 3_200, 2_400)).toBe(false)
  // A break read before the dialog was last seen does not split it.
  expect(continuesFusionDialog(dialog, 3, 3, 2_000, 1_200)).toBe(true)
  expect(continuesFusionDialog({ ...dialog, closedAt: 1_900 }, 3, 3, 2_000, 0)).toBe(false)
})

it('attributes each popup to the latest fusion confirmed before it in capture time, never reaching back to an older one', () => {
  // D1 read late, after F2 was already known: still F1's result.
  expect(fusionForResult([F1, F2], 1_900)).toBe(F1)
  expect(fusionForResult([F2, F1], 4_100)).toBe(F2)
  // A returned by F2 at 4 400 belongs to F2 (already applied by D2); F1, whose result was missed, must not claim it.
  expect(fusionForResult([F1, F2], 4_400)).toBe(F2)
  expect(fusionForResult([F1, F2], 800)).toBeNull()
})

it('numbers a material returned fusion after fusion as a new acquisition, but every frame of one popup as the same', () => {
  // A returned by F1 (popup episode 4, captured 2 300) and again by F2 (episode 7, captured 4 400): 2.1 s apart.
  const first = { at: 2_300, seq: 1, episode: 4 }
  expect(acquisitionSeq(first, 7, 4_400, [F1.observedAt, F2.observedAt])).toBe(2)
  // Even without the second dialog seen, D2's popup captured between them separates the two.
  expect(acquisitionSeq(first, 7, 4_400, [4_100])).toBe(2)
  // One popup split into two episodes with nothing between is one acquisition.
  expect(acquisitionSeq(first, 5, 2_700, [F1.observedAt])).toBe(1)
  // A late read of the same popup keeps its number however late it is confirmed or captured.
  expect(acquisitionSeq(first, 4, 9_000, [4_100])).toBe(1)
  expect(acquisitionSeq(first, 8, 7_400, [])).toBe(2)
  expect(acquisitionSeq(undefined, 4, 2_300, [])).toBe(1)
})

it('publishes acquisitions in capture order when a later popup is read first', () => {
  const returned = { giftId: 'A', observedAt: 10_000, episode: 4 }, next = { giftId: 'G', observedAt: 10_100, episode: 6 }
  // G (episode 6) is confirmed while A's popup (episode 4) is still being read: G waits.
  expect(acquisitionsToRelease([next], [4], 10_200)).toEqual({ release: [], keep: [next] })
  // Once A is confirmed both go out, A first.
  expect(acquisitionsToRelease([next, returned], [], 10_300).release).toEqual([returned, next])
  // Frames of G's own popup or later popups never hold it back, and a stuck earlier read holds it only briefly.
  expect(acquisitionsToRelease([next], [6, 7], 10_200).release).toEqual([next])
  expect(acquisitionsToRelease([next], [4], 10_100 + ACQUISITION_ORDER_WAIT_MS).release).toEqual([next])
})

it('returns only a removed material whose skipped popup follows that fusion', () => {
  const listed = [{ giftId: 'A', capturedAt: 2_300 }, { giftId: 'B', capturedAt: 500 }, { giftId: 'X', capturedAt: 2_400 }]
  expect(returnedMaterials(F1, ['A', 'B', 'C'], listed)).toEqual([listed[0]])
  expect(returnedMaterials(F1, ['B', 'C'], listed)).toEqual([])
})

/**
 * Applies the recognized steps like the companion panel: each popup, in the order given, fuses with the latest fusion
 * confirmed before it (once) or is acquired; a listed gift is remembered and re-added if that fusion removes it.
 */
function play(start: string[], fusions: typeof F1[], popups: { giftId: string; capturedAt: number }[]) {
  let state: RunState = { ...runReducer(createInitialRunState('hard'), { type: 'START_RUN' }) }
  state = { ...state, giftInventory: [...start] }
  const consumed = new Set<string>()
  let listed: typeof popups = []
  for (const popup of popups) {
    const fusion = fusionForResult(fusions, popup.capturedAt)
    if (fusion && !consumed.has(fusion.token)) {
      consumed.add(fusion.token)
      const materials = fusionMaterialsToRemove(fusion.materials, state.giftInventory, new Set())
      if (materials?.length) {
        state = runReducer(state, { type: 'CRAFT_FUSION', materialIds: materials, resultId: popup.giftId })
        const returned = returnedMaterials(fusion, materials, listed)
        listed = listed.filter(item => !returned.includes(item))
        for (const item of returned) if (!state.giftInventory.includes(item.giftId)) state = runReducer(state, { type: 'ACQUIRE_GIFT', giftId: item.giftId })
        continue
      }
    }
    if (state.giftInventory.includes(popup.giftId)) { listed.push(popup); continue }
    state = runReducer(state, { type: 'ACQUIRE_GIFT', giftId: popup.giftId })
  }
  return [...state.giftInventory].sort()
}

it('keeps a returned material across back-to-back fusions, whichever popup of a fusion is read first', () => {
  const D1 = { giftId: 'D', capturedAt: 1_900 }, A1 = { giftId: 'A', capturedAt: 2_300 }
  const G = { giftId: 'G', capturedAt: 4_100 }, A2 = { giftId: 'A', capturedAt: 4_400 }
  const expected = ['A', 'B2', 'D', 'G'].sort()
  // In capture order.
  expect(play(['A', 'B', 'C', 'E', 'F', 'B2'], [F1, F2], [D1, A1, G, A2])).toEqual(expected)
  // The returned material read before the fused result of the same fusion.
  expect(play(['A', 'B', 'C', 'E', 'F', 'B2'], [F1, F2], [A1, D1, A2, G])).toEqual(expected)
})
