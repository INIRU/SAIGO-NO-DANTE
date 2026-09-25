import { NextResponse } from 'next/server'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { storedTranslation, translatePost, translationAvailable } from '@/lib/translate/server'

const headers = { 'Cache-Control': 'private, no-store' }

/**
 * POST /api/translate { kind, id, target } — the stored translation of a deck or plan, generated on first request
 * for posts saved before automatic translation. Only the post's own texts are translated (read from the DB).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { kind?: unknown; id?: unknown; target?: unknown } | null
  const kind = body?.kind === 'deck' || body?.kind === 'plan' ? body.kind : null
  const id = typeof body?.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null
  const target = body?.target === 'ko' || body?.target === 'en' || body?.target === 'ja' ? body.target : null
  if (!kind || !id || !target) return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers })
  const stored = await storedTranslation(kind, id, target)
  if (stored) return NextResponse.json({ pairs: stored }, { headers })
  if (!translationAvailable()) return NextResponse.json({ error: 'Translation unavailable' }, { status: 503, headers })
  const limit = checkRequestRateLimit(request, { bucket: 'create', scope: 'translate' })
  if (!limit.allowed) return rateLimitResponse(limit)
  const pairs = await translatePost(kind, id, target)
  return pairs ? NextResponse.json({ pairs }, { headers }) : NextResponse.json({ error: 'Translation failed' }, { status: 502, headers })
}
