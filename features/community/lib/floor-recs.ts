import type { Formation } from '@/features/community/lib/co-occurrence'
import { boardProfile } from '@/features/community/lib/identity-recs'
import { STATUS_KEYWORDS, type RecCatalog } from '@/features/community/lib/rec-catalog'

/**
 * Theme pack and gift suggestions for one floor of a plan (recommender v2).
 *  freq  similarity-weighted share of the plans that took it on this floor, shrunk to the floor's overall rate and that to the
 *        pack's overall rate (alpha, beta pseudo-weights): a plan counts as much as it looks like this one — overlapping
 *        identities (Jaccard), a similar keyword profile (cosine) and the same packs on the floors already chosen
 *  kw    how well the keywords of the pack's gifts (a gift's own keyword) match the team's keyword profile
 * Plans that look nothing like the asked one still count a little, so a sparse floor falls back to what everyone takes.
 */
export type FloorConfig = {
  /** Weights of the identity overlap, keyword profile and floors-already-chosen parts of plan similarity. */
  overlap: number; profile: number; floors: number
  /** Similarity exponent: higher trusts only close neighbours. */
  gamma: number
  /** Pseudo-weight of the floor prior in the neighbour estimate (alpha) and of the global prior in the floor prior (beta). */
  alpha: number; beta: number
  /** Weight of the keyword fit next to ln(frequency), for packs and for gifts. */
  themeKw: number; giftKw: number
  halfLife: number
}

// Tuned on the offline harness (scripts/recommender/tune-floor.ts).
export const FLOOR_CONFIG: FloorConfig = { overlap: 0.4, profile: 0.4, floors: 0.2, gamma: 2, alpha: 3, beta: 5, themeKw: 0.3, giftKw: 0.3, halfLife: 0 }

const DAY = 86_400_000

type PlanRow = {
  identities: Set<string>
  profile: number[]
  floors: Map<number, { theme: string | null; gifts: string[] }>
  stamp: number
}
export type FloorModel = {
  catalog: RecCatalog
  plans: PlanRow[]
  /** Plans taking pack t on any floor, by pack; and those taking gift g under pack t. */
  packPlans: Map<string, number>
  giftUnderPack: Map<string, number>
}

export function buildFloorModel(formations: readonly Formation[], catalog: RecCatalog): FloorModel {
  const plans: PlanRow[] = []
  const packPlans = new Map<string, number>(), giftUnderPack = new Map<string, number>()
  for (const f of formations) {
    if (f.kind !== 'planner' || !f.floors?.length) continue
    const floors = new Map<number, { theme: string | null; gifts: string[] }>()
    for (const entry of f.floors) if (!floors.has(entry.floor)) floors.set(entry.floor, { theme: entry.theme, gifts: entry.gifts })
    const board = f.identities.flatMap(id => catalog.identities[id] && !catalog.identities[id].starter ? [catalog.identities[id]] : [])
    plans.push({ identities: new Set(board.map(identity => identity.id)), profile: boardProfile(board), floors, stamp: f.createdAt ?? NaN })
    const seenPacks = new Set<string>()
    for (const { theme, gifts } of floors.values()) {
      if (!theme) continue
      if (!seenPacks.has(theme)) { seenPacks.add(theme); packPlans.set(theme, (packPlans.get(theme) ?? 0) + 1) }
      for (const gift of new Set(gifts)) giftUnderPack.set(`${theme}|${gift}`, (giftUnderPack.get(`${theme}|${gift}`) ?? 0) + 1)
    }
  }
  return { catalog, plans, packPlans, giftUnderPack }
}

type FloorQuery = {
  floor: number
  /** The plan's identities (any order), and the main keywords its author declared. */
  identities: readonly string[]
  keywords?: readonly string[]
  /** Packs already chosen on the plan's other floors. */
  others?: readonly { floor: number; theme: string }[]
  /** The pack of this floor (for gift suggestions). */
  theme?: string | null
  /** Gifts the plan already took (they are not suggested again). */
  taken?: readonly string[]
  candidates: readonly string[]
  now: number
}

