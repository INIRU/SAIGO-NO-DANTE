// Lighthouse performance score, LCP, TBT, CLS and transferred JS for the eight tracked screens.
// usage: node scripts/perf/lighthouse.mjs <baseUrl> [--form mobile|desktop] [--runs 1] [--out file.json]
// Needs Chrome and network access for `npx lighthouse@12` (no dependency is added to the repo).
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Fixed ids from the production lists so numbers stay comparable between runs.
export const DECK_ID = '32fdf886-8dac-4bf2-a817-d53a78fe6425'
export const IDENTITY_ID = '4be6011c-a549-4b29-b434-5f5eaaa43db7'
export const SCREENS = [
  ['홈', '/ko'],
  ['덱 게시판', '/ko/decks'],
  ['덱 상세', `/ko/decks/${DECK_ID}`],
  ['플래너', '/ko/planner'],
  ['거울 던전', '/ko/mirror-dungeon'],
  ['인격 상세', `/ko/sinners/faust/identities/${IDENTITY_ID}`],
  ['메타', '/ko/meta'],
  ['보유 현황', '/ko/collection'],
]

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

/** Runs Lighthouse once and returns the numbers we track. */
function measure(url, form) {
  const out = join(mkdtempSync(join(tmpdir(), 'lh-')), 'report.json')
  const args = ['--yes', 'lighthouse@12', url, '--only-categories=performance', '--output=json', `--output-path=${out}`, '--quiet', '--chrome-flags=--headless=new']
  if (form === 'desktop') args.push('--preset=desktop')
  execFileSync('npx', args, { stdio: ['ignore', 'ignore', 'inherit'], timeout: 300_000 })
  const lhr = JSON.parse(readFileSync(out, 'utf8'))
  const audit = id => lhr.audits[id].numericValue
  const scripts = lhr.audits['network-requests'].details.items.filter(i => i.resourceType === 'Script')
  return {
    score: Math.round(lhr.categories.performance.score * 100),
    lcpMs: Math.round(audit('largest-contentful-paint')),
    tbtMs: Math.round(audit('total-blocking-time')),
    cls: Number(audit('cumulative-layout-shift').toFixed(3)),
    jsKB: Math.round(scripts.reduce((sum, i) => sum + (i.transferSize ?? 0), 0) / 1024),
  }
}

function main(argv) {
  const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback)
  const baseUrl = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'))
  if (!baseUrl) throw new Error('usage: lighthouse.mjs <baseUrl> [--form mobile|desktop] [--runs 1] [--out file]')
  const form = flag('--form', 'mobile')
  const runs = Number(flag('--runs', '1'))
  const results = {}
  console.log(`form=${form} runs=${runs}${runs > 1 ? ' (median)' : ''}`)
  console.log('screen'.padEnd(10), 'score'.padStart(6), 'LCP(s)'.padStart(8), 'TBT(ms)'.padStart(8), 'CLS'.padStart(7), 'JS(KB)'.padStart(8))
  for (const [name, path] of SCREENS) {
    const samples = Array.from({ length: runs }, () => measure(baseUrl.replace(/\/$/, '') + path, form))
    const r = Object.fromEntries(Object.keys(samples[0]).map(key => [key, median(samples.map(s => s[key]))]))
    results[path] = r
    console.log(name.padEnd(10), String(r.score).padStart(6), (r.lcpMs / 1000).toFixed(1).padStart(8), String(r.tbtMs).padStart(8), String(r.cls).padStart(7), String(r.jsKB).padStart(8))
  }
  if (flag('--out')) writeFileSync(flag('--out'), JSON.stringify(results, null, 1))
}

main(process.argv.slice(2))
