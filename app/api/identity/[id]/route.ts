import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Identity detail modal data: the identity plus every uptie row of its skills and passives. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const [identityRes, skillsRes, passivesRes] = await Promise.all([
      supabase
        .schema('limbus')
        .from('identities')
        .select('id, sinner_id, name, name_kr, name_en, name_jp, tier, rarity, sin_affinity, hp, base_hp, hp_per_level, speed_min, speed_max, def_level, keywords, slash_res, pierce_res, blunt_res, break_section, game_id, folder_name')
        .eq('id', id)
        .single(),
      supabase
        .schema('limbus')
        .from('skills')
        .select('id, identity_id, name, name_en, name_jp, skill_type, atk_type, sin_affinity, coins, base_power, coin_power, description, description_en, description_jp, flavor, flavor_en, flavor_jp, skill_order, image_id, atk_weight, offense_level, uptie_level, variant_order')
        .eq('identity_id', id)
        .order('skill_order')
        .order('variant_order'),
      supabase
        .schema('limbus')
        .from('passives')
        .select('id, identity_id, name, name_en, name_jp, passive_type, sin_affinity, sin_count, active_cond, description, description_en, description_jp, flavor, flavor_en, flavor_jp, passive_order, uptie_level')
        .eq('identity_id', id)
        .order('passive_order'),
    ])

    if (identityRes.error || !identityRes.data) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
    }
    if (skillsRes.error || passivesRes.error) {
      return NextResponse.json({ error: (skillsRes.error ?? passivesRes.error)!.message }, { status: 500 })
    }

    return NextResponse.json({
      identity: identityRes.data,
      skills: skillsRes.data,
      passives: passivesRes.data,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
