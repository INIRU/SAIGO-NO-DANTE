import { beforeEach, describe, expect, it, vi } from 'vitest'

const ID = 'd50ed946-7a8d-445b-a7b5-12d5d892d383'
const gift = { id: ID, game_id: 9250, name: '불꽃놀이', name_en: 'Fireworks', keyword: '화상', grade: 'II', image_url: null, effect_base: 'a', effect_plus: 'b', effect_plusplus: 'c', activation_condition: null }
const queries: { select: string; filters: [string, unknown][] }[] = []
let found: typeof gift | null = gift

vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: () => {
        const query = { select: '', filters: [] as [string, unknown][] }
        queries.push(query)
        const chain: Record<string, unknown> = {}
        chain.select = (columns: string) => { query.select = columns; return chain }
        chain.eq = (column: string, value: unknown) => { query.filters.push([column, value]); return chain }
        chain.limit = () => chain
        chain.maybeSingle = async () => ({ data: found, error: null })
        chain.then = (resolve: (value: unknown) => void) => resolve({ data: [{ name: gift.name }], error: null })
        return chain
      },
    }),
  }),
}))

import { GET } from '@/app/api/ego-gifts/route'

const get = (query = '') => GET(new Request('http://localhost/api/ego-gifts' + query))

beforeEach(() => { queries.length = 0; found = gift })

describe('REQ-DECKS-014 one gift for a note label', () => {
  it('REQ-DECKS-014 returns the whole gift for a uuid key (the id a note block carries), with the + and ++ effects the list leaves out', async () => {
    const res = await get('?key=' + ID)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: ID, name: '불꽃놀이', effect_plus: 'b', effect_plusplus: 'c' })
    expect(queries[0].filters).toEqual([['id', ID]])
    expect(queries[0].select).toContain('effect_plusplus_jp')
  })

  it('REQ-DECKS-014 looks any other key up by name (older note tokens), digits included', async () => {
    await get('?key=' + encodeURIComponent('불꽃놀이'))
    expect(queries[0].filters).toEqual([['name', '불꽃놀이']])
    await get('?key=9250')
    expect(queries[1].filters).toEqual([['name', '9250']])
  })

  it('REQ-DECKS-014 answers 404 when no gift matches', async () => {
    found = null
    expect((await get('?key=0')).status).toBe(404)
  })

  it('REQ-DECKS-014 keeps the light list when no key is given', async () => {
    const res = await get()
    expect(await res.json()).toEqual([{ name: '불꽃놀이' }])
    expect(queries[0].select).not.toContain('effect_plus')
  })
})
