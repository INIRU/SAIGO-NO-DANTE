import { expect, it } from 'vitest'
import { runFrameTask } from '@/lib/hooks/useAssistCapture'

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
