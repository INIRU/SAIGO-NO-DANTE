import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import DeckDetailClient from './DeckDetailClient'
import type { IdentitySlot, IdentityDetail } from '@/components/deck-detail/DeckIdentityCard'

type Props = { params: Promise<{ id: string }> }

type EgoSlot = {
  grade: string
  ego: {
    id: string
    name_kr: string | null
    grade: string
    sin_affinity: string | null
    sinner_id: string
    folder_name: string | null
    image_url: string | null
  } | null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .schema('limbus')
    .from('decks')
    .select('title, description, tags')
    .eq('id', id)
    .single()
  if (error) console.error('Failed to fetch deck metadata:', error)

  if (!data) {
    return { title: '덱을 찾을 수 없습니다' }
  }

  const title = data.title
  const description = data.description
    ? data.description.slice(0, 160)
    : `${data.title} — 림버스 컴퍼니 덱 빌드`

  return {
    title,
    description,
    openGraph: {
      title: `${title} | 덱 게시판`,
      description,
    },
  }
}

export default async function DeckDetailPage({ params }: Props) {
  const { id } = await params

  // Server-side prefetch: hero portrait strip + basic deck fields for LCP
  let initialDeck = null
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .schema('limbus')
      .from('decks')
      .select(`
        id, user_id, title, description, tags, content_type, vote_count, view_count, created_at,
        profiles!decks_user_id_fkey(username),
        deck_identities(
          slot_order, gacksung, s1_count, s2_count, s3_count,
          identities(
            id, sinner_id, folder_name, game_id, keywords, name_kr, tier, rarity,
            hp, speed_min, speed_max, def_level, slash_res, pierce_res, blunt_res,
            skills(id, name, skill_type, sin_affinity, coins, base_power, coin_power, skill_order, variant_order, atk_weight, offense_level, description, uptie_level),
            passives(name, passive_type, sin_affinity, sin_count, active_cond, description, passive_order, uptie_level)
          )
        ),
        deck_egos(
          grade,
          ego:ego_id(id, name_kr, grade, sin_affinity, sinner_id, folder_name, image_url)
        )
      `)
      .eq('id', id)
      .single()

    if (data) {
      initialDeck = {
        ...data,
        vote_count: data.vote_count ?? 0,
        view_count: data.view_count ?? 0,
        deck_identities: (data.deck_identities ?? []).map((slot) => ({
          ...slot,
          identities: Array.isArray(slot.identities)
            ? ((slot.identities[0] as IdentityDetail | undefined) ?? null)
            : (slot.identities as unknown as IdentityDetail | null),
        })) as IdentitySlot[],
        deck_egos: (data.deck_egos ?? []).map((es) => ({
          ...es,
          ego: Array.isArray(es.ego)
            ? ((es.ego[0] as EgoSlot['ego'] | undefined) ?? null)
            : (es.ego as EgoSlot['ego']),
        })) as EgoSlot[],
        profiles: Array.isArray(data.profiles) ? (data.profiles[0] ?? null) : data.profiles,
        all_sinner_egos: [],
        is_owner: false,
        is_admin: false,
        deck_code: undefined,
      } as any
    }
  } catch {
    // Fall back to client-side fetch
  }

  return <DeckDetailClient id={id} initialDeck={initialDeck} />
}
