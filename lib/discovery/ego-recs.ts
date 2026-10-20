import type { Formation } from '@/lib/discovery/co-occurrence'
import { boardProfile, boardOf, clip, detectArchetype, type Archetype, type Partner } from '@/lib/discovery/identity-recs'
import { SIN_ORDER } from '@/lib/constants/sin'
import { STATUS_KEYWORDS, cosine, statusShare, type RecCatalog, type RecIdentity } from '@/lib/discovery/rec-catalog'

/**
 * E.G.O suggestions for one sinner (recommender v2), the same recipe as the identity recommender:
 *  meta    recency/view-weighted share of the sinner's posts that equip it
 *  own     shrunk log-lift of equipping it given the sinner's identity: ln((together + m) ÷ (expected + m))
 *  team    the same with every other identity on the board, averaged (an E.G.O that fits burn teams in burn teams)
 *  status  cosine of the board's status-keyword profile and the E.G.O's keywords
 *  sin     cosine of the sins the E.G.O costs and the sins the board's skills produce (can the team pay for it?)
 *  fresh   boost for an E.G.O released recently that few posts equip
 * ZAYIN (every sinner has it free) is not suggested.
 */
export const EGO_COMPONENTS = ['meta', 'own', 'team', 'status', 'sin', 'fresh'] as const
export type EgoComponent = (typeof EGO_COMPONENTS)[number]

export type EgoConfig = { shrink: number; cap: number; halfLife: number; viewBoost: number; newDays: number; weights: Record<EgoComponent, number>; mmr: number }

// Tuned on the offline harness (scripts/recommender/tune-ego.ts).
export const EGO_CONFIG: EgoConfig = {
  shrink: 2, cap: 2.5, halfLife: 0, viewBoost: 0, newDays: 60, mmr: 0,
  weights: { meta: 1, own: 0.5, team: 0.5, status: 0.2, sin: 0.2, fresh: 0.3 },
}

const DAY = 86_400_000

export type EgoModel = {
  catalog: RecCatalog
  rows: { identities: Set<string>; egos: Set<string>; infoSinners: Set<string>; stamp: number; views: number }[]
}

/** Keeps the formations that say which E.G.O they equip; a post with no E.G.O says nothing about E.G.O. */
export function buildEgoModel(formations: readonly Formation[], catalog: RecCatalog): EgoModel {
  const rows = formations.flatMap(f => {
    const egos = (f.egos ?? []).filter(id => catalog.egos[id])
    if (!egos.length) return []
    return [{ identities: new Set(f.identities), egos: new Set(egos), infoSinners: new Set(egos.map(id => catalog.egos[id].sinner)), stamp: f.createdAt ?? NaN, views: f.views }]
  })
  return { catalog, rows }
}

export type EgoQuery = {
  /** The sinner's chosen identity (the E.G.O is suggested for it); the board holds the other chosen identities. */
  identity: string
  board: readonly string[]
  /** E.G.O already equipped on this sinner: they and their grades are taken. */
  equipped?: readonly string[]
  candidates?: readonly string[]
  now: number
}

export type EgoHint = { keyword?: string; sin?: string }
export type EgoScored = { id: string; z: number[]; hint: EgoHint }

const slot = (component: EgoComponent) => EGO_COMPONENTS.indexOf(component)

/** Shrunk log-lift of "equips e" among `rows` that field `who`, against the sinner's base rate `q`. */
function shrunkLift(together: number, fielded: number, q: number, shrink: number, cap: number) {
  return clip(Math.log((together + shrink) / (fielded * q + shrink)), cap)
}

