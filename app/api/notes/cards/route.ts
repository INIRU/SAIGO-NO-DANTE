import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withPostAuthors } from '@/features/community/server'
import { CARD_ID } from '@/lib/notes/blocks'

const DECK_SELECT = `id, user_id, title, description, tags, main_keywords, content_type, lang, vote_count, view_count, comment_count, created_at,
  guest_tag, profiles!decks_user_id_fkey(username),
  deck_identities(slot_order, gacksung, s1_count, s2_count, s3_count, identities(id, sinner_id, folder_name, game_id, keywords, skill_keyword_list, name_kr)),
  deck_egos(ego_id, grade)`
const PLAN_SELECT = 'id, title, description, difficulty, deck, egos, tags, lang, vote_count, view_count, comment_count, created_at, user_id, guest_tag, profiles:user_id(username, avatar_url)'

/** Decks or plans for the note card block: a title search for the picker, or `refs` (ids) for the viewer. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const kind = params.get('kind')
  if (kind !== 'deck' && kind !== 'plan') return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  const refs = (params.get('refs') ?? '').split(',').filter(Boolean)
  if (refs.length > 20 || refs.some(id => !CARD_ID.test(id))) return NextResponse.json({ error: 'Invalid refs' }, { status: 400 })
  const supabase = await createClient()
  const base = supabase.schema('limbus').from(kind === 'deck' ? 'decks' : 'md_plans')
  const select = kind === 'deck' ? DECK_SELECT : PLAN_SELECT
  let query = base.select(select).order('created_at', { ascending: false }).limit(refs.length || 12)
  if (refs.length) query = query.in('id', refs)
  else {
    const q = (params.get('q') ?? '').replace(/[%,().\\]/g, '').trim().slice(0, 60)
    if (q) query = query.ilike('title', `%${q}%`)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Cards unavailable' }, { status: 500 })
  const rows = await withPostAuthors((data ?? []) as { user_id?: string | null; profiles?: { username?: string; avatar_url?: string | null; public_profile?: boolean } | null }[])
  return NextResponse.json(kind === 'plan' ? rows : rows.map(row => ({ ...row, username: row.profiles?.username, avatar_url: row.profiles?.avatar_url, profile_public: row.profiles?.public_profile })))
}
