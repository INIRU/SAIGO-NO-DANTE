import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRequestRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { uniqueSegments, type TranslateLang } from '@/lib/translate/segments'

// Cheap, fast model through Vercel AI Gateway (OIDC on Vercel, AI_GATEWAY_API_KEY locally).
const MODEL = 'google/gemini-2.5-flash-lite'
const MAX_CHARS = 30_000
const LANG_NAME: Record<TranslateLang, string> = { ko: 'Korean', en: 'English', ja: 'Japanese' }
const headers = { 'Cache-Control': 'private, no-store' }

type Kind = 'deck' | 'plan'

async function postTexts(kind: Kind, id: string) {
  const db = createAdminClient().schema('limbus')
  if (kind === 'deck') {
    const { data } = await db.from('decks').select('title, description').eq('id', id).maybeSingle()
    return data ? [data.title, data.description] : null
  }
  const { data } = await db.from('md_plans').select('title, description, floor_plan').eq('id', id).maybeSingle()
  if (!data) return null
  const memos = Array.isArray(data.floor_plan) ? data.floor_plan.map((floor: { memo?: unknown }) => typeof floor?.memo === 'string' ? floor.memo : null) : []
  return [data.title, data.description, ...memos]
}

async function translate(segments: string[], target: TranslateLang): Promise<string[]> {
  const { text } = await generateText({
    model: MODEL,
    temperature: 0,
    system: `You translate player-written notes about the game Limbus Company into ${LANG_NAME[target]}.
Return ONLY a JSON array of strings, the same length and order as the input array.
Keep Markdown, line breaks, emoji, numbers, URLs and anything inside backticks or [[...]] unchanged.
Use the official ${LANG_NAME[target]} Limbus Company terms (Sinner, Identity, E.G.O, E.G.O Gift, Theme Pack, Mirror Dungeon, Uptie, Sanity, Clash; keyword statuses like Burn, Bleed, Tremor, Rupture, Sinking, Poise, Charge). Leave a string unchanged if it is already in ${LANG_NAME[target]}.`,
    prompt: JSON.stringify(segments),
  })
  const parsed: unknown = JSON.parse(text.replace(/^\s*\`\`\`(?:json)?|\`\`\`\s*$/g, ''))
  if (!Array.isArray(parsed) || parsed.length !== segments.length || parsed.some(item => typeof item !== 'string')) throw new Error('bad translation shape')
  return parsed as string[]
}

/**
 * POST /api/translate { kind, id, target } — translates a deck's or plan's own texts (read from the DB, so this is
 * not a general translation endpoint) and caches the result per post and language. Used when the browser has no
 * built-in translator.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { kind?: unknown; id?: unknown; target?: unknown } | null
  const kind = body?.kind === 'deck' || body?.kind === 'plan' ? body.kind : null
  const id = typeof body?.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null
  const target = body?.target === 'ko' || body?.target === 'en' || body?.target === 'ja' ? body.target : null
  if (!kind || !id || !target) return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers })

  const texts = await postTexts(kind, id)
  if (!texts) return NextResponse.json({ error: 'Not found' }, { status: 404, headers })
  const segments = uniqueSegments(texts)
  if (!segments.length) return NextResponse.json({ pairs: [] }, { headers })
  if (segments.reduce((sum, segment) => sum + segment.length, 0) > MAX_CHARS) return NextResponse.json({ error: 'Too long' }, { status: 413, headers })

  const hash = createHash('sha256').update(JSON.stringify(segments)).digest('hex')
  const db = createAdminClient().schema('limbus')
  const cached = await db.from('post_translations').select('source_hash, pairs').eq('kind', kind).eq('post_id', id).eq('lang', target).maybeSingle()
  if (cached.data?.source_hash === hash) return NextResponse.json({ pairs: cached.data.pairs }, { headers })

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL) return NextResponse.json({ error: 'Translation unavailable' }, { status: 503, headers })
  const limit = checkRequestRateLimit(request, { bucket: 'create', scope: 'translate' })
  if (!limit.allowed) return rateLimitResponse(limit)
  try {
    const translated = await translate(segments, target)
    const pairs = segments.map((source, index) => [source, translated[index]])
    await db.from('post_translations').upsert({ kind, post_id: id, lang: target, source_hash: hash, pairs, created_at: new Date().toISOString() })
    return NextResponse.json({ pairs }, { headers })
  } catch {
    return NextResponse.json({ error: 'Translation failed' }, { status: 502, headers })
  }
}
