// The phone tiles' colours from the season's own card art (lib/generated/season-palette.json): the blessing tiles from the
// blessing card, the constraint tiles from the constraint card. `npm run build` runs this first, so a new season's art files are
// all a season change needs. Each body (the card without its header) is averaged into a top and a bottom colour, kept in the
// card's hue but brought to the same brightness every season (the tiles' first red: brightest channel 58 at the top, 90 at the
// bottom); the border is the bottom lifted toward white.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../../', import.meta.url))
const CARDS = {
  blessing: { file: 'public/assets/planner/blessing-ui/blessing-card-base.webp', body: [0.08, 0.3, 0.92, 0.92] },
  constraint: { file: 'public/assets/planner/constraint-ui/md8-card.webp', body: [0.05, 0.2, 0.95, 0.95] },
}

const hex = rgb => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const lift = (rgb, share) => rgb.map(v => v + (255 - v) * share)
const brighten = (rgb, brightest) => rgb.map(v => v * brightest / Math.max(...rgb, 1))

async function sample({ file, body: [x0, y0, x1, y1] }) {
  const image = sharp(root + file)
  const { width, height } = await image.metadata()
  const area = { left: Math.round(width * x0), top: Math.round(height * y0), width: Math.round(width * (x1 - x0)), height: Math.round(height * (y1 - y0)) }
  // over black, so a see-through pixel darkens rather than whitens
  const data = await sharp(root + file).extract(area).flatten({ background: '#000' }).resize(1, 2, { fit: 'fill' }).raw().toBuffer()
  const top = brighten([...data.subarray(0, 3)], 58), bottom = brighten([...data.subarray(3, 6)], 90)
  return { top: hex(top), bottom: hex(bottom), border: hex(lift(bottom, 0.3)) }
}

export async function samplePalettes() {
  return Object.fromEntries(await Promise.all(Object.entries(CARDS).map(async ([kind, card]) => [kind, await sample(card)])))
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  writeFileSync(root + 'lib/generated/season-palette.json', JSON.stringify(await samplePalettes(), null, 2) + '\n')
