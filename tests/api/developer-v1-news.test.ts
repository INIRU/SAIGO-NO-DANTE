import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  rpc: vi.fn(), calls: [] as [string, ...unknown[]][], existing: null as unknown, removed: [] as unknown[], writeError: null as unknown,
  revalidate: vi.fn(), admin: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    schema: () => ({
      rpc: m.rpc,
      from: (table: string) => {
        m.calls.push(['from', table])
        const chain: Record<string, unknown> = {}
        for (const method of ['select', 'eq', 'upsert', 'delete']) chain[method] = (...args: unknown[]) => { m.calls.push([method, ...args]); return chain }
        chain.maybeSingle = async () => ({ data: m.existing, error: null })
        chain.then = (resolve: (value: unknown) => void) => resolve({ data: m.removed, error: m.writeError })
        return chain
      },
    }),
  }),
}))
vi.mock('next/cache', () => ({ revalidateTag: m.revalidate }))
vi.mock('@/lib/auth', () => ({ requireAdmin: m.admin, adminEmails: () => (process.env.ADMIN_EMAILS ?? '').split(',').filter(Boolean) }))

import { DELETE, POST } from '@/app/api/v1/news/route'
import { DELETE as adminDelete } from '@/app/api/admin/news/route'

const KEY = `Bearer lmb_${'a'.repeat(64)}`
const item = {
  id: 'steam:5124582150142200443', feed: 'limbus', platform: 'steam', published_at: '2026-10-06T18:00:00+09:00',
  content: { ko: { title: '정기 점검 안내' }, en: { title: 'Scheduled maintenance' }, ja: { title: '定期メンテナンス' } },
}
const post = (body: unknown, query = '', authorization: string | null = KEY) => POST(new Request(`http://localhost/api/v1/news${query}`, {
  method: 'POST', headers: authorization ? { authorization } : {}, body: typeof body === 'string' ? body : JSON.stringify(body),
}))
const remove = (query: string) => DELETE(new Request(`http://localhost/api/v1/news${query}`, { method: 'DELETE', headers: { authorization: KEY } }))
const access = (scopes: string[], partner: string | null = 'limpi', admin = false) => m.rpc.mockResolvedValue({ data: { status: 200, remaining: null, partner, scopes, admin }, error: null })
const called = (method: string) => m.calls.filter(call => call[0] === method)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ADMIN_EMAILS', 'owner@example.invalid')
  m.calls.length = 0
  m.existing = null
  m.removed = []
  m.writeError = null
  access(['catalog:read', 'news:write'])
})

