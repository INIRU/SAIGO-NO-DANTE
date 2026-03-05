import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) {
    return NextResponse.json({ identities: [], ego: [], sinners: [], keywords: [] })
  }

  const supabase = createAdminClient()
  const pattern = `%${q}%`

  const [identities, ego, sinners, keywords, egoGifts] = await Promise.all([
    supabase
      .schema('limbus')
      .from('identities')
      .select('id, name_kr, rarity, game_id, folder_name, sinner_id, sinners(id, name_kr)')
      .ilike('name_kr', pattern)
      .limit(8)
      .then(r => r.data ?? []),
    supabase
      .schema('limbus')
      .from('ego')
      .select('id, name_kr, grade, image_url, sinners(id, name_kr)')
      .ilike('name_kr', pattern)
      .limit(6)
      .then(r => r.data ?? []),
    supabase
      .schema('limbus')
      .from('sinners')
      .select('id, name_kr, name_en, sinner_id')
      .or(`name_kr.ilike.${pattern},name_en.ilike.${pattern}`)
      .limit(4)
      .then(r => r.data ?? []),
    supabase
      .schema('limbus')
      .from('keyword_meta')
      .select('name, description, icon_slug')
      .ilike('name', pattern)
      .limit(6)
      .then(r => r.data ?? []),
    supabase
      .schema('limbus')
      .from('ego_gifts')
      .select('name, keyword, grade, image_url')
      .ilike('name', pattern)
      .limit(6)
      .then(r => r.data ?? []),
  ])

  return NextResponse.json({ identities, ego, sinners, keywords, egoGifts })
}
