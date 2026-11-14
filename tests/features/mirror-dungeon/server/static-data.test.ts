import { describe, expect, it } from 'vitest'
import { GIFT_COLUMNS, RECIPE_COLUMNS, THEME_COLUMNS } from '@/lib/db/columns'
import { OBSERVATION_COLUMNS } from '@/features/planner'
import { giftsQuery, observationQuery, recipesQuery, themesQuery } from '@/features/mirror-dungeon/server/static-data'

type Call = [string, ...unknown[]]

/** A client whose query builder only records the calls made on it, in order. */
function fakeClient() {
  const calls: Call[] = []
  const builder: Record<string, unknown> = new Proxy({}, {
    get: (_, name: string) => (...args: unknown[]) => { calls.push([name, ...args]); return builder },
  })
  const client = {
    schema: (...args: unknown[]) => {
      calls.push(['schema', ...args])
      return { from: (...from: unknown[]) => { calls.push(['from', ...from]); return builder } }
    },
  }
  return { client: client as never, calls }
}

describe('theme pack columns', () => {
  it('are the list the planner, run, PiP preview, plan detail and prescript pages each wrote out', () => {
    expect(THEME_COLUMNS).toBe('id, name, name_en, name_jp, ego_gift_ids, specific_ego_gift_ids, fixed_reward_gift_ids, image_url, difficulty, floor_info, name_color, name_segments')
  })
})

describe('mirror dungeon static queries', () => {
  it('themes: every pack, no order', () => {
    const { client, calls } = fakeClient()
    themesQuery(client)
    expect(calls).toEqual([['schema', 'limbus'], ['from', 'ego_gift_themes'], ['select', THEME_COLUMNS]])
  })

  it('gifts: ordered by keyword, then grade', () => {
    const { client, calls } = fakeClient()
    giftsQuery(client)
    expect(calls).toEqual([['schema', 'limbus'], ['from', 'ego_gifts'], ['select', GIFT_COLUMNS], ['order', 'keyword'], ['order', 'grade']])
  })

  it('recipes: every recipe, no order', () => {
    const { client, calls } = fakeClient()
    recipesQuery(client)
    expect(calls).toEqual([['schema', 'limbus'], ['from', 'ego_gift_recipes'], ['select', RECIPE_COLUMNS]])
  })

  it('observation: the latest season row only', () => {
    const { client, calls } = fakeClient()
    observationQuery(client)
    expect(calls).toEqual([
      ['schema', 'limbus'], ['from', 'md_observation'], ['select', OBSERVATION_COLUMNS],
      ['order', 'mirror_dungeon_id', { ascending: false }], ['limit', 1], ['maybeSingle'],
    ])
  })
})
