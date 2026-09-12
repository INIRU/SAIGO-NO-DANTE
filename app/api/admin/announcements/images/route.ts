import { uploadImage } from '@/lib/uploads/image'
import { requireAdmin } from '@/lib/auth'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.response
  const limit = checkRequestRateLimit(request, {
    scope: 'announcement-images',
    bucket: 'create',
    authenticatedKey: auth.session.user!.email,
  })
  if (!limit.allowed) return rateLimitResponse(limit)
  return uploadImage(request, 'announcements')
}
