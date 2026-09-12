/** Native sinner shard sprites, from the same verified resource atlas. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const source = '../assets/recovery-2026-09-10/experience-sources/MainUI_CommonIcon_2.png'
const bytes = await readFile(source)
const sinners = ['yi-sang','faust','don-quixote','ryoshu','meursault','hong-lu','heathcliff','ishmael','rodion','sinclair','outis','gregor']
const crops = Object.fromEntries(sinners.map((id,i)=>[id,[i%8,6+Math.floor(i/8)]]))
const versionsPath = 'lib/generated/game-ui-versions.json'
const versions = JSON.parse(await readFile(versionsPath,'utf8'))
const outputs = []
await mkdir('public/assets/game-ui/shards',{recursive:true})
for(const [id,[col,row]] of Object.entries(crops)) {
  const crop={left:col*256,top:row*256,width:256,height:256}
  const output=await sharp(bytes).extract(crop).webp({lossless:true}).toBuffer()
  const sha256=createHash('sha256').update(output).digest('hex')
  await writeFile(`public/assets/game-ui/shards/${id}.webp`,output)
  versions[`shards/${id}`]=sha256.slice(0,12)
  outputs.push({id,crop,sha256})
}
await writeFile(versionsPath,JSON.stringify(versions,null,2)+'\n')
await writeFile('../assets/recovery-2026-09-10/experience-sources/shard-assets.json',JSON.stringify({driveId:'1CIqOTHoXKFLM-Bpal1HEDIHUlIiPjow1',sourceSha256:createHash('sha256').update(bytes).digest('hex'),outputs},null,2)+'\n')
