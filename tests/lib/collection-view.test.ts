import { describe, expect, it } from 'vitest'
import { countCollection, filterCollection } from '@/lib/collection-view'
import type { CollectionData, IdentityInfo, EGOInfo } from '@/lib/collection'

const identity = (id: string, keywords: string[] | null): IdentityInfo => ({ id, sinner_id: 'a', name_kr: id, game_id: null, folder_name: null, rarity: 3, keywords })
const ego = (id: string, sin_affinity: string | null): EGOInfo => ({ id, sinner_id: 'a', name_kr: id, folder_name: null, image_url: null, grade: 'HE', sin_affinity })
const data: CollectionData = {
  sinners: [{ id: 'a', name_kr: 'a', order_num: 1 }, { id: 'b', name_kr: 'b', order_num: 2 }],
  identities: { a: [identity('burn', ['화상']), identity('alias', ['same-sin']), identity('none', null)] },
  egos: { a: [ego('kr', '색욕'), ego('en', 'lust'), ego('other', '분노')] },
}

describe('collection view shared model', () => {
  it('calculates totals and tab counts together, ignoring owned IDs outside the catalog', () => {
    expect(countCollection(data, new Set(['burn', 'kr', 'stale-id']))).toEqual({
      stats: { totalIdentities: 3, ownedIdentities: 1, totalEgos: 3, ownedEgos: 1 },
      bySinner: { a: { owned: 2, total: 6 }, b: { owned: 0, total: 0 } },
    })
  })

  it('preserves same-sin identity matches and both localized EGO affinities', () => {
    const filtered = filterCollection(data, '화상', { '화상': 'lust', 'same-sin': 'lust' })
    expect(filtered.identities.a.map(row => row.id)).toEqual(['burn', 'alias'])
    expect(filtered.egos.a.map(row => row.id)).toEqual(['kr', 'en'])
    expect(data.identities.a).toHaveLength(3)
  })

  it('keeps EGO rows for keywords without a sin and restores all rows on filter clear', () => {
    const filtered = filterCollection(data, 'missing', {})
    expect(filtered.identities.a).toEqual([])
    expect(filtered.egos).toBe(data.egos)
    expect(filterCollection(data, '', {}).identities).toBe(data.identities)
  })

  it('accepts the editor loading state and updates counts after ownership changes', () => {
    expect(filterCollection(null, null, {})).toEqual({ identities: {}, egos: {} })
    expect(countCollection(null, new Set()).stats.totalIdentities).toBe(0)
    expect(countCollection(data, new Set(['burn', 'alias'])).bySinner.a.owned).toBe(2)
    expect(countCollection(data, new Set()).bySinner.a.owned).toBe(0)
  })
})
