import { NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'

type IdentityDetail = { identity: Record<string, unknown>; skills: Record<string, unknown>[]; passives: Record<string, unknown>[] }

/** Cached until a game data sync invalidates identities; null when the identity does not exist. */
async function getIdentityDetail(id: string): Promise<IdentityDetail | null> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.identities, CACHE_TAGS.gameData)

  const supabase = createAdminClient()
  const [identityRes, skillsRes, passivesRes] = await Promise.all([
    supabase
      .schema('limbus')
      .from('identities')
      .select('id, sinner_id, name_kr, name_en, name_jp, tier, rarity, sin_affinity, hp, base_hp, hp_per_level, speed_min, speed_max, def_level, keywords, slash_res, pierce_res, blunt_res, break_section, game_id, folder_name')
      .eq('id', id)
      .maybeSingle(),
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
      .select('id, identity_id, name, name_en, name_jp, passive_type, sin_affinity, sin_count, sin_requirements, active_cond, description, description_en, description_jp, flavor, flavor_en, flavor_jp, passive_order, uptie_level')
      .eq('identity_id', id)
      .order('passive_order'),
  ])
  // Errors are thrown so that a failed read is never cached as "not found".
  if (identityRes.error || skillsRes.error || passivesRes.error) throw new Error((identityRes.error ?? skillsRes.error ?? passivesRes.error)!.message)
  if (!identityRes.data) return null
  return { identity: identityRes.data, skills: skillsRes.data ?? [], passives: passivesRes.data ?? [] }
}

/** Identity detail modal data: the identity plus every uptie row of its skills and passives. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
    const detail = await getIdentityDetail(id)
    if (!detail) return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
    return NextResponse.json(detail, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
