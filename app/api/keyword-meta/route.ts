import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 300

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('keyword_meta')
    .select('name, description, max_stack')
    .order('name')

  if (error) return NextResponse.json([], { status: 200 })
  return NextResponse.json(data ?? [])
}
