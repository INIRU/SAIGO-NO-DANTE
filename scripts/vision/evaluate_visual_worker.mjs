#!/usr/bin/env node
/** Exercise the shipped browser Worker on local, reviewed still frames. No model training or frame upload. */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

function args(argv) {
  const values = {}
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || !argv[i + 1]) throw new Error('Expected --name value')
    values[argv[i].slice(2)] = argv[i + 1]
  }
  for (const key of ['manifest', 'labels', 'frames', 'output', 'origin']) if (!values[key]) throw new Error(`Missing --${key}`)
  return values
}

const config = args(process.argv.slice(2))
const manifest = JSON.parse(await readFile(config.manifest, 'utf8'))
const rows = (await readFile(config.labels, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
const giftReferences = manifest.gifts.filter(gift => gift.game_id && gift.image_url)
  .map(gift => ({ id: String(gift.game_id), imageUrl: gift.image_url }))
const eventReferences = manifest.events.filter(event => event.id && event.image_url)
  .map(event => ({ id: String(event.id), imageUrl: event.image_url }))
const browser = await chromium.launch({ headless: true, ...(config.chrome ? { executablePath: config.chrome } : {}) })
const page = await browser.newPage()
try {
  await page.goto(config.origin, { waitUntil: 'domcontentloaded' })
  const initMs = await page.evaluate(({ giftReferences, eventReferences }) => new Promise((resolve, reject) => {
    const worker = new Worker('/models/assist-scene/scene-worker.js', { type: 'module' })
    const start = performance.now()
    const timer = setTimeout(() => reject(new Error('Worker initialization timeout')), 60000)
    worker.onerror = event => { clearTimeout(timer); reject(new Error(event.message)) }
    worker.onmessage = event => {
      if (event.data.type === 'ready') {
        clearTimeout(timer)
        window.__visualEvaluationWorker = worker
        resolve(performance.now() - start)
      } else if (event.data.type === 'error') {
        clearTimeout(timer)
        reject(new Error(event.data.message))
      }
    }
    worker.postMessage({ type: 'init', giftReferences, eventReferences })
  }), { giftReferences, eventReferences })
  console.log(`Worker ready in ${initMs.toFixed(1)}ms`)
  const predictions = []
  for (const [index, row] of rows.entries()) {
    const file = path.join(config.frames, `${String(row.review_source_index).padStart(3, '0')}.jpg`)
    const image = await readFile(file)
    const result = await page.evaluate(async dataUrl => {
      const image = new Image()
      image.src = dataUrl
      await image.decode()
      const frame = await createImageBitmap(image)
      return new Promise((resolve, reject) => {
        const start = performance.now()
        const timer = setTimeout(() => reject(new Error('Worker inference timeout')), 60000)
        window.__visualEvaluationWorker.onmessage = event => {
          clearTimeout(timer)
          if (event.data.type === 'prediction') resolve({ ...event.data, inferenceMs: performance.now() - start })
          else reject(new Error(event.data.message ?? 'Unexpected Worker response'))
        }
        window.__visualEvaluationWorker.postMessage({ type: 'infer', frame }, [frame])
      })
    }, `data:image/jpeg;base64,${image.toString('base64')}`)
    predictions.push({ index: row.review_source_index, truth: row.label, ...result })
    if ((index + 1) % 25 === 0) console.log(`Evaluated ${index + 1}/${rows.length}`)
  }
  await mkdir(config.output, { recursive: true })
  await writeFile(path.join(config.output, 'predictions.jsonl'), predictions.map(row => JSON.stringify(row)).join('\n') + '\n')
  const latency = predictions.map(row => row.inferenceMs).sort((a, b) => a - b)
  const report = {
    frames: rows.length, giftReferences: giftReferences.length, eventReferences: eventReferences.length,
    browser: browser.version(), initMs,
    latencyMs: { median: latency[Math.floor(latency.length / 2)], p95: latency[Math.ceil(latency.length * .95) - 1] },
    byTruth: Object.fromEntries([...new Set(rows.map(row => row.label))].map(label => [label, {
      frames: predictions.filter(row => row.truth === label).length,
      eventAccepted: predictions.filter(row => row.truth === label && row.events.length).length,
      giftAccepted: predictions.filter(row => row.truth === label && row.gifts.length).length,
    }])),
    accepted: predictions.filter(row => row.gifts.length || row.events.length)
      .map(row => ({ index: row.index, truth: row.truth, predictedScene: row.label,
        sceneConfidence: row.confidence, gifts: row.gifts, events: row.events })),
  }
  await writeFile(path.join(config.output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ frames: report.frames, latencyMs: report.latencyMs, byTruth: report.byTruth }))
} finally {
  await page.evaluate(() => window.__visualEvaluationWorker?.terminate()).catch(() => {})
  await browser.close()
}
