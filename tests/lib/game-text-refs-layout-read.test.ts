import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ result: { data: [] as unknown[], error: null as { message: string } | null } }))
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({ from: () => ({ select: () => ({ order: () => ({ range: async () => state.result }) }) }) }),
  }),
}))

import { getGameTextRefNamesOrNull, getGameTextRefNamesWireOrNull } from '@/lib/db/game-text-refs'

const ROW = { id: 'Combustion', kind: 'keyword', name: '화상', name_en: 'Burn', name_jp: null, keyword_name: '화상' }

describe('the layout reads the names without ever failing the page', () => {
  beforeEach(() => { state.result = { data: [], error: null } })

  it('returns the names of the language when the table is read', async () => {
    state.result = { data: [ROW], error: null }
    expect(await getGameTextRefNamesOrNull('en')).toEqual({ Combustion: { k: 'keyword', n: 'Burn', kw: '화상' } })
  })

  it('returns null (the browser then requests the table) when the read fails', async () => {
    state.result = { data: [], error: { message: 'boom' } }
    expect(await getGameTextRefNamesOrNull('ko')).toBeNull()
  })

  it('returns null for an empty table, so an unfilled table is not taken as complete', async () => {
    expect(await getGameTextRefNamesOrNull('ko')).toBeNull()
  })
})

describe('the layout reads the smaller form without ever failing the page', () => {
  beforeEach(() => { state.result = { data: [], error: null } })

  it('returns the names of the language in the smaller form', async () => {
    state.result = { data: [{ ...ROW, icon_slug: 'game-Combustion' }], error: null }
    expect(await getGameTextRefNamesWireOrNull('en')).toEqual({ Combustion: { n: 'Burn', kw: '화상', i: 1 } })
  })

  it('returns null when the read fails or the table is empty', async () => {
    expect(await getGameTextRefNamesWireOrNull('ko')).toBeNull()
    state.result = { data: [], error: { message: 'boom' } }
    expect(await getGameTextRefNamesWireOrNull('ko')).toBeNull()
  })
})
