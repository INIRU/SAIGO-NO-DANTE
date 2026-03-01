import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('keyword_meta')
    .select('name, description')
    .order('name')

  if (error) return NextResponse.json([], { status: 200 })
  return NextResponse.json(data ?? [])
}
