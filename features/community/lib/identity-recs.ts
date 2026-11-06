import type { Formation } from '@/features/community/lib/co-occurrence'
import { activationChance } from '@/features/community/lib/passive-fit'
import { STATUS_KEYWORDS, cosine, statusShare, type RecCatalog, type RecIdentity } from '@/features/community/lib/rec-catalog'

/**
 * Identity suggestions for one empty slot (recommender v2), a hybrid of explainable parts, each on a fixed scale so that
 * adding one identity to the board nudges the list instead of reshuffling it:
 *  pair     item-item synergy with every identity on the board: ln((together + m) ÷ (expected + m)), clipped, averaged over the
 *           board (so one strong partner cannot carry a candidate the rest of the board never fielded)
 *  team     the same question asked of the posts that resemble the whole board (overlap^power weighted share, shrunk to the
 *           candidate's base rate with `kappa` pseudo-weight)
 *  status   cosine of the board's status-keyword profile (화상, 진동 …) and the candidate's
 *  faction  inverse-frequency-weighted cosine of affiliation tags (거미집, 새벽 사무소 …)
 *  kw       the same for the remaining keywords
 *  sinOwn / sinTeam   whether the candidate's own sin-dependent passives can fire on this team, and how much the candidate raises
 *           the chance of the board's passives (the activation model of passive-fit.ts)
 *  meta     recent usage (half-life, post views) as a prior; fresh  a boost for new identities nobody has fielded yet
 */
export const COMPONENTS = ['pair', 'team', 'status', 'faction', 'kw', 'sinOwn', 'sinTeam', 'meta', 'fresh'] as const
export type Component = (typeof COMPONENTS)[number]
export type Weights = Record<Component, number>

export type IdentityConfig = {
  /** Pseudo-count of the shrunk log-lift: pairs seen less than this many times count for little. */
  shrink: number
  /** Log-lift (and log-ratio) clip: no single partner, however tight, counts for more than this. */
  cap: number
  /** Pseudo-weight of the base rate in the team-neighbour estimate. */
  kappa: number
  /** Neighbour weight = (share of the board a post has)^power. */
  power: number
  /** Days for a post's weight to halve (0: all posts count the same). */
  halfLife: number
  /** A post's weight is multiplied by 1 + viewBoost × ln(1 + views). */
  viewBoost: number
  /** An identity is "new" for this many days after release. */
  newDays: number
  weights: Weights
  /** MMR penalty for a candidate that looks like one already picked. */
  mmr: number
}

// Tuned on the offline harness (scripts/recommender/tune-identity.ts, objective MRR − 0.5 × (1 − RBO)); then status and meta were moved
// (0.35/0.35 → 0.5/0.25) so a board's main keyword outranks plain popularity, at no loss in hit rate. The numbers are in design.md.
export const IDENTITY_CONFIG: IdentityConfig = {
  shrink: 1, cap: 1.5, kappa: 10, power: 3, halfLife: 0, viewBoost: 0.15, newDays: 60, mmr: 0.15,
  weights: { pair: 0.2, team: 0.35, status: 0.5, faction: 0.5, kw: 0, sinOwn: 0.1, sinTeam: 0.1, meta: 0.25, fresh: 0.6 },
}

const DAY = 86_400_000

export type IdentityModel = {
  catalog: RecCatalog
  ids: string[]
  index: Map<string, number>
  sinners: string[]
  sinnerIndex: Map<string, number>
  /** Per identity: its sinner's index. */
  sinnerOf: Int32Array
  count: number
  /** member[f × n + i]: formation f fields identity i. */
  member: Uint8Array
  /** memberOf[f × S + s]: the identity of sinner s formation f fields, or -1. */
  memberOf: Int32Array
  stamps: number[]
  views: number[]
  uses: Int32Array
  usesBySinner: Int32Array
  /** pair[a × n + b]: formations fielding both. */
  pair: Int32Array
  /** pairSinner[c × S + s]: formations fielding identity c and some identity of sinner s. */
  pairSinner: Int32Array
  formsBySinner: number[][]
}

