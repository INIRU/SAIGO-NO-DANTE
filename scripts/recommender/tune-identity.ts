/**
 * Tunes the identity recommender on the harness: hyper-parameters by coordinate search on the leave-author-out queries, blend
 * weights by coordinate ascent on cached components, then 5-fold cross-validation (folds by author) of the weight step.
 *   npx tsx scripts/recommender/tune-identity.ts [--beta 1.0] [--skip-hyper] [--no-sin]
 * Objective = mean MRR over the context regimes (full, half, three, one, zero) − beta × (1 − RBO of the top-6 across one added pick).
 */
import { blend, COMPONENTS, IDENTITY_CONFIG, identityComponents, type IdentityConfig, type Weights } from '@/lib/discovery/identity-recs'
import { loadSnapshot } from './load-snapshot'
import { rbo } from './metrics'
import { hash, identityQueries, stabilityQueries, type IdentityQuery, type Regime } from './queries'
import { v2Parts } from './v2'

type Case = { ids: string[]; z: number[][]; gold: number; regime: string; mixed: boolean; fold: number }
type Step = { ids: string[]; z: number[][]; seq: number; fold: number }

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const option = (name: string, fallback: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback }
const beta = Number(option('--beta', '1'))

const snapshot = loadSnapshot()
const parts = v2Parts(snapshot)
const REGIMES: Regime[] = ['full', 'half', 'three', 'one', 'zero']
const fold = (author: string) => hash(`fold:${author}`) % 5

function mixed(context: string[]): boolean {
  if (context.length < 3) return false
  const counts = new Map<string, number>()
  for (const id of context) for (const keyword of snapshot.catalog.identities.find(i => i.id === id)?.skill_keyword_list ?? []) counts.set(keyword, (counts.get(keyword) ?? 0) + 1)
  return Math.max(0, ...counts.values()) / context.length < 0.7
}

function build(cfg: IdentityConfig) {
  const withSin = !flag('--no-sin')
  const cases: Case[] = []
  for (const regime of REGIMES) {
    for (const q of identityQueries(snapshot, 'author', regime)) {
      const { scored } = identityComponents(parts.identityModel(q.train), { context: q.context, sinner: q.sinner, candidates: q.candidates, now: q.now }, cfg, { withSin })
      const gold = scored.findIndex(row => row.id === q.held)
      if (gold < 0) continue
      cases.push({ ids: scored.map(row => row.id), z: scored.map(row => row.z), gold, regime, mixed: mixed(q.context), fold: fold(q.f.author) })
    }
  }
  const steps: Step[][] = []
  stabilityQueries(snapshot, 'author').forEach((sequence, seq) => {
    steps.push(sequence.map((q: IdentityQuery) => {
      const { scored } = identityComponents(parts.identityModel(q.train), { context: q.context, sinner: q.sinner, candidates: q.candidates, now: q.now }, cfg, { withSin })
      return { ids: scored.map(row => row.id), z: scored.map(row => row.z), seq, fold: fold(q.f.author) }
    }))
  })
  return { cases, steps }
}

const rankOfGold = (c: Case, w: Weights) => {
  const gold = blend(c.z[c.gold], w)
  let rank = 1
  for (let i = 0; i < c.z.length; i++) if (i !== c.gold) { const s = blend(c.z[i], w); if (s > gold + 1e-12 || (Math.abs(s - gold) <= 1e-12 && c.ids[i] < c.ids[c.gold])) rank++ }
  return rank
}
const top6 = (s: Step, w: Weights) => s.z.map((z, i) => ({ id: s.ids[i], v: blend(z, w) })).sort((a, b) => b.v - a.v || a.id.localeCompare(b.id)).slice(0, 6).map(row => row.id)

function score(data: ReturnType<typeof build>, w: Weights, filter: (fold: number) => boolean = () => true) {
  const byRegime = new Map<string, { mrr: number; hit1: number; hit3: number; n: number }>()
  const mixedAcc = { mrr: 0, n: 0 }
  for (const c of data.cases) {
    if (!filter(c.fold)) continue
    const rank = rankOfGold(c, w)
    const row = byRegime.get(c.regime) ?? { mrr: 0, hit1: 0, hit3: 0, n: 0 }
    row.mrr += 1 / rank; row.hit1 += rank <= 1 ? 1 : 0; row.hit3 += rank <= 3 ? 1 : 0; row.n++
    byRegime.set(c.regime, row)
    if (c.mixed) { mixedAcc.mrr += 1 / rank; mixedAcc.n++ }
  }
  let stable = 0, steps = 0
  for (const sequence of data.steps) {
    if (!filter(sequence[0].fold)) continue
    let prev: string[] | null = null
    for (const step of sequence) { const list = top6(step, w); if (prev) { stable += rbo(prev, list); steps++ } prev = list }
  }
  const mrr = (r: string) => (byRegime.get(r) ? byRegime.get(r)!.mrr / byRegime.get(r)!.n : 0)
  const accuracy = REGIMES.reduce((sum, r) => sum + mrr(r), 0) / REGIMES.length
  const rboMean = steps ? stable / steps : 1
  return { objective: accuracy - beta * (1 - rboMean), accuracy, rbo: rboMean, byRegime, mixedMrr: mixedAcc.n ? mixedAcc.mrr / mixedAcc.n : 0 }
}

