import { describe, expect, it } from 'vitest'
import { DEPLOYED_SLOT_COUNT } from '@/lib/constants/game'
import { orderAfterPick, orderWithSwap, suggestionContext } from '@/lib/decks/formation-order'

const sinners = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']

describe('suggestionContext', () => {
  it('REQ-DECKS-025 takes every chosen identity of the other sinners, ordered ones first', () => {
    const picked = { a: 'ia', b: 'ib', c: 'ic', d: undefined, e: 'ie' }
    expect(suggestionContext(picked, ['c', 'a'], 'b', () => false)).toEqual(['ic', 'ia', 'ie'])
  })

  it('REQ-DECKS-025 leaves out the slot being picked and the LCB placeholders', () => {
    const picked = { a: 'ia', b: 'ib', c: 'lcb-c' }
    expect(suggestionContext(picked, [], 'a', id => id.startsWith('lcb'))).toEqual(['ib'])
  })

  it('REQ-DECKS-025 asks with a formation of nothing but placeholders for no suggestions', () => {
    expect(suggestionContext({ a: 'lcb-a' }, [], 'b', id => id.startsWith('lcb'))).toEqual([])
  })
})

describe('orderAfterPick', () => {
  it('REQ-DECKS-026 gives an identity picked for an unordered sinner the next free number', () => {
    expect(orderAfterPick([], 'a', false)).toEqual(['a'])
    expect(orderAfterPick(['a', 'b'], 'c', false)).toEqual(['a', 'b', 'c'])
  })

  it('REQ-DECKS-026 keeps the number of a sinner that is already ordered, whatever it is swapped for', () => {
    expect(orderAfterPick(['a', 'b', 'c'], 'b', false)).toEqual(['a', 'b', 'c'])
  })

  it('REQ-DECKS-026 stops numbering at the deployed count', () => {
    const full = sinners.slice(0, DEPLOYED_SLOT_COUNT)
    expect(orderAfterPick(full, 'z', false)).toEqual(full)
  })

  it('REQ-DECKS-026 frees the number when the sinner goes back to the LCB identity and numbers after it move up', () => {
    expect(orderAfterPick(['a', 'b', 'c'], 'b', true)).toEqual(['a', 'c'])
    expect(orderAfterPick(['a', 'c'], 'z', true)).toEqual(['a', 'c'])
  })
})

describe('orderWithSwap', () => {
  it('REQ-DECKS-027 swaps with the sinner that holds the chosen number', () => {
    expect(orderWithSwap(['a', 'b', 'c', 'd'], 'a', 3)).toEqual(['c', 'b', 'a', 'd'])
    expect(orderWithSwap(['a', 'b', 'c', 'd'], 'd', 1)).toEqual(['d', 'b', 'c', 'a'])
  })

  it('REQ-DECKS-027 changes nothing for the same number, a number past the end, or a sinner without one', () => {
    expect(orderWithSwap(['a', 'b'], 'a', 1)).toEqual(['a', 'b'])
    expect(orderWithSwap(['a', 'b'], 'a', 5)).toEqual(['a', 'b'])
    expect(orderWithSwap(['a', 'b'], 'z', 1)).toEqual(['a', 'b'])
  })
})
