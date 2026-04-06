import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'
import { validateBody, createAnnouncementSchema } from '@/lib/schemas/admin'


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .schema('limbus')
      .from('announcements')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const raw = await request.json()
    const parsed = validateBody(createAnnouncementSchema, raw)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .schema('limbus')
      .from('announcements')
      .insert(body)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const admin = createAdminClient()
    const userId = await findOrCreateSupabaseUser(admin, session.user!.email!, session.user!.name, session.user!.image)
    writeAuditLog({ actorId: userId, action: 'announcement_create', targetType: 'announcement', targetId: data.id, details: { title: body.title } })

    revalidatePath('/')
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
