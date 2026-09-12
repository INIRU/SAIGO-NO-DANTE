import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { announcementSchema, announcementText } from '@/lib/announcements'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: '잘못된 공지입니다.' }, { status: 400 })
  const parsed = announcementSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    )
  const body = parsed.data
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('announcements')
    .update({
      ...body,
      content: body.content_doc
        ? announcementText(body.content_doc)
        : body.content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error)
    return NextResponse.json(
      { error: '공지를 저장하지 못했습니다.' },
      { status: 500 },
    )
  revalidateTag(CACHE_TAGS.announcements, { expire: 0 })
  return data
    ? NextResponse.json(data)
    : NextResponse.json({ error: '공지가 없습니다.' }, { status: 404 })
}
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: '잘못된 공지입니다.' }, { status: 400 })
  const { error } = await createAdminClient()
    .schema('limbus')
    .from('announcements')
    .delete()
    .eq('id', id)
  if (error)
    return NextResponse.json(
      { error: '공지를 삭제하지 못했습니다.' },
      { status: 500 },
    )
  revalidateTag(CACHE_TAGS.announcements, { expire: 0 })
  return NextResponse.json({ ok: true })
}
