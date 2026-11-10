import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLongPress, LONG_PRESS_MS } from '@/lib/utils/long-press'

describe('createLongPress', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('fires after the game long click time and swallows the click that follows', () => {
    const fire = vi.fn()
    const press = createLongPress<string>(fire)
    press.start('gift')
    vi.advanceTimersByTime(LONG_PRESS_MS - 1)
    expect(fire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fire).toHaveBeenCalledWith('gift')
    expect(press.consume()).toBe(true)
    expect(press.consume()).toBe(false)
  })

  it('a short press or a cancelled press keeps the click', () => {
    const fire = vi.fn()
    const press = createLongPress<void>(fire)
    press.start()
    vi.advanceTimersByTime(300)
    press.cancel()
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(fire).not.toHaveBeenCalled()
    expect(press.consume()).toBe(false)
  })

  it('a new press clears the fired flag of the last one', () => {
    const press = createLongPress(() => undefined, 500)
    press.start()
    vi.advanceTimersByTime(500)
    press.start()
    press.cancel()
    expect(press.consume()).toBe(false)
  })
})