export function egoComponents(model: EgoModel, query: EgoQuery, cfg: EgoConfig): { sinner: string | null; scored: EgoScored[]; together: Map<string, number>; board: RecIdentity[] } {
  const { catalog } = model
  const me = catalog.identities[query.identity]
  if (!me) return { sinner: null, scored: [], together: new Map(), board: [] }
  const sinner = me.sinner
  const taken = new Set((query.equipped ?? []).filter(id => catalog.egos[id]?.sinner === sinner))
  const takenGrades = new Set([...taken].map(id => catalog.egos[id]?.grade))
  const candidates = (query.candidates ?? catalog.egosBySinner[sinner] ?? []).filter(id => {
    const ego = catalog.egos[id]
    return ego && ego.sinner === sinner && ego.grade !== 'ZAYIN' && !taken.has(id) && !takenGrades.has(ego.grade) && (ego.release === null || ego.release <= query.now + DAY)
  })
  const board = boardOf(catalog, query.board, sinner)
  if (!candidates.length) return { sinner, scored: [], together: new Map(), board }
  const profile = boardProfile([me, ...board])
  const production = SIN_ORDER.map(sin => [me, ...board].reduce((sum, identity) => sum + (identity.sins[sin] ?? 0), 0))
  const K = candidates.length

  // The universe: posts that field this sinner and say which E.G.O the sinner equips.
  const universe = model.rows.filter(row => row.infoSinners.has(sinner) && [...row.identities].some(id => catalog.identities[id]?.sinner === sinner))
  const weightOf = (row: EgoModel['rows'][number]) => {
    const age = Number.isFinite(row.stamp) ? Math.max(0, query.now - row.stamp) / DAY : 0
    return (cfg.halfLife > 0 ? 2 ** (-age / cfg.halfLife) : 1) * (1 + cfg.viewBoost * Math.log1p(row.views))
  }
  const uses = new Map<string, number>(), weighted = new Map<string, number>()
  let weightTotal = 0
  const withMe = { fielded: 0, uses: new Map<string, number>() }
  const withMate = board.map(() => ({ fielded: 0, uses: new Map<string, number>() }))
  for (const row of universe) {
    const w = weightOf(row)
    weightTotal += w
    const mine = candidates.filter(id => row.egos.has(id))
    for (const id of mine) { uses.set(id, (uses.get(id) ?? 0) + 1); weighted.set(id, (weighted.get(id) ?? 0) + w) }
    if (row.identities.has(query.identity)) { withMe.fielded++; for (const id of mine) withMe.uses.set(id, (withMe.uses.get(id) ?? 0) + 1) }
    board.forEach((mate, i) => { if (row.identities.has(mate.id)) { withMate[i].fielded++; for (const id of mine) withMate[i].uses.set(id, (withMate[i].uses.get(id) ?? 0) + 1) } })
  }

  const scored = candidates.map<EgoScored>(id => {
    const ego = catalog.egos[id]
    const z = EGO_COMPONENTS.map(() => 0), hint: EgoHint = {}
    const q = ((uses.get(id) ?? 0) + 1) / (universe.length + K)
    z[slot('meta')] = clip(Math.log((((weighted.get(id) ?? 0) + 1) / (weightTotal + K)) * K), cfg.cap) / cfg.cap
    z[slot('own')] = shrunkLift(withMe.uses.get(id) ?? 0, withMe.fielded, q, cfg.shrink, cfg.cap) / cfg.cap
    if (board.length) z[slot('team')] = board.reduce((sum, _, i) => sum + shrunkLift(withMate[i].uses.get(id) ?? 0, withMate[i].fielded, q, cfg.shrink, cfg.cap), 0) / (board.length * cfg.cap)
    const status = statusShare(ego.status)
    z[slot('status')] = cosine(profile, status)
    let top = -1, topValue = 0
    status.forEach((value, i) => { if (profile[i] * value > topValue) { topValue = profile[i] * value; top = i } })
    if (top >= 0) hint.keyword = STATUS_KEYWORDS[top]
    z[slot('sin')] = cosine(production, ego.cost)
    let bestSin = -1, bestValue = 0
    ego.cost.forEach((cost, i) => { const joint = cost * production[i]; if (joint > bestValue) { bestValue = joint; bestSin = i } })
    if (bestSin >= 0) hint.sin = SIN_ORDER[bestSin]
    if (ego.release !== null) {
      const age = (query.now - ego.release) / DAY
      if (age >= 0 && age <= cfg.newDays) z[slot('fresh')] = (1 - age / cfg.newDays) / (1 + (uses.get(id) ?? 0) / 3)
    }
    return { id, z, hint }
  })
  return { sinner, scored, together: withMe.uses, board }
}

export const blendEgo = (z: readonly number[], weights: EgoConfig['weights']) => EGO_COMPONENTS.reduce((sum, component, i) => sum + weights[component] * z[i], 0)

