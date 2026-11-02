#!/usr/bin/env node
/** Restore only verified Drive artwork and extracted UI assets. Default is a dry run. */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')
const SINNERS = ['yi-sang', 'faust', 'don-quixote', 'ryoshu', 'meursault', 'hong-lu', 'heathcliff', 'ishmael', 'rodion', 'sinclair', 'outis', 'gregor']
const slug = name => name.normalize('NFKD').replace(/['’]/g, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
const safeStoragePath = key => key.replace(/[^a-zA-Z0-9/!\-_.*'() &$@=;:+,?]/gu, char => `_u${char.codePointAt(0).toString(16)}_`)
function storagePath(file) {
  const parts = file.path.split('/')
  if (parts[0] === 'art' && ['Identities', 'EGO'].includes(parts[2])) {
    return ['sinners', slug(parts[1]), parts[2] === 'EGO' ? 'ego' : 'identities', ...parts.slice(3)].join('/').replace(/\.png$/i, '.webp')
  }
  if (file.path.startsWith('icons/Skills/Sinners/')) return `icons/skills/${slug(parts[3])}/${file.name.replace(/\.png$/i, '.webp')}`
  if (/^icons\/Sins\/(Wrath|Lust|Sloth|Gluttony|Gloom|Pride|Envy)\.png$/.test(file.path)) return `icons/Sins/transparent/${file.name.replace(/\.png$/i, '.webp')}`
  if (file.path.startsWith('icons/Status Effects/') && parts.length > 3) return `icons/keywords/${slug(path.basename(file.name, '.png'))}.webp`
  return null
}
// Exact localization/file-label aliases. Do not guess between numbered visual variants.
const KEYWORD_ALIASES = {
  'declared-duel-don-quixote': 'declared-duel',
  'declared-duel-sinclair': 'declared-duel',
  'declared-duel-outis': 'declared-duel',
  'courier-trunk-rodion': 'courier-trunk',
  'courier-trunk-sinclair': 'courier-trunk',
  'defense-level-down': 'defense-down',
  'liferender': 'life-render',
  'nerve-strike-don-quixote': 'nerver-strike-don-quixote',
  'crit-dmg-up': 'deal-more-damage-on-critical-hit',
  'unlock': 'unlock-i', // Source UnlockBuff_Base.iconId = UnlockBuff_1.
  'unlock-buff-ally-2': 'unlock-ii',
}
async function restore(base, apply = false) {
  const files = ['art', 'icons'].flatMap(domain => JSON.parse(fs.readFileSync(path.join(base, `drive-complete-${domain}.json`))).files).filter(f => f.mimeType === 'image/png')
  const plan = []
  const byKey = new Map()
  for (const file of files) {
    const sourceKey = storagePath(file)
    const key = sourceKey ? safeStoragePath(sourceKey) : null
    if (!key) continue
    const local = path.join(base, 'image-webp', file.path.replace(/\.png$/i, '.webp'))
    if (!fs.existsSync(local)) continue
    const hash = crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex')
    const prev = byKey.get(key)
    if (prev && prev.sha256 !== hash) {
      // Distinct variants must not overwrite each other; retain the source ID.
      plan.push({ key: key.replace('.webp', `-${file.id}.webp`), local, sourceId: file.id, sha256: hash })
      continue
    }
    if (!prev) { const item = { key, local, sourceId: file.id, sha256: hash }; byKey.set(key, item); plan.push(item) }
  }
  // Unity duplicate suffix on the sole available illustration, retained in source provenance.
  for (const item of [...plan]) {
    const canonical = item.key.replace(/(\d+_(?:normal|gacksung)(?:_info)?) _u23_\d+\.webp$/, '$1.webp')
    if (canonical !== item.key && !byKey.has(canonical)) { plan.push({ ...item, key: canonical, aliasOf: item.key }); byKey.set(canonical, item) }
  }
  for (const [alias, canonical] of Object.entries(KEYWORD_ALIASES)) {
    const source = byKey.get(`icons/keywords/${canonical}.webp`)
    if (!source) throw Error(`Missing keyword alias source: ${canonical}`)
    const key = `icons/keywords/${alias}.webp`
    if (!byKey.has(key)) { const item = { ...source, key, aliasOf: source.key }; plan.push(item); byKey.set(key, item) }
  }
  const extracted = path.join(base, 'artwork-ui', 'manifest.json')
  if (fs.existsSync(extracted)) plan.push(...JSON.parse(fs.readFileSync(extracted)))
  // LCB identities have no alternate full illustration; reuse the game's normal art.
  for (const item of [...plan]) if (/\/LCB Sinner\/\d+_normal(?:_info)?\.webp$/.test(item.key)) {
    plan.push({ ...item, key: item.key.replace('_normal', '_gacksung'), aliasOf: item.key })
  }
  fs.writeFileSync(path.join(base, 'artwork-upload-plan.json'), JSON.stringify(plan, null, 2))
  console.log(JSON.stringify({ available: plan.length, apply }))
  if (!apply) return
  try { process.loadEnvFile('.env.local') } catch {}
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw Error('Supabase server credentials are required')
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: 'limbus' } })
  const reportPath = path.join(base, 'artwork-upload-results.json')
  const previous = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath)) : []
  const completed = new Map(previous.filter(r => r.status === 'verified').map(r => [r.key, r.sha256]))
  const results = [...previous.filter(r => r.status === 'verified')]
  const pending = plan.filter(p => completed.get(p.key) !== p.sha256)
  let next = 0
  const save = () => fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
  async function worker() {
    while (next < pending.length) {
      const item = pending[next++]
      try {
        const bytes = fs.readFileSync(item.local)
        const { error } = await db.storage.from('limbus-assets').upload(item.key, bytes, { contentType: 'image/webp', cacheControl: '3600', upsert: true })
        if (error) throw error
        const publicUrl = db.storage.from('limbus-assets').getPublicUrl(item.key).data.publicUrl
        const response = await fetch(publicUrl)
        if (!response.ok) throw Error(`Public URL returned ${response.status}`)
        const downloaded = Buffer.from(await response.arrayBuffer())
        if (crypto.createHash('sha256').update(downloaded).digest('hex') !== item.sha256) throw Error('Public asset hash mismatch')
        results.push({ key: item.key, sourceId: item.sourceId, sha256: item.sha256, status: 'verified' })
      } catch (error) { results.push({ key: item.key, status: 'failed', error: error.message }) }
      if (results.length % 50 === 0) { save(); console.log(JSON.stringify({ done: results.length, pending: pending.length, failed: results.filter(r => r.status === 'failed').length })) }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker)); save()
  console.log(JSON.stringify({ verified: results.filter(r => r.status === 'verified').length, failed: results.filter(r => r.status === 'failed').length }))
}
module.exports = { storagePath, safeStoragePath, slug, SINNERS, KEYWORD_ALIASES }
if (require.main === module) restore(path.resolve(process.argv[2] || '../assets/recovery-2026-09-10'), process.argv.includes('--apply')).catch(e => { console.error(e.message); process.exitCode = 1 })
