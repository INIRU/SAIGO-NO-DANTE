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
  ego_gifts: [],
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({ from: (table: string) => ({ select: async () => ({ data: TABLES[table], error: null }) }) }),
  }),
}))

import { GET } from '@/app/api/search/route'

const search = async () => {
  const response = await GET(new NextRequest('http://localhost/api/search?q=%ED%99%94%EC%83%81&lang=ko'))
  expect(response.status).toBe(200)
  return (await response.json()) as { items: { sublabel: string }[] }
}
const lives = () => mocks.cacheLife.mock.calls.map(([life]) => life)

describe('REQ-SHARED-020 search subtitles use the reference table without caching a failed read', () => {
  beforeEach(() => {
    mocks.cacheLife.mockClear()
    mocks.getGameTextRefNames.mockReset()
  })

  it('REQ-SHARED-020 turns [Id] into its name and caches the index for good when the table is read', async () => {
    mocks.getGameTextRefNames.mockResolvedValue({ Combustion: { k: 'keyword', n: '화상', kw: '화상' } })
    expect((await search()).items[0].sublabel).toBe('화상 3 부여')
    expect(lives()).toEqual(['max'])
  })

  it('REQ-SHARED-020 does not cache for good an index built while the table read failed', async () => {
    mocks.getGameTextRefNames.mockRejectedValue(new Error('game_text_refs: down'))
    expect((await search()).items[0].sublabel).toBe('[Combustion] 3 부여')
    expect(lives().at(-1)).not.toBe('max')
    expect(lives().at(-1)).toBe('page-1m')
  })

  it('REQ-SHARED-020 does not cache for good an index built while the table is still empty', async () => {
    mocks.getGameTextRefNames.mockResolvedValue({})
    await search()
    expect(lives().at(-1)).toBe('page-1m')
  })
})
