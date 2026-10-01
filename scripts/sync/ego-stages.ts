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

export type EgoSkillSlot = { category: 'awakening' | 'corrosion'; skillId: number; skillOrder: number }

/**
 * The skills of an EGO in display order: the awakening skill (1), the corrosion (2), then the further skills of
 * `additionalList` it can switch to (20211 구멍's 2021112 부셰), 3 onwards. An additional entry repeats the main corrosion,
 * so only skill ids not seen yet are added; the second-to-last digit of an EGO skill id is 1 for awakening, 2 for corrosion.
 */
export function egoSkillSlots(definition: { awakeningSkillId?: number | null; corrosionSkillId?: number | null; additionalList?: unknown }): EgoSkillSlot[] {
  const slots: EgoSkillSlot[] = []
  const seen = new Set<number>()
  const add = (skillId: unknown, category: EgoSkillSlot['category'] | null, skillOrder: number) => {
    if (!Number.isInteger(skillId) || seen.has(skillId as number)) return false
    seen.add(skillId as number)
    slots.push({ category: category ?? (String(skillId).at(-2) === '2' ? 'corrosion' : 'awakening'), skillId: skillId as number, skillOrder })
    return true
  }
  add(definition.awakeningSkillId, 'awakening', 1)
  add(definition.corrosionSkillId, 'corrosion', 2)
  const levels = Array.isArray(definition.additionalList) ? definition.additionalList as { additionalList?: { awakeningSkillId?: unknown; corrosionSkillId?: unknown }[] }[] : []
  let next = 3
  for (const entry of levels.flatMap(level => level.additionalList ?? [])) {
    for (const skillId of [entry.awakeningSkillId, entry.corrosionSkillId]) if (add(skillId, null, next)) next++
  }
  return slots
}
