#!/usr/bin/env tsx
/**
 * Undo one site apply of a Windows extraction (apply-extraction.ts): every table it may write goes back to the backup
 * taken before its first write, and the images it uploaded are removed (new) or put back (overwritten).
 *
 *   node --import tsx scripts/sync/extraction-restore.ts --work <apply work dir> [--fix]
 *
 * Without --fix it only writes the plan. With --fix it first saves the current rows under restores/<time>/backup, so
 * running this script on that folder undoes the restore (tables only). Rows the apply added are deleted, except
 * identities and EGO that decks or plans already use (deleting an identity also deletes deck slots) and their skills.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

type Row = Record<string, unknown>
/** Tables apply-extraction writes, parents before children (upserts in this order, deletions in reverse). */
export const RESTORE_TABLES: readonly { table: string; key: readonly string[]; parent?: { column: string; table: string } }[] = [
  { table: 'sinners', key: ['id'] },
  { table: 'identities', key: ['id'] },
  { table: 'ego', key: ['id'] },
  { table: 'keyword_meta', key: ['name'] },
  { table: 'ego_gifts', key: ['id'] },
  { table: 'ego_gift_themes', key: ['id'] },
  { table: 'ego_gift_recipes', key: ['id'] },
  { table: 'md_events', key: ['id'] },
  { table: 'md_event_choices', key: ['id'] },
  { table: 'skills', key: ['id'], parent: { column: 'identity_id', table: 'identities' } },
  { table: 'passives', key: ['id'], parent: { column: 'identity_id', table: 'identities' } },
  { table: 'ego_skills', key: ['id'], parent: { column: 'ego_id', table: 'ego' } },
  { table: 'ego_passives', key: ['ego_id', 'game_passive_id'], parent: { column: 'ego_id', table: 'ego' } },
]

const rowKey = (row: Row, key: readonly string[]) => key.map(column => String(row[column])).join('\u0000')

/**
 * What restoring one table takes: backup rows missing or changed now are written back, rows that did not exist then are
 * deleted unless kept (in use). Pure, so it can be checked without a database.
 */
export function restorePlan(backup: Row[], current: Row[], key: readonly string[], keep: (row: Row) => boolean = () => false) {
  const now = new Map(current.map(row => [rowKey(row, key), row]))
  const then = new Set(backup.map(row => rowKey(row, key)))
  const upsert = backup.filter(row => { const present = now.get(rowKey(row, key)); return !present || JSON.stringify(present) !== JSON.stringify(row) })
  const added = current.filter(row => !then.has(rowKey(row, key)))
  return { upsert, remove: added.filter(row => !keep(row)), kept: added.filter(keep) }
}

config({ path: '.env.local', quiet: true })
const args = process.argv.slice(2)
const option = (name: string) => { const at = args.indexOf(name); return at === -1 ? undefined : args[at + 1] }
const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!)
const db = () => client().schema('limbus')

async function all(table: string, key: readonly string[]) {
  const rows: Row[] = []
  for (let offset = 0; ; offset += 1000) {
    let query = db().from(table).select('*')
    for (const column of key) query = query.order(column)
    const { data, error } = await query.range(offset, offset + 999)
    if (error) throw Error(`${table}: ${error.message}`)
    rows.push(...(data as Row[]))
    if (data.length < 1000) return rows
  }
}

/** Identities and EGO added by the apply that a deck or a plan already uses. */
async function inUse(table: 'identities' | 'ego', ids: string[]) {
  const used = new Set<string>()
  for (const id of ids) {
    const slot = table === 'identities'
      ? await db().from('deck_identities').select('identity_id').eq('identity_id', id).limit(1)
      : await db().from('deck_egos').select('ego_id').eq('ego_id', id).limit(1)
    // deck/egos are jsonb arrays of slots: containment takes a JSON literal.
    const plan = await db().from('md_plans').select('id')
      .filter(table === 'identities' ? 'deck' : 'egos', 'cs', JSON.stringify([table === 'identities' ? { identity_id: id } : { ego_id: id }])).limit(1)
    if (slot.error || plan.error) throw Error(`in-use check: ${(slot.error ?? plan.error)!.message}`)
    if (slot.data.length || plan.data.length) used.add(id)
  }
  return used
}

