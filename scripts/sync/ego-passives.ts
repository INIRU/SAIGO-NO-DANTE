/** Resolve the game's explicit passive unlock intervals; unknown rules are not guessed. */
export function passiveStageRange(requirements: string[]): { min_stage: number; max_stage: number } {
  let min_stage = 1, max_stage = 5
  for (const rule of requirements) {
    const between = /^CheckAwakenLevelBetween_(\d)_(\d)$/.exec(rule)
    const from = /^CheckAwakenLevel(\d)$/.exec(rule)
    if (between) { min_stage = Math.max(min_stage, Number(between[1])); max_stage = Math.min(max_stage, Number(between[2])) }
    else if (from) min_stage = Math.max(min_stage, Number(from[1]))
    else throw new Error(`Unknown EGO passive requirement: ${rule}`)
  }
  if (min_stage > max_stage) throw new Error('Empty passive stage interval')
  return { min_stage, max_stage }
}
