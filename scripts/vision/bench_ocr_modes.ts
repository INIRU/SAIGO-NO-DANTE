// @ts-nocheck -- developer benchmark run with tsx; Playwright page callbacks are untyped.
/** Reads the same keyframes with the balanced and quality full-frame OCR settings and scores them with the app parsers.
 * Usage: npx tsx scripts/vision/bench_ocr_modes.ts <keyframes dir> [origin]. Needs a dev server and local Chrome (WebGPU). */
import { chromium } from "playwright"
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
declare global { interface Window { __ocr: Worker } }
import { costBeforeSale, isSellWindow, sellCost, sellDialog } from '../../features/assist/lib/sell-evidence'
import { fusionConfirmation } from '../../features/assist/lib/fusion-evidence'
import { themeSelectionHeaderFloor } from '../../features/assist/lib/exploration-match'

const root = process.argv[2] ?? '/Users/iniru/Downloads/assist-analysis-2026-09-24/keyframes'
const origin = process.argv[3] ?? 'http://localhost:3300'
// Sell dialogs of the 2026-09-21 video: frame, gift, price, cost before, cost after (analysis REPORT.md 4.2).
const sellTable: [number, string, number, number, number][] = [[57588,'어두운 잔영',100,129,229],[57711,'어두운 잔영',50,229,279],[214371,'칸타빌레',156,167,323],[301380,'빛나는 잔영',300,115,415],[380235,'빛나는 잔영',300,233,533],[380346,'빛나는 잔영',150,533,683],[380520,'아스라한 잔영',100,683,783],[395658,'빛나는 잔영',300,56,356],[395757,'빛나는 잔영',150,356,506],[395862,'빛나는 잔영',150,506,656],[437802,'빛나는 잔영',300,376,676],[437901,'빛나는 잔영',150,676,826],[439938,'빛나는 잔영',150,79,229]]
const frame = (f: string) => Number(f.match(/_f(\d+)/)![1])
interface Case { file: string; kind: string; expect: { name?: string; price?: number; before?: number; after?: number; capacity?: number; floor?: number } }
const cases: Case[] = []
for (const f of readdirSync(root + '/sell').filter(f => f.endsWith('.png'))) {
  const n = frame(f), kind = f.match(/sell-(before|dialog|after)/)?.[1]
  if (!kind) continue
  // A "before" frame belongs to the next dialog, an "after" frame to the previous one, a dialog frame to itself.
  const row = kind === 'before' ? sellTable.find(r => r[0] >= n) : [...sellTable].reverse().find(r => r[0] <= n)
  if (!row || Math.abs(row[0] - n) > 200) continue
  cases.push({ file: 'sell/' + f, kind: 'sell-' + kind, expect: { name: row[1], price: row[2], before: row[3], after: row[4] } })
}
for (const dir of ['v0924', 'v0923']) for (const f of readdirSync(root + '/' + dir).filter(f => /confirm-(open|last)\.png$/.test(f)))
  cases.push({ file: dir + '/' + f, kind: 'fusion-dialog', expect: { capacity: 3 } })
for (const f of ['v0921_00m39.000s_f2340.png', 'v0923_00m17.400s_f1044.png', 'v0924_00m55.000s_f3300.png'])
  cases.push({ file: 'start/' + f, kind: 'theme-select', expect: { floor: 1 } })

