import { expect, it } from 'vitest'
import { getFormationOverlay } from '@/components/decks/FormationBoard'
it('marks slots 1–6 selected, 7 onward backup, and leaves unformed identities unmarked', () => {
  expect(getFormationOverlay(null)).toBeUndefined()
  expect(getFormationOverlay(99)).toBeUndefined()
  expect(getFormationOverlay(-1)).toBeUndefined()
  expect(getFormationOverlay(0)).toMatchObject({ kind: 'selected', order: 1 })
  expect(getFormationOverlay(5)).toMatchObject({ kind: 'selected', order: 6 })
  expect(getFormationOverlay(6)).toMatchObject({ kind: 'backup', order: 7 })
  expect(getFormationOverlay(11)).toMatchObject({ kind: 'backup', order: 12 })
})
