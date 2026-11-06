import { describe, expect, it } from 'vitest'
import { buildEgoModel, suggestEgos } from '@/features/community/lib/ego-recs'
import { catalogOf, ego, identity, NOW, post, times } from './rec-fixtures'

describe('E.G.O recommender', () => {
  const catalog = catalogOf({
    identities: [
      identity('IA', 'a', { status: ['화상'], factions: ['X'] }), identity('IA2', 'a', { status: ['침잠'] }), identity('IB', 'b', { status: ['화상'] }), identity('IC', 'c', { status: ['침잠'] }),
    ],
    egos: [
      ego('Z', 'a', 'ZAYIN'), ego('T-burn', 'a', 'TETH', { status: ['화상'], cost: [4, 0, 0, 0, 0, 0, 0] }), ego('T-sink', 'a', 'TETH', { status: ['침잠'], cost: [0, 0, 0, 0, 4, 0, 0] }),
      ego('H-one', 'a', 'HE', { cost: [2, 0, 0, 0, 0, 0, 0] }), ego('H-new', 'a', 'HE', { release: '2026-10-10' }),
    ],
    skills: [{ identity_id: 'IA', skill_order: 1, sin_affinity: 'wrath', description: '' }, { identity_id: 'IB', skill_order: 1, sin_affinity: 'wrath', description: '' }],
  })
  const equips = (identities: string[], egos: string[]) => post(identities, { egos })
  const model = buildEgoModel([
    ...times(6, () => equips(['IA', 'IB'], ['Z', 'T-burn'])), ...times(6, () => equips(['IA2', 'IC'], ['Z', 'T-sink'])), equips(['IA', 'IB'], ['Z', 'T-sink', 'H-one']),
    post(['IA', 'IB']),
  ], catalog)
  const ask = (extra: Partial<Parameters<typeof suggestEgos>[1]> = {}) => suggestEgos(model, { identity: 'IA', board: ['IB'], now: NOW, ...extra })

  it('REQ-DECKS-044 ranks the sinner\'s E.G.O by how often posts fielding this identity equip it, leaving ZAYIN out, and counts those posts', () => {
    const { items } = ask()
    expect(items.map(item => item.id)).not.toContain('Z')
    expect(items[0]).toMatchObject({ id: 'T-burn', count: 6 })
    expect(items.map(item => item.id).indexOf('T-sink')).toBeGreaterThan(0)
  })

  it('REQ-DECKS-044 does not offer an E.G.O whose grade slot the sinner has filled, nor the one already equipped', () => {
    const ids = ask({ equipped: ['T-burn'] }).items.map(item => item.id)
    expect(ids).not.toContain('T-burn')
    expect(ids).not.toContain('T-sink')
    expect(ids).toContain('H-one')
    // The equipped E.G.O of another sinner takes no slot here.
    expect(ask({ equipped: ['Z'] }).items.map(item => item.id)).toContain('T-burn')
  })

  it('REQ-DECKS-044 gives readable reasons (keyword, sin) first, the board members it goes with first, and the board\'s archetype', () => {
    const { items, archetype } = ask()
    expect(archetype.keywords).toEqual(['화상'])
    expect(items[0].reasons[0]).toBe('keyword:화상')
    expect(items[0].reasons).toContain('synergy')
    expect(items[0].partners[0]).toMatchObject({ id: 'IB', chosen: true })
    expect(items[0].partners.length).toBeLessThanOrEqual(3)
  })

  it('REQ-DECKS-044 still ranks when no post equips anything: by kit fit, with a boost for a new E.G.O nobody equips', () => {
    const empty = buildEgoModel([], catalog)
    const { items } = suggestEgos(empty, { identity: 'IA', board: ['IB'], now: NOW })
    expect(items.map(item => item.id)).toContain('H-new')
    expect(items[0].id).toBe('T-burn')
    expect(items.find(item => item.id === 'H-new')!.reasons).toContain('new')
    expect(suggestEgos(empty, { identity: 'nobody', board: [], now: NOW })).toEqual({ items: [], archetype: { keywords: [], factions: [] } })
  })
})
