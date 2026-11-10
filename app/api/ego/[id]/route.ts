import { NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'

const SIN_ORDER = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']

/** EGO detail modal data, cached until a game data sync invalidates it; null when the EGO does not exist. */
async function getEgoDetail(id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.ego, CACHE_TAGS.egoEntry(id), CACHE_TAGS.gameData)

  const supabase = createAdminClient()
  // The skills need only the id, so they are read alongside the EGO; the sinner needs the EGO's sinner_id.
  const [egoRes, skillsRes] = await Promise.all([
    supabase
      .schema('limbus')
      .from('ego')
      .select('id, sinner_id, name_kr, name_en, name_jp, grade, sin_affinity, folder_name, image_url, cor_image_url, passive_name, passive_content, resistance, cost, keywords')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .schema('limbus')
      .from('ego_skills')
      .select('id, game_skill_id, name, name_en, name_jp, skill_type, sin_affinity, base_power, coins, coin_power, description, description_en, description_jp, category, construe_level, offense_level, atk_weight')
      .eq('ego_id', id),
  ])
  // A failed read throws instead of caching a partial answer.
  if (egoRes.error || skillsRes.error) throw new Error((egoRes.error ?? skillsRes.error)!.message)
  const ego = egoRes.data
  if (!ego) return null
  const sinnerRes = await supabase
    .schema('limbus')
    .from('sinners')
    .select('name_kr, name_en, name_jp')
    .eq('id', ego.sinner_id)
    .maybeSingle()
  if (sinnerRes.error) throw new Error(sinnerRes.error.message)

  // resistance/cost 배열을 죄악별 객체로 변환
  const resistances: Record<string, string> = {}
  const costs: Record<string, number> = {}
  if (Array.isArray(ego.resistance)) {
    SIN_ORDER.forEach((sin, i) => { resistances[sin] = ego.resistance[i] ?? '보통' })
  }
  if (Array.isArray(ego.cost)) {
    SIN_ORDER.forEach((sin, i) => { costs[sin] = ego.cost[i] ?? 0 })
  }

  return {
    ego: { ...ego, resistances, costs },
    sinner: sinnerRes.data ?? null,
    skills: skillsRes.data ?? [],
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid EGO ID' }, { status: 400 })
    }
    const detail = await getEgoDetail(id)
    if (!detail) return NextResponse.json({ error: 'EGO not found' }, { status: 404 })
    return NextResponse.json(detail, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch (err: unknown) {
    console.error('[api/ego/[id]]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
