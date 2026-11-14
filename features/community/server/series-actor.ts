import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { findOrCreateSupabaseUser } from '@/lib/supabase/find-or-create-user'
import { discoveryUserId } from '@/features/community/lib/user-id'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { isAllowedRequestOrigin } from '@/lib/request-origin'

export const seriesHeaders = { 'Cache-Control': 'private, no-store' }
export const seriesFail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: seriesHeaders })

/**
 * The signed-in user behind a series request. Reading never creates an account (id is null for a session without a
 * profile); writing checks the origin and the rate limit first.
 */
export async function seriesActor(request: NextRequest, write: boolean) {
  const auth = await requireActiveUser()
  if (auth.error) return auth.response as Response
  if (write) {
    if (!isAllowedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin, request.headers.get('host'), [])) return seriesFail('Forbidden', 403)
    const limit = checkRequestRateLimit(request, { scope: 'series', authenticatedKey: auth.session.user.email })
    if (!limit.allowed) return rateLimitResponse(limit)
  }
  const admin = createAdminClient()
  const email = auth.session.user.email!
  try {
    const id = write
      ? await findOrCreateSupabaseUser(admin, email, auth.session.user.name, auth.session.user.image)
      : await discoveryUserId(admin.schema('limbus'), email)
    return { admin, id } as const
  } catch (error) {
    console.error('[series] account lookup failed:', error instanceof Error ? error.message : error)
    return seriesFail('Series unavailable', 503)
  }
}