/** Counts the public formations once; the LCB 수감자 every sinner starts with is not a member. */
export function buildIdentityModel(formations: readonly Formation[], catalog: RecCatalog): IdentityModel {
  const ids = Object.values(catalog.identities).filter(identity => !identity.starter).map(identity => identity.id).sort()
  const index = new Map(ids.map((id, i) => [id, i]))
  const sinners = [...new Set(ids.map(id => catalog.identities[id].sinner))].sort()
  const sinnerIndex = new Map(sinners.map((s, i) => [s, i]))
  const n = ids.length, S = sinners.length
  const sinnerOf = Int32Array.from(ids, id => sinnerIndex.get(catalog.identities[id].sinner)!)
  const rows = formations.map(f => [...new Set(f.identities.map(id => index.get(id)).filter((i): i is number => i !== undefined))]).filter(row => row.length > 0)
  const kept = formations.filter(f => f.identities.some(id => index.has(id)))
  const F = rows.length
  const member = new Uint8Array(F * n), memberOf = new Int32Array(F * S).fill(-1)
  const uses = new Int32Array(n), usesBySinner = new Int32Array(S), pair = new Int32Array(n * n), pairSinner = new Int32Array(n * S)
  const formsBySinner: number[][] = sinners.map(() => [])
  rows.forEach((row, f) => {
    for (const a of row) {
      member[f * n + a] = 1
      memberOf[f * S + sinnerOf[a]] = a
      uses[a]++
      for (const b of row) { pair[a * n + b]++; pairSinner[a * S + sinnerOf[b]]++ }
    }
    for (const s of new Set(row.map(a => sinnerOf[a]))) { usesBySinner[s]++; formsBySinner[s].push(f) }
  })
  return {
    catalog, ids, index, sinners, sinnerIndex, sinnerOf, count: F, member, memberOf,
    stamps: kept.map(f => f.createdAt ?? NaN), views: kept.map(f => f.views), uses, usesBySinner, pair, pairSinner, formsBySinner,
  }
}

export type IdentityQuery = {
  /** Identities on the board (any order); starters and the asked sinner's own are ignored. */
  context: readonly string[]
  sinner: string
  /** Defaults to the sinner's released, non-starter identities not already on the board. */
  candidates?: readonly string[]
  /** Main keywords the user declared for the deck, counted as one more board member. */
  keywords?: readonly string[]
  now: number
}

export type Hint = { keyword?: string; faction?: string; passive?: { kind: 'stock' | 'resonance'; sin: string } }
export type Scored = { id: string; z: number[]; hint: Hint }

export const clip = (value: number, cap: number) => Math.max(-cap, Math.min(cap, value))
const zero = () => COMPONENTS.map(() => 0)
const slot = (component: Component) => COMPONENTS.indexOf(component)

/** Board members that count: known, not a starter, not the asked sinner's. */
export function boardOf(catalog: RecCatalog, context: readonly string[], sinner: string): RecIdentity[] {
  return [...new Set(context)].flatMap(id => { const identity = catalog.identities[id]; return identity && !identity.starter && identity.sinner !== sinner ? [identity] : [] })
}

function recencyWeights(model: IdentityModel, cfg: IdentityConfig, now: number): Float64Array {
  const weights = new Float64Array(model.count)
  for (let f = 0; f < model.count; f++) {
    const age = Number.isFinite(model.stamps[f]) ? Math.max(0, now - model.stamps[f]) / DAY : 0
    weights[f] = (cfg.halfLife > 0 ? 2 ** (-age / cfg.halfLife) : 1) * (1 + cfg.viewBoost * Math.log1p(model.views[f] ?? 0))
  }
  return weights
}

/** The board's status-keyword profile: the mean share of mentions, plus the declared keywords as one more member. */
export function boardProfile(board: readonly RecIdentity[], keywords: readonly string[] = []): number[] {
  const profile = STATUS_KEYWORDS.map(() => 0)
  let members = 0
  for (const identity of board) { statusShare(identity.status).forEach((value, i) => { profile[i] += value }); members++ }
  const declared = keywords.filter(keyword => (STATUS_KEYWORDS as readonly string[]).includes(keyword))
  if (declared.length) { for (const keyword of declared) profile[STATUS_KEYWORDS.indexOf(keyword as (typeof STATUS_KEYWORDS)[number])] += 1 / declared.length; members++ }
  return members ? profile.map(value => value / members) : profile
}