export function rankEgos(model: EgoModel, query: EgoQuery, cfg: EgoConfig = EGO_CONFIG) {
  const { scored } = egoComponents(model, query, cfg)
  return scored.map(row => ({ ...row, score: blendEgo(row.z, cfg.weights) })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

export type SuggestedEgo = { id: string; score: number; /** Public posts equipping it on this identity. */ count: number; reasons: string[]; partners: Partner[] }
const PARTNERS = 3
const READABLE = /^(keyword|faction|sin):/
const round = (value: number) => Math.round(value * 1000) / 1000

/**
 * Who an E.G.O goes with: board members first (shrunk log-lift of fielding them in posts that equip it, plus kit likeness),
 * then the identities of other sinners most over-represented in those posts.
 */
function egoPartners(model: EgoModel, query: EgoQuery, cfg: EgoConfig, egoIds: string[], sinner: string, board: readonly RecIdentity[]): Map<string, Partner[]> {
  const { catalog } = model
  const universe = model.rows.filter(row => row.infoSinners.has(sinner) && [...row.identities].some(id => catalog.identities[id]?.sinner === sinner))
  const fielded = new Map<string, number>(), together = new Map<string, Map<string, number>>(egoIds.map(id => [id, new Map()]))
  const equipped = new Map<string, number>()
  for (const row of universe) {
    for (const id of row.identities) if (catalog.identities[id] && !catalog.identities[id].starter) fielded.set(id, (fielded.get(id) ?? 0) + 1)
    for (const ego of egoIds) {
      if (!row.egos.has(ego)) continue
      equipped.set(ego, (equipped.get(ego) ?? 0) + 1)
      const counts = together.get(ego)!
      for (const id of row.identities) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  const taken = new Set([sinner, ...board.map(identity => identity.sinner)])
  const out = new Map<string, Partner[]>()
  for (const ego of egoIds) {
    const q = ((equipped.get(ego) ?? 0) + 1) / (universe.length + egoIds.length)
    const profile = statusShare(catalog.egos[ego].status)
    const score = (y: RecIdentity) => 0.7 * Math.max(0, shrunkLift(together.get(ego)!.get(y.id) ?? 0, fielded.get(y.id) ?? 0, q, cfg.shrink, cfg.cap) / cfg.cap) + 0.3 * cosine(profile, statusShare(y.status))
    const chosen = board.map(y => ({ id: y.id, score: round(score(y)), chosen: true })).filter(row => row.score >= 0.2).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, PARTNERS)
    const others = chosen.length >= PARTNERS ? [] : [...fielded.keys()].flatMap(id => {
      const y = catalog.identities[id]
      return taken.has(y.sinner) ? [] : [{ id, score: round(score(y)), chosen: false }]
    }).filter(row => row.score >= 0.3).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, PARTNERS - chosen.length)
    out.set(ego, [...chosen, ...others])
  }
  return out
}

/** The sinner's E.G.O best first, each with why (`keyword:<name>`, `sin:<sin>`, then `synergy`, `meta`, `new`), the identities it pairs with and the board's archetype. */
export function suggestEgos(model: EgoModel, query: EgoQuery, { limit = 12, cfg = EGO_CONFIG }: { limit?: number; cfg?: EgoConfig } = {}): { items: SuggestedEgo[]; archetype: Archetype } {
  const { sinner, scored, together, board } = egoComponents(model, query, cfg)
  const me = model.catalog.identities[query.identity]
  const archetype = detectArchetype(model.catalog, me ? [me, ...board].filter(identity => !identity.starter) : board)
  if (!sinner) return { items: [], archetype }
  const ranked = scored.map(row => ({ ...row, score: blendEgo(row.z, cfg.weights) })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit)
  const mean = EGO_COMPONENTS.map((_, i) => scored.reduce((sum, row) => sum + row.z[i], 0) / Math.max(1, scored.length))
  const partners = egoPartners(model, query, cfg, ranked.map(row => row.id), sinner, board)
  const items = ranked.map<SuggestedEgo>(row => {
    const contribution = (...components: EgoComponent[]) => components.reduce((sum, component) => { const i = slot(component); return sum + cfg.weights[component] * (row.z[i] - mean[i]) }, 0)
    const found = [
      { code: row.hint.keyword ? `keyword:${row.hint.keyword}` : '', value: contribution('status') },
      { code: row.hint.sin ? `sin:${row.hint.sin}` : '', value: contribution('sin') },
      { code: 'synergy', value: contribution('own', 'team') },
      { code: 'meta', value: contribution('meta') },
      { code: 'new', value: contribution('fresh') },
    ].filter(item => item.code && item.value > 0.02).sort((a, b) => b.value - a.value)
    const reasons = [...found.filter(item => READABLE.test(item.code)), ...found.filter(item => !READABLE.test(item.code))].map(item => item.code)
    return { id: row.id, score: round(row.score), count: together.get(row.id) ?? 0, reasons: reasons.length ? reasons : ['meta'], partners: partners.get(row.id) ?? [] }
  })
  return { items, archetype }
}
