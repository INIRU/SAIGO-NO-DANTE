import { createClient } from '@supabase/supabase-js'
import type { Sinner, Identity, IdentityWithSinner, Skill, Passive, EGO, EGOWithSinner, EgoGiftNote } from '@/lib/types'

// ── Supabase 클라이언트 (browser/server 공용 anon key) ─────────────────────
function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    .select('*, sinner:sinners(*)')
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

export async function getEGOs(sinnerId?: string): Promise<EGO[]> {
  let q = supabase().schema('limbus').from('ego').select('*')
  if (sinnerId) q = q.eq('sinner_id', sinnerId)
  const { data, error } = await q.order('grade').order('name')
  if (error) throw error
  return data ?? []
}

export async function getEGOById(id: string): Promise<EGO | null> {
  const { data, error } = await supabase().schema('limbus').from('ego').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null

  // ego_skills 릴레이션 테이블에서 스킬 조회 → EGOSkill JSONB 포맷으로 변환
  const { data: relSkills } = await supabase().schema('limbus')
    .from('ego_skills')
    .select('*')
    .eq('ego_id', id)
    .order('skill_order')

  if (relSkills && relSkills.length > 0) {
    const toEGOSkill = (s: Record<string, unknown>) => {
      // description 파싱: "[코인 1] effect\n후속효과\n[코인 2] effect" → 개별 필드
      const desc = (s.description as string) || ''
      const lines = desc.split('\n')
      let normalEffect = ''
      const coinEffects: string[] = []
      let lastCoinIdx = -1
      for (const line of lines) {
        const coinMatch = line.match(/^\[코인\s*(\d+)\]\s*(.*)/)
        if (coinMatch) {
          const idx = parseInt(coinMatch[1]) - 1
          while (coinEffects.length <= idx) coinEffects.push('')
          coinEffects[idx] = coinMatch[2].trim()
          lastCoinIdx = idx
        } else if (line.trim() && lastCoinIdx >= 0) {
          // 이전 코인의 후속 효과 (줄바꿈으로 이어지는 효과)
          coinEffects[lastCoinIdx] += '\n' + line.trim()
        } else if (line.trim()) {
          normalEffect += (normalEffect ? '\n' : '') + line.trim()
        }
      }
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
        normalEffect,
        coin1Effect: coinEffects[0] || '',
        coin2Effect: coinEffects[1] || '',
        coin3Effect: coinEffects[2] || '',
        coin4Effect: coinEffects[3] || '',
        coin5Effect: coinEffects[4] || '',
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

export async function getEgoGiftsForNotes(): Promise<EgoGiftNote[]> {
  const { data, error } = await supabase()
    .schema('limbus')
    .from('ego_gifts')
    .select('name, keyword, grade, image_url, effect_base, activation_condition')
  if (error) throw error
  return data ?? []
}
