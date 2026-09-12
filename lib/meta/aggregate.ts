import { resolvePlannerIdentity, resolvePlannerEgo } from '@/lib/planner/catalog-references'
import { normalizeDeckMainKeyword } from '@/lib/decks/keyword-rules'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import { normalizeSin } from '@/lib/constants/sin'
import type { IdentityStat, EGOStat, MetaData, MetaIdentity, MetaEGO, MetaPost, MetaSource, MetaPeriod } from './types'

function objectRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
    : []
}

export function metaPeriodStart(period: MetaPeriod, now: number): string | null {
  return period === 'all' ? null : new Date(now - Number(period) * 86_400_000).toISOString()
}

/** One published, nonempty formation is one sample, regardless of its source. */
export function aggregateMeta({ posts, identities, egos, keywordSinMap, source, period, now }: {
  posts: MetaPost[]
  identities: MetaIdentity[]
  egos: MetaEGO[]
  keywordSinMap: Record<string, string>
  source: MetaSource
  period: MetaPeriod
  now: number
}): MetaData {
  const identityCatalog = new Map(identities.map(identity => [identity.id, identity]))
  const egoCatalog = new Map(egos.map(ego => [ego.id, ego]))
  const identityInsights: MetaData["identityInsights"] = {}
  const battle = new Map<string, IdentityStat>()
  const support = new Map<string, IdentityStat>()
  const egoCounts = new Map<string, EGOStat>()
  const keywordCounts = new Map<string, number>()
  const pairCounts = new Map<string, number>()
  const usageBySinner: Record<string, number> = {}
  const usageBySin: Record<string, number> = {}
  const sourceCounts = { decks: 0, planner: 0 }
  let excludedSamples = 0
  const seenPosts = new Set<string>()
  const since = metaPeriodStart(period, now)

  for (const post of posts) {
    if (source !== 'all' && post.source !== source) continue
    const createdAt = Date.parse(post.created_at)
    if (!Number.isFinite(createdAt) || createdAt > now || (since && createdAt < Date.parse(since))) continue
    const postKey = `${post.source}:${post.id}`
    if (seenPosts.has(postKey)) continue
    seenPosts.add(postKey)

    // Persisted planner slots are JSON. Resolve metadata through the current catalog,
    // discard deleted/unknown IDs, and keep at most one identity per sinner.
    const slots = objectRows(post.identities).flatMap(slot => {
      const identity = (typeof slot.identity_id === 'string' ? identityCatalog.get(slot.identity_id) : undefined)
        ?? (post.source === 'planner' ? resolvePlannerIdentity(slot, identities) : undefined)
      if (!identity) return []
      const order = typeof slot.slot_order === 'number' && Number.isInteger(slot.slot_order) && slot.slot_order >= 0 && slot.slot_order < 99
        ? slot.slot_order : 99
      return [{ identity, order }]
    }).sort((a, b) => a.order - b.order || a.identity.id.localeCompare(b.identity.id))
    const seenSinners = new Set<string>()
    const uniqueSlots = slots.filter(({ identity }) => {
      if (seenSinners.has(identity.sinner_id)) return false
      seenSinners.add(identity.sinner_id)
      return true
    })
    const battleSlots = uniqueSlots.filter(slot => slot.order < 99)
    if (battleSlots.length === 0) {
      excludedSamples++
      continue
    }
    sourceCounts[post.source]++
    for (const { identity, order } of uniqueSlots) {
      const target = order < 99 ? battle : support
      const existing = target.get(identity.id)
      if (existing) existing.count++
      else {
        const { id, keywords, ...info } = identity
        target.set(id, { ...info, identity_id: id, keywords: keywords ?? [], count: 1 })
      }
    }

    const postKeywords = [...new Set((post.keywords ?? []).map(normalizeDeckMainKeyword).filter((key): key is string => key !== null))]
    for (const { identity, order } of battleSlots) {
      const insight = identityInsights[identity.id] ??= { count: 0, orders: {}, keywords: [], egos: [], posts: [], companions: [] }
      insight.count++
      insight.orders[String(order + 1)] = (insight.orders[String(order + 1)] ?? 0) + 1
      for (const keyword of postKeywords) {
        const existing = insight.keywords.find(row => row.keyword === keyword)
        if (existing) existing.count++
        else insight.keywords.push({ keyword, count: 1 })
      }
      for (const { identity: companion } of battleSlots) {
        if (companion.sinner_id === identity.sinner_id) continue
        const existing = insight.companions.find(row => row.identity_id === companion.id)
        if (existing) existing.count++
        else insight.companions.push({ identity_id: companion.id, count: 1 })
      }
      insight.posts.push({ id: post.id, source: post.source, title: post.title ?? post.id, keywords: postKeywords })
    }

    const battleSinners = new Set(battleSlots.map(slot => slot.identity.sinner_id))
    const keywords = new Set<string>()
    const sins = new Set<string>()
    for (const { identity } of battleSlots) {
      usageBySinner[identity.sinner_id] = (usageBySinner[identity.sinner_id] ?? 0) + 1
      for (const keyword of identity.keywords ?? []) {
        const normalized = normalizeThemeKeyword(keyword)
        keywords.add(normalized)
        const sin = normalizeSin(keywordSinMap[normalized] ?? keywordSinMap[keyword] ?? null)
        if (sin) sins.add(sin)
      }
    }
    for (const keyword of keywords) keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1)
    for (const sin of sins) usageBySin[sin] = (usageBySin[sin] ?? 0) + 1

    // Co-occurrence is based on battle slots only; support units are not synergy evidence.
    const ids = battleSlots.map(slot => slot.identity.id).sort()
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = JSON.stringify([ids[i], ids[j]])
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }

    const seenEgos = new Set<string>()
    for (const slot of objectRows(post.egos)) {
      const ego = (typeof slot.ego_id === 'string' ? egoCatalog.get(slot.ego_id) : undefined)
        ?? (post.source === 'planner' ? resolvePlannerEgo(slot, egos) : undefined)
      if (!ego || !battleSinners.has(ego.sinner_id) || seenEgos.has(ego.id)) continue
      seenEgos.add(ego.id)
      const identity = battleSlots.find(slot => slot.identity.sinner_id === ego.sinner_id)!.identity
      const equipped = identityInsights[identity.id].egos
      const equippedEgo = equipped.find(row => row.ego_id === ego.id)
      if (equippedEgo) equippedEgo.count++
      else { const { id, ...info } = ego; equipped.push({ ...info, ego_id: id, count: 1 }) }
      const existing = egoCounts.get(ego.id)
      if (existing) existing.count++
      else {
        const { id, ...info } = ego
        egoCounts.set(id, { ...info, sin_affinity: normalizeSin(info.sin_affinity), ego_id: id, count: 1 })
      }
    }
  }

  for (const insight of Object.values(identityInsights)) {
    insight.companions.sort((a, b) => b.count - a.count || a.identity_id.localeCompare(b.identity_id))
    insight.keywords.sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    insight.egos.sort((a, b) => b.count - a.count || a.ego_id.localeCompare(b.ego_id))
  }
  return {
    identityInsights,
    sampleCount: sourceCounts.decks + sourceCounts.planner,
    sourceCounts, excludedSamples, source, period,
    generatedAt: new Date(now).toISOString(),
    battleIdentityStats: [...battle.values()].sort((a, b) => b.count - a.count || a.identity_id.localeCompare(b.identity_id)),
    supportIdentityStats: [...support.values()].sort((a, b) => b.count - a.count || a.identity_id.localeCompare(b.identity_id)),
    egoStats: [...egoCounts.values()].sort((a, b) => b.count - a.count || a.ego_id.localeCompare(b.ego_id)),
    keywordUsage: [...keywordCounts].map(([keyword, count]) => ({ keyword, count })).sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword)),
    synergies: [...pairCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([key, count]) => {
      const [aId, bId] = JSON.parse(key) as [string, string]
      const a = identityCatalog.get(aId)!
      const b = identityCatalog.get(bId)!
      return {
        a_id: aId, a_name: a.name_kr, a_sinner_id: a.sinner_id, a_folder: a.folder_name, a_game_id: a.game_id,
        b_id: bId, b_name: b.name_kr, b_sinner_id: b.sinner_id, b_folder: b.folder_name, b_game_id: b.game_id,
        count,
      }
    }),
    usageBySinner, usageBySin,
  }
}
