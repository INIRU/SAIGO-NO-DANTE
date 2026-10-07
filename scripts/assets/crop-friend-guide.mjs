#!/usr/bin/env node
/**
 * Makes the friend code guide images (public/assets/guides/friend-codes/) from five 1920x1080 game screenshots and prints the
 * callout positions as percentages of each image, for components/friends/FriendGuide.tsx.
 *   node scripts/assets/crop-friend-guide.mjs <dir with lobby.webp ticket.webp friends.webp add.webp company.webp>
 * The friend list and the "add friend" window show other players' cards with their friend codes: those areas are blurred
 * beyond reading (hide), so no code but the screenshot owner's own is published.
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

// callouts and hide: [left, top, right, bottom] in screenshot pixels.
export const GUIDE_IMAGES = [
  { name: 'code', source: 'lobby.webp', callouts: [[84, 193, 366, 242]], hide: [] },
  { name: 'copy', source: 'ticket.webp', callouts: [[586, 248, 716, 302]], hide: [] },
  { name: 'friends', source: 'friends.webp', callouts: [[730, 42, 962, 122], [516, 293, 739, 354]], hide: [[240, 368, 1630, 930]] },
  { name: 'add', source: 'add.webp', callouts: [[443, 346, 784, 394]], hide: [[440, 412, 1456, 708], [240, 368, 352, 930], [1568, 368, 1632, 930], [240, 892, 1632, 930]] },
  { name: 'company', source: 'company.webp', callouts: [[496, 45, 728, 121]], hide: [] },
]

const dir = process.argv[2]
if (!dir) throw Error('usage: node scripts/assets/crop-friend-guide.mjs <screenshot dir>')
const out = 'public/assets/guides/friend-codes'
mkdirSync(out, { recursive: true })
const percent = value => Math.round(value * 1000) / 10
for (const image of GUIDE_IMAGES) {
  const file = join(dir, image.source)
  const { width, height } = await sharp(file).metadata()
  // A patch is shrunk to 1/24, blurred and enlarged again: nothing of the text survives, the colours stay.
  const patches = await Promise.all(image.hide.map(async ([l, t, r, b]) => {
    const box = { left: l, top: t, width: Math.min(r, width) - l, height: Math.min(b, height) - t }
    const small = await sharp(file).extract(box).resize({ width: Math.max(2, Math.round(box.width / 24)) }).blur(2).toBuffer()
    return { input: await sharp(small).resize(box.width, box.height, { fit: 'fill', kernel: 'cubic' }).blur(12).modulate({ brightness: 0.7 }).toBuffer(), left: box.left, top: box.top }
  }))
  await sharp(await sharp(file).composite(patches).toBuffer()).resize({ width: 1280 }).webp({ quality: 84 }).toFile(join(out, `${image.name}.webp`))
  const spots = image.callouts.map(([l, t, r, b]) => ({ left: percent(l / width), top: percent(t / height), width: percent((r - l) / width), height: percent((b - t) / height) }))
  console.log(image.name, `${width}x${height}`, JSON.stringify(spots))
}
