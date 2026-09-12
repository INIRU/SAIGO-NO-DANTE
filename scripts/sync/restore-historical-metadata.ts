/** Recover curated catalogue fields without altering the original backup. Dry run by default. */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Identity } from '../../lib/types'
import { restoreHistoricalMetadata } from './identity-metadata'

async function main() {
  process.loadEnvFile('.env.local')
  const original = process.argv.find(arg => arg.startsWith('--source='))?.slice('--source='.length)
  if (!original) throw Error('Required: --source=/path/to/original/identities.json')
  const raw = fs.readFileSync(original)
  const historical = JSON.parse(raw.toString('utf8')) as Identity[]
  const byId = new Map(historical.map(row => [String(row.game_id), row]))
  if (byId.size !== historical.length || byId.has('undefined')) throw Error('Invalid or duplicate source game IDs')
  const base = path.resolve(process.env.LIMBUS_RECOVERY_ROOT || '../assets/recovery-2026-09-10')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!, { db: { schema: 'limbus' }, auth: { persistSession: false } })
  const read = async () => {
    const { data, error } = await db.from('identities').select('id,game_id,quote,acquisition,acquisition_info').order('game_id')
    if (error) throw error
    return data as Identity[]
  }
  const before = await read()
  const plan = before.flatMap(row => {
    const old = byId.get(String(row.game_id))
    if (!old) return []
    return [{ id: row.id, game_id: row.game_id, after: restoreHistoricalMetadata(row, old) }]
  })
  const provenance = { source: path.resolve(original), sha256: createHash('sha256').update(raw).digest('hex'), rows: historical.length, plan }
  fs.writeFileSync(path.join(base, 'historical-metadata-plan.json'), JSON.stringify(provenance, null, 2))
  console.log({ sourceRows: historical.length, matched: plan.length, quoteRestored: plan.filter(p => !before.find(r => r.id === p.id)?.quote && p.after.quote).length })
  if (!process.argv.includes('--apply')) return
  const backup = path.join(base, 'before-historical-metadata.json')
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, JSON.stringify(before, null, 2), { flag: 'wx' })
  for (const item of plan) {
    const { error } = await db.from('identities').update(item.after).eq('id', item.id)
    if (error) throw error
  }
  const saved = await read()
  for (const item of plan) {
    const row = saved.find(r => r.id === item.id)!
    if (row.quote !== item.after.quote || row.acquisition !== item.after.acquisition) throw Error(`Text mismatch ${item.game_id}`)
    for (const [key, value] of Object.entries(item.after.acquisition_info ?? {})) {
      if ((row.acquisition_info as unknown as Record<string, unknown>)?.[key] !== value) throw Error(`Acquisition mismatch ${item.game_id}.${key}`)
    }
  }
  console.log({ verified: plan.length, total: saved.length, missingQuotes: saved.filter(r => !r.quote).length })
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
