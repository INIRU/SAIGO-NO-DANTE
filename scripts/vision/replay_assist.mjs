#!/usr/bin/env node
/**
 * Assist Mode replay harness: plays a segment of a screen recording into the real /{lang}/planner/run page as its
 * screen share and records what Assist concluded (inventory changes, fusion evidence, popup acquisitions, toasts).
 *
 *   node scripts/vision/replay_assist.mjs --case truth.json#caseId --mode balanced --out dir [--base http://localhost:3300]
 *   node scripts/vision/replay_assist.mjs --dump-catalog out.json [--base ...]
 *
 * truth.json: { cases: [{ id, video, start, end, seed: [giftId], fusions: [{ n, confirm: [s, e], popups: [[s, e]],
 *   materials: [giftId], results: [giftId] }] }] }. Times are seconds in the video. No app code is changed: the page's
 * getDisplayMedia returns a captureStream() of a hidden <video>, the run starts from a seeded md-run-draft, and results
 * are read from localStorage and CompanionPanel props (React fiber, read-only).
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const argv = process.argv.slice(2)
const arg = (name, fallback) => { const i = argv.indexOf('--' + name); return i < 0 ? fallback : argv[i + 1] }
const flag = name => argv.includes('--' + name)
const base = arg('base', 'http://localhost:3300'), lang = arg('lang', 'ko'), mode = arg('mode', 'balanced')
const headed = !flag('headless'), tailSec = Number(arg('tail', 8)), readyTimeout = Number(arg('ready-timeout', 180))
/** --mask x,y,w,h[;x,y,w,h]: rectangles blacked out in every frame (video pixels). */
const mask = arg('mask') ? arg('mask').split(';').map(part => part.split(',').map(Number)) : null
/**
 * --recolor black: approximate the game's black UI theme (no real footage exists). Warm, low-chroma pixels (the brown
 * panels, frames and title plates) become grey: dark and mid tones are darkened toward black, light tones (text) keep
 * their lightness. Strong colors (grade plates, hazard stripes, orange highlights) stay. Gift artwork is not themed in
 * the game, so the icon squares of the fusion wheel, dialog and result popup (RECOLOR_KEEP, 1920×1080 units) are left
 * as they are; icons elsewhere (owned list) lose some browns.
 */
const recolor = arg('recolor', null)
/** --scene-miss: every 'fusion' scene prediction reaches the app as 'enhance', as if the classifier failed on an unseen UI theme. */
const sceneMiss = flag('scene-miss')
/** --detect gifts[,events,themes]: only these detection kinds are on (default: all). */
const detect = arg('detect', null)
const RECOLOR_KEEP = [
  ...[[544, 308], [337, 515], [751, 515], [554, 316], [357, 388], [746, 388], [357, 543], [746, 543]].map(([x, y]) => [x - 50, y - 50, 100, 100]),
  ...[373, 697, 1021].map(x => [x - 90, 368, 180, 180]), ...[296, 490, 686, 880, 1074].map(x => [x - 50, 414, 100, 100]),
  [520, 345, 195, 195],
]
const tag = arg('tag', '')

/** Serves one file with HTTP Range support (Chrome seeks inside large MP4s this way). */
function serveFile(file) {
  const server = http.createServer((req, res) => {
    const size = fs.statSync(file).size
    const headers = { 'Access-Control-Allow-Origin': '*', 'Accept-Ranges': 'bytes', 'Content-Type': 'video/mp4' }
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
    if (!range) { res.writeHead(200, { ...headers, 'Content-Length': size }); if (req.method === 'HEAD') return res.end(); return fs.createReadStream(file).pipe(res) }
    const start = range[1] ? Number(range[1]) : size - Number(range[2])
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': 'bytes ' + start + '-' + end + '/' + size })
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(file, { start, end }).pipe(res).on('error', () => res.destroy())
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, url: 'http://127.0.0.1:' + server.address().port + '/clip.mp4' })))
}

