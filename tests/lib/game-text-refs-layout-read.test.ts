import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ result: { data: [] as unknown[], error: null as { message: string } | null } }))
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({ from: () => ({ select: () => ({ order: () => ({ range: async () => state.result }) }) }) }),
  }),
}))

import { getGameTextRefNamesOrNull } from '@/lib/db/game-text-refs'

const ROW = { id: 'Combustion', kind: 'keyword', name: '화상', name_en: 'Burn', name_jp: null, keyword_name: '화상' }

describe('REQ-SHARED-023 the layout reads the names without ever failing the page', () => {
  beforeEach(() => { state.result = { data: [], error: null } })

  it('REQ-SHARED-023 returns the names of the language when the table is read', async () => {
    state.result = { data: [ROW], error: null }
    expect(await getGameTextRefNamesOrNull('en')).toEqual({ Combustion: { k: 'keyword', n: 'Burn', kw: '화상' } })
  })

  it('REQ-SHARED-023 returns null (the browser then requests the table) when the read fails', async () => {
    state.result = { data: [], error: { message: 'boom' } }
    expect(await getGameTextRefNamesOrNull('ko')).toBeNull()
  })

  it('REQ-SHARED-023 returns null for an empty table, so an unfilled table is not taken as complete', async () => {
    expect(await getGameTextRefNamesOrNull('ko')).toBeNull()
  })
})
