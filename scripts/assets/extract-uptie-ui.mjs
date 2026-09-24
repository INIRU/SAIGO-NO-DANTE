/** Uptie numerals I–IV from the identity-list atlas (I/II flat gold, III/IV glowing, as in game). */
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const source = '../assets/recovery-2026-09-10/ui-originals/MainUI_PersonalityList_4.png'
const bytes = await readFile(source)
// Alpha bounds (alpha > 2); IV is clipped above the V sprite below it.
const crops = { 1: [1349, 807, 1395, 972], 2: [1232, 803, 1330, 975], 3: [1055, 796, 1212, 982], 4: [1051, 986, 1257, 1182] }
const H = 200
const versionsPath = 'lib/generated/game-ui-versions.json'
const versions = JSON.parse(await readFile(versionsPath, 'utf8'))
await mkdir('public/assets/game-ui/uptie', { recursive: true })
for (const [n, [x0, y0, x1, y1]] of Object.entries(crops)) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  const top = Math.floor((H - h) / 2)
  const output = await sharp(bytes).extract({ left: x0, top: y0, width: w, height: h })
    .extend({ top, bottom: H - h - top, left: 6, right: 6, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ lossless: true }).toBuffer()
  await writeFile(`public/assets/game-ui/uptie/${n}.webp`, output)
  versions[`uptie/${n}`] = createHash('sha256').update(output).digest('hex').slice(0, 12)
}
await writeFile(versionsPath, JSON.stringify(versions, null, 2) + '\n')
