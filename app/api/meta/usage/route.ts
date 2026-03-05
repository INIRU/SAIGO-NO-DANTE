import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const [identityResult, egoResult, deckCountResult, keywordMetaResult] = await Promise.all([
    supabase
      .schema('limbus')
      .from('deck_identities')
      .select('deck_id, identity_id, identities(sinner_id, name_kr, keywords, rarity, folder_name, game_id)'),
    supabase
      .schema('limbus')
      .from('deck_egos')
      .select('deck_id, ego_id, ego(sinner_id, name_kr, grade, sin_affinity, image_url)'),
    supabase
      .schema('limbus')
      .from('decks')
      .select('*', { count: 'exact', head: true }),
    supabase
      .schema('limbus')
      .from('keyword_meta')
      .select('name, sin_affinity'),
  ])

  if (identityResult.error) {
    return NextResponse.json({ error: identityResult.error.message }, { status: 500 })
  }

  const totalDecks = deckCountResult.count ?? 0
  const rows = identityResult.data ?? []
  const egoRows = egoResult.data ?? []

  // 키워드 → 죄악 매핑 (keyword_meta에서 런타임 빌드)
  const keywordSinMap: Record<string, string> = {}
  for (const km of keywordMetaResult.data ?? []) {
    if (km.sin_affinity) keywordSinMap[km.name] = km.sin_affinity
  }

  // ① 인격 채용률 집계
  const identityMap = new Map<string, {
    sinner_id: string; name_kr: string; keywords: string[]; rarity: number;
    folder_name: string | null; game_id: string | null; count: number
  }>()
  const usageBySinner: Record<string, number> = {}
  const usageBySin: Record<string, number> = {}

  // 키워드 + 시너지를 위한 덱별 그룹
  const deckIdentities = new Map<string, string[]>()
  const deckKeywords = new Map<string, Set<string>>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of rows as any[]) {
    const identity = Array.isArray(row.identities) ? row.identities[0] : row.identities
    if (!row.identity_id || !identity) continue

    const existing = identityMap.get(row.identity_id)
    if (existing) {
      existing.count++
    } else {
      identityMap.set(row.identity_id, {
        sinner_id: identity.sinner_id,
        name_kr: identity.name_kr,
        keywords: identity.keywords || [],
        rarity: identity.rarity,
        folder_name: identity.folder_name ?? null,
        game_id: identity.game_id ?? null,
        count: 1,
      })
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
    for (const kw of keywords) {
      deckKeywords.get(row.deck_id)!.add(kw)
    }
  }

  const identityStats = [...identityMap.entries()]
    .map(([id, d]) => ({ identity_id: id, ...d }))
    .sort((a, b) => b.count - a.count)

  // ② 키워드 트렌드 (덱 단위 중복 제거)
  const kwCount = new Map<string, number>()
  for (const kwSet of deckKeywords.values()) {
    for (const kw of kwSet) {
      kwCount.set(kw, (kwCount.get(kw) ?? 0) + 1)
    }
  }
  const keywordUsage = [...kwCount.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)

  // ③ 시너지 (동시 편성 쌍 TOP 20)
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
      const aData = identityMap.get(aId)
      const bData = identityMap.get(bId)
      return {
        a_id: aId, a_name: aData?.name_kr ?? '',
        a_sinner_id: aData?.sinner_id ?? '', a_folder: aData?.folder_name ?? null, a_game_id: aData?.game_id ?? null,
        b_id: bId, b_name: bData?.name_kr ?? '',
        b_sinner_id: bData?.sinner_id ?? '', b_folder: bData?.folder_name ?? null, b_game_id: bData?.game_id ?? null,
        count,
      }
    })

  // ④ EGO 채용률
  const egoMap = new Map<string, {
    sinner_id: string; name_kr: string; grade: string; sin_affinity: string | null; image_url: string | null; count: number
  }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of egoRows as any[]) {
    const ego = Array.isArray(row.ego) ? row.ego[0] : row.ego
    if (!row.ego_id || !ego) continue
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

  return NextResponse.json({
    totalDecks,
    identityStats,
    usageBySinner,
    usageBySin,
    keywordUsage,
    synergies,
    egoStats,
  })
}
