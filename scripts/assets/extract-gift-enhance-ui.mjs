/** Gift enhancement marks (-, +, ++) from the Mirror Dungeon 7 UI atlas in the game extraction Drive. */
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

// Drive: Images/UI/Main Menu/Mirror Dungeon/Mirror of Names and Spiders/MainUI_MirrorDungeon7_2.png
const source = '../assets/recovery-2026-09-24/game-ui-sources/MainUI_MirrorDungeon7_2.png'
const bytes = await readFile(source)
// Alpha bounds in the 2048px atlas, padded by 2px for the glow edge.
const crops = {
  'gift/enhance-minus': [1761, 647, 1787, 661],
  'gift/enhance-plus-idle': [1806, 643, 1833, 669],
  'gift/enhance-plusplus-idle': [1855, 643, 1912, 669],
  'gift/enhance-plus': [1929, 637, 1965, 674],
  'gift/enhance-plusplus': [1978, 637, 2044, 674],
}
const versionsPath = 'lib/generated/game-ui-versions.json'
const versions = JSON.parse(await readFile(versionsPath, 'utf8'))
for (const [name, [x0, y0, x1, y1]] of Object.entries(crops)) {
  const crop = { left: x0 - 2, top: y0 - 2, width: Math.min(x1 + 2, 2048) - x0 + 2, height: y1 - y0 + 4 }
  const output = await sharp(bytes).extract(crop).webp({ lossless: true }).toBuffer()
  await writeFile(`public/assets/game-ui/${name}.webp`, output)
  versions[name] = createHash('sha256').update(output).digest('hex').slice(0, 12)
}
await writeFile(versionsPath, JSON.stringify(versions, null, 2) + '\n')
console.log('source sha256', createHash('sha256').update(bytes).digest('hex'))
