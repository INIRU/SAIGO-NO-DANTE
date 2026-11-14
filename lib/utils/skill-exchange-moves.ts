// The skill replacements from one skill-count line to another. Shared: the Assist reads the shop window (features/assist),
// the planner's PiP lists the purchases (features/planner/components/CompanionSkillExchange), and a planner view must not
// pull the whole Assist entry just for this function.

/** Skill 1/2/3 copies of one identity in the run deck. */
export type SkillCounts = [number, number, number]

/** One kind of replacement the window offers (S1→S2, S2→S3 or S1→S3) and how many times to buy it. */
interface SkillExchangeMove { from: 1 | 2; to: 2 | 3; count: number }

/**
 * Replacements from the current counts to the plan's: each one turns a lower skill copy into a higher one, so a target
 * with more Skill 1 copies or fewer Skill 3 copies is unreachable (null). S1→S3 costs about the same as S1→S2 plus
 * S2→S3, so the direct swap is used as often as possible to need the fewest purchases.
 */
export function skillExchangeMoves(current: SkillCounts, target: SkillCounts): SkillExchangeMove[] | null {
  const fromSkill1 = current[0] - target[0]
  const toSkill3 = target[2] - current[2]
  if (fromSkill1 < 0 || toSkill3 < 0 || current[0] + current[1] + current[2] !== target[0] + target[1] + target[2]) return null
  const direct = Math.min(fromSkill1, toSkill3)
  return ([{ from: 1, to: 3, count: direct }, { from: 1, to: 2, count: fromSkill1 - direct }, { from: 2, to: 3, count: toSkill3 - direct }] as SkillExchangeMove[])
    .filter(move => move.count > 0)
}
