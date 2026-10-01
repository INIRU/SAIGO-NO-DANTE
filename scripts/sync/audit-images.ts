#!/usr/bin/env tsx
/**
 * Read-only audit of the images the production DB references: keyword icons, identity skill icons, gift icons, theme pack images and
 * event images (theme pack boss images are left out), each checked against the limbus-assets bucket. Writes nothing.
 *
 *   node --import tsx scripts/sync/audit-images.ts [--json <file>] [--limit <keys per kind>] [--strict]
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and a Supabase key in .env.local. --json saves the result; --strict exits 1 when anything is missing.
 * The same audit runs at the end of every apply-extraction --fix (report.json: missingImages).
 */
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { IMAGE_AUDIT_KEY_LIMIT, IMAGE_AUDIT_KINDS, auditImages, formatMissingImages, supabaseAuditSource } from './image-audit'

async function main() {
  config({ path: '.env.local', quiet: true })
  const args = process.argv.slice(2)
  const option = (name: string) => { const at = args.indexOf(name); return at === -1 ? undefined : args[at + 1] }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (.env.local)')
  const limit = Number(option('--limit') ?? IMAGE_AUDIT_KEY_LIMIT)
  if (!Number.isInteger(limit) || limit < 0) throw Error('--limit must be a whole number')
  const result = await auditImages(supabaseAuditSource(createClient(url, key)), { limit, localExists: path => existsSync(join(process.cwd(), 'public', path)) })
  for (const line of formatMissingImages(result)) console.log(line)
  const file = option('--json')
  if (file) writeFileSync(file, JSON.stringify(result, null, 2) + '\n')
  if (args.includes('--strict') && IMAGE_AUDIT_KINDS.some(kind => result[kind].missing)) process.exitCode = 1
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
