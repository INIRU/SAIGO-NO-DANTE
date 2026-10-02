import { after, NextResponse } from 'next/server'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseAssistReport } from '@/lib/vision/assist-report'

const KEEP_MS = 180 * 86_400_000
const MAX_BYTES = 64 * 1024

/**
 * Opt-in Assist recognition reports (lib/vision/assist-report.ts): read/held counts and hand edits of one capture session.
 * No account, email or IP is stored; rows are removed after 180 days.
 */
export async function POST(request: Request) {
  const limit = checkRequestRateLimit(request, { scope: 'assist-reports', bucket: 'sample' })
  if (!limit.allowed) return rateLimitResponse(limit)
  const raw = await request.text().catch(() => '')
  if (!raw || raw.length > MAX_BYTES) return NextResponse.json({ error: 'invalid report' }, { status: 400 })
  let report
  try { report = parseAssistReport(JSON.parse(raw)) } catch { report = null }
  if (!report) return NextResponse.json({ error: 'invalid report' }, { status: 400 })
  const { session, counts, corrections, ...meta } = report
  const { error } = await createAdminClient().schema('limbus').from('assist_reports').insert({ session, meta, counts, corrections })
  if (error) return NextResponse.json({ error: 'not saved' }, { status: 500 })
  after(purgeExpired)
  return new NextResponse(null, { status: 204 })
}

async function purgeExpired() {
  await createAdminClient().schema('limbus').from('assist_reports').delete()
    .lt('created_at', new Date(Date.now() - KEEP_MS).toISOString())
}
