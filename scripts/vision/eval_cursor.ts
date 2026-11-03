// @ts-nocheck -- developer tool run with tsx.
/**
 * The cursor finder (lib/vision/cursor.ts) on labelled frames: frames with the game cursor drawn in and labelled
 * (`cursor`: {x, y, down}) and frames without one. Each frame is first scaled to `--width` (the worker's working width).
 * Usage: npx tsx scripts/vision/eval_cursor.ts <dir with cursor frames> <dir with plain frames,...> [--n 300] [--width 960]
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { decodeCursorTemplates, findCursor } from '../../lib/vision/cursor'

const args = process.argv.slice(2)
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) : d }
const [withDir, withoutDirs] = args
const n = opt('n', 300), workWidth = opt('width', 960)
const templates = decodeCursorTemplates(JSON.parse(readFileSync('public/models/assist-scene/cursor.json', 'utf8')))

function pick(files, count) {
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  return files.map(f => [rand(), f]).sort((a, b) => a[0] - b[0]).slice(0, count).map(([, f]) => f)
}

async function read(png) {
  const meta = await sharp(png).metadata()
  const width = Math.min(workWidth, meta.width)
  const { data, info } = await sharp(png).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, scale: info.width / meta.width }
}

async function main() {
  const labelled = pick(readdirSync(withDir).filter(f => f.endsWith('.json') && !f.endsWith('-truth.json'))
    .filter(f => JSON.parse(readFileSync(path.join(withDir, f), 'utf8')).cursor), n)
  let found = 0, near = 0, pressedRight = 0, ms = 0
  const misses = [], scores = []
  for (const f of labelled) {
    const label = JSON.parse(readFileSync(path.join(withDir, f), 'utf8')).cursor
    const frame = await read(path.join(withDir, f.replace(/\.json$/, '.png')))
    const t = performance.now(); const hit = findCursor(frame.data, frame.width, frame.height, templates); ms += performance.now() - t
    if (!hit) { misses.push(f); continue }
    found++
    const dist = Math.hypot(hit.x / frame.scale - label.x, hit.y / frame.scale - label.y)
    if (dist <= 8) { near++; scores.push(hit.score); if (hit.pressed === label.down) pressedRight++ } else misses.push(`${f} off by ${dist.toFixed(0)}`)
  }
  console.log(`cursor frames ${labelled.length}: found ${found}, within 8 px ${near}, pressed right ${pressedRight}; ${(ms / labelled.length).toFixed(1)} ms a frame`)
  scores.sort((a, b) => a - b); console.log('true scores 1/5/50%', [0.01, 0.05, 0.5].map(q => scores[Math.floor(q * scores.length)]?.toFixed(2)))
  console.log('misses', misses.slice(0, 12))
  let false_ = 0, total = 0
  const falses = []
  for (const dir of withoutDirs.split(',')) {
    for (const f of pick(readdirSync(dir).filter(f => f.endsWith('.png')), Math.ceil(n / 2))) {
      const frame = await read(path.join(dir, f)); total++
      const hit = findCursor(frame.data, frame.width, frame.height, templates)
      if (hit) { false_++; falses.push(`${path.basename(dir)}/${f} ${hit.score.toFixed(2)}`) }
    }
  }
  console.log(`plain frames ${total}: cursor claimed on ${false_}`, falses.slice(0, 12))
}
main()
