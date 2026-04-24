import * as Sentry from '@sentry/nextjs'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import DeckDetailClient from './DeckDetailClient'
import DeckHero from '@/components/deck-detail/DeckHero'
import type { IdentitySlot, IdentityDetail } from '@/components/deck-detail/DeckIdentityCard'
import type { HeroSlot } from '@/components/deck-detail/DeckHero'

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  username: string | null
  avatar_url: string | null
  role?: string
}

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
  if (error) Sentry.captureException(error, { tags: { location: 'decks/[id]/page:generateMetadata' }, extra: { msg: 'Failed to fetch deck metadata' } })

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
  'use cache'
  cacheLife('max')
  const { id } = await params
  cacheTag(CACHE_TAGS.deck(id), CACHE_TAGS.decksList)

  // Server-side prefetch: hero portrait strip + basic deck fields for LCP
  let initialDeck = null
  let initialComments: Comment[] = []
  let heroSlots: (HeroSlot | null)[] = Array.from({ length: 12 }, () => null)

  try {
    const supabase = createAdminClient()

    const [deckResult, commentsResult] = await Promise.all([
      supabase
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
        .single(),
      supabase
        .schema('limbus')
        .from('deck_comments')
        .select('id, content, created_at, user_id, parent_id, profiles!deck_comments_user_id_fkey(username, avatar_url, role)')
        .eq('deck_id', id)
        .order('created_at', { ascending: true }),
    ])

    const data = deckResult.data
    if (data) {
      const sortedIdentities = (data.deck_identities ?? [])
        .map((slot) => ({
          ...slot,
          identities: Array.isArray(slot.identities)
            ? ((slot.identities[0] as IdentityDetail | undefined) ?? null)
            : (slot.identities as unknown as IdentityDetail | null),
        })) as IdentitySlot[]

      sortedIdentities.sort((a, b) => {
        if (a.slot_order === 99 && b.slot_order !== 99) return 1
        if (b.slot_order === 99 && a.slot_order !== 99) return -1
        return a.slot_order - b.slot_order
      })

      // Build hero slots for server-side render
      heroSlots = Array.from({ length: 12 }, (_, i) => {
        const slot = sortedIdentities[i]
        if (!slot) return null
        const id_ = slot.identities
        return {
          slot_order: slot.slot_order,
          gacksung: slot.gacksung ?? null,
          identities: id_
            ? {
                sinner_id: id_.sinner_id,
                folder_name: id_.folder_name ?? null,
                game_id: id_.game_id ?? null,
                rarity: id_.rarity,
              }
            : null,
        } satisfies HeroSlot
      })

      initialDeck = {
        ...data,
        vote_count: data.vote_count ?? 0,
        view_count: data.view_count ?? 0,
        deck_identities: sortedIdentities,
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

    if (commentsResult.data) {
      initialComments = commentsResult.data.map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          id: row.id,
          content: row.content,
          created_at: row.created_at,
          user_id: row.user_id,
          parent_id: row.parent_id,
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
          role: profile?.role ?? undefined,
        }
      })
    }
  } catch {
    // Fall back to client-side fetch
  }

  return (
    <>
      <DeckHero slots={heroSlots} />
      <Suspense fallback={
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-pulse" style={{ width: '100%', maxWidth: '64rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
            <div style={{ background: '#1a1510', borderRadius: '0.5rem', height: '20rem', marginBottom: '1rem' }} />
            <div style={{ background: '#1a1510', borderRadius: '0.5rem', height: '10rem' }} />
          </div>
        </div>
      }>
        <DeckDetailClient id={id} initialDeck={initialDeck} initialComments={initialComments} />
      </Suspense>
    </>
  )
}
