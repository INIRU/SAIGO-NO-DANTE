import { describe, expect, it } from 'vitest'
import { ctcLexiconBest, lexiconEntries } from '@/lib/vision/paddle-text'

// A tiny alphabet: blank, 가, 나, 다, 라, space.
const alphabet = ['', '가', '나', '다', '라', ' ']
/** Softmax-like rows: each step puts `p` on one class and spreads the rest evenly. */
function probabilities(path: number[], p = 0.9) {
  const out = new Float32Array(path.length * alphabet.length)
  path.forEach((cls, step) => { for (let c = 0; c < alphabet.length; c++) out[step * alphabet.length + c] = c === cls ? p : (1 - p) / (alphabet.length - 1) })
  return out
}

describe('lexicon CTC decoding', () => {
  it('REQ-ASSIST-035 picks the lexicon name the line spells, with its lead over the runner-up', () => {
    const entries = lexiconEntries([{ id: '1', name: '가나다' }, { id: '2', name: '가나라' }, { id: '3', name: '다라' }], alphabet)
    // 가 가 _ 나 _ 다 다 : greedy reads 가나다
    const line = probabilities([1, 1, 0, 2, 0, 3, 3])
    const best = ctcLexiconBest(line, 0, 7, alphabet.length, entries)!
    expect(best.id).toBe('1')
    expect(best.name).toBe('가나다')
    expect(best.margin).toBeGreaterThan(3)
    expect(best.gap).toBeLessThan(1)
  })

  it('REQ-ASSIST-035 keeps a one-glyph misread close to the right name and far from unrelated ones', () => {
    const entries = lexiconEntries([{ id: '1', name: '가나다' }, { id: '3', name: '다라' }], alphabet)
    // The third glyph is read as 라 with low confidence: 가나다 still leads 다라 by a wide margin.
    const line = probabilities([1, 0, 2, 0, 4], 0.9)
    line[4 * alphabet.length + 4] = 0.5
    line[4 * alphabet.length + 3] = 0.4
    const best = ctcLexiconBest(line, 0, 5, alphabet.length, entries)!
    expect(best.id).toBe('1')
    expect(best.margin).toBeGreaterThan(3)
  })

  it('REQ-ASSIST-035 reports a large shortfall for text that is no lexicon name', () => {
    const entries = lexiconEntries([{ id: '1', name: '가나' }], alphabet)
    const best = ctcLexiconBest(probabilities([3, 0, 4, 0, 3, 0, 4]), 0, 7, alphabet.length, entries)!
    expect(best.gap).toBeGreaterThan(10)
  })

  it('REQ-ASSIST-035 leaves out names the model cannot spell and ties between identical names', () => {
    expect(lexiconEntries([{ id: '1', name: '가마' }, { id: '2', name: ' 가나 ' }], alphabet)).toEqual([{ id: '2', name: '가나', labels: [1, 2] }])
    const same = lexiconEntries([{ id: '1', name: '가나' }, { id: '2', name: '가나' }], alphabet)
    expect(ctcLexiconBest(probabilities([1, 0, 2]), 0, 3, alphabet.length, same)!.margin).toBe(0)
  })

  it('REQ-ASSIST-035 scores the requested line of a batch', () => {
    const entries = lexiconEntries([{ id: '1', name: '가' }, { id: '2', name: '라' }], alphabet)
    const batch = new Float32Array([...probabilities([1, 1, 0]), ...probabilities([4, 0, 4])])
    expect(ctcLexiconBest(batch, 1, 3, alphabet.length, entries)!.id).toBe('2')
  })
})
