import { NextResponse } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'
import { getEGOById, getSinnerById } from '@/lib/db/queries'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { CATALOG_CACHE_CONTROL } from '@/lib/constants/http-cache'

/** E.G.O info window data: the same record and sinner the E.G.O page shows, cached until a game data sync invalidates it; null when the E.G.O does not exist. */
async function getEgoDetail(id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.ego, CACHE_TAGS.egoEntry(id), CACHE_TAGS.gameData)

  // Both reads throw on a failed query, so a partial answer is never cached.
  const ego = await getEGOById(id)
  if (!ego) return null
  const sinner = await getSinnerById(ego.sinner_id)
  if (!sinner) return null
  return { ego, sinner }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid EGO ID' }, { status: 400 })
    }
    const detail = await getEgoDetail(id)
    if (!detail) return NextResponse.json({ error: 'EGO not found' }, { status: 404 })
    return NextResponse.json(detail, { headers: { 'Cache-Control': CATALOG_CACHE_CONTROL } })
  } catch (err: unknown) {
    console.error('[api/ego/[id]]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