async function main() {
  const work = option('--work') && resolve(option('--work')!)
  const fix = args.includes('--fix')
  if (!work || !existsSync(join(work, 'backup'))) throw Error('usage: --work <apply work dir with backup/> [--fix]')
  const out = join(work, 'restores', new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(out, { recursive: true })
  const tables = RESTORE_TABLES.filter(({ table }) => existsSync(join(work, 'backup', `${table}.json`)))
  const backups = new Map(tables.map(({ table }) => [table, JSON.parse(readFileSync(join(work, 'backup', `${table}.json`), 'utf8')) as Row[]]))
  const currents = new Map<string, Row[]>()
  for (const { table, key } of tables) currents.set(table, await all(table, key))

  // New identities and EGO in use stay, with their own skills and passives.
  const kept = new Map<string, Set<string>>()
  for (const table of ['identities', 'ego'] as const) {
    if (!backups.has(table)) continue
    const added = restorePlan(backups.get(table)!, currents.get(table)!, ['id']).remove.map(row => String(row.id))
    kept.set(table, await inUse(table, added))
  }
  const plans = tables.map(({ table, key, parent }) => {
    const keepIds = kept.get(table) ?? kept.get(parent?.table ?? '')
    const column = kept.has(table) ? 'id' : parent?.column
    return { table, key, ...restorePlan(backups.get(table)!, currents.get(table)!, key, row => !!keepIds && !!column && keepIds.has(String(row[column]))) }
  })

  // Images: this apply's uploads (report.uploads) and new identities' images (identity-images/upload-receipt.json).
  const report = existsSync(join(work, 'report.json')) ? JSON.parse(readFileSync(join(work, 'report.json'), 'utf8')) : {}
  const uploads: { key: string; before: string | null }[] = [...(report.uploads ?? [])]
  const receipt = join(work, 'identity-images', 'upload-receipt.json')
  if (existsSync(receipt)) for (const item of JSON.parse(readFileSync(receipt, 'utf8')) as { key: string }[]) {
    const before = join(work, 'identity-images', 'before', item.key)
    uploads.push({ key: item.key, before: existsSync(before) ? before : null })
  }

  const summary = { work: basename(work), fix, tables: plans.map(plan => ({ table: plan.table, restore: plan.upsert.length, remove: plan.remove.length, kept: plan.kept.length })),
    keptInUse: Object.fromEntries([...kept].map(([table, ids]) => [table, [...ids]])), images: { remove: uploads.filter(item => !item.before).length, restore: uploads.filter(item => item.before).length } }
  writeFileSync(join(out, 'plan.json'), JSON.stringify({ ...summary, rows: plans.map(({ table, upsert, remove }) => ({ table, upsert, remove })), uploads }, null, 2))
  console.log(JSON.stringify(summary))
  if (!fix) return

  mkdirSync(join(out, 'backup'), { recursive: true })
  for (const { table } of tables) writeFileSync(join(out, 'backup', `${table}.json`), JSON.stringify(currents.get(table)), { flag: 'wx' })
  for (const { table, key, upsert } of plans) for (let at = 0; at < upsert.length; at += 200) {
    const { error } = await db().from(table).upsert(upsert.slice(at, at + 200), { onConflict: key.join(',') })
    if (error) throw Error(`restore ${table}: ${error.message}`)
  }
  for (const { table, key, remove } of [...plans].reverse()) for (let at = 0; at < remove.length; at += 100) {
    const batch = remove.slice(at, at + 100)
    const { error } = key.length === 1
      ? await db().from(table).delete().in(key[0], batch.map(row => row[key[0]] as string))
      : await db().from(table).delete().or(batch.map(row => `and(${key.map(column => `${column}.eq.${row[column]}`).join(',')})`).join(','))
    if (error) throw Error(`remove ${table}: ${error.message}`)
  }
  const bucket = client().storage.from('limbus-assets')
  for (const item of uploads) {
    const { error } = item.before
      ? await bucket.upload(item.key, readFileSync(item.before), { contentType: 'image/webp', cacheControl: '3600', upsert: true })
      : await bucket.remove([item.key])
    if (error) throw Error(`image ${item.key}: ${error.message}`)
  }
  const site = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL, secret = process.env.REVALIDATION_SECRET
  if (site && secret) await fetch(`${site}/api/revalidate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-revalidation-secret': secret }, body: JSON.stringify({ scope: 'all-game-data' }) })
  writeFileSync(join(work, 'restored.json'), JSON.stringify({ at: new Date().toISOString(), undo: out, ...summary }, null, 2))
  console.log('restored')
}

// Bundled with other scripts, so the file name is checked as well (see identity-data.ts).
if (/extraction-restore\.[cm]?[jt]s$/.test(process.argv[1] ?? '')) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
