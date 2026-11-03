import type { PrescriptRun } from './prescript'

/**
 * The finished runs of this browser (my records): a run is kept only when the dungeon's end screen closed it with the
 * terminal on throughout (a break or a stop resets it, USER 2026-11-04). Newest first, at most HISTORY_LIMIT.
 */
export interface PrescriptRunSummary {
  endedAt: number
  /** Grace earned. */
  score: number
  done: number
  failed: number
  recalled: number
  /** The longest run of prescripts carried out without a violation between (recalled ones neither add nor break). */
  bestStreak: number
  /** The highest floor read in the run (0 when none was read). */
  floor: number
}

export const HISTORY_KEY = 'md-prescript-history'
export const HISTORY_LIMIT = 50

export function summarizeRun(run: PrescriptRun, floor: number, endedAt: number): PrescriptRunSummary {
  let streak = 0, bestStreak = 0
  for (const p of run.prescripts) {
    if (p.status === 'done') bestStreak = Math.max(bestStreak, ++streak)
    else if (p.status === 'failed') streak = 0
  }
  const count = (status: string) => run.prescripts.filter(p => p.status === status).length
  return { endedAt, score: run.score, done: count('done'), failed: count('failed'), recalled: count('void'), bestStreak, floor }
}

export function readHistory(text: string | null): PrescriptRunSummary[] {
  try {
    const value: unknown = JSON.parse(text ?? '[]')
    return Array.isArray(value) ? value.filter((row): row is PrescriptRunSummary => !!row && typeof row === 'object' &&
      typeof (row as PrescriptRunSummary).endedAt === 'number' && typeof (row as PrescriptRunSummary).score === 'number') : []
  } catch { return [] }
}

export function withRun(history: readonly PrescriptRunSummary[], summary: PrescriptRunSummary): PrescriptRunSummary[] {
  return [summary, ...history.filter(row => row.endedAt !== summary.endedAt)].slice(0, HISTORY_LIMIT)
}

/** The dashboard: totals over the kept runs. */
export function historyTotals(history: readonly PrescriptRunSummary[]) {
  const done = history.reduce((sum, row) => sum + row.done, 0), failed = history.reduce((sum, row) => sum + row.failed, 0)
  return {
    runs: history.length,
    grace: history.reduce((sum, row) => sum + row.score, 0),
    bestGrace: history.reduce((best, row) => Math.max(best, row.score), 0),
    bestStreak: history.reduce((best, row) => Math.max(best, row.bestStreak), 0),
    /** Carried out of judged (done or violated), 0–1; null before any was judged. */
    rate: done + failed ? done / (done + failed) : null,
  }
}
