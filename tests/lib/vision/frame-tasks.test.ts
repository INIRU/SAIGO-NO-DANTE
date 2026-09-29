import { describe, expect, it } from 'vitest'
import { OCR_READ_FAILURES, OCR_REBUILD_MS, ocrErrorAction, runFrameTask } from '@/lib/hooks/useAssistCapture'

// A hidden tab fires timers about once a second; frames from the captured track keep coming and drive the same work.
it('runs timer work from either caller at most once per interval, and not after its timer stops', () => {
  let runs = 0, live = true
  const task = { ms: 150, last: 0, work: () => { runs++ }, live: () => live }
  expect(runFrameTask(task, 1000)).toBe(true)
  expect(runFrameTask(task, 1100)).toBe(false)
  expect(runFrameTask(task, 1150)).toBe(true)
  live = false
  expect(runFrameTask(task, 5000)).toBe(false)
  expect(runs).toBe(2)
})

describe('OCR worker errors', () => {
  it('skips frames a worker could not read and retires the lane only after repeated failures', () => {
    const actions: string[] = []
    let failures = 0
    for (let read = 0; read < OCR_READ_FAILURES; read++) {
      const action = ocrErrorAction(failures)
      actions.push(action)
      if (action === 'skip') failures += 1
    }
    expect(actions).toEqual([...Array(OCR_READ_FAILURES - 1).fill('skip'), 'retire'])
    expect(OCR_REBUILD_MS.length).toBeGreaterThan(0)
  })
})
