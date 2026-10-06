import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'

/** Removes any partner's news item from the calendar, by its row id. */
export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get('id'))
  if (!id.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  const { data, error } = await createAdminClient().schema('limbus').from('news_items').delete().eq('id', id.data).select('id')
  if (error) return NextResponse.json({ error: 'unavailable' }, { status: 500 })
  if (data.length) revalidateTag(CACHE_TAGS.news, 'max')
  return NextResponse.json({ ok: true, deleted: data.length > 0 }, { headers: { 'Cache-Control': 'private, no-store' } })
}
