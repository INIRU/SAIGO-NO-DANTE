import { NextResponse } from 'next/server'
import { getKeywordData } from '@/lib/keywords/server-data'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'

/** Korean description, max stack and effect type per keyword: the catalogue's (descriptions from game_text_refs when the keyword has a game_id). */
export async function GET() {
  try {
    const keywords = await getKeywordData()
    const data = Object.entries(keywords)
      .map(([name, info]) => ({
        name,
        description: info.desc || null,
        max_stack: info.maxStack ?? null,
        effect_type: info.effectType ?? null,
      }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    return NextResponse.json(data, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch (err: unknown) {
    console.error('[api/keyword-meta]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