type FloorScored = { id: string; score: number; /** Plans at least half as like this one as the closest plan that took something on this floor, which took it here. */ count: number; freq: number; fit: number; keyword?: string; reasons: string[] }

const reasonsOf = (keyword: string | undefined, fit: number, count: number) => [...(keyword && fit >= 0.5 ? [`keyword:${keyword}`] : []), count >= 2 ? 'synergy' : 'meta']

function similarity(row: PlanRow, team: { ids: Set<string>; profile: number[]; others: readonly { floor: number; theme: string }[] }, cfg: FloorConfig): number {
  let shared = 0
  for (const id of team.ids) if (row.identities.has(id)) shared++
  const union = team.ids.size + row.identities.size - shared
  const jaccard = union ? shared / union : 0
  let dot = 0, na = 0, nb = 0
  team.profile.forEach((value, i) => { dot += value * row.profile[i]; na += value * value; nb += row.profile[i] ** 2 })
  const cosine = na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0
  const agree = team.others.length ? team.others.filter(other => row.floors.get(other.floor)?.theme === other.theme).length / team.others.length : 0
  // Without identities or earlier floors to compare, the parts that cannot be asked are left out and the rest rescaled.
  const parts = [[cfg.overlap, jaccard, team.ids.size > 0], [cfg.profile, cosine, na > 0], [cfg.floors, agree, team.others.length > 0]] as const
  const total = parts.reduce((sum, [weight, , present]) => sum + (present ? weight : 0), 0)
  return total > 0 ? parts.reduce((sum, [weight, value, present]) => sum + (present ? weight * value : 0), 0) / total : 1
}

function teamOf(model: FloorModel, query: FloorQuery) {
  const board = [...new Set(query.identities)].flatMap(id => model.catalog.identities[id] && !model.catalog.identities[id].starter ? [model.catalog.identities[id]] : [])
  return { ids: new Set(board.map(identity => identity.id)), profile: boardProfile(board, query.keywords), others: (query.others ?? []).filter(other => other.floor !== query.floor) }
}

const weightOfPlan = (row: PlanRow, now: number, halfLife: number) => (halfLife > 0 && Number.isFinite(row.stamp) ? 2 ** (-Math.max(0, now - row.stamp) / DAY / halfLife) : 1)

/** The keyword share a gift's keyword has in the team's profile, relative to the team's strongest keyword (공통 and attack types: a neutral half). */
function keywordFit(profile: readonly number[], keyword: string | undefined): number {
  const index = keyword ? (STATUS_KEYWORDS as readonly string[]).indexOf(keyword) : -1
  const max = Math.max(0, ...profile)
  if (index < 0 || max <= 0) return 0.5
  return profile[index] / max
}

function packFit(model: FloorModel, pack: string, profile: readonly number[]): { fit: number; keyword?: string } {
  const gifts = model.catalog.themes[pack]?.gifts ?? []
  const counts = STATUS_KEYWORDS.map(() => 0)
  for (const gift of gifts) { const index = (STATUS_KEYWORDS as readonly string[]).indexOf(model.catalog.gifts[gift]); if (index >= 0) counts[index]++ }
  const total = counts.reduce((sum, value) => sum + value, 0)
  if (!total || profile.every(value => value === 0)) return { fit: 0 }
  let dot = 0, na = 0, nb = 0, best = -1, bestValue = 0
  counts.forEach((count, i) => { const share = count / total; dot += profile[i] * share; na += profile[i] ** 2; nb += share ** 2; if (profile[i] * share > bestValue) { bestValue = profile[i] * share; best = i } })
  return { fit: na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0, keyword: best >= 0 ? STATUS_KEYWORDS[best] : undefined }
}

