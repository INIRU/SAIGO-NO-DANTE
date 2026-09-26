// @ts-nocheck -- developer tool run with tsx; Playwright page callbacks are untyped.
/**
 * Replays downloaded Assist recognition samples through the shipped popup pipeline: the app's 480 px popup detection,
 * the OCR and scene workers in local Chrome (WebGPU), and the app's popup verdict. Scores against hand labels.
 * Usage: npx tsx scripts/vision/replay_samples.ts <samples dir> <rows.json> <labels.json> <out.json>
 * Needs the built workers (npm run build:assist-worker && npm run build:assist-ocr) and .env.local for the gift catalog.
 */
import { createReadStream, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { acquiredGiftFromPopup, popupCandidateIds, popupHeaderEvidence, popupPurchaseHeader } from '../../lib/vision/popup-evidence'
import { effectGiftIds } from '../../lib/vision/ocr-match'
import { samePopupEpisode } from '../../lib/vision/popup-detect'
import { mkdirSync } from 'node:fs'

async function main() {
const [samplesDir, rowsFile, labelsFile, outFile] = process.argv.slice(2)
const rows = JSON.parse(readFileSync(rowsFile, 'utf8')).filter(row => row.reason === 'popup-unresolved')
const labels = existsSync(labelsFile) ? JSON.parse(readFileSync(labelsFile, 'utf8')) : {}
const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l))
  .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const { data: gifts, error } = await db.schema('limbus').from('ego_gifts').select('*')
if (error) throw error
const catalog = { gifts: gifts.map(gift => ({ id: String(gift.game_id), texts: [gift.name, gift.name_en, gift.name_jp].filter(Boolean),
  effectTexts: [gift.effect_base, gift.effect_base_en, gift.effect_base_jp, gift.effect_plus, gift.effect_plus_en, gift.effect_plus_jp,
    gift.effect_plusplus, gift.effect_plusplus_en, gift.effect_plusplus_jp].filter(Boolean) })), events: [], choices: [] }
// REPLAY_NO_TEMPLATES: icon templates never load (a first session or a slow network), leaving the embedding alone.
const giftReferences = gifts.map(gift => ({ id: String(gift.game_id), imageUrl: process.env.REPLAY_NO_TEMPLATES ? 'none:' + gift.game_id : gift.image_url }))

const bundle = await build({ entryPoints: [path.join(__dirname, 'replay-samples-page.ts')], bundle: true, write: false, format: 'esm', platform: 'browser' })
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--window-size=400,300'] })
const page = await browser.newPage()
// A plain local server: nested workers (Tesseract) load scripts that page routing does not reach.
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.jpg': 'image/jpeg' }
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost')
    if (url.pathname === '/') { response.writeHead(200, { 'content-type': 'text/html' }); return response.end('<!doctype html><script type="module" src="/page.js"></script>') }
    if (url.pathname === '/page.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); return response.end(bundle.outputFiles[0].text) }
    const file = url.pathname.startsWith('/frames/') ? path.join(samplesDir, decodeURIComponent(url.pathname.slice(8))) : path.join('public', decodeURIComponent(url.pathname))
    if (!existsSync(file)) { response.writeHead(404); return response.end() }
    response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(response)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  if (process.env.REPLAY_DEBUG) { page.on('requestfailed', r => console.log('failed', r.url())); page.on('response', r => { if (r.status() >= 400) console.log('status', r.status(), r.url()) }); page.on('console', m => console.log('console', m.text().slice(0, 300))) }
  await page.goto(origin + '/')
await page.waitForFunction(() => globalThis.replay)
const giftNames = gifts.filter(gift => gift.name).map(gift => ({ id: String(gift.game_id), name: gift.name }))
await page.evaluate(on => globalThis.replay.setGate(on), process.env.REPLAY_GATE !== '0')
const backends = await page.evaluate(([refs, names]) => globalThis.replay.init(refs, names), [giftReferences, giftNames])
console.log('backends', JSON.stringify(backends))

const results = []
for (const row of rows) {
  const frames = []
  for (let index = 0; index < row.frame_count; index++) {
    frames.push({ index, ...(await page.evaluate(url => globalThis.replay.frame(url), '/frames/' + row.path + '/' + index + '.jpg')) })
  }
  // Popups inside one sample are split like the app does: consecutive frames of one plate form an episode.
  // Kept frames are about 300 ms apart (only changed screens), so only a settled, near-identical plate continues.
  let episode = null
  for (const f of frames) {
    if (!f.label) { episode = null; continue }
    const observation = { ...f.observation, at: f.index * 300 }
    if (!episode || !samePopupEpisode(episode.last, observation)) results.push(episode = { path: row.path, scene: row.meta.scene?.label, uploaded: row.meta.candidates, frames: [] })
    episode.last = observation
    episode.frames.push(f)
  }
}
mkdirSync(path.join(path.dirname(outFile), 'crops'), { recursive: true })
const episodes = results.map((episode, index) => {
  const read = episode.frames.filter(f => f.read?.type === 'popupResult')
  const header = read.map(f => f.read.header).join('\n')
  const labelsRead = read.flatMap(f => f.read.labels)
  const icons = [...new Set(episode.frames.flatMap(f => f.icon?.gifts?.[0] ? [f.icon.gifts[0].id] : []))]
  const effects = [...new Set(read.flatMap(f => effectGiftIds(f.read.body, catalog)))]
  const verdict = icons.length > 1 ? null : acquiredGiftFromPopup({ header, labels: labelsRead, iconGiftId: icons[0] ?? null, effectGiftIds: effects, gifts: catalog.gifts })
  const candidates = popupCandidateIds({ header, labels: labelsRead, iconGiftIds: icons, effectGiftIds: effects, gifts: catalog.gifts })
  const best = episode.frames.reduce((a, b) => (b.quality > a.quality ? b : a))
  const key = episode.path.slice(11, 19) + '_' + best.index
  writeFileSync(path.join(path.dirname(outFile), 'crops', key + '.jpg'), Buffer.from(best.crop.split(',')[1], 'base64'))
  const acquired = popupHeaderEvidence(header)
  const out = { key, path: episode.path, scene: episode.scene, uploaded: episode.uploaded, frames: episode.frames.map(f => f.index), acquired,
    purchase: popupPurchaseHeader(header), headers: read.map(f => f.read.header).filter(Boolean).slice(0, 3), plateReads: labelsRead.map(l => l.text).slice(0, 6),
    icons, effects, verdict, candidates, truth: labels[key] ?? null,
    detail: episode.frames.map(f => ({ index: f.index, width: f.width, height: f.height, box: f.label, quality: f.quality, header: f.read?.header ?? null, icon: f.icon?.gifts?.[0]?.id ?? null, lexicon: f.read?.lexicon ?? null })) }
  console.log(key, out.scene, 'frames', out.frames.length, 'acq', acquired, 'verdict', verdict, 'icons', icons.join(','), 'plates', JSON.stringify(out.plateReads.slice(0, 3)), 'truth', out.truth)
  return out
})
writeFileSync(outFile, JSON.stringify({ backends, episodes }, null, 1))
await browser.close()
  server.close()
}

main().catch(error => { console.error(error); process.exit(1) })
