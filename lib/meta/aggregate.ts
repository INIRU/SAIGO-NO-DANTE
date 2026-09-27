import { resolvePlannerIdentity, resolvePlannerEgo } from '@/lib/planner/catalog-references'
import { computeKeywordDeckCombo } from '@/lib/decks/keyword-rules'
import { normalizeThemeKeyword } from '@/lib/constants/keywords'
import { normalizeSin } from '@/lib/constants/sin'
import { getIdentitySkillDistribution } from '@/lib/planner/types'
import type { IdentityStat, EGOStat, MetaData, MetaDungeon, MetaIdentity, MetaEGO, MetaPost, MetaSource, MetaPeriod, MetaUsage, MetaInsightPost, MetaPlanSummary, CountStat } from './types'

const USAGE_BY_CONTENT_TYPE: Record<string, MetaUsage> = {
  '스토리': 'story', '경험치 던전': 'expDungeon', '끈 던전': 'threadDungeon',
  '거던5층': 'mirrorDungeon', '거던10층': 'mirrorDungeon', '거던15층': 'mirrorDungeon',
  '거굴철': 'refractionRailway', '사영 전투': 'reflectrial',
}

export function metaPostUsage(post: Pick<MetaPost, 'source' | 'content_type'>): MetaUsage {
  return post.source === 'planner' ? 'mirrorDungeon' : USAGE_BY_CONTENT_TYPE[post.content_type ?? ''] ?? 'none'
}

/** Final inventory entries look like 'final_9765', 'start_9029', 'observe_9191'; blessings are not gifts. */
export function planGiftIds(inventory: unknown): string[] {
  if (!Array.isArray(inventory)) return []
  return [...new Set(inventory.flatMap(entry => {
    const match = typeof entry === 'string' ? /^(?:final|start|observe)_(\d+)$/.exec(entry) : null
    return match ? [match[1]] : []
  }))]
}

export function planThemeIds(floorPlan: unknown): string[] {
  if (!Array.isArray(floorPlan)) return []
  return [...new Set(floorPlan.flatMap(floor => {
    const id = floor && typeof floor === 'object' ? (floor as { theme_id?: unknown }).theme_id : null
    return (typeof id === 'string' || typeof id === 'number') && String(id) ? [String(id)] : []
  }))]
}

const PLAN_DIFFICULTIES = new Set(['normal', 'hard', 'extreme'])

function byCount<K extends string>(counts: Map<K, number>, limit = Infinity): CountStat<K>[] {
  return [...counts].map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, limit)
}

function bump<K>(map: Map<K, number>, key: K) { map.set(key, (map.get(key) ?? 0) + 1) }

const INVENTORY_ENTRY = /^(start|observe|final)_(\d+)(?:_(plus|plusplus))?$/

