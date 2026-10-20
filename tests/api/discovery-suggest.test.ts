import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Formation } from '@/lib/discovery/co-occurrence'

const state = vi.hoisted(() => ({ fail: false }))
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const [X, R, P, Q, E1, E2] = [1, 2, 3, 4, 5, 6].map(uuid)

vi.mock('@/lib/db/meta', () => {
  const f = (id: string, identities: string[]): Formation => ({ kind: 'deck', id, identities, votes: 0, views: 0 })
  return {
    getFormations: async () => { if (state.fail) throw new Error('down'); return [...Array.from({ length: 5 }, (_, i) => f(`x${i}`, [X, R, P, Q])), ...Array.from({ length: 15 }, (_, i) => f(`p${i}`, [P]))] },
    getMetaCatalog: async () => ({ identities: [{ id: R, sinner_id: 'faust' }, { id: P, sinner_id: 'faust' }, { id: Q, sinner_id: 'ishmael' }, { id: X, sinner_id: 'yisang' }] }),
    getMetaData: async () => ({ identityInsights: { [X]: { egos: [{ ego_id: E1, count: 7 }, { ego_id: E2, count: 2 }] } } }),
    getPlanChoices: async () => Array.from({ length: 3 }, () => ({ identities: [X], keywords: ['화상'], floors: { 1: { theme: '11', gifts: ['9001'] } } })),
  }
})

import { GET } from '@/app/api/discovery/suggest/route'

const ask = (query: string) => GET(new Request(`http://localhost/api/discovery/suggest?${query}`))

beforeEach(() => { state.fail = false })

describe('GET /api/discovery/suggest', () => {
  it('REQ-DECKS-022 suggests identities of the asked sinner beside the fielded identities', async () => {
    const body = await (await ask(`type=identity&sinner=faust&with=${X}`)).json()
    expect(body.items.map((row: { id: string }) => row.id)).toEqual([R])
  })

  it('REQ-DECKS-023 lists the E.G.O most often equipped with the identity, three times at least', async () => {
    const body = await (await ask(`type=ego&identity=${X}`)).json()
    expect(body.items).toEqual([{ id: E1, count: 7 }])
  })

  it('REQ-PLANNER-029 lists the packs and gifts similar plans took on the floor', async () => {
    const body = await (await ask(`type=floor&floor=1&identities=${X}&keywords=${encodeURIComponent('화상')}`)).json()
    expect(body).toEqual({ themes: [{ id: '11', count: 3 }], gifts: [{ id: '9001', count: 3 }] })
  })

  it('REQ-DECKS-024 refuses bad parameters and answers an unreadable count with an error, not guesses', async () => {
    expect((await ask('type=identity&sinner=faust&with=not-an-id')).status).toBe(400)
    expect((await ask('type=floor&floor=99')).status).toBe(400)
    expect((await ask('type=nothing')).status).toBe(400)
    state.fail = true
    expect((await ask(`type=identity&sinner=faust&with=${X}`)).status).toBe(503)
  })
})
