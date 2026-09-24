/** Sync explicitly selected identities from the verified extraction manifest. */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const sharp = require('sharp')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local', quiet: true })
const args = process.argv.slice(2)
const option = name => args[args.indexOf(name) + 1]
function selectEntries(manifest, id, infoOnly, variantsOnly = false) {
  return manifest.filter(entry => entry.kind === '인격'
    ? !variantsOnly && new RegExp(`^${id}_(normal|gacksung)${infoOnly ? '_info' : '(_info)?'}$`).test(entry.name)
    : !infoOnly && entry.kind === '스킬' && entry.name.startsWith(id) && (variantsOnly ? /^\d+_\d+$/ : /^\d+(?:_\d+)?$/).test(entry.name))
}
async function main() {
  const ids = args.includes('--ids') ? option('--ids').split(',') : []
  if (!ids.length || ids.some(id => !/^10[1-9]\d{2}$|^11[0-2]\d{2}$/.test(id))) throw Error('Provide explicit --ids (comma-separated game IDs)')
  if (!args.includes('--source') || !args.includes('--output')) throw Error('Provide --source and --output')
  const source = path.resolve(option('--source'))
  const output = path.resolve(option('--output'))
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: identities, error } = await client.schema('limbus').from('identities').select('game_id,sinner_id,folder_name').in('game_id', ids)
  if (error) throw error
  if (identities.length !== ids.length) throw Error('Some identities are missing in DB')
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'Reports/manifest.json')))
  // --skill-variants: only uptie icons such as 1010104_4; existing illustrations stay untouched.
  const variantsOnly = args.includes('--skill-variants')
  const plan = []
  for (const identity of identities) {
    const id = identity.game_id
    for (const entry of selectEntries(manifest, id, args.includes('--info-only'), variantsOnly)) {
      let key
      if (entry.kind === '스킬' && /^\d+(?:_\d+)?$/.test(entry.name)) key = `icons/skills/${identity.sinner_id}/${entry.name}.webp`
      else if (entry.kind === '인격' && new RegExp(`^${id}_(normal|gacksung)(_info)?$`).test(entry.name)) key = `sinners/${identity.sinner_id}/identities/${identity.folder_name}/${entry.name}.webp`
      else continue
      const local = path.resolve(source, 'Images', entry.path)
      if (!local.startsWith(path.join(source, 'Images') + path.sep)) throw Error('Invalid source path')
      const bytes = fs.readFileSync(local)
      const hash = crypto.createHash('sha256').update(bytes).digest('hex')
      if (hash.toLowerCase() !== entry.sha256.toLowerCase()) throw Error(`Source hash mismatch: ${entry.name}`)
      const webp = await sharp(bytes).webp(entry.kind === '스킬' ? { lossless: true } : { quality: 90 }).toBuffer()
      plan.push({ key, source: entry.path, sourceHash: hash, bytes: webp })

    }
    if (!variantsOnly) for (const state of ['normal', 'gacksung']) if (!plan.some(row => row.key.endsWith(`/${id}_${state}${args.includes('--info-only') ? '_info' : ''}.webp`))) throw Error(`Missing illustration: ${id} ${state}`)
  }
  if (new Set(plan.map(row => row.key)).size !== plan.length) throw Error('Ambiguous source image names')
  fs.mkdirSync(output, { recursive: true })
  // Back up every existing object before the first write; never replace a backup.
  if (args.includes('--fix')) {
    for (const item of plan) {
      const { data, error } = await client.storage.from('limbus-assets').download(item.key)
      if (error) {
        if (String(error.statusCode) === '404') continue
        throw error
      }
      const backup = path.join(output, 'before', item.key)
      fs.mkdirSync(path.dirname(backup), { recursive: true })
      if (!fs.existsSync(backup)) fs.writeFileSync(backup, Buffer.from(await data.arrayBuffer()), { flag: 'wx' })
    }
  }
  const receipt = []
  for (const item of plan) {
    const hash = crypto.createHash('sha256').update(item.bytes).digest('hex')
    fs.writeFileSync(path.join(output, hash + '.webp'), item.bytes)
    if (args.includes('--fix')) {
      const { error: uploadError } = await client.storage.from('limbus-assets').upload(item.key, item.bytes, { contentType: 'image/webp', upsert: true, cacheControl: '3600' })
      if (uploadError) throw uploadError
      const { data, error: readError } = await client.storage.from('limbus-assets').download(item.key)
      if (readError) throw readError
      const actual = crypto.createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex')
      if (actual !== hash) throw Error(`Upload verification failed: ${item.key}`)
    }
    const { bytes, ...record } = item
    receipt.push({ ...record, sha256: hash, applied: args.includes('--fix') })
  }
  fs.writeFileSync(path.join(output, args.includes('--fix') ? 'upload-receipt.json' : 'plan.json'), JSON.stringify(receipt, null, 2))
  console.log(`${args.includes('--fix') ? 'Uploaded and verified' : 'Prepared'}: ${receipt.length}`)
}
module.exports = { selectEntries }
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
