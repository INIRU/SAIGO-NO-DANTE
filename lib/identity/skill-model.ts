import type { Skill } from '@/lib/types'

export function selectUptieRows<T extends { uptie_level?: number | null }>(rows: T[], level: 3 | 4): T[] {
  const selected = rows.filter(row => (row.uptie_level ?? 3) === level)
  return selected.length ? selected : rows.filter(row => (row.uptie_level ?? 3) === 3)
}

function baseSkillOrder(order: number) {
  return order >= 5 ? 3 : order
}

export function selectIdentitySkills(skills: Skill[], level: 3 | 4): Skill[] {
  return selectUptieRows(skills, level).sort((a, b) => {
    const orderA = baseSkillOrder(a.skill_order)
    const orderB = baseSkillOrder(b.skill_order)
    return (orderA === 4 ? 99 : orderA) - (orderB === 4 ? 99 : orderB)
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
