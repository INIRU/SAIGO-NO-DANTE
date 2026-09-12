export type RawEgoStage = {
  gaksungLevel: number
  attributeType?: string
  atkType?: string
  defaultValue?: number
  mpUsage?: number
  targetNum?: number
  skillLevelCorrection?: number
  coinList?: { operatorType: string; scale: number }[]
  [key: string]: unknown
}

/** Unity exports later stages as patches; missing fields inherit earlier values. */
export function resolveEgoStages(patches: RawEgoStage[]): RawEgoStage[] {
  if (!patches.some(patch => patch.gaksungLevel === 1)) throw new Error('EGO skill has no stage 1')
  const maximum = Math.max(...patches.map(patch => patch.gaksungLevel))
  if (maximum > 5 || maximum < 1) throw new Error('Unsupported EGO stage')
  const ordered = [...patches].sort((a, b) => a.gaksungLevel - b.gaksungLevel)
  const result: RawEgoStage[] = []
  let resolved: RawEgoStage = { gaksungLevel: 1 }
  for (let level = 1; level <= maximum; level++) {
    for (const patch of ordered.filter(patch => patch.gaksungLevel === level)) resolved = { ...resolved, ...patch }
    result.push({ ...resolved, gaksungLevel: level })
  }
  return result
}