/** Each plan counts once per floor, gift, inventory entry and card. */
export function aggregateDungeon(plans: Pick<MetaPost, 'floorPlan' | 'inventory'>[]): MetaDungeon {
  const floors = new Map<number, { plans: number; themes: Map<string, number> }>()
  const routes = new Map<string, { count: number; floors: Map<string, number> }>()
  const start = new Map<string, number>(), observe = new Map<string, number>()
  const cardFloors = new Map<number, { plans: number; cards: Map<string, number> }>()
  const enhanced = new Map<string, { plus: number; plusplus: number }>()
  for (const plan of plans) {
    const giftFloors = new Map<string, Set<string>>()
    const seenFloors = new Set<number>()
    for (const row of objectRows(plan.floorPlan)) {
      const floor = Number(row.floor)
      if (!Number.isInteger(floor) || floor < 1 || floor > 15 || seenFloors.has(floor)) continue
      seenFloors.add(floor)
      const theme = typeof row.theme_id === 'string' || typeof row.theme_id === 'number' ? String(row.theme_id) : ''
      if (theme) {
        const entry = floors.get(floor) ?? { plans: 0, themes: new Map() }
        entry.plans++
        bump(entry.themes, theme)
        floors.set(floor, entry)
      }
      for (const id of Array.isArray(row.gift_ids) ? row.gift_ids.map(String) : []) {
        if (/^\d+$/.test(id)) giftFloors.set(id, (giftFloors.get(id) ?? new Set()).add(String(floor)))
      }
      const floorCards = new Set(floor >= 11 && Array.isArray(row.constraints) ? row.constraints.map(String) : [])
      if (floorCards.size) {
        const entry = cardFloors.get(floor) ?? { plans: 0, cards: new Map() }
        entry.plans++
        for (const card of floorCards) bump(entry.cards, card)
        cardFloors.set(floor, entry)
      }
    }
    for (const [gift, giftFloorSet] of giftFloors) {
      const route = routes.get(gift) ?? { count: 0, floors: new Map() }
      route.count++
      for (const floor of giftFloorSet) bump(route.floors, floor)
      routes.set(gift, route)
    }
    const entries = new Set(Array.isArray(plan.inventory) ? plan.inventory.filter((entry): entry is string => typeof entry === 'string') : [])
    for (const entry of entries) {
      const [, kind, gift, level] = INVENTORY_ENTRY.exec(entry) ?? []
      if (kind === 'start') bump(start, gift)
      else if (kind === 'observe') bump(observe, gift)
      else if (level === 'plus' || level === 'plusplus') {
        const row = enhanced.get(gift) ?? { plus: 0, plusplus: 0 }
        row[level]++
        enhanced.set(gift, row)
      }
    }
  }
  return {
    plans: plans.length,
    floors: [...floors].sort((a, b) => a[0] - b[0]).map(([floor, entry]) => ({ floor, plans: entry.plans, themes: byCount(entry.themes, 4) })),
    routes: [...routes].map(([key, route]) => ({ key, count: route.count, floors: byCount(route.floors, 3) }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, 60),
    start: byCount(start, 12),
    observe: byCount(observe, 12),
    enhanced: [...enhanced].map(([key, row]) => ({ key, ...row }))
      .sort((a, b) => b.plus + b.plusplus - a.plus - a.plusplus || b.plusplus - a.plusplus || a.key.localeCompare(b.key)).slice(0, 15),
    constraints: [...cardFloors].sort((a, b) => a[0] - b[0]).map(([floor, entry]) => ({ floor, plans: entry.plans, cards: byCount(entry.cards) })),
  }
}

/** Running tally of plan choices; summary() keeps the top gifts and packs only. */
function planTally() {
  let count = 0
  const difficulty = new Map<string, number>(), gifts = new Map<string, number>(), themes = new Map<string, number>()
  const bump = (map: Map<string, number>, keys: Iterable<string>) => { for (const key of keys) map.set(key, (map.get(key) ?? 0) + 1) }
  return {
    add(post: MetaPost) {
      count++
      if (post.difficulty && PLAN_DIFFICULTIES.has(post.difficulty)) bump(difficulty, [post.difficulty])
      bump(gifts, new Set(post.gifts ?? []))
      bump(themes, new Set(post.themes ?? []))
    },
    summary(giftLimit: number, themeLimit: number): MetaPlanSummary {
      return { count, difficulty: byCount(difficulty), gifts: byCount(gifts, giftLimit), themes: byCount(themes, themeLimit) }
    },
  }
}

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
  const usageCounts = new Map<MetaUsage, number>()
  const comboCounts = new Map<string, number>()
  const benchPosts = new Map<string, MetaInsightPost[]>()
  const planTotals = planTally()
  const planPosts: MetaPost[] = []
  const skillSplits = new Map<string, number>()
  const identityPlans = new Map<string, ReturnType<typeof planTally>>()
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
      return [{ identity, order, skills: getIdentitySkillDistribution(slot as Parameters<typeof getIdentitySkillDistribution>[0]).join('-') }]
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
        const { id, keywords, skill_keyword_list: _skills, ...info } = identity
        target.set(id, { ...info, identity_id: id, keywords: keywords ?? [], count: 1 })
      }
    }

    const usage = metaPostUsage(post)
    const combo = computeKeywordDeckCombo(battleSlots.map(({ identity, order }) => ({ slot_order: order, skill_keyword_list: identity.skill_keyword_list ?? identity.keywords })))
    usageCounts.set(usage, (usageCounts.get(usage) ?? 0) + 1)
    comboCounts.set(combo.join('+'), (comboCounts.get(combo.join('+')) ?? 0) + 1)
    const summary: MetaInsightPost = { id: post.id, source: post.source, title: post.title ?? post.id, usage, combo }
    if (post.source === 'planner') {
      planTotals.add(post)
      planPosts.push(post)
      for (const { identity } of battleSlots) {
        const tally = identityPlans.get(identity.id) ?? planTally()
        tally.add(post)
        identityPlans.set(identity.id, tally)
      }
    }
    for (const { identity, order } of uniqueSlots) {
      if (order < 99) continue
      const list = benchPosts.get(identity.id) ?? []
      list.push({ ...summary, support: true })
      benchPosts.set(identity.id, list)
    }
    for (const { identity, order, skills } of battleSlots) {
      const insight = identityInsights[identity.id] ??= { count: 0, orders: {}, egos: [], posts: [], companions: [], skills: [] }
      insight.count++
      bump(skillSplits, skills)
      insight.orders[String(order + 1)] = (insight.orders[String(order + 1)] ?? 0) + 1
      const split = insight.skills.find(row => row.key === skills)
      if (split) split.count++
      else insight.skills.push({ key: skills, count: 1 })
      for (const { identity: companion } of battleSlots) {
        if (companion.sinner_id === identity.sinner_id) continue
        const existing = insight.companions.find(row => row.identity_id === companion.id)
        if (existing) existing.count++
        else insight.companions.push({ identity_id: companion.id, count: 1 })
      }
      insight.posts.push(summary)
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

  for (const [id, insight] of Object.entries(identityInsights)) {
    insight.posts.push(...benchPosts.get(id) ?? [])
    const plans = identityPlans.get(id)
    if (plans) insight.plan = plans.summary(10, 6)
    insight.companions.sort((a, b) => b.count - a.count || a.identity_id.localeCompare(b.identity_id))
    insight.egos.sort((a, b) => b.count - a.count || a.ego_id.localeCompare(b.ego_id))
    insight.skills.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
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
    usageStats: byCount(usageCounts),
    comboStats: byCount(comboCounts),
    planStats: planTotals.summary(10, 6),
    giftCatalog: {},
    themeCatalog: {},
    skillCatalog: {},
    skillSplits: byCount(skillSplits),
    dungeon: aggregateDungeon(planPosts),
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
