type Row = Record<string, unknown>

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const byKey = (rows: Row[], key: (row: Row) => string) => new Map(rows.map(row => [key(row), row]))
const skillKey = (row: Row) => `${row.game_skill_id}:${row.construe_level}`
const passiveKey = (row: Row) => String(row.game_passive_id)

/**
 * Fields where an existing EGO differs from the extraction (bootstrap-data plan rows). Every field the extraction
 * produces must match: the EGO row (keywords as a set), each stage skill (by skill ID and stage, row id aside) and each
 * passive. An empty list means the DB already equals the game.
 */
export function egoDrift(plan: { ego: Row; skills: Row[]; passives: Row[] }, db: { ego: Row; skills: Row[]; passives: Row[] }): string[] {
  const fields = new Set<string>()
  for (const [field, value] of Object.entries(plan.ego)) {
    const equal = field === 'keywords'
      ? same([...(value as string[] ?? [])].sort(), [...(db.ego[field] as string[] ?? [])].sort())
      : same(value, db.ego[field])
    if (!equal) fields.add(field)
  }
  for (const [kind, key, planRows, dbRows] of [['skills', skillKey, plan.skills, db.skills], ['passives', passiveKey, plan.passives, db.passives]] as const) {
    const current = byKey(dbRows, key)
    if (current.size !== planRows.length) fields.add(kind)
    for (const row of planRows) {
      const found = current.get(key(row))
      if (!found || Object.entries(row).some(([field, value]) => field !== 'id' && !same(value, found[field]))) fields.add(kind)
    }
  }
  return [...fields]
}
