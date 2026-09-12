import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const source='../assets/recovery-2026-09-10/experience-sources/MainUI_CommonIcon_2.png'
const input=await readFile(source)
// The source's first 256px atlas cell is the Lunacy rose (ITEM 1/2 spriteStr lunacy).
const crop={left:0,top:0,width:256,height:256}
const bytes=await sharp(input).extract(crop).webp({lossless:true}).toBuffer()
await writeFile('public/assets/game-ui/resources/lunacy.webp',bytes)
const versions=JSON.parse(await readFile('lib/generated/game-ui-versions.json','utf8'))
versions['resources/lunacy']=createHash('sha256').update(bytes).digest('hex').slice(0,12)
await writeFile('lib/generated/game-ui-versions.json',JSON.stringify(versions,null,2)+'\n')
await writeFile('../assets/recovery-2026-09-10/lunacy-sources/icon-provenance.json',JSON.stringify({driveId:'1CIqOTHoXKFLM-Bpal1HEDIHUlIiPjow1',source,crop,sourceSha256:createHash('sha256').update(input).digest('hex'),outputSha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n')

// Matched against the user-provided in-game shop screenshots (2026-09-12).
// Membership: nine roses / four roses. Hoard: glowing treasure chest.
const cells = { 2: [4, 1], 3: [5, 1], 4: [6, 1], 5: [7, 1], 6: [7, 2], 21: [0, 1], 22: [0, 2] }
const productIcons = []
for (const [id, [column, row]] of Object.entries(cells)) {
  const crop = { left: column * 256, top: row * 256, width: 256, height: 256 }
  const bytes = await sharp(input).extract(crop).webp({ lossless: true }).toBuffer()
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  await writeFile(`public/assets/game-ui/resources/lunacy-${id}.webp`, bytes)
  versions[`resources/lunacy-${id}`] = sha256.slice(0, 12)
  productIcons.push({ id, crop, sha256 })
}
await writeFile('lib/generated/game-ui-versions.json', JSON.stringify(versions, null, 2) + '\n')
await writeFile('../assets/recovery-2026-09-10/lunacy-sources/product-icon-provenance.json', JSON.stringify({ source, sourceSha256: createHash('sha256').update(input).digest('hex'), productIcons }, null, 2) + '\n')
