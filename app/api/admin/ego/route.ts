import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const sinner_id = searchParams.get('sinner_id')

  let query = supabase.schema('limbus').from('ego').select('*').order('name')

  if (sinner_id) {
    query = query.eq('sinner_id', sinner_id)
  }

  const { data: ego, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: ego })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await request.json()
  const { sinner_id, name, grade } = body

  if (!sinner_id || !name || !grade) {
    return NextResponse.json({ error: 'Missing required fields: sinner_id, name, grade' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: ego, error } = await supabase
    .schema('limbus')
    .from('ego')
    .insert({
      sinner_id,
      name,
      name_kr: body.name_kr,
      grade,
      sin_affinity: body.sin_affinity,
      description: body.description,
      corrosion_risk: body.corrosion_risk,
      folder_name: body.folder_name,
      image_url: body.image_url,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: ego }, { status: 201 })
}
