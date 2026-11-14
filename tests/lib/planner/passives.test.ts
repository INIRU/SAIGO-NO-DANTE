import { describe, expect, it } from 'vitest'
import { buildPassivePanelModel, getPassiveCondition, passiveRequirements, type PlannerPassiveLike } from '@/lib/planner/passives'

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

  it('reads Korean or English sins of an old row (one count each) and ignores unknown tokens', () => {
    const condition = getPassiveCondition(passive('복합', { sin_affinity: '우울, pride, unknown', sin_count: 2 }), { gloom: 2, pride: 3 })
    expect(condition).toMatchObject({ sins: ['gloom', 'pride'], current: 4, required: 4, met: true, primarySin: 'gloom' })
    expect(getPassiveCondition(passive('무조건', { sin_affinity: null, sin_count: null }), {})).toMatchObject({ current: 0, required: 0, met: true, primarySin: null })
  })

  it('handles empty catalogs and incomplete slots without dropping slot positions', () => {
    const model = buildPassivePanelModel([{}, { sinner_id: 'unknown' }], [], [], {})
    expect(model.counts).toEqual({ battle: 0, support: 0 })
    expect(model.slots.map(row => [row.sinnerName, row.battle.length, row.support.length])).toEqual([['', 0, 0], ['unknown', 0, 0]])
  })

  it('keeps every sin with its own count and meets the condition only when each sin is met', () => {
    const p = passive('진형 보존', { sin_affinity: 'envy', sin_count: 2, active_cond: 'stock', sin_requirements: [{ sin: 'envy', count: 2 }, { sin: 'sloth', count: 3 }] })
    expect(passiveRequirements(p)).toEqual([{ sin: 'envy', count: 2 }, { sin: 'sloth', count: 3 }])
    const short = getPassiveCondition(p, { envy: 5, sloth: 2 })
    expect(short).toMatchObject({ met: false, current: 4, required: 5 })
    expect(short.requirements).toEqual([
      { sin: 'envy', count: 2, current: 5, met: true },
      { sin: 'sloth', count: 3, current: 2, met: false },
    ])
    expect(getPassiveCondition(p, { envy: 2, sloth: 3 }).met).toBe(true)
  })

  it('falls back to sin_affinity/sin_count when a row has no sin_requirements', () => {
    expect(passiveRequirements(passive('옛 행', { sin_affinity: 'pride', sin_count: 1, sin_requirements: null }))).toEqual([{ sin: 'pride', count: 1 }])
    expect(passiveRequirements(passive('조건 없음', { sin_affinity: null, sin_count: null }))).toEqual([])
  })
})
