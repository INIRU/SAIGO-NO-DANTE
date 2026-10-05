import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ auth: vi.fn(), db: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAdmin: m.auth }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: m.db }))
import { GET } from '@/app/api/admin/users/route'
import { GET as detail, PATCH } from '@/app/api/admin/users/[id]/route'
const id = '00000000-0000-4000-8000-000000000001'
const ctx = { params: Promise.resolve({ id }) }
const request = (body: unknown) => new Request('http://localhost/api/admin/users/' + id, { method: 'PATCH', body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ error: false, session: { user: { email: 'admin@example.invalid' } } })
  m.db.mockReturnValue({ schema: () => ({ rpc: m.rpc }) })
  m.rpc.mockResolvedValue({ data: { ok: true }, error: null })
})
describe('admin user boundaries', () => {
  it('rejects all three operations before touching private data', async () => {
    m.auth.mockResolvedValue({ error: true, response: new Response(null, { status: 403 }) })
    expect((await GET(new Request('http://localhost/api/admin/users'))).status).toBe(403)
    expect((await detail(new Request('http://localhost'), ctx)).status).toBe(403)
    expect((await PATCH(request({}), ctx)).status).toBe(403)
    expect(m.db).not.toHaveBeenCalled()
  })
  it('bounds pagination and passes search as an RPC parameter with private caching', async () => {
    expect((await GET(new Request('http://localhost/api/admin/users?page=-1'))).status).toBe(400)
    expect(m.rpc).not.toHaveBeenCalled()
    const response = await GET(new Request('http://localhost/api/admin/users?search=a%27%25&status=active&page=2'))
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(m.rpc).toHaveBeenCalledWith('admin_list_users', { p_search: "a'%", p_status: 'active', p_offset: 20, p_limit: 20 })
  })
  it('validates UUID, reason, duration and rejects forged role or actor fields', async () => {
    for (const body of [
      { suspended: true, reason: ' ', durationDays: 7, expectedSuspendedAt: null },
      { suspended: true, reason: 'reason', durationDays: 1, expectedSuspendedAt: null },
      { suspended: false, role: 'admin', expectedSuspendedAt: null },
      { suspended: false, actor: id, expectedSuspendedAt: null },
      { suspended: false },
    ]) expect((await PATCH(request(body), ctx)).status).toBe(400)
    expect((await PATCH(request({ suspended: false, expectedSuspendedAt: null }), { params: Promise.resolve({ id: 'bad-id' }) })).status).toBe(400)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('derives the actor from the session and uses the atomic moderation RPC', async () => {
    expect((await PATCH(request({ suspended: true, reason: ' reason ', durationDays: null, expectedSuspendedAt: null }), ctx)).status).toBe(200)
    expect(m.rpc).toHaveBeenCalledWith('admin_moderate_user', expect.objectContaining({ p_actor_email: 'admin@example.invalid', p_target_id: id, p_suspend: true, p_reason: 'reason', p_days: null, p_expected_suspended_at: null }))
  })
  it('surfaces protected accounts, stale edits and database failure without leaking details', async () => {
    for (const [error, status] of [['protected', 403], ['conflict', 409], ['not_found', 404]] as const) {
      m.rpc.mockResolvedValueOnce({ data: { error }, error: null })
      expect((await PATCH(request({ suspended: false, expectedSuspendedAt: null }), ctx)).status).toBe(status)
    }
    m.rpc.mockResolvedValueOnce({ data: null, error: { message: 'private database diagnostic' } })
    const response = await PATCH(request({ suspended: false, expectedSuspendedAt: null }), ctx)
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('private database diagnostic')
  })
  it('REQ-ADMIN-009 sets and clears the partner tier through the audited RPC and rejects other values', async () => {
    expect((await PATCH(request({ partner: 'discord_bot' }), ctx)).status).toBe(200)
    expect(m.rpc).toHaveBeenLastCalledWith('admin_set_partner', expect.objectContaining({ p_actor_email: 'admin@example.invalid', p_target_id: id, p_partner: 'discord_bot' }))
    expect((await PATCH(request({ partner: null }), ctx)).status).toBe(200)
    expect(m.rpc).toHaveBeenLastCalledWith('admin_set_partner', expect.objectContaining({ p_partner: null }))
    m.rpc.mockClear()
    for (const body of [{ partner: 'admin' }, { partner: 'discord_bot', role: 'admin' }, { partner: 'discord_bot', suspended: false, expectedSuspendedAt: null }])
      expect((await PATCH(request(body), ctx)).status).toBe(400)
    expect(m.rpc).not.toHaveBeenCalled()
    m.rpc.mockResolvedValueOnce({ data: { error: 'forbidden' }, error: null })
    expect((await PATCH(request({ partner: 'discord_bot' }), ctx)).status).toBe(403)
  })
})
