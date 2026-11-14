import { afterEach, describe, expect, it, vi } from 'vitest'
import { drawMeter, uploadAsked } from '@/features/motion/lib/tuning'

const at = (search: string) => vi.stubGlobal('window', { location: { search } })
afterEach(() => vi.unstubAllGlobals())

describe('the way a frame goes to the GPU is picked in the address', () => {
  it.each([
    ['', false, false], ['?tex=rgba', false, false], ['?tex=r8', true, false], ['?tex=sub', false, true], ['?tex=r8sub', true, true],
  ])('reads "%s" as grey %s, kept storage %s', (search, grey, reuse) => {
    at(search)
    expect(uploadAsked()).toEqual({ grey, reuse })
  })

  it('shows no meter unless the address asks for it', () => {
    at('')
    expect(drawMeter({} as HTMLVideoElement, () => '')).toBeNull()
  })
})
