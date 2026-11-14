import { beforeEach, describe, it, expect, vi } from 'vitest'
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  admin: vi.fn(),
  owner: vi.fn(),
  db: vi.fn(),
  query: {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({
  requireUser: m.auth,
  requireAdmin: m.admin,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: m.db }))
vi.mock('@/lib/supabase/findOrCreateUser', () => ({
  findOrCreateSupabaseUser: m.owner,
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRequestRateLimit: () => ({ allowed: true }),
  rateLimitResponse: vi.fn(),
}))
import { GET, POST } from '@/app/api/inquiries/route'
import { GET as adminGET } from '@/app/api/admin/inquiries/route'
import { POST as followUp } from '@/app/api/inquiries/[id]/route'
import { GET as adminThread, PATCH as adminPATCH, POST as adminReply } from '@/app/api/admin/inquiries/[id]/route'
const id = '8a5b7a52-5f0f-4d0e-9f3c-0d2b2f4a1c11'
const ctx = { params: Promise.resolve({ id }) }
const json = (body: unknown) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body) })
const thread = (patch: object) => ({
  data: { id, status: 'open', category: 'bug', reply: '', support_messages: [], ...patch },
  error: null,
})
const active = {
  error: false,
  session: { user: { email: 'qa@example.invalid' } },
}
beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue(active)
  m.owner.mockResolvedValue('owner-id')
  m.db.mockReturnValue({ schema: () => ({ from: () => m.query }) })
  for (const name of ['select', 'eq', 'order', 'insert', 'update', 'delete'] as const)
    m.query[name].mockReturnValue(m.query)
  m.query.limit.mockResolvedValue({ data: [], error: null })
  m.query.single.mockResolvedValue({ data: { id: 'new-id' }, error: null })
})
describe('private support routes', () => {
  it('denies anonymous reads before querying the database', async () => {
    m.auth.mockResolvedValue({
      error: true,
      response: new Response(null, { status: 401 }),
    })
    expect((await GET()).status).toBe(401)
    expect(m.db).not.toHaveBeenCalled()
  })
  it('always filters reads to the authenticated owner and disables caching', async () => {
    const r = await GET()
    expect(r.status).toBe(200)
    expect(m.query.eq).toHaveBeenCalledWith('user_id', 'owner-id')
    expect(r.headers.get('cache-control')).toBe('private, no-store')
  })
  it('derives ownership from the session, ignoring a forged owner field', async () => {
    const r = await POST(
      new Request('http://localhost/api/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          title: '문의',
          content: '본문',
          category: 'bug',
          user_id: 'victim',
        }),
      }),
    )
    expect(r.status).toBe(201)
    expect(m.query.insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: '문의', content: '본문', category: 'bug', user_id: 'owner-id' }),
    )
    expect(m.query.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ inquiry_id: 'new-id', author_role: 'user', author_id: 'owner-id', body: '본문' }),
    )
  })
  it('requires admin privileges for the shared inbox', async () => {
    m.admin.mockResolvedValue({
      error: true,
      response: new Response(null, { status: 403 }),
    })
    expect((await adminGET()).status).toBe(403)
    expect(m.db).not.toHaveBeenCalled()
  })
  it('the admin inbox and thread carry the inquirer\'s profile name; the user\'s own reads do not', async () => {
    const author = 'author:profiles!inquiries_user_id_fkey(username)'
    m.admin.mockResolvedValue(active)
    m.query.maybeSingle.mockResolvedValue(thread({ author: { username: '파우스트' } }))
    expect((await adminGET()).status).toBe(200)
    expect(m.query.select).toHaveBeenLastCalledWith(expect.stringContaining(author))
    const one = await adminThread(json({}), ctx)
    expect(m.query.select).toHaveBeenLastCalledWith(expect.stringContaining(author))
    expect((await one.json()).author).toEqual({ username: '파우스트' })
    m.query.select.mockClear()
    await GET()
    expect(m.query.select).toHaveBeenCalledWith(expect.not.stringContaining('profiles'))
  })
  it('only reads threads owned by the session user', async () => {
    m.query.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await followUp(json({ body: '추가 질문' }), ctx)).status).toBe(404)
    expect(m.query.eq).toHaveBeenCalledWith('user_id', 'owner-id')
  })
  it('refuses follow-ups once an administrator closes the thread', async () => {
    m.query.maybeSingle.mockResolvedValue(thread({ status: 'closed' }))
    expect((await followUp(json({ body: '추가 질문' }), ctx)).status).toBe(409)
    expect(m.query.insert).not.toHaveBeenCalled()
  })
  it('reopens the thread for the admin when the user follows up', async () => {
    m.query.maybeSingle.mockResolvedValue(thread({ status: 'answered' }))
    expect((await followUp(json({ body: '추가 질문' }), ctx)).status).toBe(201)
    expect(m.query.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }))
  })
  it('marks an admin reply answered and mirrors it for the contribution review', async () => {
    m.admin.mockResolvedValue(active)
    m.query.maybeSingle.mockResolvedValue(thread({}))
    expect((await adminReply(json({ body: 'Fixed' }), ctx)).status).toBe(201)
    expect(m.query.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'answered', reply: 'Fixed', replied_by: 'owner-id' }),
    )
  })
  it('awards a contribution only after a data correction was answered', async () => {
    m.admin.mockResolvedValue(active)
    m.query.maybeSingle.mockResolvedValue(thread({ category: 'data', reply: '' }))
    expect((await adminPATCH(json({ contribution_accepted: true }), ctx)).status).toBe(400)
    expect(m.query.update).not.toHaveBeenCalled()
  })
})
