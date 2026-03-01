import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createAdminClient()

  await supabase.schema('limbus').from('deck_votes').delete().eq('deck_id', id)
  await supabase.schema('limbus').from('deck_identities').delete().eq('deck_id', id)
  const { error } = await supabase.schema('limbus').from('decks').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
