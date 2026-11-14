import { describe, expect, it } from 'vitest'
import { deckInitFromTeamCode, formationParamFromSearch } from '@/lib/decks/formation-init'
import { encodeRandomResult } from '@/features/tools/lib/random/deck-code'
import { generateRandom } from '@/features/tools/lib/random/engine'
import { rngFromSeed } from '@/features/tools/lib/random/seed'
import { BASE_OPTIONS, EGOS, IDENTITIES, SINNERS } from '@/tests/features/tools/lib/random/fixture'

describe('deck builder start from a formation code', () => {
  it('reads the identities, E.G.O and numbered order out of the code', async () => {
    const result = generateRandom(SINNERS, IDENTITIES, EGOS, { ...BASE_OPTIONS, deploy: { min: 5, max: 5 } }, rngFromSeed('builder'))
    const init = deckInitFromTeamCode(await encodeRandomResult(SINNERS, IDENTITIES, EGOS, result), SINNERS, IDENTITIES, EGOS)!
    expect(init.formationOrder).toEqual(result.order)
    expect(init.formationOrder).toHaveLength(5)
    for (const sinner of SINNERS) {
      expect(init.identitySlotIds[sinner.id]).toBe(result.identities[sinner.id]!.id)
      expect(Object.values(init.egoSlotIds[sinner.id] ?? {}).sort()).toEqual(result.egos[sinner.id].map(ego => ego.id).sort())
    }
  })

  it('ignores a code that cannot be read', () => {
    expect(deckInitFromTeamCode('garbage', SINNERS, IDENTITIES, EGOS)).toBeNull()
    expect(deckInitFromTeamCode('', SINNERS, IDENTITIES, EGOS)).toBeNull()
  })

  it('finds the formation value in a query string and not any other', () => {
    expect(formationParamFromSearch('?formation=abc%2B%2F%3D&tab=ego')).toBe('abc+/=')
    expect(formationParamFromSearch('tab=ego')).toBeNull()
    expect(formationParamFromSearch('?formation=')).toBeNull()
    expect(formationParamFromSearch('')).toBeNull()
  })
})
