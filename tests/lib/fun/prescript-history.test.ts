import { describe, expect, it } from 'vitest'
import { createPrescriptRun, type Prescript } from '../../../lib/fun/prescript'
import { historyTotals, readHistory, summarizeRun, withRun } from '../../../lib/fun/prescript-history'

const p = (status: Prescript['status']): Prescript => ({ scope: 'standing', goal: { kind: 'no-sale' }, strength: 1, id: 0, floor: 1, receivedAt: 0, status, progress: 0 })

describe('my records', () => {
  it('sums a finished run: the longest streak skips recalled ones and breaks on a violation', () => {
    const run = { ...createPrescriptRun(), score: 70, prescripts: ['done', 'void', 'done', 'failed', 'done', 'done', 'done'].map(s => p(s as Prescript['status'])) }
    expect(summarizeRun(run, 9, 5)).toEqual({ endedAt: 5, score: 70, done: 5, failed: 1, recalled: 1, bestStreak: 3, floor: 9 })
  })

  it('keeps the newest first, reads only well-formed rows and totals them', () => {
    const a = { endedAt: 1, score: 10, done: 1, failed: 1, recalled: 0, bestStreak: 1, floor: 5 }
    const b = { endedAt: 2, score: 30, done: 3, failed: 0, recalled: 1, bestStreak: 3, floor: 10 }
    const history = withRun(withRun([], a), b)
    expect(history.map(row => row.endedAt)).toEqual([2, 1])
    expect(readHistory(JSON.stringify([...history, { bad: true }]))).toHaveLength(2)
    expect(readHistory('{oops')).toEqual([])
    expect(historyTotals(history)).toEqual({ runs: 2, grace: 40, bestGrace: 30, bestStreak: 3, rate: 0.8 })
  })
})
