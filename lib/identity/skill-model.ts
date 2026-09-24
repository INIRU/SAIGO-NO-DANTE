import type { Skill } from '@/lib/types'

type UptieRow = { uptie_level?: number | null }
const uptieOf = (row: UptieRow) => row.uptie_level ?? 3

/** Distinct uptie levels present in the rows (legacy rows without one are III), ascending. */
export function uptieLevels(...groups: UptieRow[][]): number[] {
  return [...new Set(groups.flat().map(uptieOf))].sort((a, b) => a - b)
}

/** Rows at the requested uptie; when missing, the nearest available level (ties: the lower one). */
export function selectUptieRows<T extends UptieRow>(rows: T[], level: number): T[] {
  const nearest = uptieLevels(rows).sort((a, b) => Math.abs(a - level) - Math.abs(b - level) || a - b)[0]
  return rows.filter(row => uptieOf(row) === nearest)
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

function baseSkillOrder(order: number) {
  return order >= 5 ? 3 : order
}

export function selectIdentitySkills(skills: Skill[], level: number): Skill[] {
  return selectUptieRows(skills, level).sort((a, b) => {
    const orderA = baseSkillOrder(a.skill_order)
    const orderB = baseSkillOrder(b.skill_order)
    return (orderA === 4 ? 99 : orderA) - (orderB === 4 ? 99 : orderB)
      || (a.variant_order ?? 0) - (b.variant_order ?? 0)
  })
}

export function buildSkillVariantMap(skills: Pick<Skill, 'id' | 'skill_order'>[]) {
  const groups = new Map<number, string[]>()
  for (const skill of skills) {
    const base = baseSkillOrder(skill.skill_order)
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
    const order = baseSkillOrder(skill.skill_order)
    const group = groups.get(order) ?? []
    group.push(skill)
    groups.set(order, group)
  }
  return [...groups.values()]
}
