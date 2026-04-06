import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { LegalSection } from '@/lib/data/legal'


export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json() as {
      type: string
      title: string
      last_updated: string
      sections: LegalSection[]
    }

    const { type, title, last_updated, sections } = body

    if (!['privacy', 'terms'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .schema('limbus')
      .from('legal_docs')
      .upsert({ type, title, last_updated, sections, updated_at: new Date().toISOString() })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    revalidatePath(`/${type}`)
    revalidatePath('/admin/legal')

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
