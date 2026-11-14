import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  getGameTextRefNames: vi.fn(),
}))
vi.mock('next/cache', () => ({ cacheLife: mocks.cacheLife, cacheTag: vi.fn() }))
vi.mock('@/lib/db/game-text-refs', () => ({ getGameTextRefNames: mocks.getGameTextRefNames }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: () => {
        const result = { data: [], error: null }
        const chain: Record<string, unknown> = { then: (resolve: (value: typeof result) => unknown) => resolve(result) }
        for (const method of ['select', 'order', 'range']) chain[method] = () => chain
        return chain
      },
    }),
  }),
}))
vi.mock('@/app/[lang]/keywords/_components/KeywordsClient', () => ({ default: function KeywordsClient() { return null } }))
vi.mock('@/app/[lang]/keywords/loading', () => ({ default: function KeywordsLoading() { return null } }))
vi.mock('@/components/providers/StaticQueryAdapter', () => ({ default: function StaticQueryAdapter() { return null } }))

import KeywordsPage from '@/app/[lang]/keywords/page'

/** Props of the KeywordsClient element somewhere in the page's element tree. */
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

describe('keywords page refs and caching', () => {
  beforeEach(() => {
    mocks.cacheLife.mockClear()
    mocks.getGameTextRefNames.mockReset()
  })

  it('hands the client the id to keyword table and caches for good when the table is read', async () => {
    mocks.getGameTextRefNames.mockResolvedValue({
      Combustion: { k: 'keyword', n: '화상', kw: '화상' },
      OnHit: { k: 'skilltag', n: '[적중시]' },
    })
    const props = clientProps(await KeywordsPage())
    expect(props?.refKeywords).toEqual({ Combustion: '화상' })
    expect(lives()).toEqual(['max'])
  })

  it('does not cache for good a page built while the refs read failed', async () => {
    mocks.getGameTextRefNames.mockRejectedValue(new Error('game_text_refs: down'))
    const props = clientProps(await KeywordsPage())
    expect(props?.refKeywords).toEqual({})
    expect(lives().at(-1)).toBe('page-1m')
  })

  it('does not cache for good a page built while the refs table is still empty', async () => {
    mocks.getGameTextRefNames.mockResolvedValue({})
    await KeywordsPage()
    expect(lives().at(-1)).toBe('page-1m')
  })
})
