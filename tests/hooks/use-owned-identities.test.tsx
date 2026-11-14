import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// useSWR and useSession are replaced so the hook is a plain function here: the test reads the key it asks SWR for and runs the fetcher it hands over.
const mocks = vi.hoisted(() => ({
  status: 'unauthenticated' as string,
  swr: [] as { key: string | null; fetcher: () => Promise<Set<string> | null> }[],
  decode: vi.fn(),
}))
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: mocks.status }) }))
vi.mock('swr', () => ({
  default: (key: string | null, fetcher: () => Promise<Set<string> | null>) => {
    mocks.swr.push({ key, fetcher })
    return { data: undefined }
  },
}))
vi.mock('@/lib/collection', () => ({
  decodeCollectionAsync: mocks.decode,
  withBaseIdentities: (owned: Set<string>) => new Set([...owned, 'base-1']),
}))

import { useOwnedIdentities } from '@/hooks/useOwnedIdentities'

const CATALOG = { sinners: [{ id: 'faust' }], identities: {}, egos: {} }
let fetched: string[]
let store: Record<string, string>

beforeEach(() => {
  mocks.swr = []
  mocks.decode.mockReset().mockResolvedValue(new Set(['i-1']))
  fetched = []
  store = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null })
  vi.stubGlobal('fetch', async (url: string) => {
    fetched.push(url)
    if (url === '/api/collection') return { ok: true, json: async () => CATALOG }
    if (url === '/api/profile') return { ok: true, json: async () => ({ profile: { collection_code: 'PROFILE' } }) }
    return { ok: false }
  })
})
afterEach(() => vi.unstubAllGlobals())

const ask = () => {
  useOwnedIdentities()
  return mocks.swr.at(-1)!
}

describe('useOwnedIdentities for a visitor who is not signed in', () => {
  it('reads the code saved on the device and never asks for a profile', async () => {
    mocks.status = 'unauthenticated'
    store['limbus-collection'] = 'DEVICE'
    const { key, fetcher } = ask()
    expect(key).not.toBeNull()

    const owned = await fetcher()
    expect([...owned!].sort()).toEqual(['base-1', 'i-1'])
    expect(mocks.decode.mock.calls[0][0]).toBe('DEVICE')
    expect(fetched).not.toContain('/api/profile')
  })

  it('answers null without downloading the catalog when no code is saved', async () => {
    mocks.status = 'unauthenticated'
    expect(await ask().fetcher()).toBeNull()
    expect(fetched).toEqual([])
  })

  it('waits while the session is still loading', () => {
    mocks.status = 'loading'
    expect(ask().key).toBeNull()
  })
})

describe('useOwnedIdentities for a signed-in user', () => {
  it('keeps using the profile code under its own key', async () => {
    mocks.status = 'authenticated'
    const { key, fetcher } = ask()
    mocks.status = 'unauthenticated'
    expect(key).not.toEqual(ask().key)

    await fetcher()
    expect(mocks.decode.mock.calls[0][0]).toBe('PROFILE')
  })
})
