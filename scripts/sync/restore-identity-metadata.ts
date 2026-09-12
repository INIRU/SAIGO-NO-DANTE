/** Fill source-backed metadata only. Dry run by default; back up before --apply. */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { identityMetadata } from './identity-metadata'

async function main() {
  process.loadEnvFile('.env.local')
  const base = path.resolve(process.env.LIMBUS_RECOVERY_ROOT || '../assets/recovery-2026-09-10')
  const source = path.join(base, 'complete-data')
  const definitions = new Map<string, { id: number; uniqueAttribute: string; updatedDate: number; sourceFile: string }>()
  for (const file of fs.readdirSync(source).sort().filter(f => /^personality-(?:\d+|a\d+c\d+p\d+)\.txt$/.test(f))) {
    for (const row of JSON.parse(fs.readFileSync(path.join(source, file), 'utf8').replace(/^\uFEFF/, '')).list ?? []) {
      const prior = definitions.get(String(row.id))
      if (!prior || (row.updatedDate ?? 0) >= prior.updatedDate) definitions.set(String(row.id), { ...row, sourceFile: file })
    }
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!, { db: { schema: 'limbus' }, auth: { persistSession: false } })
  const read = async () => {
    const { data, error } = await db.from('identities').select('id,game_id,sin_affinity,release_date,acquisition,acquisition_info,keywords,skill_keyword_list').order('game_id')
    if (error) throw error
    return data
  }
  const before = await read()
  const plan = before.map(row => {
    const def = definitions.get(String(row.game_id))
    if (!def) throw Error(`Missing source identity ${row.game_id}`)
    const metadata = identityMetadata(def)
    if (!metadata.sin_affinity || !metadata.release_date) throw Error(`Invalid source metadata ${row.game_id}`)
    // Preserve an existing curated release date; initial recovery only fills missing dates.
    return { id: row.id, game_id: row.game_id, sourceFile: def.sourceFile, updatedDate: def.updatedDate,
      after: { sin_affinity: metadata.sin_affinity, release_date: row.release_date || metadata.release_date } }
  })
  fs.writeFileSync(path.join(base, 'identity-metadata-plan.json'), JSON.stringify(plan, null, 2))
  console.log({ sourceMatched: plan.length, missingDates: before.filter(r => !r.release_date).length })
  if (!process.argv.includes('--apply')) return
  const backup = path.join(base, 'before-identity-metadata.json')
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, JSON.stringify(before, null, 2), { flag: 'wx' })
  for (const item of plan) {
    const { error } = await db.from('identities').update(item.after).eq('id', item.id)
    if (error) throw error
  }
  const saved = await read()
  for (const item of plan) {
    const row = saved.find(r => r.id === item.id)
    if (row?.sin_affinity !== item.after.sin_affinity || row?.release_date !== item.after.release_date) throw Error(`Readback mismatch ${item.game_id}`)
  }
  console.log({ verified: saved.length })
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
