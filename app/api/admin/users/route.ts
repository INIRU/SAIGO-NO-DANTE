import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const querySchema = z.object({
  search: z.string().trim().max(100).default(''),
  status: z.enum(['all', 'active', 'suspended']).default('all'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
})
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!query.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const { search, status, page } = query.data
  const { data, error } = await createAdminClient().schema('limbus').rpc('admin_list_users', {
    p_search: search, p_status: status, p_offset: (page - 1) * 20, p_limit: 20,
  })
  if (error) return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
}