/** Cosine of affinity tags weighted by inverse frequency; also reports the shared tag the board leans on most. */
function tagFit(team: Map<string, number>, own: readonly string[], idf: Record<string, number>): { fit: number; best?: string } {
  if (!team.size || !own.length) return { fit: 0 }
  let dot = 0, ownNorm = 0, teamNorm = 0, best: string | undefined, bestValue = 0
  for (const tag of own) {
    const weight = idf[tag] ?? 0
    ownNorm += weight * weight
    const shared = (team.get(tag) ?? 0) * weight
    dot += shared
    if (shared > bestValue) { bestValue = shared; best = tag }
  }
  for (const value of team.values()) teamNorm += value * value
  const norm = Math.sqrt(ownNorm * teamNorm)
  return { fit: norm > 0 ? dot / norm : 0, best }
}

function tagTeam(board: readonly RecIdentity[], pick: (identity: RecIdentity) => readonly string[], idf: Record<string, number>): Map<string, number> {
  const team = new Map<string, number>()
  for (const identity of board) for (const tag of pick(identity)) team.set(tag, (team.get(tag) ?? 0) + (idf[tag] ?? 0))
  return team
}

/** Every component of every candidate (before blending), so tuning can blend the same numbers many ways. */
export function identityComponents(model: IdentityModel, query: IdentityQuery, cfg: IdentityConfig, { withSin = false } = {}): { board: RecIdentity[]; scored: Scored[] } {
  const { catalog } = model
  const board = boardOf(catalog, query.context, query.sinner).filter(identity => model.index.has(identity.id))
  const s = model.sinnerIndex.get(query.sinner)
  if (s === undefined) return { board, scored: [] }
  const taken = new Set(board.map(identity => identity.id))
  const candidates = (query.candidates ?? catalog.bySinner[query.sinner] ?? [])
    .filter(id => { const identity = catalog.identities[id]; return identity && !identity.starter && !taken.has(id) && model.index.has(id) && (identity.release === null || identity.release <= query.now + DAY) })
  const N = model.ids.length, S = model.sinners.length
  const weightOf = recencyWeights(model, cfg, query.now)
  const boardIdx = board.map(identity => model.index.get(identity.id)!)
  const usesSinner = model.usesBySinner[s]
  const K = Math.max(1, candidates.length)

  // meta: recency- and view-weighted share of the sinner's posts, against a uniform prior.
  let weightSinner = 0
  const weightedUses = new Map<string, number>()
  for (const f of model.formsBySinner[s]) {
    const who = model.memberOf[f * S + s]
    weightSinner += weightOf[f]
    weightedUses.set(model.ids[who], (weightedUses.get(model.ids[who]) ?? 0) + weightOf[f])
  }

  // team: neighbours = posts of this sinner sharing identities with the board.
  const mass = new Map<string, number>()
  let massTotal = 0
  if (boardIdx.length) {
    for (const f of model.formsBySinner[s]) {
      let overlap = 0
      for (const c of boardIdx) overlap += model.member[f * N + c]
      if (!overlap) continue
      const w = (overlap / boardIdx.length) ** cfg.power * weightOf[f]
      massTotal += w
      const who = model.ids[model.memberOf[f * S + s]]
      mass.set(who, (mass.get(who) ?? 0) + w)
    }
  }

  const profile = boardProfile(board, query.keywords)
  const factionTeam = tagTeam(board, identity => identity.factions, catalog.idf.faction)
  const kwTeam = tagTeam(board, identity => identity.kw, catalog.idf.kw)
  const teamSins = board.map(identity => identity.sins)
  const useSin = withSin || cfg.weights.sinOwn !== 0 || cfg.weights.sinTeam !== 0
  const boardPassives = board.flatMap(identity => identity.passives)
  const baseChance = useSin ? boardPassives.map(passive => activationChance(passive.cond, passive.req, teamSins)) : []

  const scored = candidates.map<Scored>(id => {
    const x = catalog.identities[id], xi = model.index.get(id)!
    const z = zero(), hint: Hint = {}
    // pair
    if (boardIdx.length) {
      let sum = 0
      for (const c of boardIdx) {
        const together = model.pair[c * N + xi]
        const expected = model.pairSinner[c * S + s] * model.uses[xi] / Math.max(1, usesSinner)
        sum += clip(Math.log((together + cfg.shrink) / (expected + cfg.shrink)), cfg.cap)
      }
      z[slot('pair')] = sum / (cfg.cap * boardIdx.length)
      // team
      const prior = (model.uses[xi] + 1) / (usesSinner + K)
      const posterior = ((mass.get(id) ?? 0) + cfg.kappa * prior) / (massTotal + cfg.kappa)
      z[slot('team')] = clip(Math.log(posterior / prior), cfg.cap) / cfg.cap
    }
    // keyword and faction fit
    const share = statusShare(x.status)
    z[slot('status')] = cosine(profile, share)
    let top = -1, topValue = 0
    share.forEach((value, i) => { const joint = profile[i] * value; if (joint > topValue) { topValue = joint; top = i } })
    if (top >= 0) hint.keyword = STATUS_KEYWORDS[top]
    const faction = tagFit(factionTeam, x.factions, catalog.idf.faction)
    z[slot('faction')] = faction.fit
    if (faction.best) hint.faction = faction.best
    z[slot('kw')] = tagFit(kwTeam, x.kw, catalog.idf.kw).fit
    // sin and passives
    if (useSin && board.length) {
      const team = [...teamSins, x.sins]
      if (x.passives.length) {
        const chances = x.passives.map(passive => activationChance(passive.cond, passive.req, team))
        z[slot('sinOwn')] = chances.reduce((sum, value) => sum + value, 0) / chances.length - 0.5
        const best = chances.indexOf(Math.max(...chances))
        hint.passive = { kind: x.passives[best].cond, sin: x.passives[best].req[0].sin }
      }
      if (boardPassives.length) {
        let gain = 0, bestGain = 0
        boardPassives.forEach((passive, i) => {
          const delta = activationChance(passive.cond, passive.req, team) - baseChance[i]
          gain += delta
          if (delta > bestGain) { bestGain = delta; if (!hint.passive || delta > (z[slot('sinOwn')] ?? 0)) hint.passive = { kind: passive.cond, sin: passive.req[0].sin } }
        })
        z[slot('sinTeam')] = clip(gain / boardPassives.length * 4, 1)
      }
    }
    // meta and newness
    const share01 = ((weightedUses.get(id) ?? 0) + 1) / (weightSinner + K)
    z[slot('meta')] = clip(Math.log(share01 * K), cfg.cap) / cfg.cap
    if (x.release !== null) {
      const age = (query.now - x.release) / DAY
      if (age >= 0 && age <= cfg.newDays) z[slot('fresh')] = (1 - age / cfg.newDays) / (1 + model.uses[xi] / 3)
    }
    return { id, z, hint }
  })
  return { board, scored }
}