async function main() {
  const only = process.env.BENCH_ONLY
  if (only) cases.splice(0, cases.length, ...cases.filter(c => c.kind.startsWith(only)))
const modes = { balanced: { detSide: 1280, grid: 1, tileScale: 1 }, quality: { detSide: 1280, grid: 2, tileScale: 1.5 } }
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--window-size=400,300'] })
const page = await browser.newPage()
await page.route('**/__bench/**', route => route.fulfill({ body: readFileSync(path.join(root, decodeURIComponent(new URL(route.request().url()).pathname.replace('/__bench/', '')))), contentType: 'image/png' }))
await page.goto(`${origin}/ko`, { waitUntil: 'domcontentloaded' })
const backend = await page.evaluate(() => new Promise((resolve, reject) => {
  const worker = new Worker('/models/assist-ocr/ocr-worker.js', { type: 'module' })
  window.__ocr = worker
  let ready = false, engine = null
  const timer = setTimeout(() => reject(new Error('init timeout ' + JSON.stringify({ ready, engine }))), 180000)
  worker.onmessage = e => {
    if (e.data.type === 'ready') ready = true
    if (e.data.type === 'backend' && !e.data.loading) engine = e.data
    if (ready && engine) { clearTimeout(timer); resolve(engine) }
  }
  worker.postMessage({ type: 'init', language: 'ko' })
}))
console.log('backend', JSON.stringify(backend))
const read = (file, mode) => page.evaluate(async ({ file, mode }) => {
  const blob = await (await fetch('/__bench/' + encodeURIComponent(file))).blob()
  const frame = await createImageBitmap(blob)
  const size = { width: frame.width, height: frame.height }
  const start = performance.now()
  return await new Promise(resolve => {
    const id = Math.floor(Math.random() * 1e9)
    window.__ocr.onmessage = e => { if (e.data.requestId === id) resolve({ ...e.data, ms: performance.now() - start, size }) }
    window.__ocr.postMessage({ type: 'recognize', requestId: id, frame, ...mode }, [frame])
  })
}, { file, mode })
await read(cases[0].file, modes.balanced); await read(cases[0].file, modes.quality)
const rows: Record<string, unknown>[] = []
for (const c of cases) for (const [name, mode] of Object.entries(modes)) {
  const r = await read(c.file, mode) as { text?: string; words?: { text: string; left: number; top: number; width: number; height: number }[];
    ms: number; size: { width: number; height: number }; type?: string }
  const text = r.text ?? '', words = r.words ?? []
  const scale = Math.min(1, 1920 / r.size.width)
  let ok = false
  let got: any = null
  const cost = () => sellCost(words, Math.round(r.size.width * scale), Math.round(r.size.height * scale))
  // A clipped first letter still names the gift when the rest matches (sellGiftId accepts a unique suffix).
  if (c.kind === 'sell-dialog') { got = sellDialog(text); ok = !!got && c.expect.name!.replace(/\s/g, '').endsWith(got.name) && got.price === c.expect.price }
  else if (c.kind === 'sell-before') { got = cost(); ok = costBeforeSale(got, c.expect.price!) === c.expect.before }
  // The app reads the cost only on the sell window; frames after leaving it are not scored.
  else if (c.kind === 'sell-after') { if (!isSellWindow(text)) continue; got = cost(); ok = got.join('').startsWith(String(c.expect.after)) }
  else if (c.kind === 'fusion-dialog') { got = fusionConfirmation(text); ok = !!got && got.capacity === 3 }
  else { got = themeSelectionHeaderFloor(text); ok = got === 1 }
  rows.push({ file: c.file, kind: c.kind, mode: name, ok, got, ms: Math.round(r.ms), lines: words.length, chars: text.replace(/\s/g, '').length, type: r.type,
    ...(c.kind.startsWith('sell') ? { text, words: words.map(w => ({ t: w.text, x: Math.round(w.left), y: Math.round(w.top), w: Math.round(w.width), h: Math.round(w.height) })) } : {}) })
  console.log(name.padEnd(8), ok ? 'OK  ' : 'MISS', c.kind.padEnd(13), Math.round(r.ms) + 'ms', JSON.stringify(got)?.slice(0, 80), c.file)
}
writeFileSync(path.join(root, '..', 'bench-ocr-modes.json'), JSON.stringify(rows, null, 1))
const summary: Record<string, { ok: number; n: number; ms: number; lines: number }> = {}
for (const r of rows) { const k = r.kind.replace(/-(before|after)$/, '-cost') + '|' + r.mode; summary[k] ??= { ok: 0, n: 0, ms: 0, lines: 0 }; const s = summary[k]; s.n++; s.ok += r.ok ? 1 : 0; s.ms += r.ms; s.lines += r.lines }
for (const [k, s] of Object.entries(summary)) console.log(k.padEnd(24), s.ok + '/' + s.n, 'avg', Math.round(s.ms / s.n) + 'ms', 'lines', (s.lines / s.n).toFixed(1))
await browser.close()
}
main().catch(error => { console.error(error); process.exitCode = 1 })