describe('news on the developer API', () => {
  it('refuses a missing key, an unusable key and an account without the news scope before writing', async () => {
    expect((await post(item, '', null)).status).toBe(401)
    expect(m.rpc).not.toHaveBeenCalled()
    m.rpc.mockResolvedValue({ data: { status: 429, retry: 60 }, error: null })
    const limited = await post(item)
    expect([limited.status, limited.headers.get('retry-after')]).toEqual([429, '60'])
    for (const [scopes, partner] of [[[], null], [['catalog:read'], 'qa_reader']] as const) {
      access([...scopes], partner)
      const response = await post(item)
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Partner scope news:write required' })
      expect((await remove('?id=steam:1')).status).toBe(403)
    }
    access(['news:write'])
    expect((await post(JSON.stringify({ ...item, content: { ko: { title: '가', body: '가'.repeat(70000) } } }))).status).toBe(413)
    expect(m.calls).toEqual([])
    expect(m.revalidate).not.toHaveBeenCalled()
  })

  it('creates an item for the key partner, refreshes the calendar and answers with its calendar address', async () => {
    const response = await post(item)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ data: { id: item.id, created: true, day: '2026-10-06', url: 'https://saigo-no-dante.com/ko/calendar?date=2026-10-06' } })
    expect(called('from')).toEqual([['from', 'news_items'], ['from', 'news_items']])
    expect(called('eq')).toEqual([['eq', 'partner', 'limpi'], ['eq', 'external_id', item.id]])
    const [, row, options] = called('upsert')[0]
    expect(row).toMatchObject({ partner: 'limpi', external_id: item.id, feed: 'limbus', platform: 'steam', category: 'notice', spoiler: false, author: null })
    expect(row).not.toHaveProperty('id')
    expect(Object.keys((row as { content: object }).content)).toEqual(['ko', 'en', 'ja'])
    expect(options).toEqual({ onConflict: 'partner,external_id' })
    expect(m.revalidate).toHaveBeenCalledWith('news', 'max')
  })

  it('replaces an item posted again with the same id', async () => {
    m.existing = { id: 'row-1' }
    const response = await post({ ...item, ends_at: '2026-10-06T20:00:00+09:00' })
    expect(response.status).toBe(200)
    expect((await response.json()).data.created).toBe(false)
    expect(called('upsert')[0][1]).toMatchObject({ ends_at: '2026-10-06T20:00:00+09:00' })
    m.writeError = { message: 'private database diagnostic' }
    const failed = await post(item)
    expect(failed.status).toBe(503)
    expect(await failed.text()).not.toContain('private database diagnostic')
  })

  it('answers a wrong body with the fields that are wrong and stores nothing', async () => {
    const response = await post({ ...item, feed: 'steam', content: { ko: { title: '' } } })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid news item')
    expect(body.issues.map((issue: { path: string }) => issue.path)).toEqual(['feed', 'content.ko.title'])
    expect((await post('{not json')).status).toBe(400)
    expect(called('upsert')).toEqual([])
  })

  it('validates a dry run without storing it', async () => {
    const response = await post(item, '?dry_run=1')
    expect(response.status).toBe(200)
    const { data } = await response.json()
    expect(data).toMatchObject({ id: item.id, dry_run: true, day: '2026-10-06', url: 'https://saigo-no-dante.com/ko/calendar?date=2026-10-06' })
    expect(data.item.content.ko).toEqual({ title: '정기 점검 안내', body: '', url: null, media: [], translated: false })
    expect((await post({ ...item, feed: 'x' }, '?dry_run=1')).status).toBe(400)
    expect(m.calls).toEqual([])
    expect(m.revalidate).not.toHaveBeenCalled()
  })

  it('lets an administrator key dry-run but not store or delete without a partner', async () => {
    access([], null, true)
    expect((await post(item, '?dry_run=1')).status).toBe(200)
    const response = await post(item)
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Storing news needs a partner account; an administrator key can only dry-run' })
    expect((await remove('?id=steam:1')).status).toBe(403)
    expect(m.calls).toEqual([])
    expect(m.rpc).toHaveBeenLastCalledWith('consume_developer_key', { token_hash: expect.any(String), p_admin_emails: ['owner@example.invalid'] })
  })

  it('deletes only the key partner item and refreshes the calendar', async () => {
    expect((await remove('')).status).toBe(400)
    m.removed = [{ id: 'row-1' }]
    const response = await remove('?id=steam:1')
    expect(await response.json()).toEqual({ data: { id: 'steam:1', deleted: true } })
    expect(called('eq')).toEqual([['eq', 'partner', 'limpi'], ['eq', 'external_id', 'steam:1']])
    expect(m.revalidate).toHaveBeenCalledTimes(1)
    m.removed = []
    expect((await (await remove('?id=steam:2')).json()).data.deleted).toBe(false)
    expect(m.revalidate).toHaveBeenCalledTimes(1)
  })

  it('lets an administrator delete any item by its row id', async () => {
    const id = '00000000-0000-4000-8000-000000000001'
    const request = (query: string) => new Request(`http://localhost/api/admin/news${query}`, { method: 'DELETE' })
    m.admin.mockResolvedValue({ error: true, response: new Response(null, { status: 403 }) })
    expect((await adminDelete(request(`?id=${id}`))).status).toBe(403)
    expect(m.calls).toEqual([])
    m.admin.mockResolvedValue({ error: false, session: { user: { email: 'admin@example.invalid' } } })
    expect((await adminDelete(request('?id=steam:1'))).status).toBe(400)
    m.removed = [{ id }]
    expect((await adminDelete(request(`?id=${id}`))).status).toBe(200)
    expect(called('eq')).toEqual([['eq', 'id', id]])
    expect(m.revalidate).toHaveBeenCalledWith('news', 'max')
  })
})
