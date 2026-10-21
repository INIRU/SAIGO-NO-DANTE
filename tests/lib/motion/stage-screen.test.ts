import { describe, expect, it, vi } from 'vitest'
import { openStage } from '@/hooks/useStageScreen'

const element = (fullscreen?: () => Promise<void>) => ({ requestFullscreen: fullscreen }) as unknown as HTMLElement

describe('REQ-MOTION-009 full screen and landscape', () => {
  it('REQ-MOTION-009 uses the browser full screen and the screen lock when both exist (Android)', async () => {
    const lock = vi.fn(async () => {})
    expect(await openStage(element(async () => {}), true, { orientation: { lock }, portrait: true })).toEqual({ full: true, native: true, turned: false })
    expect(lock).toHaveBeenCalledWith('landscape')
  })

  it('REQ-MOTION-009 covers the page and turns the stage a quarter where neither exists (iPhone)', async () => {
    expect(await openStage(element(), true, { portrait: true })).toEqual({ full: true, native: false, turned: true })
    expect(await openStage(element(), false, { portrait: true })).toEqual({ full: true, native: false, turned: false })
  })

  it('REQ-MOTION-009 turns the stage when the lock is refused, and never on a screen already held sideways', async () => {
    const refused = { lock: async () => { throw new Error('NotSupportedError') } }
    expect(await openStage(element(async () => {}), true, { orientation: refused, portrait: true })).toMatchObject({ native: true, turned: true })
    expect(await openStage(element(async () => { throw new Error('denied') }), true, { portrait: false })).toEqual({ full: true, native: false, turned: false })
  })
})
