type SourceRow = Record<string, any>

export function collectKeywordTags(value: unknown, tags = new Set<string>(), key = ''): Set<string> {
  if (typeof value === 'string') {
    if (key === 'buffKeyword' || key === 'skillKeywordList') tags.add(value)
    for (const match of value.matchAll(/\[([^\[\]]+)\]/g)) tags.add(match[1])
  } else if (Array.isArray(value)) value.forEach(item => collectKeywordTags(item, tags, key))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, item]) => collectKeywordTags(item, tags, k))
  return tags
}

/** Collect every supported stage and passive, including keywords absent from the summary list. */
export function collectEgoKeywordTags(
  ego: SourceRow,
  skills: Map<number, SourceRow>,
  passives: Map<number, SourceRow>,
  skillTexts: Map<string, unknown>,
  passiveTexts: Map<number, unknown>,
): Set<string> {
  const tags = new Set<string>()
  const visit = (value: unknown) => collectKeywordTags(value, tags)
  visit(ego)
  for (const id of [ego.awakeningSkillId, ego.corrosionSkillId].filter(Boolean)) {
    if (!skills.has(id)) throw new Error(`Missing EGO skill source: ${id}`)
    visit(skills.get(id))
    for (const [key, text] of skillTexts) if (key.startsWith(`${id}_`)) visit(text)
  }
  for (const id of new Set<number>([...(ego.passiveList ?? []), ...(ego.awakeningPassiveList ?? [])])) {
    if (!passives.has(id) || !passiveTexts.has(id)) throw new Error(`Missing EGO passive source: ${id}`)
    visit(passives.get(id))
    visit(passiveTexts.get(id))
  }
  return tags
}
