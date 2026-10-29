import type { Skill } from '@/lib/types'

type UptieRow = { uptie_level?: number | null }
const uptieOf = (row: UptieRow) => row.uptie_level ?? 3

/** Distinct uptie levels present in the rows (legacy rows without one are III), ascending. */
export function uptieLevels(...groups: UptieRow[][]): number[] {
  return [...new Set(groups.flat().map(uptieOf))].sort((a, b) => a - b)
}

/**
 * The uptie (동기화) level whose rows show for `level`: the highest level present at or below it, else the lowest present.
 * The game lists a skill's data only at the levels where it changes (skillData[].gaksungLevel); a level in between inherits
 * the level below, and a level below the skill's first one has no such skill. So a missing level is never read from a
 * higher one (an earlier "nearest level" rule showed level IV data for III when only I and IV were stored).
 */
export function resolveUptieLevel(levels: readonly number[], level: number): number | null {
  if (levels.length === 0) return null
  const sorted = [...levels].sort((a, b) => a - b)
  return sorted.filter(item => item <= level).at(-1) ?? sorted[0]
}

export function selectUptieRows<T extends UptieRow>(rows: T[], level: number): T[] {
  const target = resolveUptieLevel(uptieLevels(rows), level)
  return target == null ? [] : rows.filter(row => uptieOf(row) === target)
}

/**
 * Payload trim: per group (identity), drop the top uptie level when its rows equal the level below
 * apart from `id`/`uptie_level`. selectUptieRows then resolves that level to the identical rows below.
 */
export function dropRepeatedTopUptie<T extends UptieRow & { id?: unknown }>(rows: T[], groupOf: (row: T) => unknown): T[] {
  const groups = new Map<unknown, T[]>()
  for (const row of rows) groups.set(groupOf(row), [...(groups.get(groupOf(row)) ?? []), row])
  const sig = (list: T[]) => JSON.stringify(list.map(({ id: _id, uptie_level: _level, ...rest }) => JSON.stringify(rest)).sort())
  const drop = new Set<T>()
  for (const list of groups.values()) {
    const levels = uptieLevels(list)
    if (levels.length < 2) continue
    const top = list.filter(row => uptieOf(row) === levels.at(-1))
    if (sig(top) === sig(list.filter(row => uptieOf(row) === levels.at(-2)))) top.forEach(row => drop.add(row))
  }
  return drop.size ? rows.filter(row => !drop.has(row)) : rows
}

const DEFENSE_SKILL_TYPES = new Set(['evade', 'defense', 'counter'])

/**
 * The slot of a skill, one rule for every screen. The game gives an identity attributeList (attack skills, each with its
 * skillTier 1-3 = S1-S3; extra entries are variants of that tier) and defenseSkillIDList (guard/evade/counter): the sync
 * stores skillTier as skill_order, so the slot is skill_order for 1-3. A defense skill (by type; a tiered counter keeps its
 * tier in skill_order) is slot 4. skill_order >= 5 only exists in rows of the old sync (S3 variants): kept as S3 until the
 * rows are re-synced.
 */
export function skillSlot(skill: { skill_order: number; skill_type?: string | null }): 1 | 2 | 3 | 4 {
  if ((skill.skill_type && DEFENSE_SKILL_TYPES.has(skill.skill_type)) || skill.skill_order === 4) return 4
  return skill.skill_order >= 5 ? 3 : (Math.min(Math.max(skill.skill_order, 1), 3) as 1 | 2 | 3)
}

/** "S2", "S3-2" (the second skill of slot 3 in list order) or the defense type name (with -n when several). */
export function skillLabel(skill: { id: string; skill_order: number; skill_type?: string | null }, group: readonly { id: string; skill_order: number; skill_type?: string | null }[], defenseName: string): string {
  const slot = skillSlot(skill)
  const same = group.filter(item => skillSlot(item) === slot)
  const idx = same.findIndex(item => item.id === skill.id) + 1
  const base = slot === 4 ? defenseName : `S${slot}`
  return same.length > 1 && idx > 0 ? `${base}-${idx}` : base
}

export function selectIdentitySkills(skills: Skill[], level: number): Skill[] {
  return selectUptieRows(skills, level).sort((a, b) => {
    const orderA = skillSlot(a)
    const orderB = skillSlot(b)
    return (orderA === 4 ? 99 : orderA) - (orderB === 4 ? 99 : orderB)
      || (a.variant_order ?? 0) - (b.variant_order ?? 0)
  })
}

export function buildSkillVariantMap(skills: { id: string; skill_order: number; skill_type?: string | null }[]) {
  const groups = new Map<number, string[]>()
  for (const skill of skills) {
    const base = skillSlot(skill)
    const ids = groups.get(base) ?? []
    ids.push(skill.id)
    groups.set(base, ids)
  }
  const variants: Record<string, { baseOrder: number; idx: number; total: number }> = {}
  for (const [baseOrder, ids] of groups) {
    ids.forEach((id, index) => { variants[id] = { baseOrder, idx: index + 1, total: ids.length } })
  }
  return variants
}

export function groupIdentitySkills(skills: Skill[]): Skill[][] {
  const groups = new Map<number, Skill[]>()
  for (const skill of skills) {
    const order = skillSlot(skill)
    const group = groups.get(order) ?? []
    group.push(skill)
    groups.set(order, group)
  }
  return [...groups.values()]
}
