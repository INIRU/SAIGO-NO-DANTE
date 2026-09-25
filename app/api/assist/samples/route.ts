import { after, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseSampleMeta, SAMPLE_FRAMES_EACH_SIDE, SAMPLE_MAX_FRAME_BYTES, SAMPLE_MAX_TOTAL_BYTES } from '@/lib/vision/assist-samples'

const BUCKET = 'assist-samples'
const KEEP_MS = 180 * 86_400_000
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status })

/** Opt-in recognition samples from Assist: no account, email or IP is stored with them. */
export async function POST(request: Request) {
  const limit = checkRequestRateLimit(request, { scope: 'assist-samples', bucket: 'sample' })
  if (!limit.allowed) return rateLimitResponse(limit)
  if (Number(request.headers.get('content-length')) > SAMPLE_MAX_TOTAL_BYTES + 64 * 1024) return bad('too large', 413)
  let form: FormData
  try { form = await request.formData() } catch { return bad('invalid form') }
  let meta = null
  try { meta = parseSampleMeta(JSON.parse(String(form.get('meta')))) } catch { /* rejected below */ }
  const frames = form.getAll('frame')
  if (!meta || !frames.length || frames.length > SAMPLE_FRAMES_EACH_SIDE * 2) return bad('invalid sample')
  if (frames.some(frame => !(frame instanceof File) || frame.type !== 'image/jpeg' || !frame.size || frame.size > SAMPLE_MAX_FRAME_BYTES) ||
    frames.reduce((total, frame) => total + (frame as File).size, 0) > SAMPLE_MAX_TOTAL_BYTES) return bad('invalid frames')
  const images = await Promise.all(frames.map(async frame => Buffer.from(await (frame as File).arrayBuffer())))
  if (images.some(image => image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff)) return bad('invalid frames')

  const admin = createAdminClient()
  const bucket = admin.storage.from(BUCKET)
  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}`
  const files = images.map((_, index) => `${path}/${index}.jpg`)
  const uploads = await Promise.all(images.map((image, index) => bucket.upload(files[index], image, { contentType: 'image/jpeg', upsert: false })))
  const { error } = uploads.some(upload => upload.error) ? { error: true }
    : await admin.schema('limbus').from('assist_samples').insert({ reason: meta.reason, meta, frame_count: images.length, path })
  if (error) {
    await bucket.remove(files)
    return bad('not saved', 500)
  }
  after(purgeExpired)
  return NextResponse.json({ ok: true }, { status: 201 })
}

// lazy retention, at most 20 expired samples per POST; move to a scheduled job if volume outgrows it.
async function purgeExpired() {
  const admin = createAdminClient()
  const { data, error } = await admin.schema('limbus').from('assist_samples').select('id, path, frame_count')
    .lt('created_at', new Date(Date.now() - KEEP_MS).toISOString()).order('created_at').limit(20)
  if (error || !data?.length) return
  const files = data.flatMap(row => Array.from({ length: row.frame_count }, (_, index) => `${row.path}/${index}.jpg`))
  const removed = await admin.storage.from(BUCKET).remove(files)
  if (!removed.error) await admin.schema('limbus').from('assist_samples').delete().in('id', data.map(row => row.id))
}
