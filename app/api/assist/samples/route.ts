import { after, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { toJson } from '@/lib/supabase/json'
import { fail } from '@/lib/api/respond'
import { parseSampleMeta, SAMPLE_BUCKET, SAMPLE_KEEP_MS, SAMPLE_MAX_FRAMES, SAMPLE_MAX_FRAME_BYTES } from '@/features/assist'

/** All uploads together, per UTC day; later samples are refused for the day. */
const DAILY_BYTES = 2 * 1024 ** 3

/**
 * Opt-in recognition samples from Assist: no account, email or IP is stored with them. The browser sends the metadata and
 * frame sizes; it gets one signed upload per frame and sends the JPEGs straight to the private bucket, which only takes
 * image/jpeg up to 400 KB.
 */
export async function POST(request: Request) {
  const limit = checkRequestRateLimit(request, { scope: 'assist-samples', bucket: 'sample' })
  if (!limit.allowed) return rateLimitResponse(limit)
  let body: { meta?: unknown; sizes?: unknown }
  try { body = await request.json() } catch { return fail(400, 'invalid body') }
  const meta = parseSampleMeta(body?.meta)
  const sizes = body?.sizes
  if (!meta || !Array.isArray(sizes) || !sizes.length || sizes.length > SAMPLE_MAX_FRAMES ||
    !sizes.every(size => Number.isInteger(size) && size > 0 && size <= SAMPLE_MAX_FRAME_BYTES)) return fail(400, 'invalid sample')
  const size = (sizes as number[]).reduce((total, value) => total + value, 0)

  const admin = createAdminClient()
  const day = new Date().toISOString().slice(0, 10)
  const today = await admin.schema('limbus').rpc('assist_sample_bytes_since', { since: day })
  if (today.error || Number(today.data ?? 0) + size > DAILY_BYTES) return fail(429, 'daily limit')
  const bucket = admin.storage.from(SAMPLE_BUCKET)
  const path = day + '/' + randomUUID()
  const signed = await Promise.all(sizes.map((_, index) => bucket.createSignedUploadUrl(path + '/' + index + '.jpg')))
  if (signed.some(item => item.error || !item.data)) return fail(500, 'not saved')
  const { error } = await admin.schema('limbus').from('assist_samples').insert({ reason: meta.reason, meta: toJson(meta), frame_count: sizes.length, bytes: size, path })
  if (error) return fail(500, 'not saved')
  after(purgeExpired)
  return NextResponse.json({ uploads: signed.map(item => ({ path: item.data!.path, token: item.data!.token })) }, { status: 201 })
}

// Samples sent before the training consent (no consent version in the metadata) were promised deletion after 180 days;
// later ones are kept (sampleExpiresAt is the same rule for downloaded copies).
// Lazy retention, at most 20 expired samples per POST; move to a scheduled job if volume outgrows it.
async function purgeExpired() {
  const admin = createAdminClient()
  const { data, error } = await admin.schema('limbus').from('assist_samples').select('id, path, frame_count')
    .is('meta->consent', null).lt('created_at', new Date(Date.now() - SAMPLE_KEEP_MS).toISOString()).order('created_at').limit(20)
  if (error || !data?.length) return
  const files = data.flatMap(row => Array.from({ length: row.frame_count }, (_, index) => row.path + '/' + index + '.jpg'))
  const removed = await admin.storage.from(SAMPLE_BUCKET).remove(files)
  if (!removed.error) await admin.schema('limbus').from('assist_samples').delete().in('id', data.map(row => row.id))
}
