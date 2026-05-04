import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { validateBody, updateAnnouncementSchema } from '@/lib/schemas/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { isMissingAnnouncementLangColumn } from '@/lib/db/announcements'


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const raw = await request.json()
    const parsed = validateBody(updateAnnouncementSchema, raw)
    if (!parsed.success) return parsed.response

    const supabase = createAdminClient()
    const updatePayload = { ...parsed.data, updated_at: new Date().toISOString() }
    let { data, error } = await supabase
      .schema('limbus')
      .from('announcements')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error && isMissingAnnouncementLangColumn(error)) {
      const { lang: _lang, ...legacyUpdatePayload } = updatePayload
      const legacyResult = await supabase
        .schema('limbus')
        .from('announcements')
        .update(legacyUpdatePayload)
        .eq('id', id)
        .select()
        .single()
      data = legacyResult.data
      error = legacyResult.error
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const adminClient = createAdminClient()
    const userId = await findOrCreateSupabaseUser(adminClient, session.user!.email!, session.user!.name, session.user!.image)
    writeAuditLog({ actorId: userId, action: 'announcement_update', targetType: 'announcement', targetId: id, details: { title: parsed.data.title } })

    revalidateTag(CACHE_TAGS.announcements, 'max')
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const supabase = createAdminClient()
    const { error } = await supabase
      .schema('limbus')
      .from('announcements')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const adminClient2 = createAdminClient()
    const delUserId = await findOrCreateSupabaseUser(adminClient2, session.user!.email!, session.user!.name, session.user!.image)
    writeAuditLog({ actorId: delUserId, action: 'announcement_delete', targetType: 'announcement', targetId: id })

    revalidateTag(CACHE_TAGS.announcements, 'max')
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
