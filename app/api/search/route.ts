import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) {
    return NextResponse.json({ identities: [], ego: [], sinners: [], keywords: [], egoGifts: [], suggestions: [] })
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
    Promise.all([
      supabase
        .schema('limbus')
        .from('sinners')
        .select('id, name, name_kr, order_num')
        .ilike('name_kr', pattern)
        .limit(4),
      supabase
        .schema('limbus')
        .from('sinners')
        .select('id, name, name_kr, order_num')
        .ilike('name', pattern)
        .limit(4),
    ]).then(([a, b]) => {
      const map = new Map<string, typeof a.data extends (infer T)[] | null ? T : never>()
      for (const s of a.data ?? []) map.set(s.id, s)
      for (const s of b.data ?? []) map.set(s.id, s)
      return [...map.values()]
    }),
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

  const hasResults = identities.length + ego.length + sinners.length + keywords.length + egoGifts.length > 0

  // 결과 없으면 개별 글자로 fuzzy 검색
  let suggestions: typeof identities = []
  if (!hasResults && q.length >= 2) {
    const chars = [...new Set(q.replace(/\s/g, '').split(''))]
    // 각 글자를 포함하는 인격을 찾되, 많이 매칭되는 순으로 정렬
    const fuzzyPattern = chars.map(c => `%${c}%`).join('')
    suggestions = await supabase
      .schema('limbus')
      .from('identities')
      .select('id, name_kr, rarity, game_id, folder_name, sinner_id, sinners(id, name_kr)')
      .ilike('name_kr', fuzzyPattern)
      .limit(5)
      .then(r => r.data ?? [])

    // fuzzy도 없으면 첫 글자만으로 검색
    if (suggestions.length === 0) {
      suggestions = await supabase
        .schema('limbus')
        .from('identities')
        .select('id, name_kr, rarity, game_id, folder_name, sinner_id, sinners(id, name_kr)')
        .ilike('name_kr', `%${chars[0]}%`)
        .limit(5)
        .then(r => r.data ?? [])
    }
  }

  return NextResponse.json({ identities, ego, sinners, keywords, egoGifts, suggestions })
}
