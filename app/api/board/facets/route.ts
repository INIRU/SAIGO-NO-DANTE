import { NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { COMMUNITY_FEED_CACHE_CONTROL } from '@/lib/constants/http-cache'

/**
 * Filter options for the deck and plan boards, drawn from the posts themselves: only affiliations, E.G.O, gifts and
 * theme packs that some post uses, each with how many posts use it. Also maps each used identity to its affiliations,
 * which the boards match posts against.
 */
type Kind = 'deck' | 'planner'
type Slot = { identity_id?: string; slot_order?: number | null; identities?: { id?: string } | { id?: string }[] | null }
type Post = { deck?: Slot[] | null; deck_identities?: Slot[] | null; egos?: { ego_id?: string }[] | null; deck_egos?: { ego_id?: string }[] | null; floor_plan?: { gift_ids?: unknown; theme_id?: unknown }[] | null; gift_inventory?: unknown[] | null }

// Every LCB identity carries these; as filters they would match nearly every post.
const GENERIC_AFFILIATIONS = new Set(['LCB', '림버스 컴퍼니'])
/** "흑수 - 묘" and "흑수 - 사" are one pack for filtering. */
export const affiliationKey = (value: string) => value.split(' - ')[0].trim()

const formedIds = (post: Post) => (post.deck ?? post.deck_identities ?? [])
  .filter(slot => (slot.slot_order ?? 99) < 99)
  .map(slot => slot.identity_id ?? (Array.isArray(slot.identities) ? slot.identities[0]?.id : slot.identities?.id))
  .filter((id): id is string => Boolean(id))

function tally(counts: Map<string, number>, values: Iterable<string>) {
  for (const value of new Set(values)) counts.set(value, (counts.get(value) ?? 0) + 1)
}

async function facets(kind: Kind) {
  'use cache'
  cacheLife('minutes')
  cacheTag(kind === 'deck' ? CACHE_TAGS.decksList : CACHE_TAGS.plansList, CACHE_TAGS.gameData)
  const db = createAdminClient().schema('limbus')
  const posts = kind === 'deck'
    ? await db.from('decks').select('deck_identities(slot_order, identities(id)), deck_egos(ego_id)')
    : await db.from('md_plans').select('deck, egos, floor_plan, gift_inventory')
  if (posts.error) throw new Error('posts')
  const rows = (posts.data ?? []) as Post[]

  const identityPosts = new Map<string, string[]>()
  const egoCounts = new Map<string, number>(), giftCounts = new Map<string, number>(), themeCounts = new Map<string, number>()
  rows.forEach((post, index) => {
    for (const id of formedIds(post)) identityPosts.set(id, [...(identityPosts.get(id) ?? []), String(index)])
    tally(egoCounts, (post.egos ?? post.deck_egos ?? []).map(ego => ego.ego_id).filter((id): id is string => Boolean(id)))
    if (kind === 'planner') {
      const floors = Array.isArray(post.floor_plan) ? post.floor_plan : []
      tally(giftCounts, [
        ...floors.flatMap(floor => Array.isArray(floor.gift_ids) ? floor.gift_ids.map(String) : []),
        ...(post.gift_inventory ?? []).flatMap(entry => { const match = typeof entry === 'string' ? /^final_(\d+)/.exec(entry) : null; return match ? [match[1]] : [] }),
      ])
      tally(themeCounts, floors.map(floor => floor.theme_id).filter(id => id !== null && id !== undefined && id !== '').map(String))
    }
  })

  const identityIds = [...identityPosts.keys()]
  const [identities, egos, gifts, themes] = await Promise.all([
    identityIds.length ? db.from('identities').select('id, association_list').in('id', identityIds) : Promise.resolve({ data: [], error: null }),
    egoCounts.size ? db.from('ego').select('id, game_id, sinner_id, grade, sin_affinity, name, name_kr, name_en, name_jp, image_url').in('id', [...egoCounts.keys()]) : Promise.resolve({ data: [], error: null }),
    giftCounts.size ? db.from('ego_gifts').select('game_id, name, name_en, name_jp, grade, keyword, image_url').in('game_id', [...giftCounts.keys()].map(Number)) : Promise.resolve({ data: [], error: null }),
    themeCounts.size ? db.from('ego_gift_themes').select('id, name, name_en, name_jp, image_url').in('id', [...themeCounts.keys()].map(Number)) : Promise.resolve({ data: [], error: null }),
  ])
  if (identities.error || egos.error || gifts.error || themes.error) throw new Error('catalog')

  const identityAffiliations: Record<string, string[]> = {}
  const affiliationPosts = new Map<string, Set<string>>()
  for (const identity of (identities.data ?? []) as { id: string; association_list: string[] | null }[]) {
    const keys = [...new Set((identity.association_list ?? []).map(affiliationKey).filter(key => key && !GENERIC_AFFILIATIONS.has(key)))]
    if (!keys.length) continue
    identityAffiliations[identity.id] = keys
    for (const key of keys) for (const post of identityPosts.get(identity.id) ?? []) affiliationPosts.set(key, (affiliationPosts.get(key) ?? new Set()).add(post))
  }
  const byCount = <T extends { count: number }>(items: T[]) => items.sort((a, b) => b.count - a.count)
  return {
    identityAffiliations,
    affiliations: byCount([...affiliationPosts].map(([key, set]) => ({ key, count: set.size }))),
    // Each sinner's starting ZAYIN (game id 2SS01) is in nearly every post: useless as a filter.
    egos: byCount(((egos.data ?? []) as Record<string, unknown>[]).filter(ego => Number(ego.game_id) % 100 !== 1)
      .map(ego => ({ ...ego, count: egoCounts.get(String(ego.id)) ?? 0 }))),
    gifts: byCount(((gifts.data ?? []) as Record<string, unknown>[]).map(gift => ({ ...gift, count: giftCounts.get(String(gift.game_id)) ?? 0 }))),
    themes: byCount(((themes.data ?? []) as Record<string, unknown>[]).map(theme => ({ ...theme, count: themeCounts.get(String(theme.id)) ?? 0 }))),
  }
}

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get('kind')
  if (kind !== 'deck' && kind !== 'planner') return NextResponse.json({ error: 'kind must be deck or planner' }, { status: 400 })
  try {
    return NextResponse.json(await facets(kind), { headers: { 'Cache-Control': COMMUNITY_FEED_CACHE_CONTROL } })
  } catch {
    return NextResponse.json({ error: 'Could not load filters' }, { status: 500 })
  }
}

