import { NextResponse } from 'next/server'
import { loadMotionCatalog } from '@/lib/motion/feed'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'
import type { SupportedLang } from '@/lib/i18n/types'

const LANGS = new Set(['ko', 'en', 'ja'])

/** The skill motion list (R2 index.json grouped by sinner → identity → skill → state) in one language. */
export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get('lang') ?? 'ko'
  const lang = (LANGS.has(asked) ? asked : 'ko') as SupportedLang
  try {
    return NextResponse.json({ sinners: await loadMotionCatalog(lang) }, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch (error) {
    console.error('[motion/catalog]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
