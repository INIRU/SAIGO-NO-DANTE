import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateBody, updateIdentitySchema } from '@/lib/schemas/admin'


export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params
    const supabase = createAdminClient()

    const [identityResult, skillsResult, passivesResult] = await Promise.all([
      supabase.schema('limbus').from('identities').select('*').eq('id', id).single(),
      supabase.schema('limbus').from('skills').select('*').eq('identity_id', id).order('skill_order').order('id'),
      supabase.schema('limbus').from('passives').select('*').eq('identity_id', id).order('passive_order'),
    ])

    if (identityResult.error || !identityResult.data) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...identityResult.data,
      skills: skillsResult.data ?? [],
      passives: passivesResult.data ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params
    const supabase = createAdminClient()
    const raw = await request.json()
    const parsed = validateBody(updateIdentitySchema, raw)
    if (!parsed.success) return parsed.response

    const { data: identity, error } = await supabase
      .schema('limbus')
      .from('identities')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(identity)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params
    const supabase = createAdminClient()

    const { error } = await supabase
      .schema('limbus')
      .from('identities')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
