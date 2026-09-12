/** Extract verified resource atlas cells without recoloring. Run from repo root. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const source = '../assets/recovery-2026-09-10/experience-sources/MainUI_CommonIcon_2.png'
const sourceBytes = await readFile(source)
const cells = { 'ticket-1':[4,3], 'ticket-2':[5,3], 'ticket-3':[6,3], 'ticket-4':[3,4], 'module':[4,4], 'enkephalin':[1,0] }
const versionsPath = 'lib/generated/game-ui-versions.json'
const versions = JSON.parse(await readFile(versionsPath, 'utf8'))
const outputs = []
await mkdir('public/assets/game-ui/resources', { recursive:true })
for (const [name,[col,row]] of Object.entries(cells)) {
  const crop = {left:col*256,top:row*256,width:256,height:256}
  const bytes = await sharp(sourceBytes).extract(crop).webp({lossless:true}).toBuffer()
  const key = `resources/${name}`
  await writeFile(`public/assets/game-ui/${key}.webp`,bytes)
  versions[key] = createHash('sha256').update(bytes).digest('hex').slice(0,12)
  outputs.push({name:key,crop,sha256:createHash('sha256').update(bytes).digest('hex')})
}
await writeFile(versionsPath,JSON.stringify(versions,null,2)+'\n')
await writeFile('../assets/recovery-2026-09-10/experience-sources/extracted-assets.json',JSON.stringify({
  driveId:'1CIqOTHoXKFLM-Bpal1HEDIHUlIiPjow1',source:'icons/Resources/MainUI_CommonIcon_2.png',
  sourceSha256:createHash('sha256').update(sourceBytes).digest('hex'),outputs},null,2)+'\n')
