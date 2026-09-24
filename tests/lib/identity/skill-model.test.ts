import { describe, expect, it } from 'vitest'
import type { Skill } from '@/lib/types'
import { groupIdentitySkills, buildSkillVariantMap, dropRepeatedTopUptie, selectIdentitySkills, selectUptieRows, uptieLevels } from '@/lib/identity/skill-model'

const skill = (id: string, order: number, level?: number) => ({ id, skill_order: order, uptie_level: level } as Skill)

describe('identity skill model', () => {
  it('falls back to level 3 including legacy rows without an uptie level', () => {
    const rows = [skill('legacy', 1), skill('third', 2, 3)]
    expect(selectUptieRows(rows, 4)).toEqual(rows)
  })

  it('uses level 4 rows without mixing in level 3 skills', () => {
    const third = skill('third', 1, 3)
    const fourth = skill('fourth', 1, 4)
    expect(selectUptieRows([third, fourth], 4)).toEqual([fourth])
  })

  it('drops a top uptie identical to the level below and keeps a changed one', () => {
    const same = [skill('a3', 1, 3), skill('a4', 1, 4)].map(row => ({ ...row, identity_id: 'a' }))
    const changed = [skill('b3', 1, 3), skill('b4', 2, 4)].map(row => ({ ...row, identity_id: 'b' }))
    const kept = dropRepeatedTopUptie([...same, ...changed], row => row.identity_id)
    expect(kept.map(row => row.id)).toEqual(['a3', 'b3', 'b4'])
    expect(selectUptieRows(kept.filter(row => row.identity_id === 'a'), 4).map(row => row.id)).toEqual(['a3'])
  })

  it('lists uptie levels I–IV present and picks the nearest one (lower on ties)', () => {
    const rows = [skill('one', 1, 1), skill('legacy', 1), skill('four', 1, 4)]
    expect(uptieLevels(rows, [skill('two', 1, 2)])).toEqual([1, 2, 3, 4])
    expect(selectUptieRows(rows, 2).map(row => row.id)).toEqual(['one'])
    expect(selectUptieRows(rows, 3).map(row => row.id)).toEqual(['legacy'])
  })

  it('keeps skill variants beside S3 and defense last without changing source order', () => {
    const source = [skill('defense', 4), skill('s1', 1), skill('s3', 3), skill('variant', 5), skill('s2', 2)]
    const original = source.slice()
    const selected = selectIdentitySkills(source, 3)
    expect(selected.map(row => row.id)).toEqual(['s1', 's2', 's3', 'variant', 'defense'])
    expect(source).toEqual(original)
    expect(buildSkillVariantMap(selected)).toMatchObject({
      s3: { baseOrder: 3, idx: 1, total: 2 },
      variant: { baseOrder: 3, idx: 2, total: 2 },
      defense: { baseOrder: 4, idx: 1, total: 1 },
    })
  })

  it('handles multiple same-order variants and empty data', () => {
    expect(buildSkillVariantMap([skill('first', 3), skill('second', 3)])).toEqual({
      first: { baseOrder: 3, idx: 1, total: 2 }, second: { baseOrder: 3, idx: 2, total: 2 },
    })
    expect(selectIdentitySkills([], 4)).toEqual([])
    expect(buildSkillVariantMap([])).toEqual({})
  })
})

it('groups all variants in one block per base skill without dropping defense or mutating input', () => {
  const rows = [skill('s1a', 1), skill('s1b', 1), skill('s2', 2), skill('s3', 3), skill('extra', 5), skill('defense', 4)]
  const original = [...rows]
  expect(groupIdentitySkills(rows).map(group => group.map(row => row.id))).toEqual([
    ['s1a', 's1b'], ['s2'], ['s3', 'extra'], ['defense'],
  ])
  expect(rows).toEqual(original)
  expect(groupIdentitySkills([])).toEqual([])
})
