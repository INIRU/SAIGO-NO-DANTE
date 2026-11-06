import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  rpc: vi.fn(), calls: [] as [string, ...unknown[]][], rows: [] as unknown[],
  loadCatalog: vi.fn(), loadCatalogItem: vi.fn(), loadDeckDetail: vi.fn(), loadPlanDetail: vi.fn(),
  auth: vi.fn(), keys: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ schema: () => ({ rpc: m.rpc, from: (table: string) => m.keys(table) }) }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    schema: () => ({
      from: (table: string) => {
        m.calls.push(['from', table])
        const chain: Record<string, unknown> = {}
        for (const method of ['select', 'order', 'range', 'eq', 'ilike']) chain[method] = (...args: unknown[]) => { m.calls.push([method, ...args]); return chain }
        chain.then = (resolve: (value: unknown) => void) => resolve({ data: m.rows, error: null })
        return chain
      },
    }),
  }),
}))
vi.mock('@/features/account/server/partner-data', () => ({ loadCatalog: m.loadCatalog, loadCatalogItem: m.loadCatalogItem, loadDeckDetail: m.loadDeckDetail, loadPlanDetail: m.loadPlanDetail }))
vi.mock('@/lib/auth', () => ({ requireActiveUser: m.auth }))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({ findOrCreateSupabaseUser: async () => 'user-1' }))
vi.mock('@/lib/rate-limit', () => ({ checkRequestRateLimit: () => ({ allowed: true }), rateLimitResponse: () => new Response(null, { status: 429 }) }))

import { GET } from '@/app/api/v1/[resource]/route'
import { GET as listKeys } from '@/app/api/developer/keys/route'

const ID = '00000000-0000-4000-8000-000000000001'
const get = (resource: string, query = '') => GET(
  new Request(`http://localhost/api/v1/${resource}${query}`, { headers: { authorization: `Bearer lmb_${'a'.repeat(64)}` } }),
  { params: Promise.resolve({ resource }) },
)
const standard = () => m.rpc.mockResolvedValue({ data: { status: 200, remaining: 9000, partner: null }, error: null })
const partner = (scopes = ['catalog:read', 'news:write']) => m.rpc.mockResolvedValue({ data: { status: 200, remaining: null, partner: 'limpi', scopes }, error: null })
const called = (method: string) => m.calls.filter(call => call[0] === method)

beforeEach(() => {
  vi.clearAllMocks()
  m.calls.length = 0
  m.rows = [{ id: ID, title: '덱' }]
  m.loadCatalog.mockResolvedValue([{ id: 7, game_id: 9079, name: '기프트', name_en: 'Gift', name_jp: null, image_url: null }, { id: 8, game_id: 9080, name: '둘', name_en: 'Two', name_jp: null, image_url: null }])
  m.loadCatalogItem.mockResolvedValue(null)
})

