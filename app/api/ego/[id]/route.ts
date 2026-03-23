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

    // EGO 기본 정보
    const { data: ego, error: egoErr } = await supabase
      .schema('limbus')
      .from('ego')
      .select('id, sinner_id, name, name_kr, grade, sin_affinity, folder_name, image_url, passive_name, passive_content, wrath_res, lust_res, sloth_res, gluttony_res, gloom_res, pride_res, envy_res, wrath_cost, lust_cost, sloth_cost, gluttony_cost, gloom_cost, pride_cost, envy_cost')
      .eq('id', id)
      .single()

    if (egoErr || !ego) {
      return NextResponse.json({ error: 'EGO not found' }, { status: 404 })
    }

    // 수감자 이름, EGO 스킬 병렬 조회
    const [sinnerRes, skillsRes] = await Promise.all([
      supabase
        .schema('limbus')
        .from('sinners')
        .select('name_kr')
        .eq('id', ego.sinner_id)
        .single(),
      supabase
        .schema('limbus')
        .from('ego_skills')
        .select('id, name, skill_type, sin_affinity, base_power, coins, coin_power, description, category, construe_level, offense_level, atk_weight')
        .eq('ego_id', id)
        .order('skill_order'),
    ])

    return NextResponse.json({
      ego,
      sinner_name: sinnerRes.data?.name_kr ?? null,
      skills: skillsRes.data ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
