import type { SupabaseClient } from '@supabase/supabase-js'

export type EgoAttackSkill = {
  skill_type: string | null
  category: string | null
  construe_level: number | null
  skill_order: number | null
}

/** The attack skills of the given E.G.O, by ego id. A read error throws, so no caller can cache an empty result as if it were real. */
export async function fetchEgoAttackSkillsByEgoId(supabase: SupabaseClient, egoIds: string[]): Promise<Map<string, EgoAttackSkill[]>> {
  const skillsByEgoId = new Map<string, EgoAttackSkill[]>()
  if (egoIds.length === 0) return skillsByEgoId

  const { data, error } = await supabase
    .schema('limbus')
    .from('ego_skills')
    .select('ego_id, skill_type, category, construe_level, skill_order')
    .in('ego_id', egoIds)
  if (error) throw error

  for (const row of data ?? []) {
    if (typeof row.ego_id !== 'string') continue
    const skills = skillsByEgoId.get(row.ego_id) ?? []
    skills.push({
      skill_type: row.skill_type ?? null,
      category: row.category ?? null,
      construe_level: row.construe_level ?? null,
      skill_order: row.skill_order ?? null,
    })
    skillsByEgoId.set(row.ego_id, skills)
  }
  return skillsByEgoId
}
