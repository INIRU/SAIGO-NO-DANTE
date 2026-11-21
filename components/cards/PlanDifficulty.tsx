import type { Difficulty } from '@/lib/planner/types'
import { planDifficultyBadge, type PlanSummary } from '@/lib/planner/strip-plan-for-list'

/** A run's difficulty in the game's own words, the same in every language. */
export const DIFFICULTY_NAME: Record<Difficulty, string> = { normal: 'NORMAL', hard: 'HARD', overlap: 'INFINITY LOOP', extreme: 'EXTREME' }
/** One colour per difficulty: the theme pack window's floor list uses the same four. */
export const DIFFICULTY_COLOR: Record<Difficulty, string> = { normal: '#bfae92', hard: '#e89030', overlap: '#c09ae0', extreme: '#e06a5a' }

/**
 * A plan's difficulty as the game writes it: Bebas capitals in the difficulty's colour, no box. A plan whose first
 * floors switch between normal and hard reads NORMAL/HARD, each word in its own colour. One line of 1rem; a place that
 * wants another size sets it on `[data-plan-difficulty]`.
 */
export default function PlanDifficulty({ difficulty, summary, className = '' }: {
  difficulty: Difficulty
  summary: PlanSummary['difficulty_summary']
  className?: string
}) {
  const { labelKeys } = planDifficultyBadge(difficulty, summary)
  return (
    <span data-plan-difficulty className={`block font-[family-name:var(--font-title)] text-[1rem] leading-none tracking-[0.04em] ${className}`}>
      {labelKeys.map((key, index) => (
        <span key={key} style={{ color: DIFFICULTY_COLOR[key] }}>
          {index > 0 && <span className="text-[var(--text-muted)]">/</span>}
          {DIFFICULTY_NAME[key]}
        </span>
      ))}
    </span>
  )
}
