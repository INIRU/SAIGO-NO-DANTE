/**
 * Server-side meta/usage data computation.
 * Extracted from app/api/meta/usage/route.ts so the server component
 * (app/meta/page.tsx) can fetch this data directly without an HTTP round-trip.
 */
import { createClient } from '@/lib/supabase/server'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'

// ── Types (mirrored in MetaClient.tsx) ─────────────────────────────────────

export interface IdentityStat {
  identity_id: string
  sinner_id: string
  name_kr: string
  keywords: string[]
  rarity: number
  folder_name: string | null
  game_id: string | null
  count: number
}

export interface KeywordStat { keyword: string; count: number }

export interface Synergy {
  a_id: string; a_name: string; a_sinner_id: string; a_folder: string | null; a_game_id: string | null
  b_id: string; b_name: string; b_sinner_id: string; b_folder: string | null; b_game_id: string | null
  count: number
}

export interface EGOStat {
  ego_id: string
  sinner_id: string
  name_kr: string
  grade: string
  sin_affinity: string | null
  image_url: string | null
  count: number
}

export interface MetaData {
  totalDecks: number
  battleIdentityStats: IdentityStat[]
  supportIdentityStats: IdentityStat[]
  usageBySinner: Record<string, number>
  usageBySin: Record<string, number>
  keywordUsage: KeywordStat[]
  synergies: Synergy[]
  egoStats: EGOStat[]
}

// ── Main fetch ──────────────────────────────────────────────────────────────

