// @ts-nocheck -- developer tool run with tsx; Playwright page callbacks are untyped.
/**
 * Replays downloaded fusion samples (fusion-materials, fusion-dialogless) through the app's fusion reading: full-frame OCR
 * finds the confirmation dialog ("선택한 기프트 N/M") and the selection screen, the scene worker reads the dialog slots and
 * wheel positions (with the OCR anchors), and fusionMaterials combines them. A dialog is complete when every material is
 * known, which is what decides between a recorded fusion and an uploaded sample in the app.
 * Usage: npx tsx scripts/vision/replay_fusion_samples.ts <samples dir> <rows.json> <out.json>
 * REPLAY_CANDIDATES=vestiges sends only the vestiges as held gifts (sample inventories are unknown).
 * REPLAY_OCR_CACHE=<file.json> keeps full-frame OCR between runs (only the slot reads change between experiments).
 * Each dialog also reports `wheelOnly`: what the wheel states before it name on their own, as for a result whose dialog no
 * screen read caught; its complete dialog reads serve as the label. Results with no dialog in the sample are `noDialog`.
 */
import { createReadStream, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { fusionAnchors, fusionConfirmation, fusionMaterials, fusionWheelAnchors, isFusionSelectionScreen, showsFusionTitle, wheelSelectionSize } from '../../lib/vision/fusion-evidence'
import { AUTO_ACQUIRE_EXCLUDED_GIFT_IDS } from '../../lib/vision/popup-evidence'

const [samplesDir, rowsFile, outFile] = process.argv.slice(2)
const rows = JSON.parse(readFileSync(rowsFile, 'utf8')).filter(row => String(row.reason).startsWith('fusion'))
const candidates = process.env.REPLAY_CANDIDATES === 'vestiges' ? [...AUTO_ACQUIRE_EXCLUDED_GIFT_IDS] : undefined
const cacheFile = process.env.REPLAY_OCR_CACHE
const ocrCache = cacheFile && existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {}
const wheelOnlyMaterials = (reads, capacity) => { const count = wheelSelectionSize(reads) || capacity; const materials = fusionMaterials(reads, count, capacity); return { count, materials, complete: materials.length === count } }

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
  const noDialog = []
  const recognize = async url => ocrCache[url] ??= await page.evaluate(u => globalThis.replay.recognize(u), url)
  const wheelReads = async (frames, capacity) => {
    const reads = []
    for (const wheel of frames) {
      const slots = await page.evaluate(([u, request]) => globalThis.replay.fusion(u, request), [wheel.url,
        { type: 'fusion-wheel', requestId: 0, capacity, anchors: wheel.anchors ?? undefined, candidates }])
      reads.push({ view: 'wheel', slots, observedAt: wheel.index * 300 })
    }
    return reads
  }
  for (const row of rows) {
    let wheelFrames = [], current = null, lastCapacity = null, lastDialogIndex = -Infinity
    const close = () => { if (current) dialogs.push(current); current = null }
    for (let index = 0; index < row.frame_count; index++) {
      const url = '/frames/' + row.path + '/' + index + '.jpg'
      const screen = await recognize(url)
      const confirmation = fusionConfirmation(screen.text)
      if (confirmation) {
        lastCapacity = confirmation.capacity
        lastDialogIndex = index
        if (!current || current.count !== confirmation.count || current.capacity !== confirmation.capacity) {
          close()
          current = { path: row.path, key: row.path.slice(11, 19) + '_' + index, reason: row.reason, size: row.meta.width + 'x' + row.meta.height, ...confirmation, frames: [], reads: [] }
          // The wheel states captured before this dialog, newest last, as the app keeps them.
          current.reads.push(...await wheelReads(wheelFrames.slice(-12), confirmation.capacity))
          wheelFrames = []
        }
        const slots = await page.evaluate(([u, request]) => globalThis.replay.fusion(u, request), [url,
          { type: 'fusion-slots', requestId: 0, count: confirmation.count, capacity: confirmation.capacity, anchors: fusionAnchors(screen.words) ?? undefined, candidates }])
        current.frames.push(index)
        current.reads.push({ view: 'dialog', slots, observedAt: index * 300 })
      } else {
        close()
        if (isFusionSelectionScreen(screen.text)) wheelFrames.push({ url, index, anchors: fusionWheelAnchors(screen.words) })
        // As the app's dialogForResult: a result within 4 s of a seen dialog is that dialog's.
        else if (/획득했습니다/.test(screen.text.replace(/\s+/g, '')) && showsFusionTitle(screen.text) && wheelFrames.length && index - lastDialogIndex > 13) {
          // A result on the fusion screen with no dialog in the sample: the app's dialog-less path, wheel states of the last 3 s.
          const frames = wheelFrames.filter(wheel => index - wheel.index <= 10)
          let capacity = lastCapacity, reads
          if (capacity) reads = await wheelReads(frames, capacity)
          else {
            const three = await wheelReads(frames, 3), five = await wheelReads(frames, 5)
            const named = (r, size) => fusionMaterials(r, size, size).length
            ;[capacity, reads] = named(five, 5) > named(three, 3) ? [5, five] : [3, three]
          }
          noDialog.push({ key: row.path.slice(11, 19) + '_' + index, reason: row.reason, size: row.meta.width + 'x' + row.meta.height, capacity, frames: frames.map(f => f.index), ...wheelOnlyMaterials(reads, capacity) })
          wheelFrames = []
        }
      }
    }
    close()
  }
  if (cacheFile) writeFileSync(cacheFile, JSON.stringify(ocrCache))
  const out = dialogs.map(dialog => {
    const materials = fusionMaterials(dialog.reads, dialog.count, dialog.capacity)
    const wheel = dialog.reads.filter(read => read.view === 'wheel')
    const wheelOnly = wheel.length ? wheelOnlyMaterials(wheel, dialog.capacity) : null
    // Label from the dialog itself when it named every material: the wheel alone must name the same multiset.
    if (wheelOnly && materials.length === dialog.count) wheelOnly.agrees = [...wheelOnly.materials].sort().join() === [...materials].sort().join()
    const { reads, ...rest } = dialog
    const slotText = reads.filter(read => read.view === 'dialog').map(read => read.slots.map(slot => !slot ? '-' : slot.blank ? '_' : slot.id + ':' + slot.score.toFixed(2) + '/' + slot.margin.toFixed(2)).join(' '))
    console.log(rest.key, rest.size, rest.count + '/' + rest.capacity, 'materials', materials.join(','), materials.length === rest.count ? 'COMPLETE' : 'held',
      '| wheel-only', wheelOnly ? wheelOnly.materials.join(',') + ' ' + wheelOnly.count + (wheelOnly.complete ? ' COMPLETE' : ' held') + (wheelOnly.agrees === false ? ' DISAGREES' : '') : '-',
      '| dialog', slotText.slice(0, 2).join(' || '))
    return { ...rest, materials, complete: materials.length === dialog.count, wheelOnly, reads }
  })
  const complete = out.filter(item => item.complete).length
  for (const item of noDialog) console.log('no-dialog', item.key, item.size, 'capacity', item.capacity, 'count', item.count, 'materials', item.materials.join(','), item.complete ? 'COMPLETE' : 'held')
  const withWheel = out.filter(item => item.wheelOnly)
  console.log('dialogs', out.length, 'complete', complete, '| wheel-only', withWheel.filter(item => item.wheelOnly.complete).length, '/', withWheel.length,
    'disagree', withWheel.filter(item => item.wheelOnly.agrees === false).length, '| no-dialog results', noDialog.length, 'complete', noDialog.filter(item => item.complete).length)
  writeFileSync(outFile, JSON.stringify({ dialogs: out, noDialog }, null, 1))
  await browser.close()
  server.close()
}
main().catch(error => { console.error(error); process.exit(1) })
