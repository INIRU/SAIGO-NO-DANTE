import { NextResponse, after } from 'next/server';
import { pushForFollow } from '@/lib/push/send';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { findOrCreateSupabaseUser } from '@/lib/supabase/find-or-create-user';
import { isAllowedRequestOrigin } from '@/lib/request-origin';
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit';
const headers = { 'Cache-Control': 'private, no-store' };
async function handle(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Not found' }, { status: 404, headers });
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.headers.get('origin') && !isAllowedRequestOrigin(request.headers.get('origin'), url.origin, request.headers.get('host'), []))
    return new Response(null, { status: 403, headers });
  const query = z.object({ kind: z.enum(['following','followers']).optional(), offset: z.coerce.number().int().min(0).max(100000).default(0) }).safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400, headers });
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.isSuspended) return new Response(null, { status: 403, headers });
    if (request.method !== 'GET' && !session?.user?.email) return new Response(null, { status: 401, headers });
    const limit = checkRequestRateLimit(request, { scope: 'community-follows', bucket: request.method === 'GET' ? 'readonly' : 'create', authenticatedKey: session?.user?.email });
    if (!limit.allowed) return rateLimitResponse(limit);
    const db = createAdminClient();
    const viewer = session?.user?.email ? await findOrCreateSupabaseUser(db, session.user.email, session.user.name, session.user.image) : null;
    if (session?.user?.email && !viewer) throw Error('Account unavailable');
    if (request.method !== 'GET') {
      const { data, error } = await db.schema('limbus').rpc('community_set_follow', { p_actor: viewer, p_target: id, p_follow: request.method === 'POST' });
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Unavailable profile' }, { status: 404, headers });
      if (request.method === 'POST' && viewer) after(() => pushForFollow(viewer, id));
    }
    const { data, error } = await db.schema('limbus').rpc('community_follows', { p_user: id, p_viewer: viewer, p_kind: query.data.kind ?? null, p_offset: query.data.offset });
    if (error) throw error;
    if (!data) return request.method === 'DELETE' ? NextResponse.json({ ok: true }, { headers }) : NextResponse.json({ error: 'Not found' }, { status: 404, headers });
    const follows = data as { items: { id: string }[] };
    return NextResponse.json({ ...follows, items: follows.items.map((item: { id: string }) => ({ ...item, is_self: item.id === viewer })) }, { headers });
  } catch {
    return NextResponse.json({ error: 'Unable to load follows' }, { status: 503, headers });
  }
}
export { handle as GET, handle as POST, handle as DELETE };
