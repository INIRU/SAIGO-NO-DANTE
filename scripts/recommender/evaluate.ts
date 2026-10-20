/**
 * Offline evaluation of the discovery suggestions on the real public decks and plans.
 *   node scripts/recommender/export-snapshot.mjs          (once; SELECT only, writes the git-ignored .recsys-snapshot/)
 *   npx tsx scripts/recommender/evaluate.ts [--algo baseline|popularity] [--split author|formation|both] [--json out.json]
 * Every query hides one item of a real formation/plan and ranks the slot's candidates from the other posts only.
 */
import fs from 'node:fs'
import { baselineRankers, popularityRankers, type Rankers } from './baseline'
import { loadSnapshot, type Snapshot } from './load-snapshot'
import { jaccard, rankOf, rbo, summarize, type Summary } from './metrics'
import { egoQueries, giftQueries, identityQueries, stabilityQueries, themeQueries, type Regime, type Split } from './queries'

export type Row = Summary & { task: string; split: Split; random6: number }

const fmt = (value: number) => (value * 100).toFixed(1).padStart(5)

export function runTask<Q extends { candidates: string[]; held?: string }>(task: string, split: Split, queries: Q[], gold: (query: Q) => string, rank: (query: Q) => string[]): Row {
  const ranks: number[] = [], answered: boolean[] = []
  let random6 = 0
  for (const query of queries) {
    const list = rank(query)
    ranks.push(rankOf(list, gold(query)))
    answered.push(list.length > 0)
    random6 += Math.min(1, 6 / Math.max(1, query.candidates.length))
  }
  return { ...summarize(ranks, answered), task, split, random6: queries.length ? random6 / queries.length : 0 }
}

export function printRows(rows: Row[]) {
  console.log('task                         split      n    hit@1  hit@3  hit@6   MRR  NDCG6  cover  random@6')
  for (const row of rows) {
    console.log(`${row.task.padEnd(28)} ${row.split.padEnd(9)} ${String(row.n).padStart(5)} ${fmt(row.hit1)} ${fmt(row.hit3)} ${fmt(row.hit6)} ${fmt(row.mrr)} ${fmt(row.ndcg6)} ${fmt(row.coverage)} ${fmt(row.random6)}`)
  }
}

/** Mean RBO / Jaccard of the top-6 before and after one more identity joins the context (steps where both lists exist). */
export function stability(sequences: ReturnType<typeof stabilityQueries>, rank: (query: ReturnType<typeof stabilityQueries>[number][number]) => string[]) {
  let steps = 0, answered = 0, rboSum = 0, jaccardSum = 0
  for (const sequence of sequences) {
    let previous: string[] | null = null
    for (const query of sequence) {
      const list = rank(query).slice(0, 6)
      if (previous) {
        steps++
        if (previous.length && list.length) { answered++; rboSum += rbo(previous, list); jaccardSum += jaccard(previous, list) }
      }
      previous = list
    }
  }
  return { steps, coverage: answered / steps, rbo: answered ? rboSum / answered : 0, jaccard: answered ? jaccardSum / answered : 0 }
}

/** A context with no main status keyword that most of its members share: the case where one dominant co-occurrence used to pull the list around. */
export function mixedContext(snapshot: Snapshot, context: string[]): boolean {
  if (context.length < 3) return false
  const keywords = new Map(snapshot.catalog.identities.map(identity => [identity.id, identity.skill_keyword_list ?? []]))
  const counts = new Map<string, number>()
  for (const id of context) for (const keyword of keywords.get(id) ?? []) counts.set(keyword, (counts.get(keyword) ?? 0) + 1)
  return Math.max(0, ...counts.values()) / context.length < 0.7
}

export function evaluateAll(rankers: Rankers, splits: Split[], label: string, snapshot = loadSnapshot()) {
  const rows: Row[] = []
  const stable: Record<string, ReturnType<typeof stability>> = {}
  for (const split of splits) {
    for (const regime of ['full', 'half', 'three', 'one'] as Regime[]) {
      rows.push(runTask(`identity (${regime} context)`, split, identityQueries(snapshot, split, regime), query => query.held, rankers.identity))
    }
    for (const regime of ['half', 'three'] as Regime[]) {
      rows.push(runTask(`identity (${regime}, mixed team)`, split, identityQueries(snapshot, split, regime).filter(query => mixedContext(snapshot, query.context)), query => query.held, rankers.identity))
    }
    rows.push(runTask('E.G.O (open grades)', split, egoQueries(snapshot, split), query => query.held, rankers.ego))
    const themes = themeQueries(snapshot, split)
    rows.push(runTask('theme pack (by floor)', split, themes, query => query.held, rankers.theme))
    rows.push(runTask('gift (its pack, >=6 choices)', split, giftQueries(snapshot, split).filter(query => query.candidates.length >= 6), query => query.held, rankers.gift))
    stable[split] = stability(stabilityQueries(snapshot, split), rankers.identity)
  }
  console.log(`\n== ${label} (snapshot ${snapshot.exportedAt}, ${snapshot.formations.length} formations)`)
  printRows(rows)
  for (const [split, value] of Object.entries(stable)) console.log(`stability[${split}]: top-6 RBO ${value.rbo.toFixed(3)}, Jaccard ${value.jaccard.toFixed(3)} over ${value.steps} steps (answered ${(value.coverage * 100).toFixed(0)}%)`)
  return { rows, stable }
}

if (process.argv[1]?.endsWith('recommender/evaluate.ts')) {
  const args = process.argv.slice(2)
  const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const algo = option('--algo') ?? 'baseline'
  const split = option('--split') ?? 'both'
  const snapshot = loadSnapshot()
  const rankers = algo === 'popularity' ? popularityRankers() : baselineRankers(snapshot)
  const result = evaluateAll(rankers, split === 'both' ? ['author', 'formation'] : [split as Split], algo, snapshot)
  const out = option('--json')
  if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2))
}