/** Runs in the page before any app script. */
function pageInit(cfg) {
  if (!sessionStorage.getItem('__replaySeeded')) {
    sessionStorage.setItem('__replaySeeded', '1')
    localStorage.setItem('md-run-draft', JSON.stringify({ state: cfg.runState, version: 0 }))
    localStorage.setItem('limbus-assist-recognition-mode', cfg.mode)
    if (cfg.detect) localStorage.setItem('limbus-assist-detection', JSON.stringify(Object.fromEntries(['gifts', 'themes', 'events'].map(kind => [kind, cfg.detect.split(',').includes(kind)]))))
    else localStorage.removeItem('limbus-assist-detection')
  }
  const R = window.__replay = { log: [], clock: [], worker: [], video: null, ready: { scene: false, ocr: {} } }
  const vt = () => R.video ? R.video.currentTime : null
  const push = (kind, data) => R.log.push({ kind, at: Date.now(), vt: vt(), ...data })
  // Wall clock -> video time samples, for capture timestamps (Date.now() in the hook).
  setInterval(() => { if (R.video && !R.video.paused) R.clock.push([Date.now(), R.video.currentTime]) }, 50)
  navigator.mediaDevices.getDisplayMedia = async () => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'; video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = cfg.videoUrl
    video.style.cssText = 'position:fixed;right:0;bottom:0;width:192px;height:108px;z-index:2147483647;pointer-events:none'
    document.body.appendChild(video)
    await new Promise((ok, fail) => { video.onloadedmetadata = ok; video.onerror = () => fail(new Error('video load failed')) })
    video.currentTime = cfg.warmupStart
    await new Promise(ok => { video.onseeked = ok })
    await video.play()
    R.video = video
    // Warm-up loops on the seconds before the segment until the harness starts the segment.
    video.addEventListener('timeupdate', () => { if (!R.started && video.currentTime > cfg.start - 0.2) video.currentTime = cfg.warmupStart })
    push('stream', {})
    if (cfg.recolor === 'black') {
      // Per-frame shader over the whole frame; mask rectangles are painted black afterwards in the same pass.
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true })
      const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s }
      const program = gl.createProgram()
      gl.attachShader(program, shader(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p; out vec2 uv; void main(){ uv = vec2((p.x+1.)/2., (1.-p.y)/2.); gl_Position = vec4(p,0.,1.); }'))
      gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; in vec2 uv; out vec4 o; uniform sampler2D t; uniform vec4 masks[4]; uniform int maskCount; uniform vec2 size; uniform vec4 keep[17];
void main(){
  vec3 c = texture(t, uv).rgb;
  vec2 px = uv * size;
  for (int i = 0; i < 4; i++) if (i < maskCount && px.x >= masks[i].x && px.y >= masks[i].y && px.x < masks[i].x + masks[i].z && px.y < masks[i].y + masks[i].w) { o = vec4(0.,0.,0.,1.); return; }
  vec2 unit = px * 1920.0 / size.x;
  for (int i = 0; i < 17; i++) if (unit.x >= keep[i].x && unit.y >= keep[i].y && unit.x < keep[i].x + keep[i].z && unit.y < keep[i].y + keep[i].w) { o = vec4(c, 1.); return; }
  float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  // Warm hue: red >= green >= blue (browns, tans, beige, dull gold).
  float warm = step(c.b, c.g) * step(c.g, c.r + 0.02);
  float chrome = warm * (1.0 - smoothstep(0.25, 0.35, chroma)) * smoothstep(0.015, 0.04, chroma);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // Dark/mid tones to near black, light tones (text) keep their lightness.
  float g = mix(l * 0.35, l, smoothstep(0.45, 0.7, l));
  o = vec4(mix(c, vec3(g), chrome), 1.0);
}`))
      gl.bindAttribLocation(program, 0, 'p'); gl.linkProgram(program); gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
      for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, key, value)
      const rects = (cfg.mask ?? []).slice(0, 4)
      gl.uniform4fv(gl.getUniformLocation(program, 'masks'), new Float32Array([...rects.flat(), ...Array(16 - rects.length * 4).fill(0)]))
      gl.uniform1i(gl.getUniformLocation(program, 'maskCount'), rects.length)
      gl.uniform2f(gl.getUniformLocation(program, 'size'), canvas.width, canvas.height)
      gl.uniform4fv(gl.getUniformLocation(program, 'keep'), new Float32Array(cfg.recolorKeep.flat()))
      gl.viewport(0, 0, canvas.width, canvas.height)
      const draw = () => { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); video.requestVideoFrameCallback(draw) }
      video.requestVideoFrameCallback(draw)
      R.recolorCanvas = canvas
      return canvas.captureStream(60)
    }
    if (!cfg.mask) return video.captureStream()
    // Masked replay: every frame is drawn to a canvas with the given rectangles painted black (e.g. a recorded PiP window).
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    const draw = () => { context.drawImage(video, 0, 0); context.fillStyle = '#000'; for (const [x, y, w, h] of cfg.mask) context.fillRect(x, y, w, h); video.requestVideoFrameCallback(draw) }
    video.requestVideoFrameCallback(draw)
    return canvas.captureStream(60)
  }
  // Worker traffic, summarized: which reads were requested and what came back.
  const NativeWorker = window.Worker
  window.Worker = function (url, options) {
    const worker = new NativeWorker(url, options)
    const name = String(url).includes('ocr') ? 'ocr' : 'scene'
    if (cfg.sceneMiss && name === 'scene') {
      let handler = null
      Object.defineProperty(worker, 'onmessage', { get: () => handler, set: value => { handler = value } })
      worker.addEventListener('message', event => {
        const data = event.data?.type === 'prediction' && event.data.label === 'fusion' ? { ...event.data, label: 'enhance' } : event.data
        handler?.call(worker, data === event.data ? event : new MessageEvent('message', { data }))
      })
    }
    const id = name + ':' + Math.random().toString(36).slice(2, 6)
    const send = worker.postMessage.bind(worker)
    const frames = new Map()
    const requestTypes = new Map()
    worker.postMessage = (message, transfer) => {
      if (message && message.type === 'recognize' && message.frame) frames.set(message.requestId, { width: message.frame.width, height: message.frame.height })
      if (message && (message.type === 'fusion-slots' || message.type === 'fusion-wheel')) requestTypes.set(message.requestId, message.type)
      if (message && message.type && message.type !== 'infer') R.worker.push({ dir: 'out', w: id, type: message.type, rid: message.requestId,
        mode: message.mode, count: message.count, capacity: message.capacity, at: Date.now(), vt: vt() })
      else if (message && message.type === 'infer') R.worker.push({ dir: 'out', w: id, type: 'infer', at: Date.now(), vt: vt() })
      return send(message, transfer)
    }
    worker.addEventListener('message', event => {
      const m = event.data || {}
      const row = { dir: 'in', w: id, type: m.type, rid: m.requestId, at: Date.now(), vt: vt() }
      if (m.type === 'ready' && name === 'scene') R.ready.scene = true
      if (m.type === 'backend') { R.ready.ocr[id] = !m.loading; row.engine = m.engine; row.loading = m.loading; row.reason = m.reason }
      if (m.type === 'ready' && name === 'ocr') R.ready.ocr[id] = R.ready.ocr[id] ?? false
      if (m.type === 'prediction') { row.label = m.label; row.conf = Math.round(m.confidence * 100) / 100 }
      if (m.type === 'result') {
        const text = String(m.text || '').replace(/\s+/g, ' ')
        row.text = /판매|조합|합성|획득/.test(text) ? text.slice(0, 1200) : text.slice(0, 200)
        const frame = frames.get(m.requestId); frames.delete(m.requestId)
        if (frame && /판매/.test(text)) {
          row.frame = frame
          // Every word with a digit and its box on the reading canvas, to see what the cost region (sellCost) receives.
          row.digitWords = (m.words || []).filter(w => /\d/.test(w.text)).map(w => [w.text, Math.round(w.left), Math.round(w.top), Math.round(w.width), Math.round(w.height)])
        }
      }
      if (m.type === 'popupResult') { row.header = m.header; row.label = m.label }
      if (m.type === 'popup-icon') row.gifts = (m.gifts || []).slice(0, 3).map(g => g.id + ':' + g.score.toFixed(2))
      if (m.type === 'fusion-slots') {
        row.view = requestTypes.get(m.requestId) === 'fusion-wheel' ? 'wheel' : 'dialog'; requestTypes.delete(m.requestId)
        row.slots = (m.slots || []).map(s => !s ? null : s.blank ? 'blank' : s.id + ':' + s.score.toFixed(2) + '/' + s.margin.toFixed(2))
      }
      if (m.type === 'error' || m.type === 'popupError') row.message = m.message
      R.worker.push(row)
    })
    return worker
  }
  window.Worker.prototype = NativeWorker.prototype
  // Run inventory, CompanionPanel evidence props and toasts, polled.
  let lastInventory = null
  let lastCapture = null
  const seen = new Set()
  const panelProps = () => {
    const button = document.querySelector('[data-pip-mode]')
    const key = button && Object.keys(button).find(k => k.startsWith('__reactFiber$'))
    for (let fiber = key ? button[key] : null; fiber; fiber = fiber.return) if (fiber.memoizedProps && 'fusionEvidence' in fiber.memoizedProps) return fiber.memoizedProps
    return null
  }
  R.panelProps = panelProps
  setInterval(() => {
    const captureState = document.querySelector('[data-capture-state]')?.getAttribute('data-capture-state') ?? null
    if (captureState !== lastCapture) { push('captureState', { state: captureState }); lastCapture = captureState }
    try {
      const inventory = JSON.parse(localStorage.getItem('md-run-draft') || '{}').state?.giftInventory ?? []
      const text = JSON.stringify(inventory)
      if (text !== lastInventory) { if (lastInventory !== null) push('inventory', { inventory }); else R.initialInventory = inventory; lastInventory = text }
    } catch {}
    const props = panelProps()
    for (const item of props?.fusionEvidence ?? []) {
      const key = 'fusion:' + item.token + ':' + item.materials.join(',') + ':' + (item.closedAt ?? '')
      if (!seen.has(key)) { seen.add(key); push('fusionEvidence', { token: item.token, materials: item.materials, observedAt: item.observedAt, lastSeenAt: item.lastSeenAt, closedAt: item.closedAt }) }
    }
    for (const item of props?.popupAcquisitions ?? []) {
      if (!seen.has('popup:' + item.token)) { seen.add('popup:' + item.token); push('popupAcquisition', { token: item.token, giftId: item.giftId, capturedAt: item.capturedAt, observedAt: item.observedAt, episode: item.episode }) }
    }
    for (const item of props?.giftSales ?? []) {
      if (!seen.has('sale:' + item.token)) { seen.add('sale:' + item.token); push('giftSale', { ...item }) }
    }
    for (const toast of document.querySelectorAll('[data-sonner-toast]')) {
      const text = toast.textContent.trim()
      if (!toast.__replaySeen) { toast.__replaySeen = true; push('toast', { text }) }
    }
  }, 50)
}

/** Video time for a wall-clock timestamp from the clock samples (latest sample at or before it). */
function toVideoTime(clock, at) {
  if (at === undefined || at === null) return null
  let best = null
  for (const sample of clock) { if (sample[0] <= at) best = sample; else break }
  best ??= clock[0]
  return best ? Math.round((best[1] + (at - best[0]) / 1000) * 1000) / 1000 : null
}

function multisetDiff(before, after) {
  const left = [...after], removed = []
  for (const id of before) { const i = left.indexOf(id); if (i >= 0) left.splice(i, 1); else removed.push(id) }
  return { added: left, removed }
}

/** Vestiges: never tracked automatically (AUTO_ACQUIRE_EXCLUDED_GIFT_IDS), so they are not expected to leave the run. */
const UNTRACKED = new Set(['9991', '9992', '9993', '9994', '9995'])

/** Matches recorded inventory changes to the ground-truth fusions (greedy, in fusion order). */
export function evaluate(truth, record) {
  const changes = []
  let previous = record.initialInventory
  // Changes while the warm-up loop (seconds before the segment) played are real screen events outside the scored segment:
  // they move the baseline and are listed separately.
  const warmupChanges = []
  // A popup captured before the segment started (warm-up) may still be applied just after it started.
  const warmupGifts = new Set(record.log.filter(row => row.kind === 'popupAcquisition' && record.startedAt !== undefined && row.capturedAt < record.startedAt).map(row => row.giftId))
  for (const row of record.log.filter(item => item.kind === 'inventory')) {
    const { added, removed } = multisetDiff(previous, row.inventory)
    const early = record.startedAt !== undefined && row.at < record.startedAt + 4000 && !removed.length && added.length && added.every(id => warmupGifts.has(id))
    if (record.startedAt === undefined || row.at < record.startedAt || early) warmupChanges.push({ vt: row.vt, added, removed })
    else changes.push({ vt: row.vt, at: row.at, added: [...added], removed: [...removed], claimed: { added: [], removed: [] } })
    previous = row.inventory
  }
  const claim = (id, kind, from) => {
    for (const change of changes) {
      if (change.vt < from) continue
      const pool = change[kind], i = pool.indexOf(id)
      if (i >= 0) { pool.splice(i, 1); change.claimed[kind].push(id); return change }
    }
    return null
  }
  const fusions = (truth.fusions ?? []).map(fusion => {
    const from = fusion.confirm[0] - 1.5
    const results = fusion.results.map(id => ({ id, change: claim(id, 'added', from) }))
    const materials = fusion.materials.filter(id => !UNTRACKED.has(id)).map(id => ({ id, change: claim(id, 'removed', from) }))
    const popupStart = fusion.popups?.[0]?.[0] ?? fusion.confirm[1]
    const firstResult = results.find(item => item.change)
    return { n: fusion.n, note: fusion.note, capacity: fusion.capacity, dialogMaterials: fusion.materials,
      expectedMaterials: materials.map(item => item.id), expectedResults: fusion.results,
      removed: materials.filter(item => item.change).map(item => item.id), missedMaterials: materials.filter(item => !item.change).map(item => item.id),
      added: results.filter(item => item.change).map(item => item.id), missedResults: results.filter(item => !item.change).map(item => item.id),
      resultLatency: firstResult ? Math.round((firstResult.change.vt - popupStart) * 1000) / 1000 : null,
      materialLatency: materials.some(item => item.change) ? Math.round((Math.max(...materials.filter(item => item.change).map(item => item.change.vt)) - popupStart) * 1000) / 1000 : null,
      sameStep: !!firstResult && materials.every(item => item.change === firstResult.change) }
  })
  // A sale removes one copy of the sold gift within SALE_WINDOW s after its confirmation dialog.
  const SALE_WINDOW = 10
  const saleList = truth.sales ?? []
  // Each sale evidence belongs to the nearest listed sale of that gift (its capture time is the dialog frame).
  const evidenceFor = new Map()
  for (const row of record.log.filter(item => item.kind === 'giftSale')) {
    const at = row.capturedAtVt ?? row.vt
    const nearest = saleList.map((sale, index) => ({ index, gap: sale.giftId === row.giftId ? Math.abs(at - sale.t) : Infinity }))
      .sort((first, second) => first.gap - second.gap)[0]
    if (nearest && nearest.gap < 1.5 && !evidenceFor.has(nearest.index)) evidenceFor.set(nearest.index, row)
  }
  const sales = saleList.map((sale, index) => {
    // Matched through the app's own sale evidence: its capture time is the dialog frame, so it names the sale it belongs to.
    const evidence = evidenceFor.get(index)
    const change = evidence && changes.find(item => item.at >= evidence.at - 100 && item.vt <= sale.t + SALE_WINDOW && item.removed.includes(sale.giftId))
    if (change) { change.removed.splice(change.removed.indexOf(sale.giftId), 1); change.claimed.removed.push(sale.giftId) }
    // A cancelled sale dialog (cost unchanged afterwards) must not remove anything.
    return { t: sale.t, giftId: sale.giftId, name: sale.name, price: sale.price, costBefore: sale.costBefore, cancelled: !!sale.cancelled,
      recorded: !!change, correct: sale.cancelled ? !change : !!change,
      latency: change ? Math.round((change.vt - sale.t) * 1000) / 1000 : null, evidenceCapturedAtVt: evidence?.capturedAtVt ?? null }
  })
  // Plain acquisitions shown on screen in the segment (e.g. shop purchases), expected to be added.
  const acquisitions = (truth.acquisitions ?? []).map(item => {
    const change = changes.find(entry => entry.vt >= item.t - 0.5 && entry.vt <= item.t + 8 && entry.added.includes(item.giftId))
    if (change) { change.added.splice(change.added.indexOf(item.giftId), 1); change.claimed.added.push(item.giftId) }
    return { t: item.t, giftId: item.giftId, name: item.name, recorded: !!change, latency: change ? Math.round((change.vt - item.t) * 1000) / 1000 : null }
  })
  const unexplained = changes.filter(change => change.added.length || change.removed.length)
    .map(change => ({ vt: change.vt, added: change.added, removed: change.removed }))
  const expectedFinal = [...truth.seed]
  for (const change of warmupChanges) { for (const id of change.removed) { const i = expectedFinal.indexOf(id); if (i >= 0) expectedFinal.splice(i, 1) } expectedFinal.push(...change.added) }
  for (const fusion of truth.fusions ?? []) {
    for (const id of fusion.materials) { const i = expectedFinal.indexOf(id); if (i >= 0) expectedFinal.splice(i, 1) }
    for (const id of fusion.results) if (!expectedFinal.includes(id)) expectedFinal.push(id)
  }
  for (const sale of (truth.sales ?? []).filter(item => !item.cancelled)) { const i = expectedFinal.indexOf(sale.giftId); if (i >= 0) expectedFinal.splice(i, 1) }
  for (const item of truth.acquisitions ?? []) expectedFinal.push(item.giftId)
  const finalInventory = record.log.filter(item => item.kind === 'inventory').at(-1)?.inventory ?? record.initialInventory
  const finalDiff = multisetDiff(expectedFinal, finalInventory)
  const total = (key) => fusions.reduce((sum, item) => sum + item[key].length, 0)
  return { fusions, sales, acquisitions, unexplained, warmupChanges, finalInventoryMatches: !finalDiff.added.length && !finalDiff.removed.length,
    finalExtra: finalDiff.added, finalMissing: finalDiff.removed,
    totals: { fusions: fusions.length, fullyCorrect: fusions.filter(f => !f.missedMaterials.length && !f.missedResults.length).length,
      materials: total('expectedMaterials'), materialsRemoved: total('removed'), results: total('expectedResults'), resultsAdded: total('added'),
      sales: sales.filter(sale => !sale.cancelled).length, salesRecorded: sales.filter(sale => !sale.cancelled && sale.recorded).length,
      cancelledSales: sales.filter(sale => sale.cancelled).length, cancelledWronglyRemoved: sales.filter(sale => sale.cancelled && sale.recorded).length,
      wrongChanges: unexplained.reduce((sum, item) => sum + item.added.length + item.removed.length, 0) } }
}

/** Short hashes of the app files the replay exercises (other people edit them while replays run). */
function appFileHashes() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  return Object.fromEntries(['lib/hooks/useAssistCapture.ts', 'lib/vision/fusion-evidence.ts', 'lib/vision/sell-evidence.ts', 'components/planner/run/CompanionPanel.tsx',
    'public/models/assist-scene/scene-worker.js', 'public/models/assist-ocr/ocr-worker.js'].map(file => {
    try { return [file, crypto.createHash('sha1').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 10)] } catch { return [file, null] }
  }))
}

function runState(seed, floor) {
  const logs = Array.from({ length: 15 }, (_, i) => ({ floor: i + 1, difficulty: 'hard', themeId: null, acquiredGifts: [], removedGifts: [],
    deckChanges: [], selectedEventOptions: [], memo: '', completedAt: null }))
  return { phase: 'playing', difficulty: 'hard', startFloor: 1, maxFloors: 15, currentFloor: floor, activeSubTab: 'deck', identitySlots: [], egoSlots: [],
    skillArrangements: {}, floorLogs: logs, giftInventory: seed.map(String), sourcePlanEncoded: null, sourcePlanSnapshot: null, targetGifts: [] }
}

async function openPage(browser, cfg) {
  // bypassCSP: the site's media-src 'self' would block the local clip server; recognition itself is unaffected.
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, bypassCSP: true })
  // Other people edit the app while replays run: a dev-server hot update would remount the page and stop capture. The
  // dev client needs the socket to hydrate, so server messages pass until the replay freezes updates (hmr.frozen).
  const hmr = { frozen: false }
  await context.routeWebSocket(/_next\/webpack-hmr|turbopack-hmr/, ws => {
    const server = ws.connectToServer()
    server.onMessage(message => { if (!hmr.frozen) ws.send(message) })
    ws.onMessage(message => server.send(message))
  })
  await context.addInitScript(pageInit, cfg)
  const page = await context.newPage()
  page.on('pageerror', error => console.error('[page error]', error.message))
  await page.goto(base + '/' + lang + '/planner/run', { waitUntil: 'domcontentloaded', timeout: 180000 })
  return { context, page, hmr }
}

async function main() {
  if (arg('reevaluate')) {
    // Rescore saved runs against the current truth file: --reevaluate run.json[,run2.json] --case truth.json
    for (const file of arg('reevaluate').split(',')) {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
      const truth = JSON.parse(fs.readFileSync(arg('case').split('#')[0], 'utf8')).cases.find(item => item.id === saved.case)
      saved.evaluation = evaluate(truth, saved.raw)
      fs.writeFileSync(file, JSON.stringify(saved, null, 1))
      console.log(path.basename(file), JSON.stringify(saved.evaluation.totals))
    }
    return
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: !headed,
    args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-webgpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] })
  try {
    if (arg('dump-catalog')) {
      const { page } = await openPage(browser, { runState: runState([], 1), mode, videoUrl: '', start: 0, warmupStart: 0 })
      await page.waitForSelector('[data-pip-mode]', { timeout: 180000 })
      const gifts = await page.evaluate(() => {
        const node = document.querySelector('[data-assist-run]'); const key = Object.keys(node).find(k => k.startsWith('__reactFiber$'))
        for (let fiber = node[key]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.gifts && fiber.memoizedProps?.recipes) return fiber.memoizedProps.gifts.map(g => ({ id: String(g.game_id), name: g.name, grade: g.grade, keyword: g.keyword, image_url: g.image_url }))
        return null
      })
      fs.writeFileSync(arg('dump-catalog'), JSON.stringify(gifts))
      console.log('catalog', gifts?.length)
      return
    }
    const [truthFile, caseId] = arg('case').split('#')
    const truth = JSON.parse(fs.readFileSync(truthFile, 'utf8')).cases.find(item => item.id === caseId)
    if (!truth) throw new Error('case not found: ' + caseId)
    const outDir = arg('out', '.'); fs.mkdirSync(outDir, { recursive: true })
    const { server, url } = await serveFile(truth.video)
    const warmupStart = Math.max(0, truth.start - Number(arg('warmup', 4)))
    const { page, hmr } = await openPage(browser, { runState: runState(truth.seed, truth.floor ?? 1), mode, videoUrl: url, start: truth.start, warmupStart, mask,
      recolor, recolorKeep: RECOLOR_KEEP, sceneMiss, detect })
    const button = page.locator('header button:has(svg.lucide-monitor-up)')
    await button.waitFor({ timeout: 180000 })
    hmr.frozen = true
    const t0 = Date.now()
    await button.click()
    try {
      await page.waitForFunction(() => { const R = window.__replay; const ocr = Object.values(R.ready.ocr); return R.video && R.ready.scene && ocr.length > 0 && ocr.every(Boolean) &&
        document.querySelector('[data-capture-state="running"]') }, null, { timeout: readyTimeout * 1000, polling: 250 })
    } catch (error) {
      const state = await page.evaluate(() => ({ capture: document.querySelector('[data-capture-state]')?.getAttribute('data-capture-state'),
        text: document.querySelector('[data-capture-state]')?.textContent, ready: window.__replay.ready, video: !!window.__replay.video,
        worker: window.__replay.worker.filter(row => row.dir === 'in' && row.type !== 'prediction').slice(-12) }))
      console.error('not ready', JSON.stringify(state))
      throw error
    }
    const readyMs = Date.now() - t0
    await page.waitForTimeout(1500)
    await page.evaluate(start => { const R = window.__replay; R.started = true; R.startedAt = Date.now(); R.video.currentTime = start }, truth.start)
    // Real time: wait for the segment to play out, then hold its last frame while late reads finish.
    await page.waitForFunction(end => window.__replay.video.currentTime >= end, truth.end, { timeout: (truth.end - truth.start + 60) * 1000, polling: 100 })
    await page.evaluate(() => window.__replay.video.pause())
    await page.waitForTimeout(tailSec * 1000)
    const record = await page.evaluate(() => {
      const R = window.__replay; const q = R.video.getVideoPlaybackQuality?.()
      return { log: R.log, worker: R.worker, clock: R.clock, initialInventory: R.initialInventory, startedAt: R.startedAt,
        playback: q ? { dropped: q.droppedVideoFrames, total: q.totalVideoFrames } : null, ocrEngines: R.worker.filter(w => w.type === 'backend') }
    })
    // Capture/observation timestamps to video time.
    for (const row of record.log) for (const key of ['capturedAt', 'observedAt', 'lastSeenAt', 'closedAt']) if (row[key] !== undefined) row[key + 'Vt'] = toVideoTime(record.clock, row[key])
    const evaluation = evaluate(truth, record)
    const result = { case: truth.id, mode, mask, recolor, sceneMiss, detect, headless: !headed, video: path.basename(truth.video), start: truth.start, end: truth.end, readyMs, playback: record.playback,
      appFiles: appFileHashes(), stopped: record.log.filter(row => row.kind === 'captureState' && row.at >= record.startedAt && row.state !== 'running').map(row => ({ vt: row.vt, state: row.state })),
      ocrEngines: record.ocrEngines, evaluation, events: record.log.filter(row => row.at >= record.startedAt - 500), worker: record.worker.filter(row => row.at >= record.startedAt - 500 && row.type !== 'infer'),
      raw: { initialInventory: record.initialInventory, startedAt: record.startedAt, log: record.log.filter(row => row.kind !== 'toast') } }
    const file = path.join(outDir, truth.id + '-' + mode + (tag ? '-' + tag : '') + '.json')
    fs.writeFileSync(file, JSON.stringify(result, null, 1))
    console.log(JSON.stringify({ file, readyMs, playback: record.playback, totals: evaluation.totals, final: evaluation.finalInventoryMatches }))
    server.close()
  } finally { await browser.close() }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(error => { console.error(error); process.exit(1) })
