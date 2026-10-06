import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const uuid = z.uuid()
const mutation = z.union([
  z.object({ partner: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/).nullable() }).strict(),
  z.object({ suspended: z.literal(true), reason: z.string().trim().min(1).max(1000), durationDays: z.union([z.literal(7), z.literal(30), z.null()]), expectedSuspendedAt: z.iso.datetime({ offset: true }).nullable() }).strict(),
  z.object({ suspended: z.literal(false), expectedSuspendedAt: z.iso.datetime({ offset: true }).nullable() }).strict(),
])
const adminEmails = () => (process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim()).filter(Boolean)
type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const { id } = await context.params
  if (!uuid.safeParse(id).success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const admin = createAdminClient()
  const db = admin.schema('limbus')
  const profile = await db.from('profiles').select('id,username,avatar_url,created_at,last_seen_at,role,partner,suspended,suspension_reason,suspended_at,suspended_until').eq('id', id).maybeSingle()
  if (profile.error) return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  if (!profile.data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const [account, decks, plans, history, partners] = await Promise.all([
    admin.auth.admin.getUserById(id),
    db.from('decks').select('id,title,created_at', { count: 'exact' }).eq('user_id', id).order('created_at', { ascending: false }).limit(5),
    db.from('md_plans').select('id,title,created_at', { count: 'exact' }).eq('user_id', id).order('created_at', { ascending: false }).limit(5),
    db.from('audit_logs').select('id,action,created_at,details').eq('target_type', 'user').eq('target_id', id).in('action', ['suspend', 'unsuspend', 'suspension_expired']).order('created_at', { ascending: false }).limit(5),
    db.from('partners').select('code,name').order('code'),
  ])
  if (account.error || decks.error || plans.error || history.error || partners.error) return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  const p = profile.data
  return NextResponse.json({
    ...p,
    restricted: p.suspended === true && (!p.suspended_until || new Date(p.suspended_until).getTime() > Date.now()),
    protected: (p.role ?? 'user') !== 'user' || account.data.user.email === auth.session.user?.email || adminEmails().includes(account.data.user.email ?? ''),
    decks: decks.data, deckCount: decks.count ?? 0, plans: plans.data, planCount: plans.count ?? 0, history: history.data, partners: partners.data,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function PATCH(request: Request, context: Context) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  if (!auth.session.user?.email) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { id } = await context.params
  const body = mutation.safeParse(await request.json().catch(() => null))
  if (!uuid.safeParse(id).success || !body.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const value = body.data
  const db = createAdminClient().schema('limbus')
  const { data, error } = 'partner' in value
    ? await db.rpc('admin_set_partner', { p_actor_email: auth.session.user.email, p_target_id: id, p_partner: value.partner, p_admin_emails: adminEmails() })
    : await db.rpc('admin_moderate_user', {
      p_actor_email: auth.session.user.email, p_target_id: id, p_suspend: value.suspended,
      p_reason: value.suspended ? value.reason : null, p_days: value.suspended ? value.durationDays : null,
      p_expected_suspended_at: value.expectedSuspendedAt, p_admin_emails: adminEmails(),
    })
  if (error || !data) return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  if (data.error) {
    const status = ({ forbidden: 403, protected: 403, not_found: 404, conflict: 409, invalid: 400 } as Record<string, number>)[data.error] ?? 500
    return NextResponse.json({ error: data.error }, { status })
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
}
