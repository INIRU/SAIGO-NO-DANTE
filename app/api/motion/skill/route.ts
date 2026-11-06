import { NextResponse } from 'next/server'
import { loadMotionSkill } from '@/features/motion/server'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'
import type { SupportedLang } from '@/lib/i18n/types'

const LANGS = new Set(['ko', 'en', 'ja'])

/** The site's skill (frame, coins, power, text) for a game skill id of the motion list. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const id = Number(query.get('id'))
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const asked = query.get('lang') ?? 'ko'
  const lang = (LANGS.has(asked) ? asked : 'ko') as SupportedLang
  try {
    const skill = await loadMotionSkill(id, lang)
    if (!skill) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
    return NextResponse.json({ skill }, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch (error) {
    console.error('[motion/skill]', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
