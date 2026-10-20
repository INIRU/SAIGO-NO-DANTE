import { describe, expect, it } from 'vitest'
import { reasonParts, suggestionContext } from '@/lib/discovery/suggestion-types'

describe('suggestionContext', () => {
  it('REQ-DECKS-031 takes every chosen identity of the other sinners with or without a formation number, numbered ones first', () => {
    const chosen = { a: 'ia', b: 'ib', c: 'ic', d: undefined, e: 'ie' }
    expect(suggestionContext(chosen, ['c', 'a'], 'b', () => false)).toEqual(['ic', 'ia', 'ie'])
  })

  it('REQ-DECKS-031 leaves out the slot being picked and the LCB placeholders', () => {
    expect(suggestionContext({ a: 'ia', b: 'ib', c: 'lcb-c' }, [], 'a', id => id.startsWith('lcb'))).toEqual(['ib'])
    expect(suggestionContext({ a: 'lcb-a' }, [], 'b', id => id.startsWith('lcb'))).toEqual([])
  })
})

describe('reasonParts', () => {
  it('REQ-DECKS-034 reads keyword, faction and sin codes, at most two', () => {
    expect(reasonParts(['keyword:출혈', 'faction:거미집', 'sin:wrath'])).toEqual([{ kind: 'keyword', value: '출혈' }, { kind: 'faction', value: '거미집' }])
    expect(reasonParts(['sin:wrath'])).toEqual([{ kind: 'sin', value: 'wrath' }])
  })

  it('REQ-DECKS-034 drops codes it cannot read and tolerates none', () => {
    expect(reasonParts(['pair', 'keyword:', 'x:y', 'faction:새벽 사무소'])).toEqual([{ kind: 'faction', value: '새벽 사무소' }])
    expect(reasonParts(undefined)).toEqual([])
  })
})
