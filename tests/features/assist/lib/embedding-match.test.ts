import { expect, it } from 'vitest'
import { cosine, decodeEmbeddingIndex, eventArtId, matchEventEmbedding, matchGiftEmbedding } from '@/features/assist/lib/embedding-match'

function vector(x: number, y: number): Float32Array {
  const result = new Float32Array(576)
  result[0] = x
  result[1] = y
  return result
}

it('returns every event ID sharing accepted illustrated artwork and ignores image-less events', () => {
  const index = { gifts: new Map(), events: new Map([
    ['901001', vector(1, 0)], ['901002', vector(0.7, 0.714)],
  ]) }
  const references = [
    { id: 'first', imageUrl: 'https://example.test/icons/events/901001.webp' },
    { id: 'followup', imageUrl: 'https://example.test/icons/events/901001.webp' },
    { id: 'other', imageUrl: 'https://example.test/icons/events/901002.webp' },
    { id: 'knowledge', imageUrl: null },
  ]
  expect(matchEventEmbedding(vector(1, 0), references, index).map(match => match.id)).toEqual(['first', 'followup'])
  expect(eventArtId('https://example.test/icons/events/901001.webp?size=200')).toBe('901001')
  expect(eventArtId(null)).toBeNull()
  expect(matchEventEmbedding(vector(0.923, 0.383), references, index)).toEqual([])
})

it('abstains on ambiguous gift crops and never returns gifts outside the supplied catalog', () => {
  const index = { gifts: new Map([
    ['42', vector(1, 0)], ['43', vector(0.7, 0.714)], ['44', vector(0, 1)],
  ]), events: new Map() }
  const references = [
    { id: '42', imageUrl: '/gift/42.webp' },
    { id: '43', imageUrl: '/gift/43.webp' },
    { id: '44', imageUrl: null },
  ]
  expect(matchGiftEmbedding(vector(1, 0), references, index)).toEqual([{ id: '42', score: 1 }])
  expect(matchGiftEmbedding(vector(0.923, 0.383), references, index)).toEqual([])
  expect(matchGiftEmbedding(vector(0, 1), references, index)).toEqual([])
  expect(cosine(vector(1, 0), vector(0, 1))).toBe(0)
})

it('rejects malformed embedding assets and dimensions', () => {
  expect(() => decodeEmbeddingIndex({ version: 1, dimensions: 576, gifts: [{ id: '1', vector: 'AA==' }], events: [] })).toThrow()
  expect(() => decodeEmbeddingIndex({ version: 1, dimensions: 2, gifts: [], events: [] })).toThrow()
  expect(() => cosine(new Float32Array(1), vector(1, 0))).toThrow()
})
