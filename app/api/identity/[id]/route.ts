import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'


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
      .select('id, sinner_id, name, name_kr, tier, rarity, hp, speed_min, speed_max, def_level, keywords, slash_res, pierce_res, blunt_res, panic_type, break_section, game_id, folder_name')
      .eq('id', id)
      .single()

    if (idErr || !identity) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
    }

    // 수감자 이름, 스킬, 패시브, 정신력 조건 병렬 조회
    const [sinnerRes, skillsRes, passivesRes, sanityRes, panicRes] = await Promise.all([
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
      supabase
        .schema('limbus')
        .from('identity_sanity_conditions')
        .select('template_id, condition_type, params, sort_order, mental_condition_templates(add_text, min_text)')
        .eq('identity_id', id)
        .order('condition_type')
        .order('sort_order'),
      identity.panic_type
        ? supabase.schema('limbus').from('panic_types').select('id, name, description').eq('id', identity.panic_type).single()
        : Promise.resolve({ data: null, error: null }),
    ])

    // 정신력 조건 텍스트 렌더링 (템플릿 + params 치환)
    const sanityConditions = (sanityRes.data ?? []).map((row: Record<string, unknown>) => {
      const tpl = row.mental_condition_templates as { add_text: string; min_text: string } | null
      const rawText = row.condition_type === 'increase' ? tpl?.add_text : tpl?.min_text
      const params = (row.params ?? []) as number[]
      const text = params.reduce<string>(
        (t, val, i) => t.replaceAll(`{${i}}`, String(val)),
        rawText ?? '',
      )
      return {
        template_id: row.template_id,
        condition_type: row.condition_type,
        text,
        sort_order: row.sort_order,
      }
    })

    return NextResponse.json({
      identity,
      sinner_name: sinnerRes.data?.name_kr ?? null,
      skills: skillsRes.data ?? [],
      passives: passivesRes.data ?? [],
      sanity_conditions: sanityConditions,
      panic_info: panicRes.data ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
