import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  getGameTextRefNames: vi.fn(),
}))
vi.mock('next/cache', () => ({ cacheLife: mocks.cacheLife, cacheTag: vi.fn() }))
vi.mock('@/lib/db/game-text-refs', () => ({ getGameTextRefNames: mocks.getGameTextRefNames }))

const TABLES: Record<string, unknown[]> = {
  sinners: [],
  identities: [],
  ego: [],
  keyword_meta: [{ name: '화상', name_en: 'Burn', name_jp: '火傷', description: '<style="highlight">[Combustion] 3</style> 부여', icon_slug: 'burn' }],
  ego_gifts: [{ id: 7, name: '불꽃 깃털', name_en: 'Flame Feather', name_jp: null, keyword: '화상', grade: '1', image_url: null }],
  ego_gift_themes: [],
  md_events: [],
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({ from: (table: string) => { const result = Promise.resolve({ data: TABLES[table], error: null }); const q = { select: () => q, eq: () => q, is: () => q, neq: () => q, then: result.then.bind(result) }; return q } }),
  }),
}))

import { GET } from '@/app/api/search/index/route'
import type { IndexEntry } from '@/lib/search/engine'

const load = async () => {
  const response = await GET(new NextRequest('http://localhost/api/search/index?lang=ko'))
  expect(response.status).toBe(200)
  return (await response.json()) as { entries: IndexEntry[] }
}
const keyword = async () => (await load()).entries.find(e => e.type === 'keyword')!
const lives = () => mocks.cacheLife.mock.calls.map(([life]) => life)

describe('search subtitles use the reference table without caching a failed read', () => {
  beforeEach(() => {
    mocks.cacheLife.mockClear()
    mocks.getGameTextRefNames.mockReset()
  })

  it('turns [Id] into its name and caches the index for good when the table is read', async () => {
    mocks.getGameTextRefNames.mockResolvedValue({ Combustion: { k: 'keyword', n: '화상', kw: '화상' } })
    expect((await keyword()).sublabel).toBe('화상 3 부여')
    expect(lives()).toEqual(['max'])
  })

  it('does not cache for good an index built while the table read failed', async () => {
    mocks.getGameTextRefNames.mockRejectedValue(new Error('game_text_refs: down'))
    expect((await keyword()).sublabel).toBe('[Combustion] 3 부여')
    expect(lives().at(-1)).not.toBe('max')
    expect(lives().at(-1)).toBe('page-1m')
  })

  it('does not cache for good an index built while the table is still empty', async () => {
    mocks.getGameTextRefNames.mockResolvedValue({})
    await load()
    expect(lives().at(-1)).toBe('page-1m')
  })
})

describe('search index entries link to their detail', () => {
  it('links gifts and keywords to the detail they open and gives gifts their keyword as context', async () => {
    mocks.getGameTextRefNames.mockResolvedValue({ Combustion: { k: 'keyword', n: '화상', kw: '화상' } })
    const { entries } = await load()
    const gift = entries.find(e => e.type === 'egoGift')!
    expect(gift.href).toBe('/mirror-dungeon?gift=7')
    expect(gift.context).toContainEqual({ field: 'keyword', text: 'Burn' })
    expect((await keyword()).href).toBe('/keywords?keyword=%ED%99%94%EC%83%81')
    expect(entries.some(e => e.type === 'page' && e.href === '/decks')).toBe(true)
  })
})
