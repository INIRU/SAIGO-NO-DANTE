import { createClient } from '@supabase/supabase-js'
import type { Sinner, Identity, IdentityWithSinner, Skill, Passive, EGO, EGOWithSinner, EgoGiftNote, SinType, SanityCondition, PanicType } from '@/lib/types'
import type { IdentityBrowserItem, EGOBrowserItem } from '@/lib/types/browser'

// ── Supabase 클라이언트 (browser/server 공용 publishable key) ───────────────
function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

// ── DB 조회 함수 ───────────────────────────────────────────────────────────
export async function getSinners(): Promise<Sinner[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('sinners')
    .select('*')
    .order('order_num')
  if (error) throw error
  return data ?? []
}

export async function getSinnerById(id: string): Promise<Sinner | null> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('sinners')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function getIdentities(sinnerId?: string): Promise<Identity[]> {
  let q = supabase().schema('limbus').from('identities').select('*')
  if (sinnerId) q = q.eq('sinner_id', sinnerId)
  const { data, error } = await q.order('rarity').order('name')
  if (error) throw error
  return data ?? []
}

export async function getLatestIdentities(limit = 6): Promise<IdentityWithSinner[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('identities')
    .select('*, sinner:sinners(id, name_kr, name_en, name_jp, order_num, description, literary_source)')
    .not('release_date', 'is', null)
    .order('release_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as IdentityWithSinner[]
}

export async function getIdentityById(id: string): Promise<Identity | null> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('identities')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function getSanityConditions(identityId: string): Promise<SanityCondition[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('identity_sanity_conditions')
    .select('template_id, condition_type, params, sort_order, mental_condition_templates(add_text, min_text, add_text_en, add_text_jp, min_text_en, min_text_jp)')
    .eq('identity_id', identityId)
    .order('condition_type')
    .order('sort_order')
  if (error || !data) return []
  return data.map((row: Record<string, unknown>) => {
    const tpl = row.mental_condition_templates as { add_text: string; min_text: string; add_text_en?: string | null; add_text_jp?: string | null; min_text_en?: string | null; min_text_jp?: string | null } | null
    const isIncrease = row.condition_type === 'increase'
    const rawText = isIncrease ? tpl?.add_text : tpl?.min_text
    const rawTextEn = isIncrease ? tpl?.add_text_en : tpl?.min_text_en
    const rawTextJp = isIncrease ? tpl?.add_text_jp : tpl?.min_text_jp
    const params = (row.params ?? []) as number[]
    const fillParams = (t: string | null | undefined) =>
      t ? params.reduce<string>((s, val, i) => s.replaceAll(`{${i}}`, String(val)), t) : null
    const text = fillParams(rawText) ?? ''
    return {
      template_id: row.template_id as string,
      condition_type: row.condition_type as 'increase' | 'decrease',
      text,
      text_en: fillParams(rawTextEn),
      text_jp: fillParams(rawTextJp),
      sort_order: row.sort_order as number,
    }
  })
}

export async function getPanicInfo(panicTypeId: number): Promise<PanicType | null> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('panic_types')
    .select('id, name, name_en, name_jp, description, description_en, description_jp')
    .eq('id', panicTypeId)
    .single()
  if (error || !data) return null
  return data
}

export async function getAllSkills(): Promise<Skill[]> {
  const all: Skill[] = []
  const BATCH = 1000
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await supabase()
      .schema('limbus')
      .from('skills')
      .select('*')
      .order('skill_order')
      .order('variant_order')
      .order('id')
      .range(offset, offset + BATCH - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < BATCH) break
  }
  return all
}

export async function getSkills(identityId: string): Promise<Skill[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('skills')
    .select('*')
    .eq('identity_id', identityId)
    .order('skill_order')
    .order('uptie_level')
    .order('variant_order')
    .order('id')
  if (error) return []
  return data ?? []
}

export async function getAllPassives(): Promise<Passive[]> {
  const all: Passive[] = []
  const BATCH = 1000
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await supabase()
      .schema('limbus')
      .from('passives')
      .select('*')
      .order('passive_order')
      .range(offset, offset + BATCH - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < BATCH) break
  }
  return all
}

export async function getPassives(identityId: string): Promise<Passive[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('passives')
    .select('*')
    .eq('identity_id', identityId)
    .order('passive_order')
    .order('uptie_level')
  if (error) return []
  return data ?? []
}