export const blend = (z: readonly number[], weights: Weights) => COMPONENTS.reduce((sum, component, i) => sum + weights[component] * z[i], 0)

export const lookLike = (a: RecIdentity, b: RecIdentity) => 0.7 * cosine(statusShare(a.status), statusShare(b.status)) + 0.3 * (a.factions.some(f => b.factions.includes(f)) ? 1 : 0)

/** Scored candidates best first; with `mmr` > 0 each pick is penalised by its likeness to the better ones already picked. */
export function rankIdentities(model: IdentityModel, query: IdentityQuery, cfg: IdentityConfig = IDENTITY_CONFIG): { board: RecIdentity[]; ranked: (Scored & { score: number })[] } {
  const { board, scored } = identityComponents(model, query, cfg)
  const rows = scored.map(row => ({ ...row, score: blend(row.z, cfg.weights) })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  if (cfg.mmr <= 0 || rows.length < 3) return { board, ranked: rows }
  const picked: typeof rows = []
  const rest = [...rows]
  while (rest.length) {
    let best = 0, bestValue = -Infinity
    rest.forEach((row, i) => {
      const penalty = picked.length ? Math.max(...picked.map(other => lookLike(model.catalog.identities[row.id], model.catalog.identities[other.id]))) : 0
      const value = row.score - cfg.mmr * penalty
      if (value > bestValue + 1e-12) { bestValue = value; best = i }
    })
    picked.push(rest.splice(best, 1)[0])
  }
  return { board, ranked: picked }
}

export type Partner = { id: string; score: number; /** Already on the board. */ chosen: boolean }
export type SuggestedIdentity = { id: string; score: number; reasons: string[]; partners: Partner[] }
export type Archetype = { keywords: string[]; factions: string[] }

/** Factions with more identities than this are labels of a game, not a team (림버스 컴퍼니, H사 …). */
const MAX_FACTION_SIZE = 14
const PARTNERS = 3

/** What the board adds up to: the status keywords (and affiliations) most of its members share. Empty on an empty board. */
export function detectArchetype(catalog: RecCatalog, board: readonly RecIdentity[], declared: readonly string[] = []): Archetype {
  if (!board.length) return { keywords: [], factions: [] }
  const keywordCount = STATUS_KEYWORDS.map(() => 0)
  const factionCount = new Map<string, number>()
  for (const identity of board) {
    statusShare(identity.status).forEach((share, i) => { if (share >= 0.25) keywordCount[i]++ })
    for (const faction of identity.factions) factionCount.set(faction, (factionCount.get(faction) ?? 0) + 1)
  }
  const size = board.length
  for (const keyword of declared) { const i = STATUS_KEYWORDS.indexOf(keyword as (typeof STATUS_KEYWORDS)[number]); if (i >= 0) keywordCount[i] += size / 2 }
  const keywords = STATUS_KEYWORDS.map((keyword, i) => ({ keyword, share: keywordCount[i] / size })).filter(row => row.share >= 0.5)
    .sort((a, b) => b.share - a.share).slice(0, 2).map(row => row.keyword as string)
  const sizeOf = (faction: string) => Object.values(catalog.identities).filter(identity => identity.factions.includes(faction)).length
  const factions = [...factionCount].filter(([faction, count]) => count >= 2 && count / size >= 0.3 && sizeOf(faction) <= MAX_FACTION_SIZE)
    .sort((a, b) => b[1] * (catalog.idf.faction[b[0]] ?? 0) - a[1] * (catalog.idf.faction[a[0]] ?? 0)).slice(0, 2).map(([faction]) => faction)
  return { keywords, factions }
}

/** How well two identities go together, 0–1: how much more often posts field them together than chance (shrunk), plus kit and faction likeness. */
function affinity(model: IdentityModel, cfg: IdentityConfig, a: RecIdentity, b: RecIdentity): number {
  const ai = model.index.get(a.id), bi = model.index.get(b.id)
  let lift = 0
  if (ai !== undefined && bi !== undefined) {
    const expected = model.uses[ai] * model.uses[bi] / Math.max(1, model.count)
    lift = Math.max(0, clip(Math.log((model.pair[ai * model.ids.length + bi] + cfg.shrink) / (expected + cfg.shrink)), cfg.cap) / cfg.cap)
  }
  const faction = tagFit(new Map(b.factions.map(tag => [tag, model.catalog.idf.faction[tag] ?? 0])), a.factions, model.catalog.idf.faction).fit
  return 0.5 * lift + 0.25 * cosine(statusShare(a.status), statusShare(b.status)) + 0.25 * faction
}

function partnersOf(model: IdentityModel, cfg: IdentityConfig, x: RecIdentity, board: readonly RecIdentity[], now: number): Partner[] {
  const chosen = board.map(y => ({ id: y.id, score: round(affinity(model, cfg, x, y)), chosen: true })).filter(row => row.score >= 0.2).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, PARTNERS)
  if (chosen.length >= PARTNERS) return chosen
  const sinners = new Set([x.sinner, ...board.map(y => y.sinner)])
  const others = model.ids.flatMap(id => {
    const y = model.catalog.identities[id]
    return sinners.has(y.sinner) || (y.release !== null && y.release > now + DAY) ? [] : [{ id, score: round(affinity(model, cfg, x, y)), chosen: false }]
  }).filter(row => row.score >= 0.3).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  return [...chosen, ...others.slice(0, PARTNERS - chosen.length)]
}

