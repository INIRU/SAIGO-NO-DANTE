import type { SupabaseClient } from '@supabase/supabase-js'
import type { DeckSummary } from '@/features/decks/components/DeckCard'
import type { PlanSummary } from '@/components/planner/PlanCard'
import { withPostAuthors } from '@/features/community/server/post-authors'
import { stripPlanForList } from '@/lib/planner/stripPlanForList'
import { orderSeriesItems, type SeriesItem } from '@/features/community/lib/series-order'

export type SeriesCard = { kind: 'deck'; id: string; deck: DeckSummary } | { kind: 'plan'; id: string; plan: PlanSummary }

const DECK_COLUMNS = 'id,user_id,title,description,tags,main_keywords,content_type,vote_count,view_count,comment_count,created_at,lang,guest_tag,deck_identities(slot_order,gacksung,identities(sinner_id,folder_name,game_id,keywords))'
const PLAN_COLUMNS = 'id,user_id,title,description,lang,difficulty,deck,egos,floor_plan,gift_inventory,tags,created_at,vote_count,view_count,comment_count,guest_tag,profiles:user_id(username,avatar_url)'

/** The cards of a series' posts, in series order; a post that can no longer be read is left out. */
export async function loadSeriesCards(db: SupabaseClient, items: SeriesItem[]): Promise<SeriesCard[]> {
  const ordered = orderSeriesItems(items)
  const deckIds = ordered.filter(item => item.kind === 'deck').map(item => item.id)
  const planIds = ordered.filter(item => item.kind === 'plan').map(item => item.id)
  const [decks, plans] = await Promise.all([
    deckIds.length ? db.schema('limbus').from('decks').select(DECK_COLUMNS).in('id', deckIds) : { data: [], error: null },
    planIds.length ? db.schema('limbus').from('md_plans').select(PLAN_COLUMNS).in('id', planIds) : { data: [], error: null },
  ])
  if (decks.error || plans.error) throw new Error('series cards lookup failed')
  const deckRows = await withPostAuthors((decks.data ?? []) as unknown as (DeckSummary & { profiles?: { username: string; avatar_url: string | null; public_profile: boolean } | null })[])
  const deckById = new Map(deckRows.map(row => {
    const { profiles, ...rest } = row
    return [row.id, { ...rest, username: profiles?.username ?? undefined, avatar_url: profiles?.avatar_url ?? null, profile_public: profiles?.public_profile } as DeckSummary]
  }))
  const planById = new Map((plans.data ?? []).map(row => [row.id as string, stripPlanForList(row as Record<string, unknown>)]))
  return ordered.flatMap((item): SeriesCard[] => {
    if (item.kind === 'deck') {
      const deck = deckById.get(item.id)
      return deck ? [{ kind: 'deck', id: item.id, deck }] : []
    }
    const plan = planById.get(item.id)
    return plan ? [{ kind: 'plan', id: item.id, plan }] : []
  })
}