export async function getMetaData(): Promise<MetaData> {
  const supabase = await createClient()

  const [identityResult, egoResult, deckCountResult, keywordMetaResult] = await Promise.all([
    supabase
      .schema('limbus')
      .from('deck_identities')
      .select('deck_id, identity_id, slot_order, identities(sinner_id, name_kr, keywords, rarity, folder_name, game_id)')
      .limit(5000),
    supabase
      .schema('limbus')
      .from('deck_egos')
      .select('deck_id, ego_id, ego(sinner_id, name_kr, grade, sin_affinity, image_url)')
      .limit(5000),
    supabase
      .schema('limbus')
      .from('decks')
      .select('*', { count: 'exact', head: true }),
    supabase
      .schema('limbus')
      .from('keyword_meta')
      .select('name, sin_affinity'),
  ])

  const totalDecks = deckCountResult.count ?? 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (identityResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const egoRows = (egoResult.data ?? []) as any[]

  // keyword → sin mapping
  const keywordSinMap: Record<string, string> = {}
  for (const km of keywordMetaResult.data ?? []) {
    if (km.sin_affinity) keywordSinMap[km.name] = km.sin_affinity
  }

  // ① Identity usage (battle / support split)
  type IdentityEntry = {
    sinner_id: string; name_kr: string; keywords: string[]; rarity: number
    folder_name: string | null; game_id: string | null; count: number
  }
  const battleIdentityMap = new Map<string, IdentityEntry>()
  const supportIdentityMap = new Map<string, IdentityEntry>()
  const usageBySinner: Record<string, number> = {}
  const usageBySin: Record<string, number> = {}
  const deckIdentities = new Map<string, string[]>()
  const deckKeywords = new Map<string, Set<string>>()
  const deckBattleSinners = new Map<string, Set<string>>()

  for (const row of rows) {
    const identity = Array.isArray(row.identities) ? row.identities[0] : row.identities
    if (!row.identity_id || !identity) continue

    const slotOrder = row.slot_order ?? 99
    const isBattle = slotOrder !== 99
    const isSupport = slotOrder === 99

    if (isBattle) {
      if (!deckBattleSinners.has(row.deck_id)) deckBattleSinners.set(row.deck_id, new Set())
      deckBattleSinners.get(row.deck_id)!.add(identity.sinner_id)
    }

    const targetMap = isBattle ? battleIdentityMap : isSupport ? supportIdentityMap : null
    if (targetMap) {
      const existing = targetMap.get(row.identity_id)
      if (existing) {
        existing.count++
      } else {
        targetMap.set(row.identity_id, {
          sinner_id: identity.sinner_id,
          name_kr: identity.name_kr,
          keywords: identity.keywords || [],
          rarity: identity.rarity,
          folder_name: identity.folder_name ?? null,
          game_id: identity.game_id ?? null,
          count: 1,
        })
      }
    }

    usageBySinner[identity.sinner_id] = (usageBySinner[identity.sinner_id] || 0) + 1

    const keywords: string[] = identity.keywords || []
    for (const kw of keywords) {
      const sin = keywordSinMap[kw]
      if (sin) { usageBySin[sin] = (usageBySin[sin] || 0) + 1; break }
    }

    if (!deckIdentities.has(row.deck_id)) deckIdentities.set(row.deck_id, [])
    deckIdentities.get(row.deck_id)!.push(row.identity_id)

    if (!deckKeywords.has(row.deck_id)) deckKeywords.set(row.deck_id, new Set())
    const normalizedKws = new Set<string>()
    for (const kw of keywords) normalizedKws.add(normalizeThemeKeyword(kw))
    for (const nkw of normalizedKws) deckKeywords.get(row.deck_id)!.add(nkw)
  }

  const battleIdentityStats = [...battleIdentityMap.entries()]
    .map(([id, d]) => ({ identity_id: id, ...d }))
    .sort((a, b) => b.count - a.count)

  const supportIdentityStats = [...supportIdentityMap.entries()]
    .map(([id, d]) => ({ identity_id: id, ...d }))
    .sort((a, b) => b.count - a.count)

  // ② Keyword trend (per-deck deduplication)
  const kwCount = new Map<string, number>()
  for (const kwSet of deckKeywords.values()) {
    for (const kw of kwSet) kwCount.set(kw, (kwCount.get(kw) ?? 0) + 1)
  }
  const keywordUsage = [...kwCount.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)

  // ③ Synergy pairs TOP 20
  const pairCount = new Map<string, number>()
  for (const ids of deckIdentities.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1)
      }
    }
  }
  const synergies = [...pairCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([key, count]) => {
      const [aId, bId] = key.split('|')
      const aData = battleIdentityMap.get(aId) ?? supportIdentityMap.get(aId)
      const bData = battleIdentityMap.get(bId) ?? supportIdentityMap.get(bId)
      return {
        a_id: aId, a_name: aData?.name_kr ?? '',
        a_sinner_id: aData?.sinner_id ?? '', a_folder: aData?.folder_name ?? null, a_game_id: aData?.game_id ?? null,
        b_id: bId, b_name: bData?.name_kr ?? '',
        b_sinner_id: bData?.sinner_id ?? '', b_folder: bData?.folder_name ?? null, b_game_id: bData?.game_id ?? null,
        count,
      }
    })

  // ④ EGO usage (only for battle sinners in each deck)
  const egoMap = new Map<string, {
    sinner_id: string; name_kr: string; grade: string; sin_affinity: string | null; image_url: string | null; count: number
  }>()
  for (const row of egoRows) {
    const ego = Array.isArray(row.ego) ? row.ego[0] : row.ego
    if (!row.ego_id || !ego) continue
    const battleSinners = deckBattleSinners.get(row.deck_id)
    if (!battleSinners || !battleSinners.has(ego.sinner_id)) continue
    const existing = egoMap.get(row.ego_id)
    if (existing) {
      existing.count++
    } else {
      egoMap.set(row.ego_id, {
        sinner_id: ego.sinner_id,
        name_kr: ego.name_kr ?? '',
        grade: ego.grade ?? row.grade,
        sin_affinity: ego.sin_affinity,
        image_url: ego.image_url ?? null,
        count: 1,
      })
    }
  }
  const egoStats = [...egoMap.entries()]
    .map(([id, d]) => ({ ego_id: id, ...d }))
    .sort((a, b) => b.count - a.count)

  return {
    totalDecks,
    battleIdentityStats,
    supportIdentityStats,
    usageBySinner,
    usageBySin,
    keywordUsage,
    synergies,
    egoStats,
  }
}
