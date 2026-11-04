import { notePreviewText } from '@/lib/notes/blocks'
import { stripPlanForList } from '@/lib/planner/stripPlanForList'

export type DiscoveryKind = 'deck' | 'planner'

// Shared by the public discovery shelf and the personal "for you" shelf.
export const DISCOVERY_COLUMNS: Record<DiscoveryKind, string> = {
  deck: 'id,user_id,guest_tag,profiles!decks_user_id_fkey(username,avatar_url,public_profile),title,description,tags,main_keywords,content_type,lang,created_at,updated_at,vote_count,view_count,comment_count,deck_identities(slot_order,identities(id,sinner_id,folder_name,game_id,name_kr))',
  planner: 'id,user_id,guest_tag,profiles:user_id(username,avatar_url,public_profile),title,description,lang,difficulty,deck,egos,floor_plan,gift_inventory,tags,created_at,updated_at,vote_count,view_count,comment_count',
}
export const DISCOVERY_TABLE: Record<DiscoveryKind, string> = { deck: 'decks', planner: 'md_plans' }

export function formatDiscoveryPosts(kind: DiscoveryKind, rows: unknown[]) {
  return rows.map(raw => {
    const row = raw as Record<string, unknown>
    if (kind === 'planner') return stripPlanForList(row) as unknown as Record<string, unknown>
    const profile = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as { username?: string | null; avatar_url?: string | null; public_profile?: boolean } | null
    // Cards show the description as one line: send that line, not the whole note document.
    const description = typeof row.description === 'string' ? { description: notePreviewText(row.description) } : {}
    return { ...row, ...description, username: profile?.username ?? undefined, avatar_url: profile?.avatar_url ?? null, profile_public: profile?.public_profile }
  })
}

export type Features = { identities: string[]; sinners: string[]; keywords: string[] }
type Person = { id?: string; sinner_id?: string }
type Slot = { identity_id?: string; sinner_id?: string; slot_order?: number | null; identities?: Person | Person[] | null }

// Deck slots and plan slots differ in shape; only assigned slots (slot_order < 99) describe the lineup.
export function postFeatures(post: Record<string, unknown>): Features {
  const slots = ((post.deck_identities ?? post.deck ?? []) as Slot[]).filter(s => (s.slot_order ?? 99) < 99)
  const people: Person[] = slots.map(s => (Array.isArray(s.identities) ? s.identities[0] : s.identities) ?? { id: s.identity_id, sinner_id: s.sinner_id })
  const keywords = (post.main_keywords ?? post.selected_keywords ?? []) as string[]
  return {
    identities: [...new Set(people.map(p => p.id).filter((id): id is string => !!id))],
    sinners: [...new Set(people.map(p => p.sinner_id).filter((id): id is string => !!id))],
    keywords: [...new Set(keywords)],
  }
}

const WEIGHT = { identities: 3, keywords: 2, sinners: 1 } as const
const KEYS = ['identities', 'sinners', 'keywords'] as const

/** How often each identity/sinner/keyword appears in what the user looked at. */
export function interestProfile(seen: Features[]) {
  const profile = new Map<string, number>()
  for (const item of seen)
    for (const key of KEYS)
      for (const value of item[key]) profile.set(key + ':' + value, (profile.get(key + ':' + value) ?? 0) + 1)
  return profile
}

/** Unseen posts sharing the most with the profile first, then unseen popular posts to fill the shelf. */
export function recommend<T extends { id: string }>(
  candidates: T[],
  profile: Map<string, number>,
  seenIds: Set<string>,
  popularIds: string[],
  limit = 6,
): T[] {
  const unseen = new Map(candidates.filter(c => !seenIds.has(c.id)).map(c => [c.id, c]))
  const score = (post: T) => {
    const features = postFeatures(post as unknown as Record<string, unknown>)
    let total = 0
    for (const key of KEYS)
      for (const value of features[key]) total += WEIGHT[key] * (profile.get(key + ':' + value) ?? 0)
    return total
  }
  const scored = [...unseen.values()].map(post => ({ post, score: score(post) })).filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || a.post.id.localeCompare(b.post.id)).map(s => s.post)
  const picked = new Set(scored.map(p => p.id))
  const popular = popularIds.map(id => unseen.get(id)).filter((c): c is T => !!c && !picked.has(c.id))
  return [...scored, ...popular].slice(0, limit)
}
