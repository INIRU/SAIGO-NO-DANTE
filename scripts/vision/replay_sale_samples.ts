// @ts-nocheck -- developer tool run with tsx; Playwright page callbacks are untyped.
/**
 * Replays downloaded sale samples (sale-unresolved) through the app's sale reading: the shipped full-frame OCR on every
 * frame, then sellCost and readSaleStep (features/assist/lib/sell-evidence.ts) in frame order, as useAssistCapture does. A sample
 * is `sold` when a sale is recorded, which in the app means it would not have been uploaded.
 * Usage: npx tsx scripts/vision/replay_sale_samples.ts <samples dir> <out.json>   (samples dir from pull_samples.ts)
 * REPLAY_OCR_CACHE=<file.json> keeps the OCR between runs, so a change to the sale rules replays in seconds.
 */
import { createReadStream, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { EMPTY_SALE_STATE, readSaleStep, sellCost, sellDialog, sellGiftId, sellQuestion } from '../../features/assist/lib/sell-evidence'

const [samplesDir, outFile] = process.argv.slice(2)
const rows = JSON.parse(readFileSync(path.join(samplesDir, 'rows.json'), 'utf8')).filter(row => String(row.reason).startsWith('sale'))
const cacheFile = process.env.REPLAY_OCR_CACHE
const ocrCache = cacheFile && existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {}

async function main() {
  const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]))
  const { createClient } = await import('@supabase/supabase-js')
  const { data: catalog, error } = await createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).schema('limbus')
    .from('ego_gifts').select('game_id,name,name_en,name_jp,image_url')
  if (error) throw error
  // Names as the app's OCR references carry them: every language the gift has.
  const gifts = catalog.map(g => ({ id: String(g.game_id), texts: [g.name, g.name_en, g.name_jp].filter(Boolean) }))

  const uncached = rows.some(row => Array.from({ length: row.frame_count }, (_, index) => '/frames/' + row.path + '/' + index + '.jpg').some(url => !ocrCache[url]))
  let browser, server, page
  if (uncached) {
    const bundle = await build({ entryPoints: [path.join(__dirname, 'replay-samples-page.ts')], bundle: true, write: false, format: 'esm', platform: 'browser' })
    const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.jpg': 'image/jpeg', '.onnx': 'application/octet-stream' }
    server = createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost')
      if (url.pathname === '/') { response.writeHead(200, { 'content-type': 'text/html' }); return response.end('<!doctype html><script type="module" src="/page.js"></script>') }
      if (url.pathname === '/page.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); return response.end(bundle.outputFiles[0].text) }
      const file = url.pathname.startsWith('/frames/') ? path.join(samplesDir, decodeURIComponent(url.pathname.slice(8))) : path.join('public', decodeURIComponent(url.pathname))
      if (!existsSync(file)) { response.writeHead(404); return response.end() }
      response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' })
      createReadStream(file).pipe(response)
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--window-size=400,300'] })
    page = await browser.newPage()
    await page.goto('http://127.0.0.1:' + server.address().port + '/')
    await page.waitForFunction(() => globalThis.replay)
    console.log('backends', JSON.stringify(await page.evaluate(refs => globalThis.replay.init(refs, []), catalog.map(g => ({ id: String(g.game_id), imageUrl: g.image_url })))))
  }
  const recognize = async url => ocrCache[url] ??= await page.evaluate(u => globalThis.replay.recognize(u), url)

  const out = []
  for (const row of rows) {
    let state = EMPTY_SALE_STATE
    const item = { key: row.path.slice(11, 19), size: row.meta.width + 'x' + row.meta.height, frames: row.frame_count, questionFrames: 0, dialog: null, giftId: null, cost: [], sold: [] }
    for (let index = 0; index < row.frame_count; index++) {
      const screen = await recognize('/frames/' + row.path + '/' + index + '.jpg')
      const cost = sellCost(screen.words, screen.width, screen.height)
      if (sellQuestion(screen.text)) {
        item.questionFrames++
        item.dialog ??= sellDialog(screen.text)
        if (item.dialog) item.giftId ??= sellGiftId(item.dialog.name, gifts)
        if (cost.length) item.cost = cost
      }
      // Sample frames are kept about 300 ms apart.
      const step = readSaleStep(state, { at: index * 300, text: screen.text, cost, giftId: name => sellGiftId(name, gifts) })
      state = step.state
      item.sold.push(...step.sold.map(sale => sale.giftId + '@' + sale.price))
    }
    console.log(item.key, item.size.padEnd(9), 'question frames', item.questionFrames, '| dialog', item.dialog ? item.dialog.name + ' ' + item.dialog.price : '-',
      '| gift', item.giftId ?? '-', '| cost', item.cost.join('>') || '-', '|', item.sold.length ? 'SOLD ' + item.sold.join(',') : 'held')
    out.push(item)
  }
  if (cacheFile) writeFileSync(cacheFile, JSON.stringify(ocrCache))
  const withDialog = out.filter(item => item.questionFrames)
  console.log('samples', out.length, '| with the dialog in a frame', withDialog.length, '| sold', out.filter(item => item.sold.length).length,
    '| dialog seen but held', withDialog.filter(item => !item.sold.length).length)
  writeFileSync(outFile, JSON.stringify(out, null, 1))
  await browser?.close()
  server?.close()
}
main().catch(error => { console.error(error); process.exit(1) })
