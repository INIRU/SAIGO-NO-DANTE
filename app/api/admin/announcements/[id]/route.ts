import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { validateBody, updateAnnouncementSchema } from '@/lib/schemas/admin'


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
    const { data, error } = await supabase
      .schema('limbus')
      .from('announcements')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const adminClient = createAdminClient()
    const userId = await findOrCreateSupabaseUser(adminClient, session.user!.email!, session.user!.name, session.user!.image)
    writeAuditLog({ actorId: userId, action: 'announcement_update', targetType: 'announcement', targetId: id, details: { title: parsed.data.title } })

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

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
