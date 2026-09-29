import { NextResponse } from 'next/server'
import { getKeywordData, keywordDescriptions } from '@/lib/keywords/server-data'
import { routing } from '@/lib/i18n/routing'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'
import type { SupportedLang } from '@/lib/i18n/types'

/** Keyword tooltip descriptions for one site language (the layout's catalog leaves them out). */
export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!(routing.locales as readonly string[]).includes(lang)) return NextResponse.json({ error: 'Unknown language' }, { status: 404 })
  try {
    return NextResponse.json(keywordDescriptions(await getKeywordData(), lang as SupportedLang), {
      headers: { 'Cache-Control': CATALOG_CACHE_CONTROL },
    })
  } catch {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 })
  }
}
