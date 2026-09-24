#!/usr/bin/env node

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const thresholds = [0.5, 0.7, 0.8, 0.9]

function options(argv) {
  const result = {}
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || !argv[i + 1]) throw new Error(`Expected --name value at ${argv[i] ?? 'end'}`)
    result[argv[i].slice(2)] = argv[i + 1]
  }
  return result
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function summarize(rows, labels) {
  if (!rows.length) throw new Error('No evaluated frames')
  const matrix = Object.fromEntries(labels.map(truth => [truth, Object.fromEntries(labels.map(predicted => [predicted, 0]))]))
  for (const row of rows) matrix[row.truth][row.predicted]++
  const perClass = Object.fromEntries(labels.map(label => {
    const support = labels.reduce((sum, predicted) => sum + matrix[label][predicted], 0)
    const tp = matrix[label][label]
    const fp = labels.reduce((sum, truth) => sum + matrix[truth][label], 0) - tp
    const fn = support - tp
    const precision = tp + fp ? tp / (tp + fp) : 0
    const recall = support ? tp / support : 0
    const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0
    return [label, { support, tp, fp, fn, precision, recall, f1 }]
  }))
  const supported = labels.filter(label => perClass[label].support > 0)
  const correct = rows.filter(row => row.truth === row.predicted).length
  const selective = Object.fromEntries(thresholds.map(threshold => {
    const accepted = rows.filter(row => row.confidence >= threshold)
    const acceptedCorrect = accepted.filter(row => row.truth === row.predicted).length
    return [threshold.toFixed(1), {
      accepted: accepted.length,
      coverage: accepted.length / rows.length,
      conditionalAccuracy: accepted.length ? acceptedCorrect / accepted.length : null,
      acceptedCorrectShare: acceptedCorrect / rows.length,
    }]
  }))
  const latencies = rows.map(row => row.inferenceMs).sort((a, b) => a - b)
  return {
    evaluated: rows.length, correct, top1Accuracy: correct / rows.length,
    supportedClasses: supported,
    supportedMacroF1: supported.reduce((sum, label) => sum + perClass[label].f1, 0) / supported.length,
    balancedRecall: supported.reduce((sum, label) => sum + perClass[label].recall, 0) / supported.length,
    perClass, confusion: matrix, selective,
    latencyMs: {
      min: latencies[0], median: latencies[Math.floor(latencies.length / 2)],
      p95: latencies[Math.ceil(latencies.length * 0.95) - 1], max: latencies.at(-1),
      mean: latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
    },
  }
}

function selfCheck() {
  const result = summarize([
    { truth: 'a', predicted: 'a', confidence: 0.8, inferenceMs: 10 },
    { truth: 'b', predicted: 'a', confidence: 0.4, inferenceMs: 20 },
  ], ['a', 'b'])
  assert.equal(result.top1Accuracy, 0.5)
  assert.equal(result.perClass.a.precision, 0.5)
  assert.equal(result.perClass.b.recall, 0)
  assert.equal(result.selective['0.9'].accepted, 0)
  assert.equal(result.selective['0.9'].conditionalAccuracy, null)
}

