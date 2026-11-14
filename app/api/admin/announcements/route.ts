import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { announcementText, type Announcement } from '@/lib/announcements'
import type { Json } from '@/lib/supabase/database.types'
import { announcementSchema, postAnnouncementToDiscord } from '@/features/admin/server'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  return error
    ? NextResponse.json(
        { error: '공지를 불러오지 못했습니다.' },
        { status: 500 },
      )
    : NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
}
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const parsed = announcementSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    )
  const { discord_everyone, ...body } = parsed.data
  const { data, error } = await createAdminClient()
    .schema('limbus')
    .from('announcements')
    .insert({
      ...body,
      content_doc: body.content_doc as Json | undefined,
      content: body.content_doc
        ? announcementText(body.content_doc)
        : body.content,
    })
    .select()
    .single()
  if (error)
    return NextResponse.json(
      { error: '공지를 저장하지 못했습니다.' },
      { status: 500 },
    )
  revalidateTag(CACHE_TAGS.announcements, { expire: 0 })
  const discord = data.published ? await postAnnouncementToDiscord(data as Announcement, discord_everyone) : 'skipped'
  return NextResponse.json({ ...data, discord }, { status: 201 })
}