export function rankThemes(model: FloorModel, query: FloorQuery, cfg: FloorConfig = FLOOR_CONFIG): FloorScored[] {
  const team = teamOf(model, query)
  const onFloor = model.plans.flatMap(row => {
    const entry = row.floors.get(query.floor)
    if (!entry?.theme) return []
    const raw = similarity(row, team, cfg)
    return [{ row, theme: entry.theme, raw, sim: raw ** cfg.gamma * weightOfPlan(row, query.now, cfg.halfLife) }]
  })
  const floorTotal = onFloor.length
  const floorUses = new Map<string, number>(), globalUses = model.packPlans
  const globalTotal = Math.max(1, model.plans.length)
  for (const { theme } of onFloor) floorUses.set(theme, (floorUses.get(theme) ?? 0) + 1)
  const mass = new Map<string, number>(), counts = new Map<string, number>()
  let massTotal = 0
  const close = 0.5 * Math.max(0, ...onFloor.map(row => row.raw))
  for (const { theme, raw, sim } of onFloor) { mass.set(theme, (mass.get(theme) ?? 0) + sim); massTotal += sim; if (raw >= close) counts.set(theme, (counts.get(theme) ?? 0) + 1) }
  return query.candidates.map(id => {
    const global = ((globalUses.get(id) ?? 0) + 0.5) / (globalTotal + 1)
    const prior = ((floorUses.get(id) ?? 0) + cfg.beta * global) / (floorTotal + cfg.beta)
    const freq = ((mass.get(id) ?? 0) + cfg.alpha * prior) / (massTotal + cfg.alpha)
    const { fit, keyword } = packFit(model, id, team.profile)
    return { id, score: Math.log(freq) + cfg.themeKw * fit, count: counts.get(id) ?? 0, freq, fit, keyword, reasons: reasonsOf(keyword, fit, counts.get(id) ?? 0) }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

export function rankGifts(model: FloorModel, query: FloorQuery, cfg: FloorConfig = FLOOR_CONFIG): FloorScored[] {
  const team = teamOf(model, query)
  const pack = query.theme ?? ''
  const taken = new Set(query.taken ?? [])
  // Without the floor's pack, every plan's picks on the floor count (gifts of other packs simply never match a candidate).
  const entries = model.plans.flatMap(row => {
    const entry = row.floors.get(query.floor)
    if (!entry || (pack && entry.theme !== pack)) return []
    const raw = similarity(row, team, cfg)
    return [{ entry, raw, sim: raw ** cfg.gamma * weightOfPlan(row, query.now, cfg.halfLife) }]
  })
  const packTotal = pack ? model.packPlans.get(pack) ?? 0 : entries.length
  const mass = new Map<string, number>(), counts = new Map<string, number>()
  let massTotal = 0
  const close = 0.5 * Math.max(0, ...entries.map(row => row.raw))
  for (const { entry, raw, sim } of entries) {
    massTotal += sim
    for (const gift of new Set(entry.gifts)) { mass.set(gift, (mass.get(gift) ?? 0) + sim); if (raw >= close) counts.set(gift, (counts.get(gift) ?? 0) + 1) }
  }
  return query.candidates.filter(id => !taken.has(id)).map(id => {
    const prior = ((pack ? model.giftUnderPack.get(`${pack}|${id}`) ?? 0 : 0) + 0.5) / (packTotal + 2)
    const freq = ((mass.get(id) ?? 0) + cfg.alpha * prior) / (massTotal + cfg.alpha)
    const keyword = model.catalog.gifts[id]
    const fit = keywordFit(team.profile, keyword)
    const status = (STATUS_KEYWORDS as readonly string[]).includes(keyword) ? keyword : undefined
    return { id, score: Math.log(freq) + cfg.giftKw * fit, count: counts.get(id) ?? 0, freq, fit, keyword: status, reasons: reasonsOf(status, fit, counts.get(id) ?? 0) }
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}
