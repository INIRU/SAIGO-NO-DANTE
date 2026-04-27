import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertLegalDocSchema, validateBody } from '@/lib/schemas/admin'


export async function PUT(request: Request) {
  try {
    const adminAuth = await requireAdmin()
    if (adminAuth.error) return adminAuth.response

    const parsed = validateBody(upsertLegalDocSchema, await request.json())
    if (!parsed.success) return parsed.response

    const { type, title, version, last_updated, sections } = parsed.data

    const supabase = createAdminClient()
    const { error } = await supabase
      .schema('limbus')
      .from('legal_docs')
      .upsert({ type, title, version, last_updated, sections, updated_at: new Date().toISOString() })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    revalidatePath(`/${type}`)
    revalidatePath('/admin/legal')

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
