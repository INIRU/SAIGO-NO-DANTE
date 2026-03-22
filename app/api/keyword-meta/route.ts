import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 300

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .schema('limbus')
      .from('keyword_meta')
      .select('name, description, max_stack')
      .order('name')

    if (error) return NextResponse.json([], { status: 200 })
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