const show = (label: string, s: ReturnType<typeof score>) => console.log(`${label.padEnd(22)} J ${s.objective.toFixed(4)}  acc(MRR) ${s.accuracy.toFixed(4)}  RBO ${s.rbo.toFixed(4)}  mixed MRR ${s.mixedMrr.toFixed(4)}  ` + REGIMES.map(r => `${r}:${(s.byRegime.get(r)!.mrr / s.byRegime.get(r)!.n).toFixed(3)}/${(s.byRegime.get(r)!.hit1 / s.byRegime.get(r)!.n).toFixed(3)}`).join(' '))
const WEIGHT_GRID = [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.5, 2]
function ascend(data: ReturnType<typeof build>, start: Weights, filter?: (fold: number) => boolean, passes = 3, frozen: string[] = []): Weights {
  let best = { ...start }
  let bestScore = score(data, best, filter).objective
  for (let pass = 0; pass < passes; pass++) {
    let improved = false
    for (const component of COMPONENTS) {
      if (frozen.includes(component)) continue
      for (const value of WEIGHT_GRID) {
        if (value === best[component]) continue
        const trial = { ...best, [component]: value }
        const s = score(data, trial, filter).objective
        if (s > bestScore + 1e-6) { best = trial; bestScore = s; improved = true }
      }
    }
    if (!improved) break
  }
  return best
}


if (flag('--diag')) {
  const diagData = build({ ...IDENTITY_CONFIG })
  for (const component of COMPONENTS) {
    const only = Object.fromEntries(COMPONENTS.map(c => [c, c === component ? 1 : 0])) as Weights
    show(`only ${component}`, score(diagData, only))
  }
  process.exit(0)
}
let cfg: IdentityConfig = { ...IDENTITY_CONFIG, weights: { ...IDENTITY_CONFIG.weights } }
if (flag('--no-sin')) cfg.weights = { ...cfg.weights, sinOwn: 0, sinTeam: 0 }
const sinOn = !flag('--no-sin')
let data = build(cfg)
show('start', score(data, cfg.weights))

if (!flag('--skip-hyper')) {
  const grids: [keyof IdentityConfig, number[]][] = [['shrink', [0.5, 1, 2, 4]], ['cap', [1.5, 2.5, 4]], ['kappa', [0.5, 2, 5, 10]], ['power', [1, 2, 3]], ['halfLife', [0, 14, 30]], ['viewBoost', [0, 0.15, 0.4]]]
  for (let round = 0; round < Number(option("--rounds", "1")); round++) {
    for (const [key, values] of grids) {
      let best = { value: cfg[key] as number, score: score(data, cfg.weights).objective }
      for (const value of values) {
        if (value === cfg[key]) continue
        const trialCfg = { ...cfg, [key]: value } as IdentityConfig
        const trialData = build(trialCfg)
        const trialWeights = ascend(trialData, cfg.weights, undefined, 1)
        const s = score(trialData, trialWeights).objective
        if (s > best.score + 1e-5) best = { value, score: s }
      }
      if (best.value !== cfg[key]) { cfg = { ...cfg, [key]: best.value } as IdentityConfig; data = build(cfg); cfg.weights = ascend(data, cfg.weights, undefined, 1) }
      console.log(`hyper ${String(key)} = ${cfg[key]}  J ${score(data, cfg.weights).objective.toFixed(4)}`)
    }
  }
}

cfg.weights = ascend(data, cfg.weights)
show('tuned (in-sample)', score(data, cfg.weights))

// 5-fold cross-validation of the weight step: tune on four folds of authors, score on the fifth.
const cv = { objective: 0, accuracy: 0, rbo: 0, mixed: 0 }
const base = { objective: 0, accuracy: 0, rbo: 0, mixed: 0 }
for (let k = 0; k < 5; k++) {
  const weights = ascend(data, IDENTITY_CONFIG.weights, f => f !== k, 2)
  const held = score(data, weights, f => f === k)
  const ref = score(data, IDENTITY_CONFIG.weights, f => f === k)
  cv.objective += held.objective / 5; cv.accuracy += held.accuracy / 5; cv.rbo += held.rbo / 5; cv.mixed += held.mixedMrr / 5
  base.objective += ref.objective / 5; base.accuracy += ref.accuracy / 5; base.rbo += ref.rbo / 5; base.mixed += ref.mixedMrr / 5
}
console.log(`CV (5 folds)           J ${cv.objective.toFixed(4)}  acc ${cv.accuracy.toFixed(4)}  RBO ${cv.rbo.toFixed(4)}  mixed ${cv.mixed.toFixed(4)}   | untuned defaults on the same folds: J ${base.objective.toFixed(4)} acc ${base.accuracy.toFixed(4)} RBO ${base.rbo.toFixed(4)} mixed ${base.mixed.toFixed(4)}`)
console.log(JSON.stringify({ shrink: cfg.shrink, cap: cfg.cap, kappa: cfg.kappa, power: cfg.power, halfLife: cfg.halfLife, viewBoost: cfg.viewBoost, weights: cfg.weights, sinOn }, null, 1))
