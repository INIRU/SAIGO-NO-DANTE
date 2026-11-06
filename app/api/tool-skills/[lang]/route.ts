import { NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'
import { routing } from '@/lib/i18n/routing'
import type { SupportedLang } from '@/lib/i18n/types'
import { isMissingColumnError } from '@/lib/keywords/ref-text'
import { buildEgoSkills, buildIdentitySkills, type EgoSkillRow, type IdentitySkillRow } from '@/features/tools'

const SKILL_COLUMNS = 'id, name, name_en, name_jp, skill_type, atk_type, sin_affinity, coins, base_power, coin_power, skill_order, variant_order, uptie_level, offense_level, image_id'
const EGO_SKILL_COLUMNS = 'id, category, construe_level, name, name_en, name_jp, skill_type, sin_affinity, coins, base_power, coin_power, offense_level'

/** One identity's skills at the highest uptie, or one E.G.O's awakening and corrosion skills: what a calculator loads once it is picked. */
async function getToolSkills(lang: SupportedLang, kind: 'identity' | 'ego', id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(kind === 'ego' ? CACHE_TAGS.ego : CACHE_TAGS.identities, CACHE_TAGS.gameData)

  const db = createAdminClient().schema('limbus')
  // coin_list is a newer column: without it a skill's coins are its count times the one coin power.
  const withCoins = async (table: string, columns: string, owner: string) => {
    const rows = await db.from(table).select(`${columns}, coin_list`).eq(owner, id)
    return rows.error && isMissingColumnError(rows.error) ? db.from(table).select(columns).eq(owner, id) : rows
  }
  if (kind === 'ego') {
    const [ego, skills] = await Promise.all([db.from('ego').select('image_url').eq('id', id).maybeSingle(), withCoins('ego_skills', EGO_SKILL_COLUMNS, 'ego_id')])
    // A failed read throws instead of caching an empty list.
    if (ego.error || skills.error) throw new Error('Unavailable')
    return ego.data ? buildEgoSkills(ego.data, skills.data as unknown as EgoSkillRow[], lang) : null
  }
  const [identity, skills] = await Promise.all([db.from('identities').select('sinner_id, game_id').eq('id', id).maybeSingle(), withCoins('skills', SKILL_COLUMNS, 'identity_id')])
  if (identity.error || skills.error) throw new Error('Unavailable')
  return identity.data ? buildIdentitySkills(identity.data, skills.data as unknown as IdentitySkillRow[], lang) : null
}

/** The skills of the identity or E.G.O picked in a calculator (?kind=identity|ego&id=). */
export async function GET(request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const search = new URL(request.url).searchParams
  const kind = search.get('kind'), id = search.get('id') ?? ''
  if (!(routing.locales as readonly string[]).includes(lang) || (kind !== 'identity' && kind !== 'ego') || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
    const skills = await getToolSkills(lang as SupportedLang, kind, id)
    return skills ? NextResponse.json({ skills }, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
}
