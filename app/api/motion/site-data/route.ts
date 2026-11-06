import { NextResponse } from 'next/server'
import { loadMotionSiteData } from '@/features/motion/server'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'
import type { SupportedLang } from '@/lib/i18n/types'

const LANGS = new Set(['ko', 'en', 'ja'])

/** The site's names and sprites for the skill motion list in one language; the browser reads the R2 index itself. */
export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get('lang') ?? 'ko'
  const lang = (LANGS.has(asked) ? asked : 'ko') as SupportedLang
  try {
    return NextResponse.json(await loadMotionSiteData(lang), { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch (error) {
    console.error('[motion/site-data]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
