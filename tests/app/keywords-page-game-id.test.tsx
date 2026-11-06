import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  getGameTextRefNames: vi.fn(),
  tables: {} as Record<string, Record<string, unknown>[]>,
  missingGameId: false,
  refsError: false,
}))
vi.mock('next/cache', () => ({ cacheLife: mocks.cacheLife, cacheTag: vi.fn() }))
vi.mock('@/lib/db/game-text-refs', () => ({ getGameTextRefNames: mocks.getGameTextRefNames }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: (table: string) => {
        let columns = ''
        const chain: Record<string, unknown> = {}
        chain.select = (cols: string) => { columns = cols; return chain }
        for (const method of ['eq', 'order']) chain[method] = () => chain
        chain.range = async (from: number) => {
          if (table === 'keyword_meta' && columns.includes('game_id') && mocks.missingGameId) return { data: null, error: { code: '42703', message: 'column keyword_meta.game_id does not exist' } }
          if (table === 'game_text_refs' && mocks.refsError) return { data: null, error: { message: 'down' } }
          const rows = mocks.tables[table] ?? []
          return { data: from > 0 ? [] : table === 'keyword_meta' && !columns.includes('game_id') ? rows.map(({ game_id: _, ...rest }) => rest) : rows, error: null }
        }
        return chain
      },
    }),
  }),
}))
vi.mock('@/app/[lang]/keywords/_components/KeywordsClient', () => ({ default: function KeywordsClient() { return null } }))
vi.mock('@/app/[lang]/keywords/loading', () => ({ default: function KeywordsLoading() { return null } }))
vi.mock('@/components/providers/StaticQueryAdapter', () => ({ default: function StaticQueryAdapter() { return null } }))

import KeywordsPage from '@/app/[lang]/keywords/page'

function clientProps(node: ReactNode): Record<string, unknown> | null {
  if (!isValidElement(node)) return null
  const element = node as ReactElement<{ children?: ReactNode }>
  if ((element.type as { name?: string }).name === 'KeywordsClient') return element.props as Record<string, unknown>
  const children = element.props.children
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = clientProps(child)
    if (found) return found
  }
  return null
}
const lives = () => mocks.cacheLife.mock.calls.map(([life]) => life)

const META = [
  { name: '화상', description: '옛 설명', name_en: 'old Burn', name_jp: null, description_en: null, description_jp: null, icon_slug: 'burn', max_stack: null, sin_affinity: null, category: 'status', game_id: 'Combustion' },
  { name: '호흡', description: '크리티컬', name_en: 'Poise', name_jp: null, description_en: null, description_jp: null, icon_slug: null, max_stack: null, sin_affinity: null, category: 'status', game_id: null },
]
const REFS = [{ id: 'Combustion', name: '화상', name_en: 'Burn', name_jp: '火傷', description: '턴 종료 시 피해', description_en: 'Take damage', description_jp: null }]

type Keyword = { name: string; name_en: string | null; name_jp: string | null; description: string | null; description_en: string | null }
const keywordsOf = (props: Record<string, unknown> | null) => props?.keywords as Keyword[]

describe('REQ-KEYWORDS-004 keywords page texts come from the game text references', () => {
  beforeEach(() => {
    mocks.cacheLife.mockClear()
    mocks.getGameTextRefNames.mockReset()
    mocks.getGameTextRefNames.mockResolvedValue({ Combustion: { k: 'keyword', n: '화상', kw: '화상' } })
    mocks.tables = { keyword_meta: META, game_text_refs: REFS }
    mocks.missingGameId = false
    mocks.refsError = false
  })

  it('REQ-KEYWORDS-004 hands the client the reference names and descriptions of a row with a game_id and keyword_meta\'s for the others', async () => {
    const keywords = keywordsOf(clientProps(await KeywordsPage()))
    expect(keywords[0]).toMatchObject({ name: '화상', name_en: 'Burn', name_jp: '火傷', description: '턴 종료 시 피해', description_en: 'Take damage' })
    expect(keywords[0]).not.toHaveProperty('game_id')
    expect(keywords[1]).toMatchObject({ name: '호흡', name_en: 'Poise', description: '크리티컬' })
    expect(lives()).toEqual(['max'])
  })

  it('REQ-KEYWORDS-004 still lists every keyword from keyword_meta before the game_id migration is applied', async () => {
    mocks.missingGameId = true
    const keywords = keywordsOf(clientProps(await KeywordsPage()))
    expect(keywords.map(keyword => keyword.name)).toEqual(['화상', '호흡'])
    expect(keywords[0].name_en).toBe('old Burn')
  })

  it('REQ-KEYWORDS-004 builds the page from keyword_meta and caches it only briefly while the reference texts cannot be read', async () => {
    mocks.refsError = true
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const keywords = keywordsOf(clientProps(await KeywordsPage()))
    expect(keywords[0]).toMatchObject({ name: '화상', name_en: 'old Burn', description: '옛 설명' })
    expect(lives().at(-1)).toBe('page-1m')
    error.mockRestore()
  })
})
