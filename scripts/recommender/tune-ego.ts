/**
 * Tunes the E.G.O recommender: shrink/cap by search, blend weights by coordinate ascent on cached components, 5-fold CV by author.
 *   npx tsx scripts/recommender/tune-ego.ts
 * Objective = MRR on the leave-author-out E.G.O queries.
 */
import { blendEgo, EGO_COMPONENTS, EGO_CONFIG, egoComponents, type EgoConfig } from '@/lib/discovery/ego-recs'
import { loadSnapshot } from './load-snapshot'
import { egoQueries, hash } from './queries'
import { v2Parts } from './v2'

const snapshot = loadSnapshot()
const parts = v2Parts(snapshot)
const queries = egoQueries(snapshot, 'author')

type Case = { z: number[][]; gold: number; fold: number }
const build = (cfg: EgoConfig) => queries.flatMap<Case>(q => {
  const { scored } = egoComponents(parts.egoModel(q.train), { identity: q.identity, board: q.team, equipped: q.otherEgos, candidates: q.candidates, now: q.now }, cfg)
  const gold = scored.findIndex(row => row.id === q.held)
  return gold < 0 ? [] : [{ z: scored.map(row => row.z), gold, fold: hash(`fold:${q.f.author}`) % 5 }]
})

const rank = (c: Case, w: EgoConfig['weights']) => { const gold = blendEgo(c.z[c.gold], w); let r = 1; c.z.forEach((z, i) => { if (i !== c.gold && blendEgo(z, w) >= gold - 1e-12) r++ }); return r }
const score = (cases: Case[], w: EgoConfig['weights'], keep: (fold: number) => boolean = () => true) => {
  let mrr = 0, hit1 = 0, n = 0
  for (const c of cases) if (keep(c.fold)) { const r = rank(c, w); mrr += 1 / r; hit1 += r === 1 ? 1 : 0; n++ }
  return { mrr: mrr / n, hit1: hit1 / n }
}
const GRID = [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.5, 2]
const ascend = (cases: Case[], start: EgoConfig['weights'], keep?: (fold: number) => boolean, passes = 3) => {
  let best = { ...start }, bestScore = score(cases, best, keep).mrr
  for (let pass = 0; pass < passes; pass++) {
    let improved = false
    for (const component of EGO_COMPONENTS) for (const value of GRID) {
      if (value === best[component]) continue
      const trial = { ...best, [component]: value }, s = score(cases, trial, keep).mrr
      if (s > bestScore + 1e-6) { best = trial; bestScore = s; improved = true }
    }
    if (!improved) break
  }
  return best
}

let cfg: EgoConfig = { ...EGO_CONFIG, weights: { ...EGO_CONFIG.weights } }
let cases = build(cfg)
if (process.argv.includes('--diag')) {
  for (const c of EGO_COMPONENTS) {
    const only = Object.fromEntries(EGO_COMPONENTS.map(k => [k, k === c ? 1 : 0])) as EgoConfig['weights']
    const without = { ...EGO_CONFIG.weights, [c]: 0 }
    console.log(c.padEnd(8), 'alone', JSON.stringify(score(cases, only)), ' | all but it', JSON.stringify(score(cases, without)))
  }
  process.exit(0)
}
console.log('start', JSON.stringify(score(cases, cfg.weights)))
for (const [key, values] of [['shrink', [0.5, 1, 2, 4]], ['cap', [1.5, 2.5, 4]], ['viewBoost', [0, 0.15, 0.4]], ['halfLife', [0, 14, 30]]] as [keyof EgoConfig, number[]][]) {
  let best = { value: cfg[key] as number, mrr: score(cases, cfg.weights).mrr }
  for (const value of values) {
    if (value === cfg[key]) continue
    const trial = { ...cfg, [key]: value } as EgoConfig, trialCases = build(trial)
    const mrr = score(trialCases, ascend(trialCases, cfg.weights, undefined, 1)).mrr
    if (mrr > best.mrr + 1e-5) best = { value, mrr }
  }
  if (best.value !== cfg[key]) { cfg = { ...cfg, [key]: best.value } as EgoConfig; cases = build(cfg); cfg.weights = ascend(cases, cfg.weights, undefined, 1) }
  console.log(`hyper ${String(key)} = ${cfg[key]}`)
}
cfg.weights = ascend(cases, cfg.weights)
console.log('tuned (in-sample)', JSON.stringify(score(cases, cfg.weights)))
const cv = { mrr: 0, hit1: 0 }, ref = { mrr: 0, hit1: 0 }
for (let k = 0; k < 5; k++) {
  const w = ascend(cases, EGO_CONFIG.weights, f => f !== k, 2)
  const held = score(cases, w, f => f === k), base = score(cases, EGO_CONFIG.weights, f => f === k)
  cv.mrr += held.mrr / 5; cv.hit1 += held.hit1 / 5; ref.mrr += base.mrr / 5; ref.hit1 += base.hit1 / 5
}
console.log(`CV (5 folds) ${JSON.stringify(cv)}  | untuned defaults ${JSON.stringify(ref)}`)
console.log(JSON.stringify({ shrink: cfg.shrink, cap: cfg.cap, halfLife: cfg.halfLife, viewBoost: cfg.viewBoost, weights: cfg.weights }))
