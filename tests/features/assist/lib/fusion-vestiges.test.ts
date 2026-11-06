import { expect, it } from 'vitest'
import { fusionMaterials, FUSION_VESTIGE_ID, vestigeGroup } from '@/features/assist/lib/fusion-evidence'
import { heldSlotRead, mergeRankedGroups } from '@/features/assist/lib/icon-match'

it('REQ-ASSIST-043 reads the five look-alike vestiges as one material, measured against the other icons', () => {
  // 2026-09-26 samples: a vestige bottle led the next vestige by 0.04–0.07, so no vestige ever passed.
  const ranked = [{ id: '9993', score: 0.9 }, { id: '9992', score: 0.86 }, { id: '9994', score: 0.84 }, { id: '9101', score: 0.55 }]
  const merged = mergeRankedGroups(ranked, vestigeGroup)
  expect(merged).toEqual([{ id: FUSION_VESTIGE_ID, score: 0.9 }, { id: '9101', score: 0.55 }])
  expect(heldSlotRead(merged, merged)).toMatchObject({ id: FUSION_VESTIGE_ID, score: 0.9 })
  expect(heldSlotRead(merged, merged)!.margin).toBeCloseTo(0.35)
  // Other icons keep their own identity.
  expect(mergeRankedGroups([{ id: '9101', score: 0.8 }, { id: '9102', score: 0.7 }], vestigeGroup).map(item => item.id)).toEqual(['9101', '9102'])
})

it('REQ-ASSIST-043 keeps a dialog with two or three vestiges, which a player can hold at once', () => {
  const vestige = { id: FUSION_VESTIGE_ID, score: 0.9, margin: 0.35 }
  const dialog = (at: number) => ({ view: 'dialog' as const, observedAt: at, slots: [vestige, vestige, { id: '9101', score: 0.9, margin: 0.4 }] })
  expect(fusionMaterials([dialog(0)], 3, 5).sort()).toEqual([FUSION_VESTIGE_ID, FUSION_VESTIGE_ID, '9101'].sort())
  // Any other gift read in two slots is still a misread and drops that read.
  const twice = { view: 'dialog' as const, observedAt: 0, slots: [{ id: '9101', score: 0.9, margin: 0.4 }, { id: '9101', score: 0.9, margin: 0.4 }] }
  expect(fusionMaterials([twice], 2, 3)).toEqual([])
})
