import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

// Restore archived originals only; never overwrite a newer registered document.
const root = fileURLToPath(new URL('../', import.meta.url))
nextEnv.loadEnvConfig(root, true, { info() {}, error() {} })
const originals = JSON.parse(await readFile(new URL('../backups/2026-03-23/legal_docs.json', import.meta.url), 'utf8'))
assert.deepEqual(originals.map(doc => doc.type).sort(), ['privacy', 'terms'])
for (const doc of originals) assert.ok(doc.title && doc.last_updated && Array.isArray(doc.sections) && doc.sections.length)
const rows = originals.map(doc => ({ ...doc, lang: 'ko', version: 'v1' }))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).schema('limbus')
const { data: existing, error } = await db.from('legal_docs').select('type,lang').eq('lang', 'ko')
if (error) throw new Error(error.message)
const missing = rows.filter(doc => !existing.some(row => row.type === doc.type))
console.log('Missing Korean documents:', missing.map(doc => doc.type))
if (process.argv.includes('--apply') && missing.length) {
  const result = await db.from('legal_docs').upsert(missing, { onConflict: 'type,lang', ignoreDuplicates: true })
  if (result.error) throw new Error(result.error.message)
  const verified = await db.from('legal_docs').select('type,lang,title,sections,last_updated').eq('lang', 'ko')
  if (verified.error) throw new Error(verified.error.message)
  for (const doc of missing) {
    const restored = verified.data.find(row => row.type === doc.type)
    assert.deepEqual(restored, { type: doc.type, lang: 'ko', title: doc.title, sections: doc.sections, last_updated: doc.last_updated })
  }
  console.log('Restored and verified:', missing.map(doc => doc.type))
}
