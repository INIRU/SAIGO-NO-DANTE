import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateBody, updateKeywordSchema } from '@/lib/schemas/admin'


export async function PATCH(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { name } = await params
    const decodedName = decodeURIComponent(name)
    const raw = await request.json()
    const parsed = validateBody(updateKeywordSchema, raw)
    if (!parsed.success) return parsed.response

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .update(parsed.data)
      .eq('name', decodedName)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { name } = await params
    const decodedName = decodeURIComponent(name)

    const supabase = createAdminClient()
    const { error } = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .delete()
      .eq('name', decodedName)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
