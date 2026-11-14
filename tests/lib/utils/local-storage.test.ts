import { afterEach, describe, expect, it, vi } from 'vitest'
import { readJson, writeJson } from '@/lib/utils/local-storage'

afterEach(() => vi.unstubAllGlobals())

const memory = (initial: Record<string, string> = {}) => {
  const store = { ...initial }
  return { store, getItem: (key: string) => store[key] ?? null, setItem: (key: string, value: string) => { store[key] = value } }
}

describe('readJson', () => {
  it('reads the JSON value under a key', () => {
    expect(readJson('k', memory({ k: '{"a":[1,2]}' }))).toEqual({ a: [1, 2] })
    expect(readJson('k', memory({ k: '"text"' }))).toBe('text')
  })

  it('is null when nothing is stored, the text is not JSON, or the storage throws', () => {
    expect(readJson('k', memory())).toBeNull()
    expect(readJson('k', memory({ k: '' }))).toBeNull()
    expect(readJson('k', memory({ k: '{broken' }))).toBeNull()
    expect(readJson('k', { getItem: () => { throw new Error('blocked') } })).toBeNull()
    expect(readJson('k', null)).toBeNull()
  })

  it('reads the browser localStorage by default, and is null when there is none', () => {
    vi.stubGlobal('localStorage', memory({ k: '[1]' }))
    expect(readJson('k')).toEqual([1])
    vi.unstubAllGlobals()
    expect(readJson('k')).toBeNull() // node has no localStorage
  })

  it('gives the same value the hand-written read gave', () => {
    // `JSON.parse(storage.getItem(key) ?? 'null')` inside try/catch, as call sites wrote it.
    const before = (storage: { getItem(key: string): string | null }) => { try { return JSON.parse(storage.getItem('k') ?? 'null') } catch { return null } }
    for (const text of [undefined, '', '0', 'null', 'true', '[]', '{}', '{"a":1}', '{bad', '"x"']) {
      const storage = memory(text === undefined ? {} : { k: text })
      expect(readJson('k', storage)).toEqual(before(storage))
    }
  })
})

describe('writeJson', () => {
  it('stores the JSON text and says it worked', () => {
    const storage = memory()
    expect(writeJson('k', { a: 1 }, storage)).toBe(true)
    expect(storage.store.k).toBe('{"a":1}')
  })

  it('says false instead of throwing when the storage refuses or is missing', () => {
    expect(writeJson('k', 1, { setItem: () => { throw new Error('full') } })).toBe(false)
    expect(writeJson('k', 1, null)).toBe(false)
    expect(writeJson('k', 1)).toBe(false) // node has no localStorage
  })

  it('writes the browser localStorage by default', () => {
    const storage = memory()
    vi.stubGlobal('localStorage', storage)
    expect(writeJson('k', [1])).toBe(true)
    expect(storage.store.k).toBe('[1]')
  })

  it('says false for a value that cannot be written as JSON', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(writeJson('k', circular, memory())).toBe(false)
  })
})