describe('partner resources on the developer API', () => {
  it('REQ-ACCOUNT-012 refuses partner resources to a standard key without reading them', async () => {
    standard()
    for (const resource of ['identities', 'egos', 'ego-gifts', 'theme-packs', 'md-events', 'keywords']) {
      const response = await get(resource)
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Partner access required' })
    }
    expect(m.loadCatalog).not.toHaveBeenCalled()
    expect((await get('unknown')).status).toBe(404)
  })

  it('REQ-ACCOUNT-012 returns a partner catalog in the requested language without a daily quota header', async () => {
    partner()
    const response = await get('ego-gifts', '?lang=en')
    expect(response.status).toBe(200)
    expect(response.headers.get('x-ratelimit-remaining')).toBeNull()
    expect((await response.json()).data.map((gift: { name: string }) => gift.name)).toEqual(['Gift', 'Two'])
    expect(m.loadCatalog).toHaveBeenCalledWith('ego-gifts')
    expect((await (await get('ego-gifts', '?id=9080')).json()).data).toEqual([expect.objectContaining({ game_id: 9080, name: '둘' })])
    expect((await get('ego-gifts', '?lang=fr')).status).toBe(400)
  })

  it('REQ-ACCOUNT-012 reads one identity with its skills by id', async () => {
    partner()
    m.loadCatalogItem.mockResolvedValue({ id: ID, sinner_id: 'faust', game_id: '10201', folder_name: 'LCB Sinner', name: 'LCB', name_kr: '수감자', name_en: 'Sinner', name_jp: null, skills: [], passives: [] })
    const body = await (await get('identities', `?id=${ID}&lang=en`)).json()
    expect(m.loadCatalogItem).toHaveBeenCalledWith('identities', ID)
    expect(body.data).toEqual([expect.objectContaining({ id: ID, name: 'Sinner', skills: [] })])
    expect((await get('identities', '?id=not-a-uuid')).status).toBe(400)
    m.loadCatalogItem.mockResolvedValue(null)
    expect((await (await get('identities', `?id=${ID}`)).json()).data).toEqual([])
  })

  it('REQ-ACCOUNT-013 gives a partner key the formation detail and leaves the standard response as it was', async () => {
    partner()
    m.loadDeckDetail.mockResolvedValue({ id: ID, title: '덱', deck_identities: [], deck_egos: [] })
    const detail = await (await get('decks', `?id=${ID}`)).json()
    expect(m.loadDeckDetail).toHaveBeenCalledWith(ID)
    expect(detail.data[0]).toMatchObject({ id: ID, formation: [], egos: [], analysis: { attack_types: { slash: 0, pierce: 0, blunt: 0 } } })
    m.loadPlanDetail.mockResolvedValue({ plan: { id: ID, title: '플랜', deck: [], egos: [], floor_plan: [], gift_inventory: [] }, identities: [], egos: [] })
    expect((await (await get('planners', `?id=${ID}`)).json()).data[0]).toMatchObject({ id: ID, formation: [], floors: [], gift_inventory: [] })
    const list = await (await get('decks')).json()
    expect(list.data[0].url).toMatch(/\/ko\/decks\/00000000-/)

    standard()
    m.loadDeckDetail.mockClear()
    const response = await get('decks', `?id=${ID}`)
    expect(response.headers.get('x-ratelimit-remaining')).toBe('9000')
    expect((await response.json()).data).toEqual([{ id: ID, title: '덱' }])
    expect(m.loadDeckDetail).not.toHaveBeenCalled()
  })

  it('REQ-ACCOUNT-015 searches titles literally and sorts by votes on request', async () => {
    standard()
    await get('planners', '?q=50%25_a&sort=popular')
    expect(called('from')).toEqual([['from', 'md_plans']])
    expect(called('ilike')).toEqual([['ilike', 'title', '%50\\%\\_a%']])
    expect(called('order')[0]).toEqual(['order', 'vote_count', { ascending: false }])
    m.calls.length = 0
    await get('decks')
    expect(called('ilike')).toEqual([])
    expect(called('order')[0]).toEqual(['order', 'created_at', { ascending: false }])
    expect((await get('decks', '?sort=oldest')).status).toBe(400)
    expect((await get('decks', `?q=${'a'.repeat(101)}`)).status).toBe(400)
  })

  it('REQ-ACCOUNT-018 gives game data only to a partner whose scopes include catalog:read', async () => {
    partner(['news:write'])
    expect((await get('ego-gifts')).status).toBe(403)
    expect(m.loadCatalog).not.toHaveBeenCalled()
    // Without the scope a deck id is answered like a standard key: the list shape, no formation.
    const response = await get('decks', `?id=${ID}`)
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual([{ id: ID, title: '덱' }])
    expect(m.loadDeckDetail).not.toHaveBeenCalled()
    partner(['catalog:read'])
    expect((await get('ego-gifts')).status).toBe(200)
  })

  it('REQ-ACCOUNT-022 lets an administrator key read game data without being a partner', async () => {
    m.rpc.mockResolvedValue({ data: { status: 200, remaining: 9000, partner: null, scopes: [], admin: true }, error: null })
    const response = await get('ego-gifts')
    expect(response.status).toBe(200)
    expect(response.headers.get('x-ratelimit-remaining')).toBe('9000')
    await get('decks', `?id=${ID}`)
    expect(m.loadDeckDetail).toHaveBeenCalledWith(ID)
  })

  it('REQ-ACCOUNT-014 returns the account partner code, name and scopes with the key list', async () => {
    m.auth.mockResolvedValue({ error: false, session: { user: { email: 'dev@example.invalid', name: 'Dev', image: null } } })
    m.keys.mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {}
      for (const method of ['select', 'eq', 'order']) chain[method] = () => chain
      chain.maybeSingle = async () => ({ data: { partner: { code: 'limpi', name: '림피', scopes: ['catalog:read', 'news:write'] } }, error: null })
      chain.then = (resolve: (value: unknown) => void) => resolve({ data: table === 'developer_keys' ? [{ id: 'k1', name: 'bot' }] : null, error: null })
      return chain
    })
    const body = await (await listKeys(new Request('http://localhost/api/developer/keys'))).json()
    expect(body).toEqual({ keys: [{ id: 'k1', name: 'bot' }], partner: { code: 'limpi', name: '림피', scopes: ['catalog:read', 'news:write'] }, admin: false })
  })
})
