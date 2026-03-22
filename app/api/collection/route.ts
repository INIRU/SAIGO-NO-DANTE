import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()

    const [sinnersRes, identitiesRes, egosRes] = await Promise.all([
      supabase.schema('limbus').from('sinners').select('id, name_kr, order_num').order('order_num'),
      supabase.schema('limbus').from('identities').select('id, sinner_id, name_kr, game_id, folder_name, rarity, keywords').order('game_id'),
      supabase.schema('limbus').from('ego').select('id, sinner_id, name_kr, grade, sin_affinity, folder_name, image_url').order('grade').order('name_kr'),
    ])

    if (sinnersRes.error || identitiesRes.error || egosRes.error) {
      return NextResponse.json({ error: '데이터를 불러올 수 없습니다.' }, { status: 500 })
    }

    // 수감자별 그룹핑
    const identities: Record<string, typeof identitiesRes.data> = {}
    const egos: Record<string, typeof egosRes.data> = {}

    for (const s of sinnersRes.data) {
      identities[s.id] = []
      egos[s.id] = []
    }
    for (const i of identitiesRes.data) {
      identities[i.sinner_id]?.push(i)
    }
    for (const e of egosRes.data) {
      egos[e.sinner_id]?.push(e)
    }

    return NextResponse.json({
      sinners: sinnersRes.data,
      identities,
      egos,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
