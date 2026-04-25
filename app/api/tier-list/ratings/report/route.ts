import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/findOrCreateUser'

const DEFAULT_REASON = 'inappropriate'
const MAX_REASON_LENGTH = 120
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeReason(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_REASON
  const reason = value.trim().slice(0, MAX_REASON_LENGTH)
  return reason.length > 0 ? reason : DEFAULT_REASON
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || error.message?.includes('tier_rating_reports') === true
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveUser()
    if (auth.error) return auth.response
    const { session } = auth

    const body = await request.json()
    const ratingId = typeof body.ratingId === 'string' ? body.ratingId.trim() : ''
    const reason = normalizeReason(body.reason)

    if (!ratingId) {
      return NextResponse.json({ error: 'ratingId가 필요합니다.' }, { status: 400 })
    }
    if (!UUID_PATTERN.test(ratingId)) {
      return NextResponse.json({ error: '유효하지 않은 ratingId입니다.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const reporterId = await findOrCreateSupabaseUser(
      admin,
      session.user.email!,
      session.user.name,
      session.user.image,
    )
    if (!reporterId) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 500 })
    }

    const { data: rating, error: ratingError } = await admin
      .schema('limbus')
      .from('tier_ratings')
      .select('id')
      .eq('id', ratingId)
      .maybeSingle()

    if (ratingError) {
      if (isMissingTableError(ratingError)) {
        return NextResponse.json({
          error: '평가 신고 테이블이 아직 준비되지 않았습니다.',
          code: 'tier_rating_reports_missing',
        }, { status: 503 })
      }
      return NextResponse.json({ error: ratingError.message }, { status: 500 })
    }
    if (!rating) {
      return NextResponse.json({ error: '신고할 평가를 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: report, error: reportError } = await admin
      .schema('limbus')
      .from('tier_rating_reports')
      .upsert(
        { rating_id: ratingId, reporter_id: reporterId, reason },
        { onConflict: 'rating_id,reporter_id' },
      )
      .select('id, status, created_at')
      .single()

    if (reportError) {
      if (isMissingTableError(reportError)) {
        return NextResponse.json({
          error: '평가 신고 테이블이 아직 준비되지 않았습니다.',
          code: 'tier_rating_reports_missing',
        }, { status: 503 })
      }
      return NextResponse.json({ error: reportError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        status: report.status,
        created_at: report.created_at,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
