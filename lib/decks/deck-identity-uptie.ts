/** Uptie 1–4 per deck identity. Anything else (missing column, bad input) is 4. */
export function normalizeUptie(value: unknown): number {
  return value === 1 || value === 2 || value === 3 ? value : 4
}

/** Uptie III–IV use the awakened (gacksung) illustration. */
export const isAwakenedUptie = (uptie: unknown) => normalizeUptie(uptie) >= 3

/**
 * Keeps each identity's skill/passive rows at its slot uptie (identities without one: 4).
 * When the data lacks that level, the nearest available one is used (ties: the lower one).
 */
export function rowsAtUptie<T extends { identity_id: string; uptie_level?: number | null }>(
  rows: readonly T[],
  uptieByIdentity: ReadonlyMap<string, number | undefined>,
): T[] {
  const levels = new Map<string, Set<number>>()
  for (const row of rows) levels.set(row.identity_id, (levels.get(row.identity_id) ?? new Set()).add(row.uptie_level ?? 3))
  const chosen = new Map([...levels].map(([id, set]) => {
    const target = normalizeUptie(uptieByIdentity.get(id))
    return [id, [...set].sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)[0]]
  }))
  return rows.filter(row => (row.uptie_level ?? 3) === chosen.get(row.identity_id))
}

type InsertResult = { error: { message: string } | null }

/**
 * Inserts deck_identities rows with uptie. Until migration 20260924130000 is applied the
 * column does not exist, so a column error retries once without it (uptie then reads as 4).
 */
export async function insertDeckIdentities<T extends { uptie: number }>(
  insert: (rows: Omit<T, 'uptie'>[] | T[]) => PromiseLike<InsertResult>,
  rows: T[],
): Promise<InsertResult> {
  const result = await insert(rows)
  if (!result.error?.message.includes('uptie')) return result
  return insert(rows.map(({ uptie: _uptie, ...row }) => row))
}
