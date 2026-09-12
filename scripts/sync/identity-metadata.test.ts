import { expect, it } from 'vitest'
import { identityMetadata, restoreHistoricalMetadata } from './identity-metadata'

it('restores the identity attribute independently of skill or keyword colors', () => {
  expect(identityMetadata({ uniqueAttribute: 'CRIMSON', updatedDate: 20260709 })).toEqual({ sin_affinity: 'wrath', release_date: '2026-07-09' })
  expect(identityMetadata({ uniqueAttribute: 'VIOLET', updatedDate: 20250717 })).toEqual({ sin_affinity: 'envy', release_date: '2025-07-17' })
})
it('rejects absent, unknown and impossible source values', () => {
  for (const updatedDate of [null, 20250230, 20261301, 0]) expect(identityMetadata({ updatedDate }).release_date).toBeNull()
  expect(identityMetadata({ uniqueAttribute: 'unknown' }).sin_affinity).toBeNull()
})

it('recovers historical event prices and missing quotes without generated pickup restrictions', () => {
  const current = { quote: '', acquisition: 'generated pickup', acquisition_info: { type: 'limited' as const, release_season: 4, fragment_cost: 150, gacha: 'pickup' as const, gacha_id: 99, gacha_from_season: 4 } }
  const historical = { quote: 'original quote', acquisition: 'event reward', acquisition_info: { type: 'event' as const, release_season: 4, fragment_cost: 150, gacha: 'none' as const, event_cost: 500, event_currency: '회중시계' } }
  expect(restoreHistoricalMetadata(current, historical)).toEqual(historical)
  expect(current.acquisition_info.gacha).toBe('pickup')
})

it('retains current quotes and newly sourced banner names alongside original release chronology', () => {
  const current = { quote: 'current quote', acquisition_info: { type: 'standard' as const, release_season: 0, fragment_cost: 400, gacha: 'always' as const, gacha_id: 17, gacha_name: '배너' } }
  const historical = { quote: 'old quote', acquisition_info: { type: 'standard' as const, release_season: 2, fragment_cost: 400, gacha: 'always' as const } }
  expect(restoreHistoricalMetadata(current, historical)).toMatchObject({ quote: 'current quote', acquisition_info: { release_season: 2, gacha: 'always', gacha_id: 17, gacha_name: '배너' } })
})
