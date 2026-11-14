import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryLine, startMemoryLog } from '@/lib/server/memory-log'

const MB = 1024 * 1024

describe('server memory log', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('writes the JS heap apart from the process total and the memory outside the heap, in MB', () => {
    expect(memoryLine({ rss: 900 * MB, heapTotal: 700 * MB, heapUsed: 612.4 * MB, external: 80 * MB, arrayBuffers: 40.6 * MB }))
      .toBe('[memory] heapUsed=612MB heapTotal=700MB rss=900MB external=80MB arrayBuffers=41MB')
  })

  it('logs one line every interval and does not keep the process alive', () => {
    vi.useFakeTimers()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const timer = startMemoryLog(1000)
    vi.advanceTimersByTime(3000)
    expect(log).toHaveBeenCalledTimes(3)
    expect(log.mock.calls[0][0]).toMatch(/^\[memory\] heapUsed=\d+MB/)
    expect(timer.hasRef()).toBe(false)
    clearInterval(timer)
  })
})
