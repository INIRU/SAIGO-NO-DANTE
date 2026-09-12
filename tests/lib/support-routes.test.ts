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
  },
}))
vi.mock('@/lib/auth', () => ({
  requireActiveUser: m.auth,
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
const active = {
  error: false,
  session: { user: { email: 'qa@example.invalid' } },
}
beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue(active)
  m.owner.mockResolvedValue('owner-id')
  m.db.mockReturnValue({ schema: () => ({ from: () => m.query }) })
  for (const name of ['select', 'eq', 'order', 'insert'] as const)
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
    expect(m.query.insert).toHaveBeenCalledWith({
      title: '문의',
      content: '본문',
      category: 'bug',
      user_id: 'owner-id',
    })
  })
  it('requires admin privileges for the shared inbox', async () => {
    m.admin.mockResolvedValue({
      error: true,
      response: new Response(null, { status: 403 }),
    })
    expect((await adminGET()).status).toBe(403)
    expect(m.db).not.toHaveBeenCalled()
  })
})
