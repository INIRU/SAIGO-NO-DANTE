import { describe, expect, it } from 'vitest'
import { identitySuggestUrl, plannerSuggestionContext, reasonParts, suggestionContext } from '@/features/community/lib/suggestion-types'

describe('suggestionContext', () => {
  it('takes every chosen identity of the other sinners with or without a formation number, numbered ones first', () => {
    const chosen = { a: 'ia', b: 'ib', c: 'ic', d: undefined, e: 'ie' }
    expect(suggestionContext(chosen, ['c', 'a'], 'b', () => false)).toEqual(['ic', 'ia', 'ie'])
  })

  it('leaves out the slot being picked and the LCB placeholders', () => {
    expect(suggestionContext({ a: 'ia', b: 'ib', c: 'lcb-c' }, [], 'a', id => id.startsWith('lcb'))).toEqual(['ib'])
    expect(suggestionContext({ a: 'lcb-a' }, [], 'b', id => id.startsWith('lcb'))).toEqual([])
  })
})

describe('reasonParts', () => {
  it('reads keyword, faction and sin codes, at most two', () => {
    expect(reasonParts(['keyword:출혈', 'faction:거미집', 'sin:wrath'])).toEqual([{ kind: 'keyword', value: '출혈' }, { kind: 'faction', value: '거미집' }])
    expect(reasonParts(['sin:wrath'])).toEqual([{ kind: 'sin', value: 'wrath' }])
  })

  it('drops codes it cannot read and tolerates none', () => {
    expect(reasonParts(['pair', 'keyword:', 'x:y', 'faction:새벽 사무소'])).toEqual([{ kind: 'faction', value: '새벽 사무소' }])
    expect(reasonParts(undefined)).toEqual([])
  })
})

describe('identity suggestions are asked even before anything else is chosen', () => {
  it('asks with the chosen identities, and with none for an empty board', () => {
    expect(identitySuggestUrl('gregor', ['a', 'b'])).toBe('/api/discovery/suggest?type=identity&sinner=gregor&with=a,b')
    expect(identitySuggestUrl('gregor', [])).toBe('/api/discovery/suggest?type=identity&sinner=gregor')
    expect(identitySuggestUrl(null, ['a'])).toBeNull()
  })
})

describe('the planner asks for identity suggestions from its own slots', () => {
  it('reads the other sinners\' chosen identities, numbered ones first, without the LCB placeholders or the slot being picked', () => {
    const slots = [
      { sinner_id: 'yi-sang', identity_id: 'lcb-yi', slot_order: 99 },
      { sinner_id: 'faust', identity_id: 'f1', slot_order: 1 },
      { sinner_id: 'gregor', identity_id: 'g1', slot_order: 0 },
      { sinner_id: 'rodion', identity_id: 'r1', slot_order: 99 },
    ]
    expect(plannerSuggestionContext(slots, 'gregor', id => id.startsWith('lcb-'))).toEqual(['f1', 'r1'])
    expect(plannerSuggestionContext(slots, 'rodion', id => id.startsWith('lcb-'))).toEqual(['g1', 'f1'])
  })
})
