/**
 * Enhanced (+/++) gift slot as in game, from two pieces of the EGO Gift UI atlas in the game extraction Drive:
 * the orange-striped square slot with the yellow octagon over it (the glowing outline in the atlas is the selection
 * highlight, not part of the slot). Scaled to the normal slot's size so the two swap in place.
 */
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

// Drive: Images/UI/Main Menu/EGO Gift, the 1024×2048 atlas (sha256 5f867b3c…). The normal slot (gift/background) stays as is.
const source = '../assets/recovery-2026-09-24/game-ui-sources/EGOGift_1024x2048.png'
const bytes = await readFile(source)
// Alpha bounds in atlas pixels.
const square = { left: 381, top: 648, width: 173, height: 172 } // orange-striped square slot, empty inside
const body = { left: 203, top: 524, width: 158, height: 154 } // yellow octagon (opaque part)
const pad = 8 // plus its soft shadow
// Octagon width as a share of the slot, matched to the grey octagon in the normal slot.
const OCTAGON_SHARE = 0.75
const scale = OCTAGON_SHARE * square.width / body.width
const crop = { left: body.left - pad, top: body.top - pad, width: body.width + pad * 2, height: body.height + pad * 2 }
const ow = Math.round(crop.width * scale), oh = Math.round(crop.height * scale)
const octagon = await sharp(bytes).extract(crop).resize(ow, oh, { kernel: 'lanczos3' }).png().toBuffer()
const composed = await sharp(bytes).extract(square)
  .composite([{ input: octagon, left: Math.round((square.width - ow) / 2), top: Math.round((square.height - oh) / 2) }])
  .png().toBuffer()
const normal = await sharp('public/assets/game-ui/gift/background.webp').metadata()
const output = await sharp(composed).resize(normal.width, normal.height, { fit: 'fill', kernel: 'lanczos3' })
  .webp({ quality: 92, alphaQuality: 100 }).toBuffer()
await writeFile('public/assets/game-ui/gift/background-enhanced.webp', output)
const versionsPath = 'lib/generated/game-ui-versions.json'
const versions = JSON.parse(await readFile(versionsPath, 'utf8'))
versions['gift/background-enhanced'] = createHash('sha256').update(output).digest('hex').slice(0, 12)
await writeFile(versionsPath, JSON.stringify(versions, null, 2) + '\n')
console.log('source sha256', createHash('sha256').update(bytes).digest('hex'), 'size', normal.width, normal.height)
