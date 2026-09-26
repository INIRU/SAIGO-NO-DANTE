// @ts-nocheck -- developer tool run with tsx; Playwright page callbacks are untyped.
/**
 * Replays downloaded fusion samples (fusion-materials, fusion-dialogless) through the app's fusion reading: full-frame OCR
 * finds the confirmation dialog ("선택한 기프트 N/M") and the selection screen, the scene worker reads the dialog slots and
 * wheel positions (with the OCR anchors), and fusionMaterials combines them. A dialog is complete when every material is
 * known, which is what decides between a recorded fusion and an uploaded sample in the app.
 * Usage: npx tsx scripts/vision/replay_fusion_samples.ts <samples dir> <rows.json> <out.json>
 * REPLAY_CANDIDATES=vestiges sends only the vestiges as held gifts (sample inventories are unknown).
 */
import { createReadStream, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { fusionAnchors, fusionConfirmation, fusionMaterials, fusionWheelAnchors, isFusionSelectionScreen } from '../../lib/vision/fusion-evidence'
import { AUTO_ACQUIRE_EXCLUDED_GIFT_IDS } from '../../lib/vision/popup-evidence'

const [samplesDir, rowsFile, outFile] = process.argv.slice(2)
const rows = JSON.parse(readFileSync(rowsFile, 'utf8')).filter(row => String(row.reason).startsWith('fusion'))
const candidates = process.env.REPLAY_CANDIDATES === 'vestiges' ? [...AUTO_ACQUIRE_EXCLUDED_GIFT_IDS] : undefined

async function main() {
  const bundle = await build({ entryPoints: [path.join(__dirname, 'replay-samples-page.ts')], bundle: true, write: false, format: 'esm', platform: 'browser' })
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.jpg': 'image/jpeg', '.onnx': 'application/octet-stream' }
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
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--window-size=400,300'] })
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:' + server.address().port + '/')
  await page.waitForFunction(() => globalThis.replay)
  // Icon templates come from the gift catalog in storage, as in the app.
  const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]))
  const { createClient } = await import('@supabase/supabase-js')
  const { data: gifts, error } = await createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).schema('limbus').from('ego_gifts').select('game_id,image_url')
  if (error) throw error
  console.log('backends', JSON.stringify(await page.evaluate(refs => globalThis.replay.init(refs, []), gifts.map(g => ({ id: String(g.game_id), imageUrl: g.image_url })))))

  const dialogs = []
  for (const row of rows) {
    let wheelFrames = [], current = null
    const close = () => { if (current) dialogs.push(current); current = null }
    for (let index = 0; index < row.frame_count; index++) {
      const url = '/frames/' + row.path + '/' + index + '.jpg'
      const screen = await page.evaluate(u => globalThis.replay.recognize(u), url)
      const confirmation = fusionConfirmation(screen.text)
      if (confirmation) {
        if (!current || current.count !== confirmation.count || current.capacity !== confirmation.capacity) {
          close()
          current = { path: row.path, key: row.path.slice(11, 19) + '_' + index, reason: row.reason, size: row.meta.width + 'x' + row.meta.height, ...confirmation, frames: [], reads: [] }
          // The wheel states captured before this dialog, newest last, as the app keeps them.
          for (const wheel of wheelFrames.slice(-12)) {
            const slots = await page.evaluate(([u, request]) => globalThis.replay.fusion(u, request), [wheel.url,
              { type: 'fusion-wheel', requestId: 0, capacity: confirmation.capacity, anchors: wheel.anchors ?? undefined, candidates }])
            current.reads.push({ view: 'wheel', slots, observedAt: wheel.index * 300 })
          }
          wheelFrames = []
        }
        const slots = await page.evaluate(([u, request]) => globalThis.replay.fusion(u, request), [url,
          { type: 'fusion-slots', requestId: 0, count: confirmation.count, capacity: confirmation.capacity, anchors: fusionAnchors(screen.words) ?? undefined, candidates }])
        current.frames.push(index)
        current.reads.push({ view: 'dialog', slots, observedAt: index * 300 })
      } else {
        close()
        if (isFusionSelectionScreen(screen.text)) wheelFrames.push({ url, index, anchors: fusionWheelAnchors(screen.words) })
      }
    }
    close()
  }
  const out = dialogs.map(dialog => {
    const materials = fusionMaterials(dialog.reads, dialog.count, dialog.capacity)
    const { reads, ...rest } = dialog
    const slotText = reads.filter(read => read.view === 'dialog').map(read => read.slots.map(slot => !slot ? '-' : slot.blank ? '_' : slot.id + ':' + slot.score.toFixed(2) + '/' + slot.margin.toFixed(2)).join(' '))
    console.log(rest.key, rest.size, rest.count + '/' + rest.capacity, 'materials', materials.join(','), materials.length === rest.count ? 'COMPLETE' : 'held', '| dialog', slotText.slice(0, 2).join(' || '))
    return { ...rest, materials, complete: materials.length === dialog.count, reads }
  })
  const complete = out.filter(item => item.complete).length
  console.log('dialogs', out.length, 'complete', complete)
  writeFileSync(outFile, JSON.stringify(out, null, 1))
  await browser.close()
  server.close()
}
main().catch(error => { console.error(error); process.exit(1) })
