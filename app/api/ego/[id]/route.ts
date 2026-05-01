import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'


export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid EGO ID' }, { status: 400 })
    }
    const supabase = createAdminClient()

    const { data: ego, error: egoErr } = await supabase
      .schema('limbus')
      .from('ego')
      .select('id, sinner_id, name, name_kr, name_en, name_jp, grade, sin_affinity, folder_name, image_url, cor_image_url, passive_name, passive_content, resistance, cost, keywords, description, corrosion_risk, obtaining_method, obtaining_method_en, obtaining_method_jp')
      .eq('id', id)
      .single()

    if (egoErr || !ego) {
      return NextResponse.json({ error: 'EGO not found' }, { status: 404 })
    }

    const [sinnerRes, skillsRes] = await Promise.all([
      supabase
        .schema('limbus')
        .from('sinners')
        .select('name_kr, name_en, name_jp')
        .eq('id', ego.sinner_id)
        .single(),
      supabase
        .schema('limbus')
        .from('ego_skills')
        .select('id, name, name_en, name_jp, skill_type, sin_affinity, base_power, coins, coin_power, description, description_en, description_jp, category, construe_level, offense_level, atk_weight')
        .eq('ego_id', id),
    ])

    // resistance/cost 배열을 죄악별 객체로 변환
    const SIN_ORDER = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
    const resistances: Record<string, string> = {}
    const costs: Record<string, number> = {}
    if (Array.isArray(ego.resistance)) {
      SIN_ORDER.forEach((sin, i) => { resistances[sin] = ego.resistance[i] ?? '보통' })
    }
    if (Array.isArray(ego.cost)) {
      SIN_ORDER.forEach((sin, i) => { costs[sin] = ego.cost[i] ?? 0 })
    }

    return NextResponse.json({
      ego: { ...ego, resistances, costs },
      sinner: sinnerRes.data ?? null,
      skills: skillsRes.data ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
