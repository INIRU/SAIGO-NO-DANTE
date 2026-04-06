import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .schema('limbus')
      .from('ego_gifts')
      .select('name, keyword, grade, image_url, effect_base, activation_condition')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
