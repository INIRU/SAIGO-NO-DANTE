// Per-route first-load JS and CSS (gzip + raw bytes) of the last `next build`.
// usage: node scripts/perf/route-sizes.mjs [repo] [--out sizes.json] [--compare before.json] [--budget perf-budget.json]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

/** Sums [gzip, raw] bytes of files given relative to the repo root. */
function sumFiles(repo, files) {
  let gz = 0
  let raw = 0
  for (const file of files) {
    const bytes = readFileSync(join(repo, file))
    gz += gzipSync(bytes).length
    raw += bytes.length
  }
  return [gz, raw]
}

/**
 * Finds a route's client-reference manifest. A route group such as `(home)` adds a folder
 * that is not part of the route, so `/[lang]` lives in `app/[lang]/(home)/`.
 */
function manifestPath(repo, route) {
  const dir = join(repo, '.next/server/app', route)
  const file = 'page_client-reference-manifest.js'
  if (existsSync(join(dir, file))) return join(dir, file)
  if (!existsSync(dir)) return null
  const group = readdirSync(dir, { withFileTypes: true }).find(
    d => d.isDirectory() && /^\(.+\)$/.test(d.name) && existsSync(join(dir, d.name, file)),
  )
  return group ? join(dir, group.name, file) : null
}

/** CSS files (relative to the repo root) a route loads: root layout, [lang] layout and its page. */
function routeCssFiles(repo, route) {
  const path = manifestPath(repo, route)
  if (!path) throw new Error(`no client-reference manifest for ${route}`)
  globalThis.__RSC_MANIFEST = {}
  // The manifest is build output we generated ourselves: a script that fills globalThis.__RSC_MANIFEST.
  ;(0, eval)(readFileSync(path, 'utf8'))
  const [pageKey, manifest] = Object.entries(globalThis.__RSC_MANIFEST)[0]
  const entry = manifest.entryCSSFiles
  const keys = ['[project]/app/layout', '[project]/app/[lang]/layout', `[project]/app${pageKey}`]
  const css = new Set(keys.flatMap(key => (entry[key] || []).map(f => f.path)))
  return [...css].map(f => '.next/' + f)
}

/** @returns {Record<string, { jsGz: number, jsRaw: number, cssGz: number, cssRaw: number }>} */
export function routeSizes(repo = '.') {
  const stats = JSON.parse(readFileSync(join(repo, '.next/diagnostics/route-bundle-stats.json'), 'utf8'))
  const out = {}
  for (const { route, firstLoadChunkPaths } of stats) {
    const [jsGz, jsRaw] = sumFiles(repo, firstLoadChunkPaths)
    let cssGz = -1
    let cssRaw = -1
    try {
      ;[cssGz, cssRaw] = sumFiles(repo, routeCssFiles(repo, route))
    } catch {
      // -1 marks a route whose CSS could not be read
    }
    out[route] = { jsGz, jsRaw, cssGz, cssRaw }
  }
  return out
}

/** Per-route gzip difference (after - before), biggest total growth first. */
export function compareSizes(before, after) {
  return Object.keys(after)
    .map(route => ({
      route,
      jsGz: after[route].jsGz - (before[route]?.jsGz ?? 0),
      cssGz: after[route].cssGz - (before[route]?.cssGz ?? 0),
    }))
    .sort((a, b) => b.jsGz + b.cssGz - (a.jsGz + a.cssGz))
}

/**
 * Routes past their limit in a budget ({ route: { jsKB, cssKB } }, gzip KB): each JS or CSS size over its limit, and a budgeted
 * route the build no longer has (a renamed route takes its limit along). In the budget's order.
 */
export function overBudget(sizes, budget) {
  const over = []
  for (const [route, limit] of Object.entries(budget)) {
    const size = sizes[route]
    if (!size) { over.push({ route, kind: 'missing', sizeKB: 0, limitKB: 0 }); continue }
    if (size.jsGz > limit.jsKB * 1024) over.push({ route, kind: 'js', sizeKB: Math.ceil(size.jsGz / 1024), limitKB: limit.jsKB })
    if (size.cssGz > limit.cssKB * 1024) over.push({ route, kind: 'css', sizeKB: Math.ceil(size.cssGz / 1024), limitKB: limit.cssKB })
  }
  return over
}

const kb = n => (n < 0 ? '-' : (n / 1024).toFixed(1) + 'KB')
const signed = n => (n > 0 ? '+' : '') + (n / 1024).toFixed(1) + 'KB'

function main(argv) {
  const flag = name => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const repo = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')) ?? '.'
  const sizes = routeSizes(repo)
  if (flag('--out')) writeFileSync(flag('--out'), JSON.stringify(sizes, null, 1))
  if (flag('--budget')) {
    const over = overBudget(sizes, JSON.parse(readFileSync(flag('--budget'), 'utf8')))
    for (const o of over) {
      console.log(o.kind === 'missing' ? `${o.route}: in the budget but not in this build` : `${o.route}: ${o.kind} ${o.sizeKB}KB > ${o.limitKB}KB`)
    }
    if (over.length) {
      console.log('Over the route size budget. Shrink it, or raise the limit in perf-budget.json with the reason in the PR.')
      process.exitCode = 1
    } else console.log('Within the route size budget.')
    return
  }
  const before = flag('--compare') ? JSON.parse(readFileSync(flag('--compare'), 'utf8')) : null
  if (before) {
    console.log('route'.padEnd(44), 'jsGz'.padStart(10), 'cssGz'.padStart(10))
    for (const d of compareSizes(before, sizes)) console.log(d.route.padEnd(44), signed(d.jsGz).padStart(10), signed(d.cssGz).padStart(10))
  } else {
    console.log('route'.padEnd(44), 'jsGz'.padStart(10), 'cssGz'.padStart(10))
    for (const [route, v] of Object.entries(sizes).sort()) console.log(route.padEnd(44), kb(v.jsGz).padStart(10), kb(v.cssGz).padStart(10))
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
