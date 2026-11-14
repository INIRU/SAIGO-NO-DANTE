import { beforeEach, describe, expect, it, vi } from 'vitest'

type Result = { data: unknown[] | null; error: { message: string } | null }
const state = vi.hoisted(() => ({ selects: [] as string[], calls: [] as string[], results: [] as unknown[] }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    schema: (name: string) => {
      state.calls.push(`schema:${name}`)
      return {
        from: (table: string) => {
          state.calls.push(`from:${table}`)
          return {
            select: (select: string) => {
              state.selects.push(select)
              const result = state.results.shift() as Result
              const query = {
                order: (column: string, options?: { ascending: boolean }) => {
                  state.calls.push(`order:${column}${options ? `:${options.ascending}` : ''}`)
                  return Object.assign(Promise.resolve(result), query)
                },
              }
              return query
            },
          }
        },
      }
    },
  }),
}))

import { IDENTITY_FILTER_SELECT_LEGACY, IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS } from '@/features/decks/lib/filter-params'
import { loadIdentityFilterOptions } from '@/features/decks/hooks/useIdentityFilterOptions'

beforeEach(() => { state.selects = []; state.calls = []; state.results = [] })

describe('loadIdentityFilterOptions', () => {
  it('reads the identities by sinner, grade (highest first) and name', async () => {
    const rows = [{ id: 'i1' }]
    state.results = [{ data: rows, error: null }]
    await expect(loadIdentityFilterOptions()).resolves.toBe(rows)
    expect(state.selects).toEqual([IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS])
    expect(state.calls).toEqual(['schema:limbus', 'from:identities', 'order:sinner_id', 'order:rarity:false', 'order:name_kr'])
  })

  it('tries again without the skill keyword column when the database does not have it yet', async () => {
    const rows = [{ id: 'i1' }]
    state.results = [{ data: null, error: { message: 'column identities.skill_keyword_list does not exist' } }, { data: rows, error: null }]
    await expect(loadIdentityFilterOptions()).resolves.toBe(rows)
    expect(state.selects).toEqual([IDENTITY_FILTER_SELECT_WITH_SKILL_KEYWORDS, IDENTITY_FILTER_SELECT_LEGACY])
  })

  it('throws any other error, and the error of the second try', async () => {
    const other = { message: 'permission denied' }
    state.results = [{ data: null, error: other }]
    await expect(loadIdentityFilterOptions()).rejects.toBe(other)
    expect(state.selects).toHaveLength(1)

    state.selects = []
    const second = { message: 'permission denied for the legacy read' }
    state.results = [{ data: null, error: { message: 'skill_keyword_list is missing' } }, { data: null, error: second }]
    await expect(loadIdentityFilterOptions()).rejects.toBe(second)
    expect(state.selects).toHaveLength(2)
  })
})
