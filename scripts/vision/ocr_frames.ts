// @ts-nocheck -- developer tool run with tsx; Playwright page callbacks are untyped.
/**
 * Reads image files with the shipped full-frame OCR (the app's worker, on WebGPU), for labelling frames by what their
 * screen says (scripts/vision/build_scene_dataset.py).
 * Usage: npx tsx scripts/vision/ocr_frames.ts <root dir> <list.json> <out.json>
 * list.json: file paths relative to the root. out.json: { <path>: { text, width, height } }; paths already in it are kept,
 * and it is saved every 200 frames, so an interrupted run continues.
 */
import { createReadStream, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { build } from 'esbuild'
import { chromium } from 'playwright'

const [root, listFile, outFile] = process.argv.slice(2)
const out = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {}
const todo = JSON.parse(readFileSync(listFile, 'utf8')).filter(file => !out[file])

async function main() {
  const bundle = await build({ entryPoints: [path.join(__dirname, 'replay-samples-page.ts')], bundle: true, write: false, format: 'esm', platform: 'browser' })
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.jpg': 'image/jpeg', '.onnx': 'application/octet-stream' }
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost')
    if (url.pathname === '/') { response.writeHead(200, { 'content-type': 'text/html' }); return response.end('<!doctype html><script type="module" src="/page.js"></script>') }
    if (url.pathname === '/page.js') { response.writeHead(200, { 'content-type': 'text/javascript' }); return response.end(bundle.outputFiles[0].text) }
    const file = url.pathname.startsWith('/frames/') ? path.join(root, decodeURIComponent(url.pathname.slice(8))) : path.join('public', decodeURIComponent(url.pathname))
    if (!existsSync(file)) { response.writeHead(404); return response.end() }
    response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(response)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--window-size=400,300'] })
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:' + server.address().port + '/')
  await page.waitForFunction(() => globalThis.replay)
  console.log('backends', JSON.stringify(await page.evaluate(() => globalThis.replay.init([], []))), '| to read', todo.length)
  for (const [index, file] of todo.entries()) {
    const screen = await page.evaluate(u => globalThis.replay.recognize(u), '/frames/' + file)
    out[file] = { text: screen.text, width: screen.width, height: screen.height }
    if (index % 200 === 199) { writeFileSync(outFile, JSON.stringify(out)); console.log(index + 1, '/', todo.length) }
  }
  writeFileSync(outFile, JSON.stringify(out))
  await browser.close()
  server.close()
}
main().catch(error => { console.error(error); process.exit(1) })
