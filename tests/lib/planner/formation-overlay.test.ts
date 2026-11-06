import { expect, it } from 'vitest'
import { getFormationOverlay } from '@/features/catalog/components/IdentityFrameCard'
it('marks slots 1–7 selected, 8–12 backup, and leaves unformed identities unmarked', () => {
  expect(getFormationOverlay(null)).toBeUndefined()
  expect(getFormationOverlay(99)).toBeUndefined()
  expect(getFormationOverlay(-1)).toBeUndefined()
  for (let order = 1; order <= 12; order++) {
    expect(getFormationOverlay(order - 1)).toMatchObject({
      kind: order <= 7 ? 'selected' : 'backup', order,
    })
  }
})
