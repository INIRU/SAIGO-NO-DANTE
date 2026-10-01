import { expect, it } from 'vitest'
import { RESTORE_TABLES, restorePlan } from './extraction-restore'

it('writes back changed and deleted backup rows and removes rows the apply added, keeping those in use', () => {
  const backup = [{ id: 'a', name: '원래' }, { id: 'b', name: '그대로' }, { id: 'c', name: '지워짐' }]
  const current = [{ id: 'a', name: '바뀜' }, { id: 'b', name: '그대로' }, { id: 'n1', name: '새 행' }, { id: 'n2', name: '덱에서 사용' }]
  const plan = restorePlan(backup, current, ['id'], row => row.id === 'n2')
  expect(plan.upsert.map(row => row.id)).toEqual(['a', 'c'])
  expect(plan.remove.map(row => row.id)).toEqual(['n1'])
  expect(plan.kept.map(row => row.id)).toEqual(['n2'])
  // Composite keys (ego_passives) compare every key column.
  const passives = restorePlan([{ ego_id: 'e', game_passive_id: 1, d: 'x' }], [{ ego_id: 'e', game_passive_id: 1, d: 'x' }, { ego_id: 'e', game_passive_id: 2, d: 'y' }], ['ego_id', 'game_passive_id'])
  expect(passives).toEqual({ upsert: [], remove: [{ ego_id: 'e', game_passive_id: 2, d: 'y' }], kept: [] })
})

it('lists parents before their children so upserts meet their foreign keys and deletions run in reverse', () => {
  const order = RESTORE_TABLES.map(item => item.table)
  for (const item of RESTORE_TABLES) if (item.parent) expect(order.indexOf(item.parent.table)).toBeLessThan(order.indexOf(item.table))
  expect(order.indexOf('md_events')).toBeLessThan(order.indexOf('md_event_choices'))
  expect(order.indexOf('ego_gifts')).toBeLessThan(order.indexOf('ego_gift_recipes'))
})

it('REQ-DATA-SYNC-037 restores the game text reference table with the keyword catalogue it links to', () => {
  const order = RESTORE_TABLES.map(item => item.table)
  expect(RESTORE_TABLES.find(item => item.table === 'game_text_refs')).toEqual({ table: 'game_text_refs', key: ['id'] })
  expect(order.indexOf('game_text_refs')).toBeGreaterThan(order.indexOf('keyword_meta'))
})
