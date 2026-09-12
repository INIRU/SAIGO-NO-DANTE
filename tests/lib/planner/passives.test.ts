import { describe, expect, it } from 'vitest'
import { buildPassivePanelModel, getPassiveCondition, type PlannerPassiveLike } from '@/lib/planner/passives'

const passive = (name: string, overrides: Partial<PlannerPassiveLike> = {}): PlannerPassiveLike => ({
  identity_id: 'selected', name, passive_type: 'battle', sin_affinity: '분노',
  sin_count: 3, active_cond: 'resonance', description: '', ...overrides,
})

describe('passive panel model', () => {
  it('counts selected identities once and separates battle and support rows', () => {
    const battle = passive('전투')
    const support = passive('지원', { passive_type: 'support' })
    const model = buildPassivePanelModel(
      [{ identity_id: 'selected', sinner_id: 'yi-sang' }, { identity_id: 'selected' }],
      [battle, support, passive('미선택', { identity_id: 'other' })],
      [{ id: 'yi-sang', name_kr: '이상' }], {},
    )
    expect(model.counts).toEqual({ battle: 1, support: 1 })
    expect(model.slots[0].sinnerName).toBe('이상')
    expect(model.slots[0].battle.map(row => row.passive)).toEqual([battle])
    expect(model.slots[1].support.map(row => row.passive)).toEqual([support])
  })

  it('puts met conditions first while preserving source order within each group', () => {
    const rows = [passive('미달1'), passive('충족1', { sin_count: 1 }), passive('미달2'), passive('충족2', { sin_count: 2 })]
    const original = [...rows]
    const model = buildPassivePanelModel([{ identity_id: 'selected' }], rows, [], { wrath: 2 })
    expect(model.slots[0].battle.map(row => row.passive.name)).toEqual(['충족1', '충족2', '미달1', '미달2'])
    expect(rows).toEqual(original)
    const updated = buildPassivePanelModel([{ identity_id: 'selected' }], rows, [], { wrath: 3 })
    expect(updated.slots[0].battle.map(row => row.passive.name)).toEqual(rows.map(row => row.name))
  })

  it('adds multiple Korean or English sin conditions and ignores unknown tokens', () => {
    const condition = getPassiveCondition(passive('복합', { sin_affinity: '우울, pride, unknown', sin_count: 4 }), { gloom: 2, pride: 3 })
    expect(condition).toMatchObject({ sins: ['gloom', 'pride'], current: 5, required: 4, met: true, primarySin: 'gloom' })
    expect(getPassiveCondition(passive('무조건', { sin_affinity: null, sin_count: null }), {})).toMatchObject({ current: 0, required: 0, met: true, primarySin: null })
  })

  it('handles empty catalogs and incomplete slots without dropping slot positions', () => {
    const model = buildPassivePanelModel([{}, { sinner_id: 'unknown' }], [], [], {})
    expect(model.counts).toEqual({ battle: 0, support: 0 })
    expect(model.slots.map(row => [row.sinnerName, row.battle.length, row.support.length])).toEqual([['', 0, 0], ['unknown', 0, 0]])
  })
})
