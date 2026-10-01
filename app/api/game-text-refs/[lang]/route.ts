import { NextResponse } from 'next/server'
import { getGameTextRefDescriptions, getGameTextRefNames } from '@/lib/db/game-text-refs'
import { routing } from '@/lib/i18n/routing'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'
import type { SupportedLang } from '@/lib/i18n/types'

/**
 * What `[Id]` references in raw game text stand for, for one site language: kind, label and keyword_meta name per id.
 * `?part=descriptions` returns the keywords' game descriptions instead (tooltips load them when first needed).
 */
export async function GET(request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!(routing.locales as readonly string[]).includes(lang)) return NextResponse.json({ error: 'Unknown language' }, { status: 404 })
  const part = new URL(request.url).searchParams.get('part')
  if (part !== null && part !== 'descriptions') return NextResponse.json({ error: 'Unknown part' }, { status: 400 })
  try {
    const body = part === 'descriptions'
      ? await getGameTextRefDescriptions(lang as SupportedLang)
      : await getGameTextRefNames(lang as SupportedLang)
    return NextResponse.json(body, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
}
