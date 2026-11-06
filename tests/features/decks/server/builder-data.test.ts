import { expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }))
vi.mock('@/lib/db/queries', () => ({}))

it('keeps the page language and Korean text of skills and passives, without flavor text or other languages', async () => {
  const { forBuilder } = await import('@/features/decks/server/builder-data')
  const skill = { id: 's1', name: '베기', name_en: 'Slash', name_jp: '斬る', description: '설명', description_en: 'Text', description_jp: '説明',
    flavor: '향', flavor_en: 'Flavor', flavor_jp: '香', coins: 3, base_power: 4, created_at: 'x' }
  expect(forBuilder(skill, 'ko')).toEqual({ id: 's1', name: '베기', description: '설명', coins: 3, base_power: 4 })
  expect(forBuilder(skill, 'en')).toEqual({ id: 's1', name: '베기', name_en: 'Slash', description: '설명', description_en: 'Text', coins: 3, base_power: 4 })
  expect(forBuilder(skill, 'ja')).toEqual({ id: 's1', name: '베기', name_jp: '斬る', description: '설명', description_jp: '説明', coins: 3, base_power: 4 })
})
