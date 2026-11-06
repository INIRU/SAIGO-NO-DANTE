import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const selects: Record<string, string[]> = {}
const rowsByTable: Record<string, unknown> = {
  decks: {
    id: 'd1', user_id: 'u1', title: '덱', description: null, vote_count: 3, view_count: 7,
    deck_identities: [{ slot_order: 0, identities: { id: 'i1', sinner_id: 'yi-sang', game_id: '10101' } }],
    deck_egos: [{ grade: 'ZAYIN', ego: { id: 'e1', sinner_id: 'yi-sang', grade: 'ZAYIN', game_id: '20101' } }],
  },
  sinners: [{ id: 'yi-sang', order_num: 1 }],
  ego: [{ id: 'e1', sinner_id: 'yi-sang', grade: 'ZAYIN', name_kr: '이상 자인', sin_affinity: 'Gloom', image_url: null, game_id: '20101' }],
  ego_skills: [],
}

function query(table: string) {
  const result = { data: rowsByTable[table], error: null }
  const chain: Record<string, unknown> = {
    select: (columns: string) => { (selects[table] ??= []).push(columns); return chain },
    then: (resolve: (value: typeof result) => unknown) => resolve(result),
  }
  for (const name of ['eq', 'in', 'order']) chain[name] = () => chain
  chain.single = async () => result
  return chain
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ schema: () => ({ from: query }) }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ schema: () => ({ from: query }) }) }))
vi.mock('next-auth', () => ({ getServerSession: async () => null }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/features/community/server/post-authors', () => ({ withPostAuthors: async (rows: unknown[]) => rows }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }))

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/decks/[id]/route'

const get = (query = '') => GET(new NextRequest(`http://localhost/api/decks/d1${query}`), { params: Promise.resolve({ id: 'd1' }) })

describe('REQ-DECKS-051 the deck detail does not download its first view again', () => {
  beforeEach(() => { for (const key of Object.keys(selects)) delete selects[key] })

  it('REQ-DECKS-051 ?part=viewer returns only what the rendered page lacks, without identity skills or passives', async () => {
    const response = await get('?part=viewer')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Object.keys(body).sort()).toEqual(['all_sinner_egos', 'deck_code', 'is_admin', 'is_owner', 'view_count', 'vote_count'])
    expect(body.all_sinner_egos).toHaveLength(1)
    expect(selects.decks[0]).not.toMatch(/skills\(|passives\(|description/)
    expect(body.deck_code).toBe((await (await get()).json()).deck_code)
  })

  it('REQ-DECKS-051 without the part the whole deck comes back as before', async () => {
    const body = await (await get()).json()
    expect(body).toHaveProperty('deck_identities')
    expect(selects.decks[0]).toMatch(/skills\(/)
  })

  it('REQ-DECKS-051 the page asks for the viewer part when it has the first view, and shares the gift list key with note chips', () => {
    const client = readFileSync(join(process.cwd(), 'app/[lang]/decks/[id]/DeckDetailClient.tsx'), 'utf8')
    expect(client).toMatch(/initialDeck \? `\/api\/decks\/\$\{id\}\?part=viewer` : `\/api\/decks\/\$\{id\}`/)
    expect(client).toMatch(/useSWR\('\/api\/ego-gifts', fetchNoteGifts/)
    expect(client).not.toMatch(/fetch\('\/api\/ego-gifts'\)/)
  })
})
