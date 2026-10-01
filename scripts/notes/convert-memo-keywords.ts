#!/usr/bin/env tsx
/**
 * Old memos → explicit keyword chips (see lib/notes/memo-keywords.ts and scripts/notes/memo-conversion.ts).
 *
 *   npx tsx scripts/notes/convert-memo-keywords.ts --out <dir>                  dry run: reads the database, writes the
 *                                                                               preview report (JSON + markdown) to <dir>
 *   npx tsx scripts/notes/convert-memo-keywords.ts --out <dir> --backup <dir> --fix
 *                                                                               backs up the affected rows, updates them,
 *                                                                               reads them back and verifies
 *
 * The default never writes to the database. Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (.env.local); the key
 * stays in this process and is never printed.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import type { KeywordInfo } from '../../lib/keywords/catalog'
import { isMissingColumnError, keywordTextsFromRefs, loadKeywordRefTexts } from '../../lib/keywords/ref-text'
import { MEMO_TABLES, runMemoConversion, type MemoRow, type MemoStore, type MemoTable } from './memo-conversion'

config({ path: '.env.local' })

const PAGE = 1000
const COLUMNS: Record<MemoTable, string> = { decks: 'id, description', md_plans: 'id, description, floor_plan' }

function createStore(db: SupabaseClient): MemoStore {
  const toRow = (table: MemoTable, row: Record<string, unknown>): MemoRow => ({
    table, id: String(row.id), description: typeof row.description === 'string' ? row.description : null,
    ...(table === 'md_plans' ? { floor_plan: row.floor_plan } : {}),
  })
  return {
    async loadCatalog() {
      const read = async (columns: string) => {
        const rows: Record<string, unknown>[] = []
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await db.schema('limbus').from('keyword_meta').select(columns).order('name').range(from, from + PAGE - 1)
          if (error) return { rows, error }
          rows.push(...(data as unknown as Record<string, unknown>[]))
          if (data.length < PAGE) break
        }
        return { rows, error: null }
      }
      let result = await read('name, name_en, name_jp, game_id')
      if (result.error && isMissingColumnError(result.error)) result = await read('name, name_en, name_jp')
      if (result.error) throw new Error(`keyword_meta: ${result.error.message}`)
      const metas = result.rows as { name: string; name_en?: string | null; name_jp?: string | null; game_id?: string | null }[]
      // The names the site shows (the reference table's, where keyword_meta has a game_id), as the layout catalog builds them.
      const refs = metas.some(row => row.game_id) ? await loadKeywordRefTexts(db) : null
      const catalog: Record<string, KeywordInfo> = {}
      for (const row of metas.map(meta => keywordTextsFromRefs(meta, refs))) catalog[row.name] = { desc: '', nameEn: row.name_en ?? null, nameJp: row.name_jp ?? null }
      return catalog
    },
    async loadRows(table) {
      const rows: MemoRow[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db.schema('limbus').from(table).select(COLUMNS[table]).order('id').range(from, from + PAGE - 1)
        if (error) throw new Error(`${table}: ${error.message}`)
        rows.push(...(data as unknown as Record<string, unknown>[]).map(row => toRow(table, row)))
        if (data.length < PAGE) break
      }
      return rows
    },
    async getRow(table, id) {
      const { data, error } = await db.schema('limbus').from(table).select(COLUMNS[table]).eq('id', id).maybeSingle()
      if (error) throw new Error(`${table} ${id}: ${error.message}`)
      return data ? toRow(table, data as unknown as Record<string, unknown>) : null
    },
    async loadFullRows(table, ids) {
      const rows: Record<string, unknown>[] = []
      for (let at = 0; at < ids.length; at += 100) {
        const { data, error } = await db.schema('limbus').from(table).select('*').in('id', ids.slice(at, at + 100))
        if (error) throw new Error(`${table} backup: ${error.message}`)
        rows.push(...(data as unknown as Record<string, unknown>[]))
      }
      return rows
    },
    async updateRow(table, id, patch) {
      const { error } = await db.schema('limbus').from(table).update(patch).eq('id', id)
      if (error) throw new Error(`${table} ${id}: ${error.message}`)
    },
  }
}

function option(args: string[], name: string): string | undefined {
  const at = args.indexOf(name)
  if (at < 0) return undefined
  const value = args[at + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`)
  return value
}

async function main() {
  const args = process.argv.slice(2)
  const outDir = option(args, '--out')
  const backupDir = option(args, '--backup')
  const fix = args.includes('--fix')
  if (!outDir) throw new Error('Usage: convert-memo-keywords.ts --out <dir> [--backup <dir> --fix]')
  if (fix && !backupDir) throw new Error('--fix needs --backup <dir>')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY')
  console.log(fix ? 'mode: fix (writes to the database)' : 'mode: dry-run (nothing is written)')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const report = await runMemoConversion(createStore(db), { outDir, backupDir, fix, log: message => console.log(message) })
  console.log(`tables: ${MEMO_TABLES.join(', ')}`)
  console.log(`totals: ${JSON.stringify(report.totals)}`)
  console.log(`report: ${outDir}/memo-conversion-${report.mode}.md`)
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
