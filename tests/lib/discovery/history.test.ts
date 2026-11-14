import { afterEach, describe, expect, it, vi } from 'vitest'
import { readHistory, remember } from '@/lib/discovery/history'

const KEY = 'limbus_browsing_v1'

afterEach(() => vi.unstubAllGlobals())

function stubStorage(initial?: string, options: { throwOnGet?: boolean; throwOnSet?: boolean } = {}) {
  const store: Record<string, string> = initial === undefined ? {} : { [KEY]: initial }
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => { if (options.throwOnGet) throw new Error('blocked'); return store[key] ?? null },
    setItem: (key: string, value: string) => { if (options.throwOnSet) throw new Error('full'); store[key] = value },
  })
  return store
}

// The reader as it was written before the shared JSON helper.
function readHistoryBefore() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      items: Array.isArray(v.items)
        ? v.items.filter((i: { href: unknown; title: unknown }) => typeof i.href === 'string' && i.href.startsWith('/') && !i.href.startsWith('//') && typeof i.title === 'string').slice(0, 20)
        : [],
      queries: Array.isArray(v.queries) ? v.queries.filter((q: unknown) => typeof q === 'string').slice(0, 20) : [],
      enabled: v.enabled !== false,
    }
  } catch {
    return { items: [], queries: [], enabled: true }
  }
}

describe('readHistory', () => {
  const item = { href: '/ko/decks/1', title: 'Deck', kind: 'deck', id: '1' }
  const stored = [
    undefined, '', 'null', '0', '"text"', '[1]', '{}', '{broken',
    JSON.stringify({ items: [item, { href: '//evil.example', title: 'x' }, { href: 'relative', title: 'x' }], queries: ['a', 3, 'b'], enabled: false }),
    JSON.stringify({ items: [null, item] }),
    JSON.stringify({ items: 'nope', queries: 'nope' }),
  ]

  it.each(stored.map((value, index) => [index, value]))('reads stored value %i as it did before', (_index, value) => {
    stubStorage(value)
    expect(readHistory()).toEqual(readHistoryBefore())
  })

  it('starts empty and enabled when nothing is stored or the storage is blocked', () => {
    stubStorage()
    expect(readHistory()).toEqual({ items: [], queries: [], enabled: true })
    stubStorage(undefined, { throwOnGet: true })
    expect(readHistory()).toEqual({ items: [], queries: [], enabled: true })
  })
})

describe('remember', () => {
  it('stores a visited page and a query, newest first', () => {
    const store = stubStorage()
    remember({ href: '/ko/a', title: 'A', kind: 'deck', id: 'a' })
    remember('  query  ')
    expect(JSON.parse(store[KEY])).toEqual({ items: [{ href: '/ko/a', title: 'A', kind: 'deck', id: 'a' }], queries: ['query'], enabled: true })
  })

  it('writes nothing when history is turned off, and does not throw when storage is full', () => {
    const store = stubStorage(JSON.stringify({ enabled: false }))
    remember('query')
    expect(store[KEY]).toBe('{"enabled":false}')
    stubStorage(undefined, { throwOnSet: true })
    expect(() => remember('query')).not.toThrow()
  })
})
