/** Name and description of a game row in the page language, falling back through the other languages. */
function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function localizeIdentityName(
  identity: { name_en?: string | null; name_jp?: string | null; name_kr?: string | null; name?: string | null; id?: string | null },
  locale: string,
): string {
  if (locale === 'en') return present(identity.name_en) ?? present(identity.name_jp) ?? present(identity.name_kr) ?? present(identity.name) ?? identity.id ?? ''
  if (locale === 'ja') return present(identity.name_jp) ?? present(identity.name_en) ?? present(identity.name_kr) ?? present(identity.name) ?? identity.id ?? ''
  return present(identity.name_kr) ?? present(identity.name) ?? present(identity.name_en) ?? present(identity.name_jp) ?? identity.id ?? ''
}

export function localizeSkillName(
  skill: { name: string; name_en?: string | null; name_jp?: string | null },
  locale: string,
): string {
  if (locale === 'en') return present(skill.name_en) ?? present(skill.name_jp) ?? skill.name
  if (locale === 'ja') return present(skill.name_jp) ?? present(skill.name_en) ?? skill.name
  return skill.name
}

export function localizeSkillDescription(
  skill: { description?: string | null; description_en?: string | null; description_jp?: string | null },
  locale: string,
): string | null {
  if (locale === 'en') return present(skill.description_en) ?? present(skill.description_jp) ?? present(skill.description)
  if (locale === 'ja') return present(skill.description_jp) ?? present(skill.description_en) ?? present(skill.description)
  return present(skill.description)
}

export function localizePassiveName(
  passive: { name: string; name_en?: string | null; name_jp?: string | null },
  locale: string,
): string {
  if (locale === 'en') return present(passive.name_en) ?? present(passive.name_jp) ?? passive.name
  if (locale === 'ja') return present(passive.name_jp) ?? present(passive.name_en) ?? passive.name
  return passive.name
}

export function localizePassiveDescription(
  passive: { description?: string | null; description_en?: string | null; description_jp?: string | null },
  locale: string,
): string | null {
  if (locale === 'en') return present(passive.description_en) ?? present(passive.description_jp) ?? present(passive.description)
  if (locale === 'ja') return present(passive.description_jp) ?? present(passive.description_en) ?? present(passive.description)
  return present(passive.description)
}

export function localizeEgoName(
  ego: { name_en?: string | null; name_jp?: string | null; name_kr?: string | null; name?: string | null; id?: string | null },
  locale: string,
): string {
  if (locale === 'en') return present(ego.name_en) ?? present(ego.name_jp) ?? present(ego.name_kr) ?? present(ego.name) ?? ego.id ?? ''
  if (locale === 'ja') return present(ego.name_jp) ?? present(ego.name_en) ?? present(ego.name_kr) ?? present(ego.name) ?? ego.id ?? ''
  return present(ego.name_kr) ?? present(ego.name) ?? present(ego.name_en) ?? present(ego.name_jp) ?? ego.id ?? ''
}
