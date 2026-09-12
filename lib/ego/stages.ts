import type { EGO, EGOSkill } from '@/lib/types'

export function egoStages(skills: EGOSkill[]): number[] {
  return [...new Set(skills.map(skill => skill.construeLevel))]
    .filter(level => Number.isInteger(level) && level >= 1 && level <= 5)
    .sort((a, b) => a - b)
}

export function egoSkillsAtStage(skills: EGOSkill[], level: number): EGOSkill[] {
  const groups = new Map<string, EGOSkill[]>()
  for (const skill of skills) {
    const key = String(skill.gameSkillId ?? skill.name)
    const group = groups.get(key) ?? []
    group.push(skill)
    groups.set(key, group)
  }
  return [...groups.values()].flatMap(group => {
    const eligible = group.filter(skill => skill.construeLevel <= level)
      .sort((a, b) => b.construeLevel - a.construeLevel)
    return eligible[0] ? [eligible[0]] : []
  })
}

export function egoPassiveAtStage(ego: EGO, stage: number) {
  if (!ego.stage_passives) return ego
  const current = ego.stage_passives.filter(passive => stage >= passive.min_stage && stage <= passive.max_stage)
  return {
    passive_name: current.map(p => p.name).join('\n\n'),
    passive_content: current.map(p => p.description).join('\n\n'),
    passive_name_en: current.map(p => p.name_en || p.name).join('\n\n'),
    passive_content_en: current.map(p => p.description_en || p.description).join('\n\n'),
    passive_name_jp: current.map(p => p.name_jp || p.name).join('\n\n'),
    passive_content_jp: current.map(p => p.description_jp || p.description).join('\n\n'),
  }
}
