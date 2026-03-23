import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    // 인격 기본 정보
    const { data: identity, error: idErr } = await supabase
      .schema('limbus')
      .from('identities')
      .select('id, sinner_id, name, name_kr, tier, rarity, hp, speed_min, speed_max, def_level, keywords, slash_res, pierce_res, blunt_res, panic_type, sanity_increase, sanity_decrease, break_section, game_id, folder_name')
      .eq('id', id)
      .single()

    if (idErr || !identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
    }

    // 수감자 이름, 스킬, 패시브 병렬 조회
    const [sinnerRes, skillsRes, passivesRes] = await Promise.all([
      supabase
        .schema('limbus')
        .from('sinners')
        .select('name_kr')
        .eq('id', identity.sinner_id)
        .single(),
      supabase
        .schema('limbus')
        .from('skills')
        .select('id, name, skill_type, sin_affinity, coins, base_power, coin_power, description, skill_order, atk_weight, offense_level, quantity, uptie_level, variant_order')
        .eq('identity_id', id)
        .order('skill_order')
        .order('variant_order'),
      supabase
        .schema('limbus')
        .from('passives')
        .select('id, name, passive_type, sin_affinity, sin_count, active_cond, description, passive_order, uptie_level')
        .eq('identity_id', id)
        .order('passive_order'),
    ])

    return NextResponse.json({
      identity,
      sinner_name: sinnerRes.data?.name_kr ?? null,
      skills: skillsRes.data ?? [],
      passives: passivesRes.data ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
