import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { compareSizes, overBudget, routeSizes } from '../../../scripts/perf/route-sizes.mjs'

const FIXTURE = resolve(__dirname, '../../fixtures/perf/route-bundle-stats.json')
const CHUNKS: Record<string, string> = {
  'a.js': 'console.log("a");'.repeat(200),
  'b.js': 'export const b = [1, 2, 3, 4, 5];'.repeat(100),
  'c.js': 'function c() { return "c" }'.repeat(50),
}
const CSS: Record<string, string> = {
  'layout.css': '.a{color:red}'.repeat(100),
  'page.css': '.b{margin:0}'.repeat(100),
}
const gz = (text: string) => gzipSync(Buffer.from(text)).length

/** Writes a fake `.next` build: the fixture stats, chunk and CSS files, and one client-reference manifest per route. */
function fakeRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'route-sizes-'))
  const put = (path: string, text: string) => {
    mkdirSync(join(repo, path, '..'), { recursive: true })
    writeFileSync(join(repo, path), text)
  }
  put('.next/diagnostics/route-bundle-stats.json', readFileSync(FIXTURE, 'utf8'))
  for (const [name, text] of Object.entries(CHUNKS)) put(`.next/static/chunks/${name}`, text)
  for (const [name, text] of Object.entries(CSS)) put(`.next/static/chunks/${name}`, text)
  const manifest = (pageKey: string, withPage: boolean) => `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {}
globalThis.__RSC_MANIFEST[${JSON.stringify(pageKey)}] = ${JSON.stringify({
    entryCSSFiles: {
      '[project]/app/layout': [{ path: 'static/chunks/layout.css' }],
      '[project]/app/[lang]/layout': [{ path: 'static/chunks/layout.css' }],
      [`[project]/app${pageKey}`]: withPage ? [{ path: 'static/chunks/layout.css' }, { path: 'static/chunks/page.css' }] : [],
    },
  })}`
  // Route group: the home page lives in app/[lang]/(home), so its manifest sits under (home)/.
  put('.next/server/app/[lang]/(home)/page_client-reference-manifest.js', manifest('/[lang]/(home)/page', true))
  put('.next/server/app/[lang]/licenses/page_client-reference-manifest.js', manifest('/[lang]/licenses/page', false))
  return repo
}

describe('route-sizes', () => {
  it('REQ-SHARED-086 sums gzip and raw bytes of first-load JS and CSS per route', () => {
    const sizes = routeSizes(fakeRepo())
    const [a, b, c] = ['a.js', 'b.js', 'c.js'].map(n => CHUNKS[n])
    expect(sizes['/[lang]/licenses'].jsGz).toBe(gz(a) + gz(b))
    expect(sizes['/[lang]/licenses'].jsRaw).toBe(a.length + b.length)
    expect(sizes['/[lang]'].jsGz).toBe(gz(a) + gz(b) + gz(c))
    expect(sizes['/[lang]/licenses'].cssGz).toBe(gz(CSS['layout.css']))
  })

  it('REQ-SHARED-086 reads the CSS of a route inside a route group such as (home)', () => {
    const sizes = routeSizes(fakeRepo())
    expect(sizes['/[lang]'].cssGz).toBe(gz(CSS['layout.css']) + gz(CSS['page.css']))
    expect(sizes['/[lang]'].cssRaw).toBe(CSS['layout.css'].length + CSS['page.css'].length)
  })

  it('REQ-SHARED-086 compareSizes lists routes that grew first, biggest first, and then routes that shrank', () => {
    const entry = (jsGz: number, cssGz: number) => ({ jsGz, jsRaw: 0, cssGz, cssRaw: 0 })
    const before = { '/x': entry(100, 10), '/y': entry(200, 20), '/z': entry(300, 30) }
    const after = { '/x': entry(150, 10), '/y': entry(180, 20), '/z': entry(400, 35) }
    expect(compareSizes(before, after)).toEqual([
      { route: '/z', jsGz: 100, cssGz: 5 },
      { route: '/x', jsGz: 50, cssGz: 0 },
      { route: '/y', jsGz: -20, cssGz: 0 },
    ])
  })
})

describe('route size budget', () => {
  const entry = (jsKB: number, cssKB: number) => ({ jsGz: jsKB * 1024, jsRaw: 0, cssGz: cssKB * 1024, cssRaw: 0 })

  it('REQ-SHARED-093 lists every route past its JS or CSS limit, and a budgeted route the build no longer has', () => {
    const sizes = { '/a': entry(100, 10), '/b': entry(210, 10), '/c': entry(50, 31), '/unbudgeted': entry(999, 99) }
    const budget = { '/a': { jsKB: 100, cssKB: 10 }, '/b': { jsKB: 200, cssKB: 10 }, '/c': { jsKB: 60, cssKB: 30 }, '/gone': { jsKB: 1, cssKB: 1 } }
    expect(overBudget(sizes, budget)).toEqual([
      { route: '/b', kind: 'js', sizeKB: 210, limitKB: 200 },
      { route: '/c', kind: 'css', sizeKB: 31, limitKB: 30 },
      { route: '/gone', kind: 'missing', sizeKB: 0, limitKB: 0 },
    ])
  })

  it('REQ-SHARED-093 fails the command (exit 1) past the budget and passes (exit 0) within it', () => {
    const repo = fakeRepo()
    const script = resolve(__dirname, '../../../scripts/perf/route-sizes.mjs')
    const sizes = routeSizes(repo)
    const kb = (bytes: number) => Math.ceil(bytes / 1024)
    const within = join(repo, 'within.json'), past = join(repo, 'past.json')
    writeFileSync(within, JSON.stringify(Object.fromEntries(Object.entries(sizes).map(([route, v]) => [route, { jsKB: kb(v.jsGz), cssKB: kb(v.cssGz) }]))))
    writeFileSync(past, JSON.stringify({ '/[lang]': { jsKB: 0, cssKB: 0 } }))
    expect(() => execFileSync('node', [script, repo, '--budget', within], { stdio: 'pipe' })).not.toThrow()
    let failed: { status?: number; stdout?: Buffer } = {}
    try { execFileSync('node', [script, repo, '--budget', past], { stdio: 'pipe' }) } catch (error) { failed = error as typeof failed }
    expect(failed.status).toBe(1)
    expect(String(failed.stdout)).toContain('/[lang]')
  })
})
