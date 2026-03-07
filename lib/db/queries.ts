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
