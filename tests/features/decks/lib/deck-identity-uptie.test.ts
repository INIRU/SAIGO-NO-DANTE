import { expect, it } from 'vitest'
import { insertDeckIdentities, normalizeUptie } from '@/features/decks/lib/deck-identity-uptie'

it('falls back to uptie 4 for anything outside 1–3', () => {
  expect([1, 2, 3, 4, 0, 5, null, undefined, '2'].map(normalizeUptie)).toEqual([1, 2, 3, 4, 4, 4, 4, 4, 4])
})

it('retries without uptie only when the column is missing', async () => {
  const calls: object[][] = []
  const missing = async (rows: object[]) => { calls.push(rows); return { error: calls.length === 1 ? { message: "Could not find the 'uptie' column of 'deck_identities'" } : null } }
  expect(await insertDeckIdentities(missing, [{ identity_id: 'a', uptie: 2 }])).toEqual({ error: null })
  expect(calls).toEqual([[{ identity_id: 'a', uptie: 2 }], [{ identity_id: 'a' }]])

  const other = async () => ({ error: { message: 'duplicate key' } })
  expect(await insertDeckIdentities(other, [{ identity_id: 'a', uptie: 2 }])).toEqual({ error: { message: 'duplicate key' } })
})
