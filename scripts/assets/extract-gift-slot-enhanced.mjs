/** Enhanced (+/++) gift slot from the EGO Gift UI atlas in the game extraction Drive: the orange glowing frame over a dark fill with the yellow inner octagon. */
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

// Drive: Images/UI/Main Menu/EGO Gift, the 1024×2048 atlas (sha256 5f867b3c…). The normal slot (gift/background) stays as is.
const source = '../assets/recovery-2026-09-24/game-ui-sources/EGOGift_1024x2048.png'
const bytes = await readFile(source)
// Alpha bounds of the pieces (atlas pixels).
const frameCrop = { left: 320, top: 832, width: 186, height: 181 } // orange glowing frame, empty inside
const octagonCrop = { left: 195, top: 515, width: 175, height: 172 } // yellow inner octagon slot
const { width: W, height: H } = frameCrop
const frame = await sharp(bytes).extract(frameCrop).png().toBuffer()
const octagon = await sharp(bytes).extract(octagonCrop).resize(Math.round(octagonCrop.width * 0.9)).png().toBuffer()
const { width: ow, height: oh } = await sharp(octagon).metadata()
const fill = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><polygon points="42,14 144,14 172,42 172,139 144,167 42,167 14,139 14,42" fill="#1c150e"/></svg>`)
const composed = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: fill }, { input: octagon, left: Math.round((W - ow) / 2), top: Math.round((H - oh) / 2) }, { input: frame }])
  .png().toBuffer()
const output = await sharp(composed).webp({ lossless: true }).toBuffer()
await writeFile('public/assets/game-ui/gift/background-enhanced.webp', output)
const versionsPath = 'lib/generated/game-ui-versions.json'
const versions = JSON.parse(await readFile(versionsPath, 'utf8'))
versions['gift/background-enhanced'] = createHash('sha256').update(output).digest('hex').slice(0, 12)
await writeFile(versionsPath, JSON.stringify(versions, null, 2) + '\n')
console.log('source sha256', createHash('sha256').update(bytes).digest('hex'))
