import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DecksClient from './DecksClient'
import type { DeckSummary } from '@/components/decks/DeckCard'

export const metadata: Metadata = {
  title: '덱 게시판',
  description: '림버스 컴퍼니 커뮤니티 덱 빌드를 탐색하고 공유하세요.',
  alternates: { canonical: 'https://saigo-no-dante.com/decks' },
}

export const revalidate = 60

const PAGE_SIZE = 12

export default async function DecksPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .schema('limbus')
    .from('decks')
    .select(`
      id, title, description, tags, content_type, vote_count, view_count, comment_count, created_at,
      profiles!decks_user_id_fkey(username),
      deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords, name_kr)),
      deck_egos(ego_id)
    `)
    .order('created_at', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  if (error) {
    console.error('[DecksPage] initial fetch error:', error)
  }

  const initialDecks = (data ?? []).map(d => {
    const profiles = d.profiles as { username?: string } | { username?: string }[] | null
    const username = Array.isArray(profiles)
      ? (profiles[0]?.username ?? undefined)
      : (profiles?.username ?? undefined)
    return { ...d, profiles: undefined, username } as unknown as DeckSummary
  })

  return <DecksClient initialDecks={initialDecks} initialTotal={initialDecks.length} />
}
