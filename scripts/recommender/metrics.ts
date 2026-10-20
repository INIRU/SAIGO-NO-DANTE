/** Ranking metrics for "complete the set" evaluation: one hidden item per query, ranked among candidates. */

/** 1-based position of `gold` in `list`; Infinity when the list does not hold it (a miss). */
export function rankOf(list: readonly string[], gold: string): number {
  const index = list.indexOf(gold)
  return index < 0 ? Infinity : index + 1
}

export type Summary = {
  n: number
  hit1: number
  hit3: number
  hit6: number
  mrr: number
  ndcg6: number
  /** Share of queries the algorithm returned anything for. */
  coverage: number
}

/** hit@k = share of queries whose gold item is in the top k; MRR = mean 1/rank; NDCG@6 with one relevant item = 1/log2(rank+1). */
export function summarize(ranks: readonly number[], answered: readonly boolean[] = ranks.map(() => true)): Summary {
  const n = ranks.length
  if (!n) return { n: 0, hit1: 0, hit3: 0, hit6: 0, mrr: 0, ndcg6: 0, coverage: 0 }
  const mean = (fn: (rank: number) => number) => ranks.reduce((sum, rank) => sum + fn(rank), 0) / n
  return {
    n,
    hit1: mean(rank => (rank <= 1 ? 1 : 0)),
    hit3: mean(rank => (rank <= 3 ? 1 : 0)),
    hit6: mean(rank => (rank <= 6 ? 1 : 0)),
    mrr: mean(rank => (Number.isFinite(rank) ? 1 / rank : 0)),
    ndcg6: mean(rank => (rank <= 6 ? 1 / Math.log2(rank + 1) : 0)),
    coverage: answered.filter(Boolean).length / n,
  }
}

/** Jaccard overlap of two top-k lists (1 = same set, order ignored). */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a), right = new Set(b)
  if (!left.size && !right.size) return 1
  let shared = 0
  for (const item of left) if (right.has(item)) shared++
  return shared / (left.size + right.size - shared)
}

/**
 * Rank-biased overlap (Webber, Moffat & Zobel 2010) of two lists cut at the same depth: top ranks weigh most,
 * persistence p sets how fast the weight falls. Extrapolated so equal lists score 1 at any depth.
 */
export function rbo(a: readonly string[], b: readonly string[], p = 0.8): number {
  const depth = Math.min(a.length, b.length)
  if (!depth) return a.length === b.length ? 1 : 0
  const seenA = new Set<string>(), seenB = new Set<string>()
  let overlap = 0, sum = 0
  for (let d = 1; d <= depth; d++) {
    const x = a[d - 1], y = b[d - 1]
    if (x === y) overlap++
    else {
      if (seenB.has(x)) overlap++
      if (seenA.has(y)) overlap++
    }
    seenA.add(x)
    seenB.add(y)
    sum += (overlap / d) * p ** (d - 1)
  }
  // Finite-depth form with the tail extrapolated at the last observed agreement.
  return (1 - p) * sum + (overlap / depth) * p ** depth
}
