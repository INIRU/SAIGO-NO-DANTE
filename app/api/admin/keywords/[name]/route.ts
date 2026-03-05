import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { name } = await params
  const decodedName = decodeURIComponent(name)
  const body = await request.json()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('keyword_meta')
    .update({ description: body.description, max_stack: body.max_stack ?? null })
    .eq('name', decodedName)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ name: string }> }) {
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
}