const READABLE = /^(keyword|faction|sin):/
const round = (value: number) => Math.round(value * 1000) / 1000

/**
 * The suggestions for a slot: best first, each with why (reason codes `keyword:<name>`, `faction:<name>`, `sin:<sin>` first, then
 * `synergy`, `meta`, `new`) and up to three partners it goes well with (board members first, then the strongest others),
 * plus the archetype of the board. An empty board gets the meta prior, the newest identities and a spread of archetypes.
 */
export function suggestIdentities(model: IdentityModel, query: IdentityQuery, { limit = 24, cfg = IDENTITY_CONFIG }: { limit?: number; cfg?: IdentityConfig } = {}): { items: SuggestedIdentity[]; archetype: Archetype } {
  const { board, ranked } = rankIdentities(model, query, cfg)
  const archetype = detectArchetype(model.catalog, board, query.keywords)
  const top = ranked.slice(0, limit)
  const mean = COMPONENTS.map((_, i) => ranked.reduce((sum, row) => sum + row.z[i], 0) / Math.max(1, ranked.length))
  const items = top.map<SuggestedIdentity>(row => {
    const contribution = (...components: Component[]) => components.reduce((sum, component) => { const i = slot(component); return sum + cfg.weights[component] * (row.z[i] - mean[i]) }, 0)
    const x = model.catalog.identities[row.id]
    const found: { code: string; value: number }[] = [
      { code: row.hint.keyword ? `keyword:${row.hint.keyword}` : '', value: contribution('status', 'kw') },
      { code: row.hint.faction ? `faction:${row.hint.faction}` : '', value: contribution('faction') },
      { code: row.hint.passive ? `sin:${row.hint.passive.sin}` : '', value: contribution('sinOwn', 'sinTeam') },
      { code: 'synergy', value: contribution('pair', 'team') },
      { code: 'meta', value: contribution('meta') },
      { code: 'new', value: contribution('fresh') },
    ].filter(item => item.code && item.value > 0.02).sort((a, b) => b.value - a.value)
    let reasons = [...found.filter(item => READABLE.test(item.code)), ...found.filter(item => !READABLE.test(item.code))].map(item => item.code)
    if (!board.length && !reasons.some(code => code.startsWith('keyword:'))) {
      const share = statusShare(x.status), best = share.indexOf(Math.max(...share))
      if (share[best] >= 0.4) reasons = [`keyword:${STATUS_KEYWORDS[best]}`, ...reasons]
    }
    return { id: row.id, score: round(row.score), reasons: reasons.length ? reasons : ['meta'], partners: partnersOf(model, cfg, x, board, query.now) }
  })
  return { items, archetype }
}

export type Companion = { identity_id: string; /** Public posts fielding both. */ count: number; score: number }

/**
 * "함께 쓰는 인격" of an identity page: identities of other sinners that posts field with it (at least once), best first by
 * `affinity` — the shrunk synergy of fielding them together, plus how alike their kits and affiliations are. A pair seen once
 * counts for little, so a staple that sits in every post does not top every list.
 */
export function companionsOfIdentity(model: IdentityModel, identityId: string, { limit = 6, cfg = IDENTITY_CONFIG }: { limit?: number; cfg?: IdentityConfig } = {}): Companion[] {
  const me = model.catalog.identities[identityId], mi = model.index.get(identityId)
  if (!me || mi === undefined) return []
  return model.ids.flatMap(id => {
    const other = model.catalog.identities[id], oi = model.index.get(id)!
    const count = model.pair[mi * model.ids.length + oi]
    return other.sinner === me.sinner || count === 0 ? [] : [{ identity_id: id, count, score: affinity(model, cfg, me, other) }]
  }).sort((a, b) => b.score - a.score || b.count - a.count || a.identity_id.localeCompare(b.identity_id)).slice(0, limit)
}