async function main() {
  selfCheck()
  const args = options(process.argv.slice(2))
  for (const key of ['labels', 'frames', 'output', 'origin', 'model']) {
    if (!args[key]) throw new Error(`Missing --${key}`)
  }
  const origin = new URL(args.origin)
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('Origin must be HTTP(S)')
  const pagePath = args.page ?? '/'
  const workerPath = args.worker ?? '/models/assist-scene/scene-worker.js'
  const modelPath = args.modelPath ?? '/models/assist-scene/scene.onnx'
  const labelPath = args.labelPath ?? '/models/assist-scene/labels.json'
  const extension = args.ext ?? 'jpg'
  const pad = Number(args.pad ?? 4)
  if (!Number.isInteger(pad) || pad < 0 || pad > 12 || !/^[a-z0-9]+$/i.test(extension)) throw new Error('Invalid frame naming options')

  const truth = JSON.parse(await readFile(args.labels, 'utf8'))
  if (!truth || typeof truth !== 'object' || Array.isArray(truth)) throw new Error('Labels must be a key-to-class object')
  const entries = Object.entries(truth).sort(([a], [b]) => Number(a) - Number(b)).map(([key, value]) => {
    if (!/^\d+$/.test(key) || typeof value !== 'string') throw new Error(`Invalid truth entry: ${key}`)
    return { key, truth: value, file: path.join(args.frames, `${key.padStart(pad, '0')}.${extension}`) }
  })
  if (!entries.length) throw new Error('No labeled frames')
  for (const entry of entries) await readFile(entry.file)
  const frameName = new RegExp(`^\\d{${pad}}\\.${extension}$`, 'i')
  const allFrames = (await readdir(args.frames)).filter(file => frameName.test(file)).length
  const modelBefore = hash(await readFile(args.model))

  const fetchedLabels = await fetch(new URL(labelPath, origin))
  if (!fetchedLabels.ok) throw new Error(`Could not fetch deployed labels: ${fetchedLabels.status}`)
  const labels = await fetchedLabels.json()
  if (!Array.isArray(labels) || !labels.length || !labels.every(label => typeof label === 'string') || new Set(labels).size !== labels.length) {
    throw new Error('Invalid deployed class list')
  }
  for (const entry of entries) if (!labels.includes(entry.truth)) throw new Error(`Unknown truth class: ${entry.truth}`)

  const deployedResponse = await fetch(new URL(modelPath, origin))
  if (!deployedResponse.ok) throw new Error(`Could not fetch deployed model: ${deployedResponse.status}`)
  const deployedModelHash = hash(Buffer.from(await deployedResponse.arrayBuffer()))
  if (deployedModelHash !== modelBefore) throw new Error('Deployed model differs from local model')

  const browser = await chromium.launch({
    headless: true,
    ...(args.chrome ? { executablePath: args.chrome } : {}),
  })
  const page = await browser.newPage()
  try {
    await page.goto(new URL(pagePath, origin).href, { waitUntil: 'domcontentloaded' })
    const environment = await page.evaluate(() => ({
      userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
      offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    }))
    const initMs = await page.evaluate(workerPath => new Promise((resolve, reject) => {
      const start = performance.now()
      const worker = new Worker(workerPath, { type: 'module' })
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Worker init timeout')) }, 60000)
      worker.onerror = event => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message)) }
      worker.onmessage = event => {
        if (event.data.type === 'ready') {
          clearTimeout(timer)
          window.__sceneEvalWorker = worker
          resolve(performance.now() - start)
        } else if (event.data.type === 'error') {
          clearTimeout(timer)
          worker.terminate()
          reject(new Error(event.data.message))
        }
      }
      worker.postMessage({ type: 'init' })
    }), workerPath)

    const infer = async entry => {
      const jpeg = await readFile(entry.file)
      return page.evaluate(async dataUrl => {
        const worker = window.__sceneEvalWorker
        const image = new Image()
        image.src = dataUrl
        await image.decode()
        const frame = await createImageBitmap(image)
        return new Promise((resolve, reject) => {
          const start = performance.now()
          const timer = setTimeout(() => reject(new Error('Inference timeout')), 30000)
          worker.onmessage = event => {
            clearTimeout(timer)
            if (event.data.type === 'error') reject(new Error(event.data.message))
            else if (event.data.type === 'prediction') resolve({ ...event.data, inferenceMs: performance.now() - start })
            else reject(new Error(`Unexpected worker message: ${event.data.type}`))
          }
          worker.postMessage({ type: 'infer', frame }, [frame])
        })
      }, `data:image/${extension === 'jpg' ? 'jpeg' : extension};base64,${jpeg.toString('base64')}`)
    }

    const warmup = await infer(entries[0])
    const rows = []
    for (const [index, entry] of entries.entries()) {
      const prediction = await infer(entry)
      if (!labels.includes(prediction.label) || !Number.isFinite(prediction.confidence) || prediction.confidence < 0 || prediction.confidence > 1) {
        throw new Error(`Invalid prediction for frame ${entry.key}`)
      }
      rows.push({ key: entry.key, file: path.basename(entry.file), truth: entry.truth,
        predicted: prediction.label, confidence: prediction.confidence,
        correct: prediction.label === entry.truth, inferenceMs: prediction.inferenceMs })
      if ((index + 1) % 25 === 0) console.log(`Evaluated ${index + 1}/${entries.length}`)
    }
    const result = summarize(rows, labels)
    const modelAfter = hash(await readFile(args.model))
    if (modelAfter !== modelBefore) throw new Error('Local model changed during evaluation')
    const report = {
      createdAt: new Date().toISOString(),
      source: { labeledFrames: entries.length, totalExtractedFrames: allFrames, excludedFrames: allFrames - entries.length,
        sampling: 'Labeled still frames only; temporal neighbors are correlated' },
      modelSha256: { before: modelBefore, after: modelAfter, deployed: deployedModelHash },
      runtime: { browserVersion: browser.version(), ...environment, initMs, warmupMs: warmup.inferenceMs },
      metrics: result,
      scope: 'Independent scene classification evaluation only; no training, gift identity, or transaction recognition',
    }
    await mkdir(args.output, { recursive: true })
    await writeFile(path.join(args.output, 'predictions.jsonl'), rows.map(row => JSON.stringify(row)).join('\n') + '\n')
    await writeFile(path.join(args.output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ evaluated: result.evaluated, accuracy: result.top1Accuracy,
      supportedMacroF1: result.supportedMacroF1, balancedRecall: result.balancedRecall, output: args.output }))
  } finally {
    await page.evaluate(() => window.__sceneEvalWorker?.terminate()).catch(() => {})
    await browser.close()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
