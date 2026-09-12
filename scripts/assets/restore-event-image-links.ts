/** Reconnect only event IDs with a verified Drive upload receipt. No inferred artwork. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { eventImageId } from './event-image-source'
config({ path: '.env.local', quiet: true })

async function main() {
  const apply = process.argv.includes('--fix')
  const recovery = resolve(process.env.LIMBUS_RECOVERY_DIR || '../assets/recovery-2026-09-10')
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const client = createClient(base, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const db = client.schema('limbus')
  const { data: events, error } = await db.from('md_events').select('id,image_url').order('id')
  if (error) throw error
  const receipts: { target: string; sha256: string; sourceId: string }[] = JSON.parse(readFileSync(join(recovery, 'mirror-assets-upload.json'), 'utf8'))
  const byId = new Map(receipts.filter(r => /^icons\/events\/\d+\.webp$/.test(r.target)).map(r => [Number(r.target.match(/(\d+)\.webp$/)![1]), r]))
  const updates = (events || []).flatMap(event => {
    const receipt = byId.get(eventImageId(event.id))
    return !event.image_url && receipt ? [{ id: event.id, image_url: `${base}/storage/v1/object/public/limbus-assets/${receipt.target}`, receipt }] : []
  })
  // Verify actual public bytes before proposing any write. A successful upload alone is insufficient.
  let next = 0
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < updates.length) {
      const update = updates[next++]
      const response = await fetch(update.image_url)
      if (!response.ok) throw Error(`HTTP ${response.status}: event ${update.id}`)
      const hash = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')
      if (hash !== update.receipt.sha256) throw Error(`Public hash mismatch: event ${update.id}`)
    }
  }))
  if (updates.length) writeFileSync(join(recovery, 'event-image-links-plan.json'), JSON.stringify(updates, null, 2))
  console.log(JSON.stringify({ events: events?.length, verifiedLinks: updates.length, apply }))
  if (!apply || !updates.length) return
  const backup = join(recovery, 'before-event-image-links.json')
  if (!existsSync(backup)) writeFileSync(backup, JSON.stringify(events, null, 2))
  // Retain the exact state before each later recovery, too.
  const snapshot = JSON.stringify(events, null, 2)
  const revision = createHash('sha256').update(snapshot).digest('hex').slice(0, 12)
  writeFileSync(join(recovery, `before-event-image-links-${revision}.json`), snapshot)
  for (const { id, image_url } of updates) {
    const { error: updateError } = await db.from('md_events').update({ image_url }).eq('id', id).is('image_url', null)
    if (updateError) throw updateError
  }
  const { data: after, error: afterError } = await db.from('md_events').select('id,image_url')
  if (afterError) throw afterError
  const current = new Map(after.map(e => [e.id, e.image_url]))
  if (updates.some(e => current.get(e.id) !== e.image_url)) throw Error('Read-back mismatch')
  console.log(`Reconnected and read back ${updates.length} event images`)
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