export async function getLatestEGOs(limit = 6): Promise<EGOWithSinner[]> {
  const loadByGameId = async () => {
    const { data, error } = await supabase()
      .schema('limbus')
      .from('ego')
      .select('*, sinner:sinners(*)')
      .not('image_url', 'is', null)
      .not('game_id', 'is', null)
      .order('game_id', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as EGOWithSinner[]
  }

  const { data, error } = await supabase()
    .schema('limbus')
    .from('ego')
    .select('*, sinner:sinners(*)')
    .not('image_url', 'is', null)
    .not('game_id', 'is', null)
    .not('release_date', 'is', null)
    .order('release_date', { ascending: false })
    .order('game_id', { ascending: false })
    .limit(limit)
  if (error) {
    if (error.code === '42703') return loadByGameId()
    throw error
  }
  if (!data || data.length === 0) return loadByGameId()
  return (data ?? []) as EGOWithSinner[]
}

export async function getEGOs(sinnerId?: string): Promise<EGO[]> {
  let q = supabase().schema('limbus').from('ego').select('*')
  if (sinnerId) q = q.eq('sinner_id', sinnerId)
  const { data, error } = await q.order('grade').order('name')
  if (error) throw error
  return data ?? []
}

export async function getEGOById(id: string): Promise<EGO | null> {
  // ego + ego_skills 병렬 조회 (둘 다 id만 사용)
  const [egoRes, skillsRes] = await Promise.all([
    supabase().schema('limbus').from('ego').select('*').eq('id', id).maybeSingle(),
    supabase().schema('limbus')
      .from('ego_skills')
      .select('*')
      .eq('ego_id', id)
      .order('skill_order'),
  ])
  const { data, error } = egoRes
  if (error) throw error
  if (!data) return null

  // ego_skills 릴레이션 테이블에서 스킬 조회 → EGOSkill JSONB 포맷으로 변환
  const { data: relSkills } = skillsRes

  if (relSkills && relSkills.length > 0) {
    const parseDescription = (desc: string | null | undefined, suffix: string) => {
      if (!desc) return {}
      const lines = desc.split('\n')
      let normalEffect = ''
      const coinEffects: string[] = []
      let lastCoinIdx = -1
      // EN/JP uses [Coin N] format, KR uses [코인 N]
      const coinRegex = /^\[(?:코인|Coin)\s*(\d+)\]\s*(.*)/
      for (const line of lines) {
        const coinMatch = line.match(coinRegex)
        if (coinMatch) {
          const idx = parseInt(coinMatch[1]) - 1
          while (coinEffects.length <= idx) coinEffects.push('')
          coinEffects[idx] = coinMatch[2].trim()
          lastCoinIdx = idx
        } else if (line.trim() && lastCoinIdx >= 0) {
          coinEffects[lastCoinIdx] += '\n' + line.trim()
        } else if (line.trim()) {
          normalEffect += (normalEffect ? '\n' : '') + line.trim()
        }
      }
      return {
        [`normalEffect_${suffix}`]: normalEffect || null,
        [`coin1Effect_${suffix}`]: coinEffects[0] || null,
        [`coin2Effect_${suffix}`]: coinEffects[1] || null,
        [`coin3Effect_${suffix}`]: coinEffects[2] || null,
        [`coin4Effect_${suffix}`]: coinEffects[3] || null,
        [`coin5Effect_${suffix}`]: coinEffects[4] || null,
      }
    }

    const toEGOSkill = (s: Record<string, unknown>) => {
      // description 파싱: "[코인 1] effect\n후속효과\n[코인 2] effect" → 개별 필드
      const krParsed = parseDescription(s.description as string, 'kr')
      return {
        name: s.name as string,
        power: String((s.base_power as number) ?? 0),
        mentalConsume: 0,
        atkType: s.skill_type as string,
        resource: s.sin_affinity as string,
        skillPower: (s.base_power as number) ?? 0,
        coinPower: (s.coin_power as number) ?? 0,
        coinNum: (s.coins as number) ?? 1,
        atkWeight: (s.atk_weight as number) ?? 1,
        construeLevel: (s.construe_level as number) ?? 4,
        offenseLevel: (s.offense_level as number) ?? null,
        normalEffect: (krParsed.normalEffect_kr as string) || '',
        coin1Effect: (krParsed.coin1Effect_kr as string) || '',
        coin2Effect: (krParsed.coin2Effect_kr as string) || '',
        coin3Effect: (krParsed.coin3Effect_kr as string) || '',
        coin4Effect: (krParsed.coin4Effect_kr as string) || '',
        coin5Effect: (krParsed.coin5Effect_kr as string) || '',
        name_en: (s.name_en as string) || null,
        name_jp: (s.name_jp as string) || null,
        ...parseDescription(s.description_en as string, 'en'),
        ...parseDescription(s.description_jp as string, 'jp'),
      }
    }

    const awakening = relSkills.filter(s => s.category === 'awakening').map(toEGOSkill)
    const corrosion = relSkills.filter(s => s.category === 'corrosion').map(toEGOSkill)

    // 릴레이션 데이터가 있으면 JSONB 컬럼보다 우선
    if (awakening.length > 0) data.ego_skills = awakening
    if (corrosion.length > 0) data.ego_cor_skills = corrosion
  }

  return data
}

// ── 브라우저용 전체 인격 (스킬 요약 포함) ──────────────────────────────────
// Design Ref: §4.1 — 서버에서 스킬 요약 가공 후 클라이언트 전달
export async function getAllIdentitiesForBrowser(): Promise<IdentityBrowserItem[]> {
  // 1+2. 전체 인격 + 스킬을 병렬 조회
  const [idRes, skRes] = await Promise.all([
    supabase()
      .schema('limbus')
      .from('identities')
      .select('id, sinner_id, name, name_kr, rarity, keywords, folder_name, game_id, hp, speed_min, speed_max, def_level, acquisition_info, sinner:sinners(id, name_kr, order_num)')
      .order('rarity', { ascending: false })
      .order('name'),
    supabase()
      .schema('limbus')
      .from('skills')
      .select('identity_id, sin_affinity, skill_type, atk_weight, coins')
      .eq('uptie_level', 4)
      .in('skill_type', ['slash', 'pierce', 'blunt', 'evade', 'defense', 'counter']),
  ])
  const { data: identities, error: idErr } = idRes
  if (idErr) throw idErr
  const { data: skills, error: skErr } = skRes
  if (skErr) throw skErr

  // 3. 스킬을 identity_id로 그룹핑하여 요약
  const skillMap = new Map<string, { sins: Set<string>, types: Set<string>, weights: Set<number>, coins: Set<number> }>()
  for (const s of (skills ?? [])) {
    let entry = skillMap.get(s.identity_id)
    if (!entry) {
      entry = { sins: new Set(), types: new Set(), weights: new Set(), coins: new Set() }
      skillMap.set(s.identity_id, entry)
    }
    if (s.sin_affinity) entry.sins.add(s.sin_affinity)
    if (s.skill_type) entry.types.add(s.skill_type)
    if (s.atk_weight) entry.weights.add(s.atk_weight)
    if (s.coins) entry.coins.add(s.coins)
  }

  // 4. 합치기
  return (identities ?? []).map(id => {
    const sinner = id.sinner as unknown as { id: string; name_kr: string; order_num: number }
    const sk = skillMap.get(id.id)
    return {
      id: id.id,
      sinner_id: id.sinner_id,
      name: id.name,
      name_kr: id.name_kr,
      rarity: id.rarity,
      keywords: id.keywords ?? [],
      folder_name: id.folder_name,
      game_id: id.game_id,
      hp: id.hp ?? 0,
      speed_min: id.speed_min ?? 0,
      speed_max: id.speed_max ?? 0,
      def_level: id.def_level ?? 0,
      sinner_name_kr: sinner.name_kr,
      sinner_slug: sinner.id,
      sinner_order: sinner.order_num,
      skill_sins: sk ? [...sk.sins] as SinType[] : [],
      skill_types: sk ? [...sk.types] : [],
      atk_weights: sk ? [...sk.weights] : [],
      coin_counts: sk ? [...sk.coins] : [],
      season: (id.acquisition_info as Record<string, unknown>)?.release_season as number ?? 0,
    }
  })
}

// ── 브라우저용 전체 EGO ─────────────────────────────────────────────────────
export async function getAllEGOsForBrowser(): Promise<EGOBrowserItem[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('ego')
    .select('id, sinner_id, name, name_kr, grade, sin_affinity, keywords, folder_name, image_url, game_id, sinner:sinners(id, name_kr, order_num)')
    .order('grade')
    .order('name')
  if (error) throw error

  return (data ?? []).map(e => {
    const sinner = e.sinner as unknown as { id: string; name_kr: string; order_num: number }
    return {
      id: e.id,
      sinner_id: e.sinner_id,
      name: e.name,
      name_kr: e.name_kr,
      grade: e.grade,
      sin_affinity: e.sin_affinity as SinType | null,
      keywords: e.keywords,
      folder_name: e.folder_name,
      image_url: e.image_url,
      game_id: e.game_id,
      sinner_name_kr: sinner.name_kr,
      sinner_slug: sinner.id,
      sinner_order: sinner.order_num,
    }
  })
}

export async function getEgoGiftsForNotes(): Promise<EgoGiftNote[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('ego_gifts')
    .select('name, keyword, grade, image_url, effect_base, activation_condition')
  if (error) throw error
  return data ?? []
}
