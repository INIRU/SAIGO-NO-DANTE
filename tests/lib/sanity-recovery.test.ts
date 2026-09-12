import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
const { parseCondition } = createRequire(import.meta.url)('../../scripts/sync/restore-sanity.cjs')
it('separates sanity template identity from ordered source parameters', () => {
  expect(parseCondition('OnKillEnemy10Level2')).toEqual({template:'OnKillEnemyLevel',params:[10,2]})
  expect(parseCondition('OnAllyDeath')).toEqual({template:'OnAllyDeath',params:[]})
})
