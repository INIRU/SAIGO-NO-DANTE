/**
 * Tunes the theme pack / gift recommender by coordinate search over its few parameters, with 5-fold CV by author.
 *   npx tsx scripts/recommender/tune-floor.ts
 * Objective = (MRR of packs + MRR of gifts) / 2 on the leave-author-out queries (gift queries with at least 6 choices).
 */
import { FLOOR_CONFIG, rankGifts, rankThemes, type FloorConfig } from '@/features/community/lib/floor-recs'
import { loadSnapshot } from './load-snapshot'
import { giftQueries, hash, themeQueries } from './queries'
import { floorQueryOf, v2Parts } from './v2'

const snapshot = loadSnapshot()
const parts = v2Parts(snapshot)
const themes = themeQueries(snapshot, 'author')
const gifts = giftQueries(snapshot, 'author').filter(q => q.candidates.length >= 6)
const fold = (q: { f: { author: string } }) => hash(`fold:${q.f.author}`) % 5

function mrr<Q extends (typeof themes)[number]>(queries: Q[], cfg: FloorConfig, rank: typeof rankThemes, keep: (fold: number) => boolean) {
  let sum = 0, n = 0, hit1 = 0
  for (const q of queries) {
    if (!keep(fold(q))) continue
    const list = rank(parts.floorModel(q.train), floorQueryOf(q), cfg)
    const index = list.findIndex(row => row.id === q.held)
    if (index >= 0) { sum += 1 / (index + 1); if (index === 0) hit1++ }
    n++
  }
  return { mrr: sum / n, hit1: hit1 / n }
}
const score = (cfg: FloorConfig, keep: (fold: number) => boolean = () => true) => {
  const t = mrr(themes, cfg, rankThemes, keep), g = mrr(gifts, cfg, rankGifts, keep)
  return { objective: (t.mrr + g.mrr) / 2, theme: t, gift: g }
}

const GRIDS: Partial<Record<keyof FloorConfig, number[]>> = {
  overlap: [0, 0.2, 0.4, 0.6], profile: [0, 0.2, 0.4, 0.6], floors: [0, 0.2, 0.4, 0.6], gamma: [1, 2, 3, 4], alpha: [0.5, 1, 3, 8], beta: [1, 2, 5, 15], themeKw: [0, 0.15, 0.3, 0.6, 1], giftKw: [0, 0.15, 0.3, 0.6, 1], halfLife: [0, 14, 28],
}
function search(start: FloorConfig, keep?: (fold: number) => boolean, rounds = 2) {
  let best = { ...start }, bestScore = score(best, keep).objective
  for (let round = 0; round < rounds; round++) {
    let improved = false
    for (const [key, values] of Object.entries(GRIDS) as [keyof FloorConfig, number[]][]) {
      for (const value of values) {
        if (value === best[key]) continue
        const trial = { ...best, [key]: value }
        const s = score(trial, keep).objective
        if (s > bestScore + 1e-6) { best = trial; bestScore = s; improved = true }
      }
    }
    if (!improved) break
  }
  return best
}
const show = (label: string, s: ReturnType<typeof score>) => console.log(`${label.padEnd(24)} objective ${s.objective.toFixed(4)}  packs MRR ${s.theme.mrr.toFixed(4)} hit@1 ${s.theme.hit1.toFixed(3)}  gifts MRR ${s.gift.mrr.toFixed(4)} hit@1 ${s.gift.hit1.toFixed(3)}`)

show('defaults', score(FLOOR_CONFIG))
const tuned = search(FLOOR_CONFIG)
show('tuned (in-sample)', score(tuned))
let cv = 0, ref = 0
const cvRows = { theme: 0, gift: 0 }
for (let k = 0; k < 5; k++) {
  const cfg = search(FLOOR_CONFIG, f => f !== k, 1)
  const held = score(cfg, f => f === k)
  cv += held.objective / 5; cvRows.theme += held.theme.mrr / 5; cvRows.gift += held.gift.mrr / 5
  ref += score(FLOOR_CONFIG, f => f === k).objective / 5
}
console.log(`CV (5 folds) objective ${cv.toFixed(4)} (packs MRR ${cvRows.theme.toFixed(4)}, gifts MRR ${cvRows.gift.toFixed(4)}) | untuned defaults ${ref.toFixed(4)}`)
console.log(JSON.stringify(tuned))
